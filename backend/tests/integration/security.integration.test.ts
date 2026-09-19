/*
 * SPDX-License-Identifier: Apache-2.0
 */

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { gatewayManager } from '../../src/fabric/gatewayManager.js';
import { calculateCredentialCommitment } from '../../src/storage/encryption.js';

describe('Milestone 9 Phase 3 — Live Fabric Security Integration Test Suite', () => {
    const app = createApp();

    beforeAll(async () => {
        // Ensure gateways are initialized
        await gatewayManager.initialize();
    });

    afterAll(async () => {
        await gatewayManager.closeAll();
    });

    describe('Live Cross-Organization Gateway Isolation', () => {
        it('BankMSP attempting to issue Academic credential returns 403', async () => {
            const res = await request(app)
                .post('/api/v1/credentials/academic')
                .set('X-API-Key', env.API_KEY_BANK)
                .send({
                    credentialId: `cred:sec:cross:${Date.now()}`,
                    subjectDID: 'did:example:student1',
                    issuerDID: 'did:example:bank',
                    credentialCommitment: 'a'.repeat(64),
                    expiresAt: '2030-01-01T00:00:00.000Z'
                });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('UNAUTHORIZED_OPERATION');
            expect(res.body.message).toContain('restricted to [UniversityMSP]');
        });

        it('UniversityMSP attempting to register civil identity returns 403', async () => {
            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_UNI)
                .send({
                    did: `did:example:uni-spoof:${Date.now()}`,
                    identityCommitment: 'b'.repeat(64)
                });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('External Verifier attempting to issue KYC credential returns 403', async () => {
            const res = await request(app)
                .post('/api/v1/credentials/kyc')
                .set('X-API-Key', env.API_KEY_VERIFIER)
                .send({
                    credentialId: `cred:sec:verifier:${Date.now()}`,
                    subjectDID: 'did:example:subject',
                    issuerDID: 'did:example:verifier',
                    credentialCommitment: 'c'.repeat(64),
                    expiresAt: '2030-01-01T00:00:00.000Z'
                });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('External Verifier attempting to register civil identity returns 403', async () => {
            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_VERIFIER)
                .send({
                    did: `did:example:verifier-spoof:${Date.now()}`,
                    identityCommitment: 'd'.repeat(64)
                });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });
    });

    describe('Live Storage Metadata and Retrieval Privilege Isolation', () => {
        const testCredId = `cred:sec:gov:${Date.now()}`;
        const testSubject = `did:example:subject:${Date.now()}`;
        const payload = { fullName: 'Civil Citizen', clearanceLevel: 'Confidential' };
        const commitment = calculateCredentialCommitment(payload);

        beforeAll(async () => {
            // 1. Issue a valid GovMSP credential on ledger
            const issueRes = await request(app)
                .post('/api/v1/credentials/government-id')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({
                    credentialId: testCredId,
                    subjectDID: testSubject,
                    issuerDID: 'did:gov:identity-authority',
                    credentialCommitment: commitment,
                    expiresAt: '2030-01-01T00:00:00.000Z'
                });
            expect(issueRes.status).toBe(201);

            // 2. Store payload off-chain
            const storeRes = await request(app)
                .post(`/api/v1/credentials/${testCredId}/storage`)
                .set('X-API-Key', env.API_KEY_GOV)
                .send(payload);
            expect(storeRes.status).toBe(201);
        });

        it('AUTH-13: BankMSP reading GovMSP storage metadata returns 403', async () => {
            const res = await request(app)
                .get(`/api/v1/credentials/${testCredId}/storage`)
                .set('X-API-Key', env.API_KEY_BANK);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
            expect(res.body.message).toContain('Storage metadata access restricted to issuing organization');
        });

        it('AUTH-13 (Verifier): Verifier reading GovMSP storage metadata returns 403', async () => {
            const res = await request(app)
                .get(`/api/v1/credentials/${testCredId}/storage`)
                .set('X-API-Key', env.API_KEY_VERIFIER);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('Authorized issuer (GovMSP) reading storage metadata succeeds with 200', async () => {
            const res = await request(app)
                .get(`/api/v1/credentials/${testCredId}/storage`)
                .set('X-API-Key', env.API_KEY_GOV);
            expect(res.status).toBe(200);
            expect(res.body.data.credentialId).toBe(testCredId);
            expect(res.body.data.keyId).toBeDefined();
            expect(res.body.data.iv).toBeDefined();
            expect(res.body.data.authTag).toBeDefined();
            // Confirm zero plaintext leaked in metadata
            expect(res.body.data.fullName).toBeUndefined();
        });

        it('AUTH-14: Verifier requesting plaintext retrieval returns 403', async () => {
            const res = await request(app)
                .post(`/api/v1/credentials/${testCredId}/retrieve`)
                .set('X-API-Key', env.API_KEY_VERIFIER);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
            expect(res.body.message).toContain('Verifiers must use cryptographic verification');
        });

        it('Authorized issuer requesting plaintext retrieval succeeds with 200', async () => {
            const res = await request(app)
                .post(`/api/v1/credentials/${testCredId}/retrieve`)
                .set('X-API-Key', env.API_KEY_GOV);
            expect(res.status).toBe(200);
            expect(res.body.payload.fullName).toBe('Civil Citizen');
        });
    });
});
