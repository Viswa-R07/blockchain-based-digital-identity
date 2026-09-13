/*
 * SPDX-License-Identifier: Apache-2.0
 */

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { gatewayManager } from '../../src/fabric/gatewayManager.js';
import { calculateCredentialCommitment } from '../../src/storage/encryption.js';

describe('Milestone 8 Live Fabric Off-Chain Storage Integration Test Suite', () => {
    const app = createApp();
    const runId = Date.now();

    // Test Identity and Credential IDs
    const citizenDid = `did:example:citizen_m8_${runId}`;
    const idCommitment = '7777777777777777777777777777777777777777777777777777777777777777';

    const credId = `cred:m8:gov:${runId}`;
    const issuerDid = 'did:example:gov_authority';
    const expiresAt = '2036-12-31T23:59:59.000Z';

    // The off-chain credential claims payload
    const rawCredentialPayload = {
        credentialId: credId,
        subjectDID: citizenDid,
        issuerDID: issuerDid,
        credentialType: 'GovernmentIdCredential',
        claims: {
            nationalRegistryNumber: `NRN-${runId}`,
            citizenshipStatus: 'CITIZEN',
            jurisdictionCode: 'IND-DL'
        },
        expiresAt
    };

    // Deterministic canonical commitment computed over off-chain payload
    const computedCommitment = calculateCredentialCommitment(rawCredentialPayload);

    beforeAll(async () => {
        await gatewayManager.initialize();
    }, 60000);

    afterAll(async () => {
        await gatewayManager.closeAll();
    });

    it('Step 1: Register identity on Hyperledger Fabric ledger', async () => {
        const res = await request(app)
            .post('/api/v1/identities')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                did: citizenDid,
                identityCommitment: idCommitment
            });

        expect(res.status).toBe(201);
        expect(res.body.data.did).toBe(citizenDid);
    });

    it('Step 2: Issue credential on Fabric ledger using computed canonical commitment', async () => {
        const res = await request(app)
            .post('/api/v1/credentials/government-id')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                credentialId: credId,
                subjectDID: citizenDid,
                issuerDID: issuerDid,
                credentialCommitment: computedCommitment,
                expiresAt
            });

        expect(res.status).toBe(201);
        expect(res.body.data.credentialId).toBe(credId);
        expect(res.body.data.credentialCommitment).toBe(computedCommitment);
        expect(res.body.data.status).toBe('ACTIVE');
    });

    it('Step 3: Confirm Fabric ledger commitment matches computed off-chain commitment', async () => {
        const res = await request(app)
            .get(`/api/v1/credentials/${encodeURIComponent(credId)}`)
            .set('X-API-Key', env.API_KEY_GOV);

        expect(res.status).toBe(200);
        expect(res.body.data.credentialCommitment).toBe(computedCommitment);
        expect(res.body.data.issuerOrg).toBe('GovMSP');
    });

    it('Step 4: Store encrypted credential payload off-chain (authorized GovMSP)', async () => {
        const res = await request(app)
            .post(`/api/v1/credentials/${encodeURIComponent(credId)}/storage`)
            .set('X-API-Key', env.API_KEY_GOV)
            .send(rawCredentialPayload);

        expect(res.status).toBe(201);
        expect(res.body.data.credentialId).toBe(credId);
        expect(res.body.data.credentialCommitment).toBe(computedCommitment);
        expect(res.body.data.encryptionAlgorithm).toBe('AES-256-GCM');
        expect(res.body.data.stored).toBe(true);
    });

    it('Step 5: Retrieve storage metadata and verify no plaintext claims are leaked', async () => {
        const res = await request(app)
            .get(`/api/v1/credentials/${encodeURIComponent(credId)}/storage`)
            .set('X-API-Key', env.API_KEY_GOV);

        expect(res.status).toBe(200);
        expect(res.body.data.credentialId).toBe(credId);
        expect(res.body.data.encryptionAlgorithm).toBe('AES-256-GCM');
        expect(res.body.data.iv).toBeDefined();
        expect(res.body.data.authTag).toBeDefined();
        // Plaintext claims must NOT be present in metadata response
        expect(res.body.data.claims).toBeUndefined();
        expect(res.body.data.payload).toBeUndefined();
    });

    it('Step 6: Authorized plaintext retrieval and decryption by issuing organization', async () => {
        const res = await request(app)
            .post(`/api/v1/credentials/${encodeURIComponent(credId)}/retrieve`)
            .set('X-API-Key', env.API_KEY_GOV);

        expect(res.status).toBe(200);
        expect(res.body.credentialId).toBe(credId);
        expect(res.body.status).toBe('ACTIVE');
        expect(res.body.payload).toEqual(rawCredentialPayload);
    });

    it('Step 7: Verify off-chain storage integrity matches Fabric commitment (VALID)', async () => {
        const res = await request(app)
            .post(`/api/v1/credentials/${encodeURIComponent(credId)}/verify-storage`)
            .set('X-API-Key', env.API_KEY_VERIFIER);

        expect(res.status).toBe(200);
        expect(res.body.valid).toBe(true);
        expect(res.body.reason).toBe('VALID');
        expect(res.body.credentialId).toBe(credId);
        expect(res.body.status).toBe('ACTIVE');
    });

    it('Step 8: Deny plaintext retrieval to public verifier without plaintext privilege', async () => {
        const res = await request(app)
            .post(`/api/v1/credentials/${encodeURIComponent(credId)}/retrieve`)
            .set('X-API-Key', env.API_KEY_VERIFIER);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FORBIDDEN');
    });

    it('Step 9: Deny off-chain storage operation to unauthorized organization (BankMSP)', async () => {
        const res = await request(app)
            .post(`/api/v1/credentials/${encodeURIComponent(credId)}/storage`)
            .set('X-API-Key', env.API_KEY_BANK)
            .send(rawCredentialPayload);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FORBIDDEN');
    });

    it('Step 10: Revoke credential on Hyperledger Fabric ledger', async () => {
        const res = await request(app)
            .post(`/api/v1/credentials/${encodeURIComponent(credId)}/revoke`)
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                reason: 'SUPERSEDED'
            });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('REVOKED');
    });

    it('Step 11: Confirm plaintext retrieval is strictly DENIED for REVOKED credential', async () => {
        const res = await request(app)
            .post(`/api/v1/credentials/${encodeURIComponent(credId)}/retrieve`)
            .set('X-API-Key', env.API_KEY_GOV);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('CREDENTIAL_REVOKED');
    });

    it('Step 12: Confirm verify-storage reports CREDENTIAL_REVOKED', async () => {
        const res = await request(app)
            .post(`/api/v1/credentials/${encodeURIComponent(credId)}/verify-storage`)
            .set('X-API-Key', env.API_KEY_VERIFIER);

        expect(res.status).toBe(200);
        expect(res.body.valid).toBe(false);
        expect(res.body.reason).toBe('CREDENTIAL_REVOKED');
        expect(res.body.status).toBe('REVOKED');
    });

    it('Step 13: Delete off-chain encrypted credential payload (GDPR erasure model)', async () => {
        const res = await request(app)
            .delete(`/api/v1/credentials/${encodeURIComponent(credId)}/storage`)
            .set('X-API-Key', env.API_KEY_GOV);

        expect(res.status).toBe(200);
        expect(res.body.ledgerIntact).toBe(true);
        expect(res.body.credentialId).toBe(credId);
    });

    it('Step 14: Confirm off-chain storage record is gone', async () => {
        const res = await request(app)
            .get(`/api/v1/credentials/${encodeURIComponent(credId)}/storage`)
            .set('X-API-Key', env.API_KEY_GOV);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('STORAGE_NOT_FOUND');
    });

    it('Step 15: Confirm Fabric ledger record STILL EXISTS after off-chain deletion', async () => {
        const res = await request(app)
            .get(`/api/v1/credentials/${encodeURIComponent(credId)}`)
            .set('X-API-Key', env.API_KEY_GOV);

        expect(res.status).toBe(200);
        expect(res.body.data.credentialId).toBe(credId);
        expect(res.body.data.status).toBe('REVOKED');
        expect(res.body.data.credentialCommitment).toBe(computedCommitment);
    });

    it('Step 16: Confirm Fabric transaction history remains completely intact', async () => {
        const res = await request(app)
            .get(`/api/v1/credentials/${encodeURIComponent(credId)}/history`)
            .set('X-API-Key', env.API_KEY_GOV);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(2); // Issued + Revoked
    });
});
