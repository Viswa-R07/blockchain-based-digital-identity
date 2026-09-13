/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
    buildStorageAAD,
    calculateCredentialCommitment,
    canonicalizeJson,
    decryptPayload,
    encryptPayload
} from '../../src/storage/encryption.js';
import { EnvKeyProvider } from '../../src/storage/keyProvider.js';

describe('Milestone 8: Canonicalization & Encryption Unit Tests', () => {
    const validKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');

    describe('RFC 8785 / JCS Canonical Serialization', () => {
        it('should produce identical canonical output for objects with different key insertion orders', () => {
            const obj1 = { z: 1, a: 2, m: { y: 'test', b: 'nested' } };
            const obj2 = { a: 2, m: { b: 'nested', y: 'test' }, z: 1 };

            const canonical1 = canonicalizeJson(obj1);
            const canonical2 = canonicalizeJson(obj2);

            expect(canonical1).toBe(canonical2);
            expect(canonical1).toBe('{"a":2,"m":{"b":"nested","y":"test"},"z":1}');
        });

        it('should handle nested arrays while preserving original element order', () => {
            const data = {
                list: [3, 1, { b: 2, a: 1 }],
                name: 'array-test'
            };

            const canonical = canonicalizeJson(data);
            expect(canonical).toBe('{"list":[3,1,{"a":1,"b":2}],"name":"array-test"}');
        });

        it('should accurately canonicalize scalar primitives (string, number, boolean, null)', () => {
            expect(canonicalizeJson('hello world')).toBe('"hello world"');
            expect(canonicalizeJson(123.45)).toBe('123.45');
            expect(canonicalizeJson(true)).toBe('true');
            expect(canonicalizeJson(false)).toBe('false');
            expect(canonicalizeJson(null)).toBe('null');
        });

        it('should correctly format Unicode characters in deterministic canonical output', () => {
            const unicodeObj = {
                city: 'München',
                country: '日本',
                currency: '€'
            };

            const canonical = canonicalizeJson(unicodeObj);
            expect(canonical).toBe('{"city":"München","country":"日本","currency":"€"}');
        });

        it('should compute identical SHA-256 commitment regardless of input key ordering', () => {
            const payloadA = {
                credentialType: 'KYCCredential',
                subjectDID: 'did:gov:citizen01',
                details: { riskLevel: 'LOW', tier: 1 }
            };

            const payloadB = {
                details: { tier: 1, riskLevel: 'LOW' },
                credentialType: 'KYCCredential',
                subjectDID: 'did:gov:citizen01'
            };

            const commitmentA = calculateCredentialCommitment(payloadA);
            const commitmentB = calculateCredentialCommitment(payloadB);

            expect(commitmentA).toHaveLength(64);
            expect(commitmentA).toMatch(/^[a-f0-9]{64}$/);
            expect(commitmentA).toBe(commitmentB);
        });
    });

    describe('AES-256-GCM Authenticated Encryption & Decryption', () => {
        it('should successfully encrypt and decrypt a plaintext object with AAD', () => {
            const payload = {
                subjectDID: 'did:gov:citizen01',
                credentialType: 'AcademicDegreeCredential',
                degree: 'Bachelor of Science',
                gpa: 3.9
            };

            const aad = buildStorageAAD('cred-001', 'a'.repeat(64), 1);
            const encrypted = encryptPayload(payload, validKey, aad);

            expect(encrypted.ciphertext).toBeDefined();
            expect(encrypted.iv).toHaveLength(24); // 12 bytes = 24 hex chars
            expect(encrypted.authTag).toHaveLength(32); // 16 bytes = 32 hex chars

            const decryptedJson = decryptPayload(encrypted, validKey, aad);
            const parsed = JSON.parse(decryptedJson);

            expect(parsed).toEqual(payload);
        });

        it('should fail decryption if wrong encryption key is supplied', () => {
            const payload = { secret: 'confidential' };
            const encrypted = encryptPayload(payload, validKey);

            const wrongKey = Buffer.from('fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210', 'hex');

            expect(() => {
                decryptPayload(encrypted, wrongKey);
            }).toThrow();
        });

        it('should fail authentication if ciphertext is tampered with', () => {
            const payload = { claims: 'tamper-test' };
            const encrypted = encryptPayload(payload, validKey);

            // Flip first hex character of ciphertext
            const tamperedHex = (encrypted.ciphertext[0] === 'a' ? 'b' : 'a') + encrypted.ciphertext.slice(1);
            const tamperedData = { ...encrypted, ciphertext: tamperedHex };

            expect(() => {
                decryptPayload(tamperedData, validKey);
            }).toThrow();
        });

        it('should fail authentication if authentication tag is tampered with', () => {
            const payload = { claims: 'tag-test' };
            const encrypted = encryptPayload(payload, validKey);

            const tamperedTag = (encrypted.authTag[0] === '0' ? '1' : '0') + encrypted.authTag.slice(1);
            const tamperedData = { ...encrypted, authTag: tamperedTag };

            expect(() => {
                decryptPayload(tamperedData, validKey);
            }).toThrow();
        });

        it('should fail authentication if IV is tampered with', () => {
            const payload = { claims: 'iv-test' };
            const encrypted = encryptPayload(payload, validKey);

            const tamperedIv = (encrypted.iv[0] === '0' ? '1' : '0') + encrypted.iv.slice(1);
            const tamperedData = { ...encrypted, iv: tamperedIv };

            expect(() => {
                decryptPayload(tamperedData, validKey);
            }).toThrow();
        });

        it('should fail authentication if AAD metadata is modified', () => {
            const payload = { claims: 'aad-test' };
            const validAad = buildStorageAAD('cred-100', 'b'.repeat(64), 1);
            const encrypted = encryptPayload(payload, validKey, validAad);

            const modifiedAad = buildStorageAAD('cred-100', 'c'.repeat(64), 1);

            expect(() => {
                decryptPayload(encrypted, validKey, modifiedAad);
            }).toThrow();
        });

        it('should independently generate fresh random IVs for repeated encryptions (no IV reuse)', () => {
            const payload = { same: 'data' };
            const ivSet = new Set<string>();

            for (let i = 0; i < 50; i++) {
                const encrypted = encryptPayload(payload, validKey);
                expect(ivSet.has(encrypted.iv)).toBe(false);
                ivSet.add(encrypted.iv);
            }

            expect(ivSet.size).toBe(50);
        });

        it('should reject keys with invalid lengths at encryption and decryption', () => {
            const shortKey = Buffer.from('0123456789abcdef', 'hex'); // 8 bytes

            expect(() => {
                encryptPayload({ test: 1 }, shortKey);
            }).toThrow(/AES-256 requires a 32-byte key/);

            expect(() => {
                decryptPayload({ ciphertext: 'aa', iv: '0'.repeat(24), authTag: '0'.repeat(32) }, shortKey);
            }).toThrow(/AES-256 requires a 32-byte key/);
        });
    });

    describe('KeyProvider & EnvKeyProvider', () => {
        it('should properly load and validate 32-byte master key from hex string', async () => {
            const hexKey = 'a'.repeat(64);
            const provider = new EnvKeyProvider(hexKey, 'test-key-id');

            const result = await provider.getKey('test-key-id');
            expect(result.keyId).toBe('test-key-id');
            expect(result.key).toHaveLength(32);
        });

        it('should reject master key if decoded byte length is not 32 bytes', () => {
            const invalidKey = 'a'.repeat(32); // 16 bytes in hex

            expect(() => {
                new EnvKeyProvider(invalidKey);
            }).toThrow(/expected 32 bytes/);
        });
    });
});
