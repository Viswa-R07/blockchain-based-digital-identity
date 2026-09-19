/*
 * SPDX-License-Identifier: Apache-2.0
 */

import * as crypto from 'crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { env, validateEnvironment } from '../../src/config/env.js';
import { gatewayManager } from '../../src/fabric/gatewayManager.js';
import { safeCompareSecret } from '../../src/middleware/auth.middleware.js';
import { MemoryRateLimiter, resetAllRateLimits } from '../../src/middleware/rateLimit.middleware.js';
import { EncryptedFileStorage } from '../../src/storage/encryptedFileStorage.js';
import {
    buildStorageAAD,
    calculateCredentialCommitment,
    decryptPayload,
    encryptPayload,
    validateHex
} from '../../src/storage/encryption.js';

// Mock GatewayManager and Contract for controller-level authorization checks
const mockContract = {
    evaluateTransaction: vi.fn(),
    submitTransaction: vi.fn()
};

vi.mock('../../src/fabric/gatewayManager.js', () => ({
    gatewayManager: {
        getContract: vi.fn(() => mockContract),
        getDefaultContract: vi.fn(() => mockContract),
        checkHealth: vi.fn(async () => ({ status: 'UP', orgs: {} })),
        initialize: vi.fn(),
        closeAll: vi.fn()
    }
}));

describe('Milestone 9 Phase 3 — Security Hardening Test Suite', () => {
    const app = createApp();

    beforeEach(() => {
        vi.clearAllMocks();
        resetAllRateLimits();
    });

    describe('AUTHENTICATION & AUTHORIZATION (AUTH-01 .. AUTH-17)', () => {
        it('AUTH-01: Missing API key -> 401', async () => {
            const res = await request(app).post('/api/v1/identities').send({
                did: 'did:example:test',
                identityCommitment: 'a'.repeat(64)
            });
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('UNAUTHORIZED');
        });

        it('AUTH-02: Invalid API key -> 401', async () => {
            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', 'malicious-attacker-key-999')
                .send({
                    did: 'did:example:test',
                    identityCommitment: 'a'.repeat(64)
                });
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('INVALID_CREDENTIALS');
        });

        it('AUTH-03: Verifier -> identity registration -> 403', async () => {
            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_VERIFIER)
                .send({
                    did: 'did:example:test',
                    identityCommitment: 'a'.repeat(64)
                });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('AUTH-04: Bank -> identity registration -> 403', async () => {
            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_BANK)
                .send({
                    did: 'did:example:test',
                    identityCommitment: 'a'.repeat(64)
                });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('AUTH-05: Employer -> identity registration -> 403', async () => {
            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_EMP)
                .send({
                    did: 'did:example:test',
                    identityCommitment: 'a'.repeat(64)
                });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('AUTH-06: University -> identity registration -> 403', async () => {
            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_UNI)
                .send({
                    did: 'did:example:test',
                    identityCommitment: 'a'.repeat(64)
                });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('AUTH-07: Verifier -> government credential issuance -> 403', async () => {
            const res = await request(app)
                .post('/api/v1/credentials/government-id')
                .set('X-API-Key', env.API_KEY_VERIFIER)
                .send({
                    credentialId: 'cred:gov:999',
                    subjectDID: 'did:example:subject',
                    issuerDID: 'did:example:gov',
                    credentialCommitment: 'a'.repeat(64),
                    expiresAt: '2030-01-01T00:00:00.000Z'
                });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('AUTH-08: Verifier -> government credential revocation -> 403', async () => {
            const res = await request(app)
                .post('/api/v1/credentials/cred:gov:1/revoke')
                .set('X-API-Key', env.API_KEY_VERIFIER)
                .send({ reason: 'KEY_COMPROMISE' });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('AUTH-09: Verifier -> suspension -> 403', async () => {
            const res = await request(app)
                .post('/api/v1/credentials/cred:gov:1/suspend')
                .set('X-API-Key', env.API_KEY_VERIFIER)
                .send({ reason: 'PRIVILEGE_WITHDRAWN' });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('AUTH-10: Verifier -> reinstatement -> 403', async () => {
            const res = await request(app)
                .post('/api/v1/credentials/cred:gov:1/reinstate')
                .set('X-API-Key', env.API_KEY_VERIFIER);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('AUTH-11: Verifier -> status mutation -> 403', async () => {
            const res = await request(app)
                .patch('/api/v1/credentials/cred:gov:1/status')
                .set('X-API-Key', env.API_KEY_VERIFIER)
                .send({ status: 'SUSPENDED' });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('AUTH-12: Spoofed X-Calling-Org -> ignored/rejected', async () => {
            // University API key attempting to claim GovMSP identity registration with spoofed header
            const res = await request(app)
                .post('/api/v1/identities')
                .set('X-API-Key', env.API_KEY_UNI)
                .set('X-Calling-Org', 'GovMSP')
                .set('X-Role', 'GOV_ADMIN')
                .send({
                    did: 'did:example:test',
                    identityCommitment: 'a'.repeat(64)
                });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('AUTH-13: Non-issuer storage metadata access -> 403', async () => {
            mockContract.evaluateTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({
                    credentialId: 'cred:gov:1',
                    issuerOrg: 'GovMSP',
                    credentialCommitment: 'c'.repeat(64),
                    status: 'ACTIVE'
                }))
            );

            // BankMSP attempting to read GovMSP storage metadata
            const res = await request(app)
                .get('/api/v1/credentials/cred:gov:1/storage')
                .set('X-API-Key', env.API_KEY_BANK);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('AUTH-14: Non-issuer plaintext retrieval -> 403', async () => {
            mockContract.evaluateTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({
                    credentialId: 'cred:gov:1',
                    issuerOrg: 'GovMSP',
                    credentialCommitment: 'c'.repeat(64),
                    status: 'ACTIVE',
                    expiresAt: '2030-01-01T00:00:00.000Z'
                }))
            );

            // Verifier attempting plaintext retrieval
            const res = await request(app)
                .post('/api/v1/credentials/cred:gov:1/retrieve')
                .set('X-API-Key', env.API_KEY_VERIFIER);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        it('AUTH-15: Production environment with default secret -> startup failure', () => {
            const badConfig = {
                ...env,
                NODE_ENV: 'production',
                API_KEY_GOV: 'gov-admin-secret-key-12345' // prototype default
            };
            expect(() => validateEnvironment(badConfig)).toThrow(
                'Production configuration error: API_KEY_GOV must not use prototype default value.'
            );
        });

        it('AUTH-16: Production environment with missing secret -> startup failure', () => {
            const badConfig = {
                ...env,
                NODE_ENV: 'production',
                API_KEY_GOV: '' // missing
            };
            expect(() => validateEnvironment(badConfig)).toThrow(
                'Production configuration error: API_KEY_GOV is not configured.'
            );
        });

        it('AUTH-17: Malformed API key lengths -> safe rejection', () => {
            // Constant-time comparator handles undefined, non-string, odd lengths safely
            expect(safeCompareSecret(undefined, 'secret')).toBe(false);
            expect(safeCompareSecret('', 'secret')).toBe(false);
            expect(safeCompareSecret('short', 'much-longer-secret-key-string')).toBe(false);
            expect(safeCompareSecret('valid-key-match-12345', 'valid-key-match-12345')).toBe(true);
        });
    });

    describe('API RATE LIMITING & SECURITY HEADERS (API-01, API-02)', () => {
        it('API-01: Rate limit exceeded -> 429', async () => {
            const localLimiter = new MemoryRateLimiter({
                name: 'test-limiter',
                windowMs: 60000,
                maxRequests: 3
            });
            const mw = localLimiter.middleware();

            const req = { ip: '192.168.1.100', socket: { remoteAddress: '192.168.1.100' } } as any;
            let finalStatus = 200;
            const res = {
                setHeader: vi.fn(),
                status: (code: number) => {
                    finalStatus = code;
                    return {
                        json: vi.fn()
                    };
                }
            } as any;
            const next = vi.fn();

            // First 3 requests succeed
            mw(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);
            mw(req, res, next);
            expect(next).toHaveBeenCalledTimes(2);
            mw(req, res, next);
            expect(next).toHaveBeenCalledTimes(3);

            // 4th request hits rate limit
            mw(req, res, next);
            expect(next).toHaveBeenCalledTimes(3); // Not called
            expect(finalStatus).toBe(429);
            expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
        });

        it('API-02: Security headers present', async () => {
            const res = await request(app).get('/');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
            expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
            expect(res.headers['content-security-policy']).toContain("default-src 'self'");
            expect(res.headers['x-xss-protection']).toBe('0');
            expect(res.headers['x-powered-by']).toBeUndefined();
        });
    });

    describe('STRICT CRYPTOGRAPHIC HEX VALIDATION (CRYPTO-01 .. CRYPTO-05)', () => {
        const key = crypto.randomBytes(32);

        it('CRYPTO-01: Invalid IV characters rejected', () => {
            expect(() => validateHex('zzzzzzzzzzzzzzzzzzzzzzzz', 'IV', 12)).toThrow(
                'contains non-hexadecimal characters'
            );
        });

        it('CRYPTO-02: Invalid authTag characters rejected', () => {
            expect(() => validateHex('qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq', 'authTag', 16)).toThrow(
                'contains non-hexadecimal characters'
            );
        });

        it('CRYPTO-03: Odd-length hex rejected', () => {
            expect(() => validateHex('abc', 'oddTest')).toThrow('odd-length hexadecimal string');
        });

        it('CRYPTO-04: Wrong IV length rejected', () => {
            expect(() => validateHex('1234', 'IV', 12)).toThrow(
                'Invalid IV length: expected 24 hex characters (12 bytes), got 4'
            );
        });

        it('CRYPTO-05: Wrong authTag length rejected', () => {
            expect(() => validateHex('1234', 'authTag', 16)).toThrow(
                'Invalid authTag length: expected 32 hex characters (16 bytes), got 4'
            );
        });
    });

    describe('STORAGE CRYPTOGRAPHIC TAMPER RESISTANCE (STORAGE-01 .. STORAGE-04)', () => {
        const key = crypto.randomBytes(32);
        const payload = { citizen: 'did:example:123', claim: 'Approved' };
        const credentialId = 'cred:tamper:001';
        const commitment = calculateCredentialCommitment(payload);
        const version = 1;
        const aad = buildStorageAAD(credentialId, commitment, version);

        it('STORAGE-01: Ciphertext tampering -> failure', () => {
            const encrypted = encryptPayload(payload, key, aad);
            // Flip last byte of ciphertext
            const tamperedCiphertext =
                encrypted.ciphertext.slice(0, -2) + (encrypted.ciphertext.slice(-2) === 'aa' ? 'bb' : 'aa');

            expect(() =>
                decryptPayload(
                    {
                        ciphertext: tamperedCiphertext,
                        iv: encrypted.iv,
                        authTag: encrypted.authTag
                    },
                    key,
                    aad
                )
            ).toThrow();
        });

        it('STORAGE-02: AAD tampering -> failure', () => {
            const encrypted = encryptPayload(payload, key, aad);
            const tamperedAAD = buildStorageAAD(credentialId, 'f'.repeat(64), version);

            expect(() => decryptPayload(encrypted, key, tamperedAAD)).toThrow();
        });

        it('STORAGE-03: Commitment mismatch -> failure', () => {
            const originalCommitment = calculateCredentialCommitment({ name: 'Alice' });
            const tamperedCommitment = calculateCredentialCommitment({ name: 'Bob' });

            expect(originalCommitment).not.toBe(tamperedCommitment);
        });

        it('STORAGE-04: Path traversal -> failure', () => {
            const storage = new EncryptedFileStorage('./storage/credentials');
            // Malicious traversal in credential ID
            const filePath = storage.getFilePath('../../../etc/passwd');
            // File path must be hashed and remain within directory, not escaping
            expect(filePath).not.toContain('/etc/passwd');
            expect(filePath).toContain('cred_');
        });
    });

    describe('ISSUER DID BINDING & MASQUERADE DEFENSE (ATK-ROUTE-04)', () => {
        it('ROUTE-04-A: Correct University issuerDID -> accepted (201)', async () => {
            mockContract.submitTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({ credentialId: 'cred:uni:1', status: 'ACTIVE' }))
            );

            const res = await request(app)
                .post('/api/v1/credentials/academic')
                .set('X-API-Key', env.API_KEY_UNI)
                .send({
                    credentialId: 'cred:uni:1',
                    subjectDID: 'did:example:student1',
                    issuerDID: 'did:example:university:registrar',
                    credentialCommitment: 'a'.repeat(64),
                    expiresAt: '2035-01-01T00:00:00.000Z'
                });

            expect(res.status).toBe(201);
            expect(mockContract.submitTransaction).toHaveBeenCalledWith(
                'IssueCredential',
                'cred:uni:1',
                'did:example:student1',
                'did:example:university:registrar',
                'AcademicDegreeCredential',
                'https://schema.org/v1/AcademicDegreeCredential.json',
                'a'.repeat(64),
                '2035-01-01T00:00:00.000Z'
            );
        });

        it('ROUTE-04-B: University authenticated + Bank issuerDID -> rejected (403, zero Gateway call)', async () => {
            const res = await request(app)
                .post('/api/v1/credentials/academic')
                .set('X-API-Key', env.API_KEY_UNI)
                .send({
                    credentialId: 'cred:uni:masquerade:1',
                    subjectDID: 'did:example:student1',
                    issuerDID: 'did:example:bank:compliance',
                    credentialCommitment: 'a'.repeat(64),
                    expiresAt: '2035-01-01T00:00:00.000Z'
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('UNAUTHORIZED_ISSUER_DID');
            expect(res.body.message).toContain("Issuer DID 'did:example:bank:compliance' is not authorized for organization 'UniversityMSP'");
            expect(mockContract.submitTransaction).not.toHaveBeenCalled();
        });

        it('ROUTE-04-C: Correct Government issuerDID -> accepted (201)', async () => {
            mockContract.submitTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({ credentialId: 'cred:gov:1', status: 'ACTIVE' }))
            );

            const res = await request(app)
                .post('/api/v1/credentials/government-id')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({
                    credentialId: 'cred:gov:1',
                    subjectDID: 'did:example:citizen1',
                    issuerDID: 'did:example:gov:authority',
                    credentialCommitment: 'b'.repeat(64),
                    expiresAt: '2035-01-01T00:00:00.000Z'
                });

            expect(res.status).toBe(201);
            expect(mockContract.submitTransaction).toHaveBeenCalled();
        });

        it('ROUTE-04-D: Government authenticated + University issuerDID -> rejected (403, zero Gateway call)', async () => {
            const res = await request(app)
                .post('/api/v1/credentials/government-id')
                .set('X-API-Key', env.API_KEY_GOV)
                .send({
                    credentialId: 'cred:gov:masquerade:1',
                    subjectDID: 'did:example:citizen1',
                    issuerDID: 'did:example:university:registrar',
                    credentialCommitment: 'b'.repeat(64),
                    expiresAt: '2035-01-01T00:00:00.000Z'
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('UNAUTHORIZED_ISSUER_DID');
            expect(mockContract.submitTransaction).not.toHaveBeenCalled();
        });

        it('ROUTE-04-E: Correct Bank issuerDID -> accepted (201)', async () => {
            mockContract.submitTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({ credentialId: 'cred:bank:1', status: 'ACTIVE' }))
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
            expect(mockContract.submitTransaction).toHaveBeenCalled();
        });

        it('ROUTE-04-F: Bank authenticated + Employer issuerDID -> rejected (403, zero Gateway call)', async () => {
            const res = await request(app)
                .post('/api/v1/credentials/kyc')
                .set('X-API-Key', env.API_KEY_BANK)
                .send({
                    credentialId: 'cred:bank:masquerade:1',
                    subjectDID: 'did:example:citizen1',
                    issuerDID: 'did:example:employer:hr',
                    credentialCommitment: 'c'.repeat(64),
                    expiresAt: '2035-01-01T00:00:00.000Z'
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('UNAUTHORIZED_ISSUER_DID');
            expect(mockContract.submitTransaction).not.toHaveBeenCalled();
        });

        it('ROUTE-04-G: Correct Employer issuerDID -> accepted (201)', async () => {
            mockContract.submitTransaction.mockResolvedValueOnce(
                Buffer.from(JSON.stringify({ credentialId: 'cred:emp:1', status: 'ACTIVE' }))
            );

            const res = await request(app)
                .post('/api/v1/credentials/employment')
                .set('X-API-Key', env.API_KEY_EMP)
                .send({
                    credentialId: 'cred:emp:1',
                    subjectDID: 'did:example:employee1',
                    issuerDID: 'did:example:employer:hr',
                    credentialCommitment: 'd'.repeat(64),
                    expiresAt: '2035-01-01T00:00:00.000Z'
                });

            expect(res.status).toBe(201);
            expect(mockContract.submitTransaction).toHaveBeenCalled();
        });

        it('ROUTE-04-H: Employer authenticated + Government issuerDID -> rejected (403, zero Gateway call)', async () => {
            const res = await request(app)
                .post('/api/v1/credentials/employment')
                .set('X-API-Key', env.API_KEY_EMP)
                .send({
                    credentialId: 'cred:emp:masquerade:1',
                    subjectDID: 'did:example:employee1',
                    issuerDID: 'did:example:gov:authority',
                    credentialCommitment: 'd'.repeat(64),
                    expiresAt: '2035-01-01T00:00:00.000Z'
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('UNAUTHORIZED_ISSUER_DID');
            expect(mockContract.submitTransaction).not.toHaveBeenCalled();
        });
    });
});
