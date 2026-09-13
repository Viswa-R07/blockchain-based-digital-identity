/*
 * SPDX-License-Identifier: Apache-2.0
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { gatewayManager } from '../../src/fabric/gatewayManager.js';

// Mock GatewayManager and Contract
const mockContract = {
    evaluateTransaction: vi.fn(),
    submitTransaction: vi.fn()
};

vi.mock('../../src/fabric/gatewayManager.js', () => ({
    gatewayManager: {
        getContract: vi.fn(() => mockContract),
        getDefaultContract: vi.fn(() => mockContract),
        checkHealth: vi.fn(async () => ({
            status: 'UP',
            orgs: {
                GovMSP: true,
                UniversityMSP: true,
                BankMSP: true,
                EmployerMSP: true
            }
        })),
        initialize: vi.fn(),
        closeAll: vi.fn()
    }
}));

describe('Digital Identity Backend Unit Tests', () => {
    const app = createApp();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('1. Authentication Middleware', () => {
        it('should reject requests with missing credentials with 401', async () => {
            const res = await request(app).get('/api/v1/identities/did:example:test');
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('UNAUTHORIZED');
        });

        it('should reject requests with invalid credentials with 401', async () => {
            const res = await request(app)
                .get('/api/v1/identities/did:example:test')
                .set('X-API-Key', 'invalid-key');
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('INVALID_CREDENTIALS');
        });

        it('should accept requests with valid API key in header', async () => {
            mockContract.evaluateTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({ did: 'did:example:test', status: 'ACTIVE' }))
            );

            const res = await request(app)
                .get('/api/v1/identities/did:example:test')
                .set('X-API-Key', env.API_KEY_GOV);
            expect(res.status).toBe(200);
            expect(res.body.data.did).toBe('did:example:test');
        });

        it('should accept requests with Bearer token', async () => {
            mockContract.evaluateTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({ did: 'did:example:test', status: 'ACTIVE' }))
            );

            const res = await request(app)
                .get('/api/v1/identities/did:example:test')
                .set('Authorization', `Bearer ${env.API_KEY_GOV}`);
            expect(res.status).toBe(200);
        });

        it('should ignore client-supplied X-Calling-Org header and use authenticated API key mapping', async () => {
            mockContract.submitTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({ credentialId: 'cred:1', status: 'ACTIVE' }))
            );

            // Caller provides University key but sends X-Calling-Org: GovMSP
            const res = await request(app)
                .post('/api/v1/credentials/academic')
                .set('X-API-Key', env.API_KEY_UNI)
                .set('X-Calling-Org', 'GovMSP')
                .send({
                    credentialId: 'cred:academic:101',
                    subjectDID: 'did:example:student1',
                    issuerDID: 'did:example:university1',
                    credentialCommitment: 'a'.repeat(64),
                    expiresAt: '2035-01-01T00:00:00.000Z'
                });

            expect(res.status).toBe(201);
            // Verify that gatewayManager.getContract was called with 'UniversityMSP' (from key), NOT 'GovMSP'
            expect(gatewayManager.getContract).toHaveBeenCalledWith('UniversityMSP');
        });
    });

    describe('2. Request Validation Middleware & Zero Raw PII Gatekeeper', () => {
        it('should reject malformed DID with 400', async () => {
            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({
                    did: 'not-a-valid-did',
                    identityCommitment: 'a'.repeat(64)
                });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('INVALID_REQUEST_BODY');
        });

        it('should reject malformed commitment with 400', async () => {
            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({
                    did: 'did:example:citizen101',
                    identityCommitment: 'short-hash'
                });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('INVALID_REQUEST_BODY');
        });

        it('should reject raw PII fields (e.g. firstName) with 400 via Zero Raw PII Gatekeeper', async () => {
            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({
                    did: 'did:example:citizen101',
                    identityCommitment: 'a'.repeat(64),
                    firstName: 'Alice' // Prohibited raw PII
                });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('INVALID_REQUEST_PAYLOAD');
            expect(res.body.message).toContain('raw PII fields detected');
        });

        it('should reject invalid revocation reason with 400', async () => {
            const res = await request(app)
                .post('/api/v1/credentials/cred:test:1/revoke')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({
                    reason: 'ARBITRARY_CUSTOM_REASON'
                });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('INVALID_REQUEST_BODY');
        });
    });

    describe('3. Centralized Error Handler Mapping', () => {
        it('should map NOT_FOUND error to 404', async () => {
            mockContract.evaluateTransaction.mockRejectedValueOnce(
                new Error('[IDENTITY_NOT_FOUND] Identity did:example:unknown does not exist')
            );

            const res = await request(app)
                .get('/api/v1/identities/did:example:unknown')
                .set('X-API-Key', env.API_KEY_GOV);
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('NOT_FOUND');
        });

        it('should map DUPLICATE / ALREADY_EXISTS error to 409', async () => {
            mockContract.submitTransaction.mockRejectedValueOnce(
                new Error('[IDENTITY_ALREADY_EXISTS] Identity already registered')
            );

            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({
                    did: 'did:example:citizen101',
                    identityCommitment: 'a'.repeat(64)
                });
            expect(res.status).toBe(409);
            expect(res.body.error).toBe('RESOURCE_CONFLICT');
        });

        it('should map UNAUTHORIZED / UNAUTHORIZED_ISSUER_ORG error to 403', async () => {
            mockContract.submitTransaction.mockRejectedValueOnce(
                new Error('[UNAUTHORIZED] Caller organization "BankMSP" is not authorized')
            );

            const res = await request(app)
                .post('/api/v1/credentials/cred:gov:1/revoke')
                .set('X-API-Key', env.API_KEY_BANK)
                .send({
                    reason: 'KEY_COMPROMISE'
                });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('UNAUTHORIZED_OPERATION');
        });

        it('should map REVOCATION_IS_TERMINAL error to 422', async () => {
            mockContract.submitTransaction.mockRejectedValueOnce(
                new Error('[CREDENTIAL_REVOCATION_IS_TERMINAL] Cannot update status of a credential that is REVOKED')
            );

            const res = await request(app)
                .post('/api/v1/credentials/cred:gov:1/reinstate')
                .set('X-API-Key', env.API_KEY_GOV);
            expect(res.status).toBe(422);
            expect(res.body.error).toBe('TERMINAL_STATE_CONFLICT');
        });

        it('should map ENDORSEMENT_POLICY_FAILURE to 502', async () => {
            mockContract.submitTransaction.mockRejectedValueOnce(
                new Error('endorsement failure: endorsement policy failure during invoke')
            );

            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({
                    did: 'did:example:citizen101',
                    identityCommitment: 'a'.repeat(64)
                });
            expect(res.status).toBe(502);
            expect(res.body.error).toBe('ENDORSEMENT_POLICY_FAILURE');
        });
    });

    describe('4. Identity Controller', () => {
        it('POST /api/v1/identities should register identity and return 201', async () => {
            mockContract.submitTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({
                    did: 'did:example:citizen101',
                    identityCommitment: 'a'.repeat(64),
                    status: 'ACTIVE',
                    version: 1
                }))
            );

            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({
                    did: 'did:example:citizen101',
                    identityCommitment: 'a'.repeat(64)
                });
            expect(res.status).toBe(201);
            expect(res.body.data.did).toBe('did:example:citizen101');
            expect(mockContract.submitTransaction).toHaveBeenCalledWith(
                'RegisterIdentity',
                'did:example:citizen101',
                'a'.repeat(64)
            );
        });

        it('GET /api/v1/identities/:did/exists should return boolean existence', async () => {
            mockContract.evaluateTransaction.mockResolvedValueOnce(Buffer.from('true'));

            const res = await request(app)
                .get('/api/v1/identities/did:example:citizen101/exists')
                .set('X-API-Key', env.API_KEY_GOV);
            expect(res.status).toBe(200);
            expect(res.body.exists).toBe(true);
        });

        it('PATCH /api/v1/identities/:did/status should update status and return 200', async () => {
            mockContract.submitTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({
                    did: 'did:example:citizen101',
                    status: 'SUSPENDED',
                    version: 2
                }))
            );

            const res = await request(app)
                .patch('/api/v1/identities/did:example:citizen101/status')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({ status: 'SUSPENDED' });
            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('SUSPENDED');
        });

        it('GET /api/v1/identities/:did/history should return audit array', async () => {
            mockContract.evaluateTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify([{ txId: 'tx1', status: 'ACTIVE' }]))
            );

            const res = await request(app)
                .get('/api/v1/identities/did:example:citizen101/history')
                .set('X-API-Key', env.API_KEY_GOV);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('5. Credential Controller & Server-Controlled Issuer Routing', () => {
        it('POST /api/v1/credentials/government-id routes to GovMSP', async () => {
            mockContract.submitTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({ credentialId: 'cred:gov:1', credentialType: 'GovernmentIdCredential' }))
            );

            const res = await request(app)
                .post('/api/v1/credentials/government-id')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({
                    credentialId: 'cred:gov:1',
                    subjectDID: 'did:example:citizen1',
                    issuerDID: 'did:example:gov:auth',
                    credentialCommitment: 'b'.repeat(64),
                    expiresAt: '2035-01-01T00:00:00.000Z'
                });
            expect(res.status).toBe(201);
            expect(mockContract.submitTransaction).toHaveBeenCalledWith(
                'IssueCredential',
                'cred:gov:1',
                'did:example:citizen1',
                'did:example:gov:auth',
                'GovernmentIdCredential',
                'https://schema.org/v1/GovernmentIdCredential.json',
                'b'.repeat(64),
                '2035-01-01T00:00:00.000Z'
            );
        });

        it('POST /api/v1/credentials/kyc routes to BankMSP', async () => {
            mockContract.submitTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({ credentialId: 'cred:bank:1', credentialType: 'KYCCredential' }))
            );

            const res = await request(app)
                .post('/api/v1/credentials/kyc')
                .set('X-API-Key', env.API_KEY_BANK)
                .send({
                    credentialId: 'cred:bank:1',
                    subjectDID: 'did:example:citizen1',
                    issuerDID: 'did:example:bank:compliance',
                    credentialCommitment: 'c'.repeat(64),
                    expiresAt: '2035-01-01T00:00:00.000Z'
                });
            expect(res.status).toBe(201);
            expect(mockContract.submitTransaction).toHaveBeenCalledWith(
                'IssueCredential',
                'cred:bank:1',
                'did:example:citizen1',
                'did:example:bank:compliance',
                'KYCCredential',
                'https://schema.org/v1/KYCCredential.json',
                'c'.repeat(64),
                '2035-01-01T00:00:00.000Z'
            );
        });
    });

    describe('6. Lifecycle Controller', () => {
        it('POST /api/v1/credentials/:id/revoke should invoke RevokeCredential', async () => {
            mockContract.submitTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({ credentialId: 'cred:1', status: 'REVOKED' }))
            );

            const res = await request(app)
                .post('/api/v1/credentials/cred:gov:1/revoke')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({ reason: 'KEY_COMPROMISE' });
            expect(res.status).toBe(200);
            expect(mockContract.submitTransaction).toHaveBeenCalledWith(
                'RevokeCredential',
                'cred:gov:1',
                'KEY_COMPROMISE'
            );
        });

        it('POST /api/v1/credentials/:id/suspend should invoke SuspendCredential', async () => {
            mockContract.submitTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({ credentialId: 'cred:1', status: 'SUSPENDED' }))
            );

            const res = await request(app)
                .post('/api/v1/credentials/cred:gov:1/suspend')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({ reason: 'PRIVILEGE_WITHDRAWN' });
            expect(res.status).toBe(200);
            expect(mockContract.submitTransaction).toHaveBeenCalledWith(
                'SuspendCredential',
                'cred:gov:1',
                'PRIVILEGE_WITHDRAWN'
            );
        });

        it('POST /api/v1/credentials/:id/reinstate should invoke ReinstateCredential', async () => {
            mockContract.submitTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({ credentialId: 'cred:1', status: 'ACTIVE' }))
            );

            const res = await request(app)
                .post('/api/v1/credentials/cred:gov:1/reinstate')
                .set('X-API-Key', env.API_KEY_GOV);
            expect(res.status).toBe(200);
            expect(mockContract.submitTransaction).toHaveBeenCalledWith(
                'ReinstateCredential',
                'cred:gov:1'
            );
        });
    });

    describe('7. Verification Controller', () => {
        it('GET /api/v1/credentials/:id/status returns status and effectiveStatus', async () => {
            mockContract.evaluateTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({
                    credentialId: 'cred:gov:1',
                    status: 'ACTIVE',
                    effectiveStatus: 'ACTIVE'
                }))
            );

            const res = await request(app)
                .get('/api/v1/credentials/cred:gov:1/status')
                .set('X-API-Key', env.API_KEY_GOV);
            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('ACTIVE');
        });

        it('POST /api/v1/credentials/verify returns valid and reason', async () => {
            mockContract.evaluateTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({
                    valid: true,
                    reason: 'VALID',
                    verifiedAt: '2026-09-14T00:00:00.000Z'
                }))
            );

            const res = await request(app)
                .post('/api/v1/credentials/verify')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({
                    credentialId: 'cred:gov:1',
                    subjectDID: 'did:example:citizen1',
                    credentialCommitment: 'b'.repeat(64)
                });
            expect(res.status).toBe(200);
            expect(res.body.data.valid).toBe(true);
            expect(res.body.data.reason).toBe('VALID');
        });
    });

    describe('8. Health Controller', () => {
        it('GET /api/v1/health should return UP status without authentication', async () => {
            const res = await request(app).get('/api/v1/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('UP');
            expect(res.body.fabric.gateways.GovMSP).toBe(true);
        });

        it('GET /api/v1/health should return DEGRADED status when one gateway fails', async () => {
            vi.mocked(gatewayManager.checkHealth).mockResolvedValueOnce({
                status: 'DEGRADED',
                orgs: {
                    GovMSP: true,
                    UniversityMSP: true,
                    BankMSP: false,
                    EmployerMSP: true
                },
                details: {
                    GovMSP: { connected: true, endpoint: 'localhost:7051', peerHostOverride: 'peer0.gov.identity.example.com' },
                    UniversityMSP: { connected: true, endpoint: 'localhost:8051', peerHostOverride: 'peer0.university.example.com' },
                    BankMSP: { connected: false, endpoint: 'localhost:9051', peerHostOverride: 'peer0.bank.example.com', error: 'Connection failure' },
                    EmployerMSP: { connected: true, endpoint: 'localhost:10051', peerHostOverride: 'peer0.employer.example.com' }
                }
            });

            const res = await request(app).get('/api/v1/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('DEGRADED');
            expect(res.body.fabric.gateways.BankMSP).toBe(false);
            expect(res.body.fabric.gateways.GovMSP).toBe(true);
        });
    });
});
