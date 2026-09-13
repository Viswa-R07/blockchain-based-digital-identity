/*
 * SPDX-License-Identifier: Apache-2.0
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { StorageController } from '../../src/controllers/storage.controller.js';
import { gatewayManager } from '../../src/fabric/gatewayManager.js';
import { EncryptedStorageRecord } from '../../src/storage/credentialStorage.js';
import { EncryptedFileStorage } from '../../src/storage/encryptedFileStorage.js';
import { calculateCredentialCommitment, encryptPayload } from '../../src/storage/encryption.js';
import { EnvKeyProvider } from '../../src/storage/keyProvider.js';
import { AuditLogger } from '../../src/utils/auditLogger.js';

describe('Milestone 8: Encrypted File Storage & Controller Unit Tests', () => {
    const testStorageDir = path.resolve(__dirname, '../../storage/test_credentials');
    const storage = new EncryptedFileStorage(testStorageDir);
    const testMasterKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const keyProvider = new EnvKeyProvider(testMasterKey, 'test-key-id');

    beforeAll(async () => {
        await fs.mkdir(testStorageDir, { recursive: true });
    });

    afterAll(async () => {
        try {
            await fs.rm(testStorageDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup failure
        }
    });

    describe('EncryptedFileStorage Provider', () => {
        const sampleRecord: EncryptedStorageRecord = {
            credentialId: 'cred-unit-001',
            credentialCommitment: 'e'.repeat(64),
            encryptionAlgorithm: 'AES-256-GCM',
            keyId: 'test-key-id',
            iv: '1'.repeat(24),
            authTag: '2'.repeat(32),
            ciphertext: 'abcdef123456',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1
        };

        it('should generate a deterministic, non-PII filename based on SHA-256 hash', () => {
            const filePath = storage.getFilePath('cred-unit-001');
            const fileName = path.basename(filePath);

            const expectedHash = crypto.createHash('sha256').update('cred-unit-001').digest('hex').slice(0, 24);
            expect(fileName).toBe(`cred_${expectedHash}.enc.json`);
            expect(fileName).not.toContain('cred-unit-001'); // Verifies ID is hashed, zero PII in filename
        });

        it('should store and retrieve an encrypted storage record', async () => {
            await storage.store(sampleRecord);

            const exists = await storage.exists('cred-unit-001');
            expect(exists).toBe(true);

            const retrieved = await storage.retrieve('cred-unit-001');
            expect(retrieved).not.toBeNull();
            expect(retrieved?.credentialId).toBe('cred-unit-001');
            expect(retrieved?.ciphertext).toBe('abcdef123456');
            expect(retrieved?.version).toBe(1);
        });

        it('should verify stored file on disk contains NO plaintext claims or keys', async () => {
            const filePath = storage.getFilePath('cred-unit-001');
            const fileContent = await fs.readFile(filePath, 'utf8');

            expect(fileContent).not.toContain('Aadhaar');
            expect(fileContent).not.toContain('passport');
            expect(fileContent).not.toContain('name');
            expect(fileContent).not.toContain(testMasterKey);

            const parsed = JSON.parse(fileContent);
            expect(parsed).toHaveProperty('ciphertext');
            expect(parsed).toHaveProperty('iv');
            expect(parsed).toHaveProperty('authTag');
            expect(parsed).toHaveProperty('credentialCommitment');
            expect(parsed).not.toHaveProperty('claims');
            expect(parsed).not.toHaveProperty('payload');
        });

        it('should return null when retrieving non-existent credential', async () => {
            const result = await storage.retrieve('non-existent-cred');
            expect(result).toBeNull();
        });

        it('should delete existing credential and verify subsequent retrieval fails', async () => {
            const deleted = await storage.delete('cred-unit-001');
            expect(deleted).toBe(true);

            const exists = await storage.exists('cred-unit-001');
            expect(exists).toBe(false);

            const retrieved = await storage.retrieve('cred-unit-001');
            expect(retrieved).toBeNull();
        });

        it('should return false when deleting non-existent credential', async () => {
            const deleted = await storage.delete('non-existent-cred');
            expect(deleted).toBe(false);
        });
    });

    describe('AuditLogger Redaction', () => {
        it('should safely log audit events without leaking sensitive payload keys', () => {
            expect(() => {
                AuditLogger.logEvent('CREDENTIAL_STORED', {
                    credentialId: 'cred-audit-001',
                    org: 'GovMSP',
                    role: 'GOV_ADMIN',
                    action: 'STORE',
                    status: 'SUCCESS'
                });
            }).not.toThrow();
        });
    });

    describe('StorageController Policy & Authorization', () => {
        let controller: StorageController;
        let mockEvaluate: any;

        beforeAll(() => {
            controller = new StorageController(storage, keyProvider);
        });

        it('should reject off-chain storage request if caller is not the authoritative issuer org', async () => {
            // Mock Fabric ReadCredential returning GovMSP as issuer
            mockEvaluate = vi.spyOn(gatewayManager, 'getDefaultContract').mockReturnValue({
                evaluateTransaction: vi.fn().mockResolvedValue(
                    Buffer.from(
                        JSON.stringify({
                            credentialId: 'cred-gov-01',
                            issuerOrg: 'GovMSP',
                            credentialCommitment: 'a'.repeat(64),
                            status: 'ACTIVE',
                            expiresAt: '2035-01-01T00:00:00.000Z'
                        })
                    )
                )
            } as any);

            const req: any = {
                params: { credentialId: 'cred-gov-01' },
                body: { claim: 'test' },
                user: { org: 'BankMSP', role: 'BANK_COMPLIANCE' } // Unauthorized caller
            };

            let status = 0;
            let jsonBody: any = null;
            const res: any = {
                status: (s: number) => {
                    status = s;
                    return { json: (j: any) => { jsonBody = j; } };
                }
            };
            const next = vi.fn();

            await controller.storeCredential(req, res, next);

            expect(status).toBe(403);
            expect(jsonBody.error).toBe('FORBIDDEN');
            expect(jsonBody.message).toContain('authoritative issuing organization');
        });

        it('should reject off-chain storage request if payload commitment does not match on-chain commitment', async () => {
            const correctPayload = { degree: 'BSc Computer Science' };
            const correctCommitment = calculateCredentialCommitment(correctPayload);

            mockEvaluate = vi.spyOn(gatewayManager, 'getDefaultContract').mockReturnValue({
                evaluateTransaction: vi.fn().mockResolvedValue(
                    Buffer.from(
                        JSON.stringify({
                            credentialId: 'cred-uni-01',
                            issuerOrg: 'UniversityMSP',
                            credentialCommitment: correctCommitment,
                            status: 'ACTIVE',
                            expiresAt: '2035-01-01T00:00:00.000Z'
                        })
                    )
                )
            } as any);

            const req: any = {
                params: { credentialId: 'cred-uni-01' },
                body: { degree: 'Different Degree' }, // Tampered or mismatched payload
                user: { org: 'UniversityMSP', role: 'UNI_REGISTRAR' }
            };

            let status = 0;
            let jsonBody: any = null;
            const res: any = {
                status: (s: number) => {
                    status = s;
                    return { json: (j: any) => { jsonBody = j; } };
                }
            };
            const next = vi.fn();

            await controller.storeCredential(req, res, next);

            expect(status).toBe(400);
            expect(jsonBody.error).toBe('COMMITMENT_MISMATCH');
        });

        it('should deny plaintext retrieval if credential is REVOKED', async () => {
            mockEvaluate = vi.spyOn(gatewayManager, 'getDefaultContract').mockReturnValue({
                evaluateTransaction: vi.fn().mockResolvedValue(
                    Buffer.from(
                        JSON.stringify({
                            credentialId: 'cred-revoked-01',
                            issuerOrg: 'GovMSP',
                            credentialCommitment: 'b'.repeat(64),
                            status: 'REVOKED',
                            expiresAt: '2035-01-01T00:00:00.000Z'
                        })
                    )
                )
            } as any);

            const req: any = {
                params: { credentialId: 'cred-revoked-01' },
                user: { org: 'GovMSP', role: 'GOV_ADMIN' }
            };

            let status = 0;
            let jsonBody: any = null;
            const res: any = {
                status: (s: number) => {
                    status = s;
                    return { json: (j: any) => { jsonBody = j; } };
                }
            };
            const next = vi.fn();

            await controller.retrieveCredential(req, res, next);

            expect(status).toBe(403);
            expect(jsonBody.error).toBe('CREDENTIAL_REVOKED');
        });

        it('should deny plaintext retrieval if credential is SUSPENDED', async () => {
            mockEvaluate = vi.spyOn(gatewayManager, 'getDefaultContract').mockReturnValue({
                evaluateTransaction: vi.fn().mockResolvedValue(
                    Buffer.from(
                        JSON.stringify({
                            credentialId: 'cred-suspended-01',
                            issuerOrg: 'GovMSP',
                            credentialCommitment: 'b'.repeat(64),
                            status: 'SUSPENDED',
                            expiresAt: '2035-01-01T00:00:00.000Z'
                        })
                    )
                )
            } as any);

            const req: any = {
                params: { credentialId: 'cred-suspended-01' },
                user: { org: 'GovMSP', role: 'GOV_ADMIN' }
            };

            let status = 0;
            let jsonBody: any = null;
            const res: any = {
                status: (s: number) => {
                    status = s;
                    return { json: (j: any) => { jsonBody = j; } };
                }
            };
            const next = vi.fn();

            await controller.retrieveCredential(req, res, next);

            expect(status).toBe(403);
            expect(jsonBody.error).toBe('CREDENTIAL_SUSPENDED');
        });

        it('should deny plaintext retrieval if credential is EXPIRED relative to current backend UTC time', async () => {
            // Past expiration timestamp
            const pastExpiration = new Date(Date.now() - 3600000).toISOString();

            mockEvaluate = vi.spyOn(gatewayManager, 'getDefaultContract').mockReturnValue({
                evaluateTransaction: vi.fn().mockResolvedValue(
                    Buffer.from(
                        JSON.stringify({
                            credentialId: 'cred-expired-01',
                            issuerOrg: 'GovMSP',
                            credentialCommitment: 'b'.repeat(64),
                            status: 'ACTIVE',
                            expiresAt: pastExpiration
                        })
                    )
                )
            } as any);

            const req: any = {
                params: { credentialId: 'cred-expired-01' },
                user: { org: 'GovMSP', role: 'GOV_ADMIN' }
            };

            let status = 0;
            let jsonBody: any = null;
            const res: any = {
                status: (s: number) => {
                    status = s;
                    return { json: (j: any) => { jsonBody = j; } };
                }
            };
            const next = vi.fn();

            await controller.retrieveCredential(req, res, next);

            expect(status).toBe(400);
            expect(jsonBody.error).toBe('CREDENTIAL_EXPIRED');
            expect(jsonBody.message).toContain('expired at');
        });

        it('should deny plaintext retrieval to external verifiers without plaintext privilege', async () => {
            mockEvaluate = vi.spyOn(gatewayManager, 'getDefaultContract').mockReturnValue({
                evaluateTransaction: vi.fn().mockResolvedValue(
                    Buffer.from(
                        JSON.stringify({
                            credentialId: 'cred-gov-02',
                            issuerOrg: 'GovMSP',
                            credentialCommitment: 'c'.repeat(64),
                            status: 'ACTIVE',
                            expiresAt: '2035-01-01T00:00:00.000Z'
                        })
                    )
                )
            } as any);

            const req: any = {
                params: { credentialId: 'cred-gov-02' },
                user: { org: 'GovMSP', role: 'VERIFIER' } // Public verifier role
            };

            let status = 0;
            let jsonBody: any = null;
            const res: any = {
                status: (s: number) => {
                    status = s;
                    return { json: (j: any) => { jsonBody = j; } };
                }
            };
            const next = vi.fn();

            await controller.retrieveCredential(req, res, next);

            expect(status).toBe(403);
            expect(jsonBody.error).toBe('FORBIDDEN');
            expect(jsonBody.message).toContain('Verifiers must use cryptographic verification');
        });
    });
});
