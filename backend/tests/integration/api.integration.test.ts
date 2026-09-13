/*
 * SPDX-License-Identifier: Apache-2.0
 */

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { gatewayManager } from '../../src/fabric/gatewayManager.js';

describe('Milestone 7 Live Fabric Integration Test Suite', () => {
    const app = createApp();
    const runId = Date.now();

    // Unique IDs for deterministic test isolation
    const citizenDid = `did:example:citizen_m7_${runId}`;
    const identityCommitment = '1111111111111111111111111111111111111111111111111111111111111111';

    const govCredId = `cred:m7:gov:${runId}`;
    const uniCredId = `cred:m7:uni:${runId}`;
    const bankCredId = `cred:m7:bank:${runId}`;
    const empCredId = `cred:m7:emp:${runId}`;
    const expCredId = `cred:m7:exp:${runId}`;

    const govHash = '2222222222222222222222222222222222222222222222222222222222222222';
    const uniHash = '3333333333333333333333333333333333333333333333333333333333333333';
    const bankHash = '4444444444444444444444444444444444444444444444444444444444444444';
    const empHash = '5555555555555555555555555555555555555555555555555555555555555555';
    const expHash = '6666666666666666666666666666666666666666666666666666666666666666';

    const observedLatencies = {
        health: [] as number[],
        evaluate: [] as number[],
        submit: [] as number[]
    };

    beforeAll(async () => {
        // Initialize connections to all 4 peer gateways
        await gatewayManager.initialize();
    }, 60000);

    afterAll(async () => {
        await gatewayManager.closeAll();
        console.log('\n--- OBSERVED EXPERIMENTAL LATENCIES ---');
        const avg = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 'N/A';
        console.log(`Health-Check Latencies (ms): [${observedLatencies.health.join(', ')}] (Avg: ${avg(observedLatencies.health)} ms)`);
        console.log(`Evaluate/Read Latencies (ms): [${observedLatencies.evaluate.join(', ')}] (Avg: ${avg(observedLatencies.evaluate)} ms)`);
        console.log(`Submit/Write Latencies (ms): [${observedLatencies.submit.join(', ')}] (Avg: ${avg(observedLatencies.submit)} ms)`);
    });

    // 1. Health Check
    it('1. GET /api/v1/health should return 200 and all gateways UP with distinct endpoints', async () => {
        const start = Date.now();
        const res = await request(app).get('/api/v1/health');
        observedLatencies.health.push(Date.now() - start);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('UP');
        expect(res.body.fabric.gateways.GovMSP).toBe(true);
        expect(res.body.fabric.gateways.UniversityMSP).toBe(true);
        expect(res.body.fabric.gateways.BankMSP).toBe(true);
        expect(res.body.fabric.gateways.EmployerMSP).toBe(true);

        expect(res.body.fabric.topology.GovMSP.endpoint).toBe('localhost:7051');
        expect(res.body.fabric.topology.GovMSP.peerHostOverride).toBe('peer0.gov.identity.example.com');
        expect(res.body.fabric.topology.UniversityMSP.endpoint).toBe('localhost:8051');
        expect(res.body.fabric.topology.UniversityMSP.peerHostOverride).toBe('peer0.university.example.com');
        expect(res.body.fabric.topology.BankMSP.endpoint).toBe('localhost:9051');
        expect(res.body.fabric.topology.BankMSP.peerHostOverride).toBe('peer0.bank.example.com');
        expect(res.body.fabric.topology.EmployerMSP.endpoint).toBe('localhost:10051');
        expect(res.body.fabric.topology.EmployerMSP.peerHostOverride).toBe('peer0.employer.example.com');

        console.log('Runtime Health Topology:', JSON.stringify(res.body.fabric.topology, null, 2));
    });

    // 2. Register valid identity
    it('2. POST /api/v1/identities should register identity with GovMSP (201)', async () => {
        const start = Date.now();
        const res = await request(app)
            .post('/api/v1/identities')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                did: citizenDid,
                identityCommitment
            });
        observedLatencies.submit.push(Date.now() - start);

        expect(res.status).toBe(201);
        expect(res.body.data.did).toBe(citizenDid);
        expect(res.body.data.status).toBe('ACTIVE');
    });

    // 3. Register duplicate identity
    it('3. POST /api/v1/identities should reject duplicate identity with 409', async () => {
        const res = await request(app)
            .post('/api/v1/identities')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                did: citizenDid,
                identityCommitment
            });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('RESOURCE_CONFLICT');
    });

    // 4. Read identity
    it('4. GET /api/v1/identities/:did should read registered identity (200)', async () => {
        const start = Date.now();
        const res = await request(app)
            .get(`/api/v1/identities/${citizenDid}`)
            .set('X-API-Key', env.API_KEY_GOV);
        observedLatencies.evaluate.push(Date.now() - start);

        expect(res.status).toBe(200);
        expect(res.body.data.did).toBe(citizenDid);
        expect(res.body.data.identityCommitment).toBe(identityCommitment);
    });

    // 5. Identity exists
    it('5. GET /api/v1/identities/:did/exists should return true for registered identity', async () => {
        const res = await request(app)
            .get(`/api/v1/identities/${citizenDid}/exists`)
            .set('X-API-Key', env.API_KEY_GOV);

        expect(res.status).toBe(200);
        expect(res.body.exists).toBe(true);
    });

    // 6. Issue GovernmentIdCredential through GovMSP
    it('6. POST /api/v1/credentials/government-id issues GovernmentIdCredential (201)', async () => {
        const start = Date.now();
        const res = await request(app)
            .post('/api/v1/credentials/government-id')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                credentialId: govCredId,
                subjectDID: citizenDid,
                issuerDID: 'did:example:gov:authority',
                credentialCommitment: govHash,
                expiresAt: '2035-01-01T00:00:00.000Z'
            });
        observedLatencies.submit.push(Date.now() - start);

        expect(res.status).toBe(201);
        expect(res.body.data.credentialId).toBe(govCredId);
        expect(res.body.data.issuerOrg).toBe('GovMSP');
        expect(res.body.data.status).toBe('ACTIVE');
    });

    // 7. Issue AcademicDegreeCredential through UniversityMSP
    it('7. POST /api/v1/credentials/academic issues AcademicDegreeCredential (201)', async () => {
        const start = Date.now();
        const res = await request(app)
            .post('/api/v1/credentials/academic')
            .set('X-API-Key', env.API_KEY_UNI)
            .send({
                credentialId: uniCredId,
                subjectDID: citizenDid,
                issuerDID: 'did:example:university:registrar',
                credentialCommitment: uniHash,
                expiresAt: '2035-01-01T00:00:00.000Z'
            });
        observedLatencies.submit.push(Date.now() - start);

        expect(res.status).toBe(201);
        expect(res.body.data.credentialId).toBe(uniCredId);
        expect(res.body.data.issuerOrg).toBe('UniversityMSP');
    });

    // 8. Issue KYCCredential through BankMSP
    it('8. POST /api/v1/credentials/kyc issues KYCCredential (201)', async () => {
        const start = Date.now();
        const res = await request(app)
            .post('/api/v1/credentials/kyc')
            .set('X-API-Key', env.API_KEY_BANK)
            .send({
                credentialId: bankCredId,
                subjectDID: citizenDid,
                issuerDID: 'did:example:bank:compliance',
                credentialCommitment: bankHash,
                expiresAt: '2035-01-01T00:00:00.000Z'
            });
        observedLatencies.submit.push(Date.now() - start);

        expect(res.status).toBe(201);
        expect(res.body.data.credentialId).toBe(bankCredId);
        expect(res.body.data.issuerOrg).toBe('BankMSP');
    });

    // 9. Issue EmploymentCredential through EmployerMSP
    it('9. POST /api/v1/credentials/employment issues EmploymentCredential (201)', async () => {
        const start = Date.now();
        const res = await request(app)
            .post('/api/v1/credentials/employment')
            .set('X-API-Key', env.API_KEY_EMP)
            .send({
                credentialId: empCredId,
                subjectDID: citizenDid,
                issuerDID: 'did:example:employer:hr',
                credentialCommitment: empHash,
                expiresAt: '2035-01-01T00:00:00.000Z'
            });
        observedLatencies.submit.push(Date.now() - start);

        expect(res.status).toBe(201);
        expect(res.body.data.credentialId).toBe(empCredId);
        expect(res.body.data.issuerOrg).toBe('EmployerMSP');
    });

    // 10. Attempt GovernmentIdCredential issuance using BankMSP context (ABAC Negative)
    it('10. Attempt GovernmentIdCredential issuance using BankMSP context should be rejected with 403', async () => {
        const res = await request(app)
            .post('/api/v1/credentials/government-id')
            .set('X-API-Key', env.API_KEY_BANK) // Bank key calling Gov issuance endpoint
            .send({
                credentialId: `cred:gov:unauth:${runId}`,
                subjectDID: citizenDid,
                issuerDID: 'did:example:gov:auth',
                credentialCommitment: govHash,
                expiresAt: '2035-01-01T00:00:00.000Z'
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('UNAUTHORIZED_OPERATION');
    });

    // 11. Read credential
    it('11. GET /api/v1/credentials/:id should return full credential record (200)', async () => {
        const start = Date.now();
        const res = await request(app)
            .get(`/api/v1/credentials/${govCredId}`)
            .set('X-API-Key', env.API_KEY_GOV);
        observedLatencies.evaluate.push(Date.now() - start);

        expect(res.status).toBe(200);
        expect(res.body.data.credentialId).toBe(govCredId);
        expect(res.body.data.status).toBe('ACTIVE');
    });

    // 12. Credential exists
    it('12. GET /api/v1/credentials/:id/exists should return true for existing credential', async () => {
        const res = await request(app)
            .get(`/api/v1/credentials/${govCredId}/exists`)
            .set('X-API-Key', env.API_KEY_GOV);

        expect(res.status).toBe(200);
        expect(res.body.exists).toBe(true);
    });

    // 13. Verify valid credential
    it('13. POST /api/v1/credentials/verify should return valid=true, reason=VALID', async () => {
        const start = Date.now();
        const res = await request(app)
            .post('/api/v1/credentials/verify')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                credentialId: govCredId,
                subjectDID: citizenDid,
                credentialCommitment: govHash
            });
        observedLatencies.evaluate.push(Date.now() - start);

        expect(res.status).toBe(200);
        expect(res.body.data.valid).toBe(true);
        expect(res.body.data.reason).toBe('VALID');
    });

    // 14. Suspend credential
    it('14. POST /api/v1/credentials/:id/suspend should suspend credential (200)', async () => {
        const start = Date.now();
        const res = await request(app)
            .post(`/api/v1/credentials/${govCredId}/suspend`)
            .set('X-API-Key', env.API_KEY_GOV)
            .send({ reason: 'PRIVILEGE_WITHDRAWN' });
        observedLatencies.submit.push(Date.now() - start);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('SUSPENDED');
    });

    // 15. Verify suspended credential
    it('15. POST /api/v1/credentials/verify on suspended credential returns valid=false, reason=SUSPENDED', async () => {
        const res = await request(app)
            .post('/api/v1/credentials/verify')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                credentialId: govCredId,
                subjectDID: citizenDid,
                credentialCommitment: govHash
            });

        expect(res.status).toBe(200);
        expect(res.body.data.valid).toBe(false);
        expect(res.body.data.reason).toBe('SUSPENDED');
    });

    // 16. Reinstate credential
    it('16. POST /api/v1/credentials/:id/reinstate restores credential to ACTIVE (200)', async () => {
        const start = Date.now();
        const res = await request(app)
            .post(`/api/v1/credentials/${govCredId}/reinstate`)
            .set('X-API-Key', env.API_KEY_GOV);
        observedLatencies.submit.push(Date.now() - start);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('ACTIVE');
    });

    // 17. Verify reinstated credential
    it('17. POST /api/v1/credentials/verify on reinstated credential returns valid=true, reason=VALID', async () => {
        const res = await request(app)
            .post('/api/v1/credentials/verify')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                credentialId: govCredId,
                subjectDID: citizenDid,
                credentialCommitment: govHash
            });

        expect(res.status).toBe(200);
        expect(res.body.data.valid).toBe(true);
        expect(res.body.data.reason).toBe('VALID');
    });

    // 18. Revoke credential using KEY_COMPROMISE
    it('18. POST /api/v1/credentials/:id/revoke revokes credential with KEY_COMPROMISE (200)', async () => {
        const start = Date.now();
        const res = await request(app)
            .post(`/api/v1/credentials/${govCredId}/revoke`)
            .set('X-API-Key', env.API_KEY_GOV)
            .send({ reason: 'KEY_COMPROMISE' });
        observedLatencies.submit.push(Date.now() - start);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('REVOKED');
        expect(res.body.data.revocationReason).toBe('KEY_COMPROMISE');
        expect(res.body.data.revokedAt).toBeDefined();
    });

    // 19. Verify revoked credential
    it('19. POST /api/v1/credentials/verify on revoked credential returns valid=false, reason=REVOKED', async () => {
        const res = await request(app)
            .post('/api/v1/credentials/verify')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                credentialId: govCredId,
                subjectDID: citizenDid,
                credentialCommitment: govHash
            });

        expect(res.status).toBe(200);
        expect(res.body.data.valid).toBe(false);
        expect(res.body.data.reason).toBe('REVOKED');
    });

    // 20. Attempt to reinstate revoked credential (Terminal state rejection)
    it('20. Attempting to reinstate REVOKED credential returns 422 TERMINAL_STATE_CONFLICT', async () => {
        const res = await request(app)
            .post(`/api/v1/credentials/${govCredId}/reinstate`)
            .set('X-API-Key', env.API_KEY_GOV);

        expect(res.status).toBe(422);
        expect(res.body.error).toBe('TERMINAL_STATE_CONFLICT');
    });

    // 21. Attempt to revoke already revoked credential (Terminal state rejection)
    it('21. Attempting to re-revoke already REVOKED credential returns 422 TERMINAL_STATE_CONFLICT', async () => {
        const res = await request(app)
            .post(`/api/v1/credentials/${govCredId}/revoke`)
            .set('X-API-Key', env.API_KEY_GOV)
            .send({ reason: 'SUPERSEDED' });

        expect(res.status).toBe(422);
        expect(res.body.error).toBe('TERMINAL_STATE_CONFLICT');
    });

    // 22. Non-issuer organization attempts lifecycle operation (ABAC Negative)
    it('22. Non-issuer organization (BankMSP) attempting to revoke UniversityMSP credential returns 403', async () => {
        const res = await request(app)
            .post(`/api/v1/credentials/${uniCredId}/revoke`)
            .set('X-API-Key', env.API_KEY_BANK) // Bank attempting to revoke Uni credential
            .send({ reason: 'KEY_COMPROMISE' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('UNAUTHORIZED_OPERATION');
    });

    // 23. Invalid revocation reason
    it('23. Revocation request with invalid reason returns 400', async () => {
        const res = await request(app)
            .post(`/api/v1/credentials/${uniCredId}/revoke`)
            .set('X-API-Key', env.API_KEY_UNI)
            .send({ reason: 'NON_EXISTENT_REASON' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('INVALID_REQUEST_BODY');
    });

    // 24. Invalid DID format
    it('24. Registration with malformed DID returns 400', async () => {
        const res = await request(app)
            .post('/api/v1/identities')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                did: 'invalid_did_format',
                identityCommitment
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('INVALID_REQUEST_BODY');
    });

    // 25. Invalid commitment length/format
    it('25. Registration with malformed commitment returns 400', async () => {
        const res = await request(app)
            .post('/api/v1/identities')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                did: `did:example:test_${runId}`,
                identityCommitment: '12345' // Too short
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('INVALID_REQUEST_BODY');
    });

    // 26. Raw PII field in request
    it('26. Request payload containing raw PII field returns 400 via Zero Raw PII gatekeeper', async () => {
        const res = await request(app)
            .post('/api/v1/identities')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                did: `did:example:test_pii_${runId}`,
                identityCommitment,
                ssn: '000-11-2222' // Raw PII
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('INVALID_REQUEST_PAYLOAD');
        expect(res.body.message).toContain('raw PII fields detected');
    });

    // 27. Credential history
    it('27. GET /api/v1/credentials/:id/history returns chronological lifecycle revisions', async () => {
        const start = Date.now();
        const res = await request(app)
            .get(`/api/v1/credentials/${govCredId}/history`)
            .set('X-API-Key', env.API_KEY_GOV);
        observedLatencies.evaluate.push(Date.now() - start);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(4); // ISSUED -> SUSPENDED -> ACTIVE -> REVOKED
    });

    // 28. Dynamic expiration
    it('28. Credential with expired timestamp returns EXPIRED without mutating world state status from ACTIVE', async () => {
        // Issue credential expiring in 4 seconds
        const futureExp = new Date(Date.now() + 4000).toISOString();
        const issRes = await request(app)
            .post('/api/v1/credentials/government-id')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                credentialId: expCredId,
                subjectDID: citizenDid,
                issuerDID: 'did:example:gov:authority',
                credentialCommitment: expHash,
                expiresAt: futureExp
            });
        expect(issRes.status).toBe(201);

        // Immediate verification before expiration
        const beforeRes = await request(app)
            .post('/api/v1/credentials/verify')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                credentialId: expCredId,
                subjectDID: citizenDid,
                credentialCommitment: expHash
            });
        expect(beforeRes.body.data.valid).toBe(true);
        expect(beforeRes.body.data.reason).toBe('VALID');

        // Sleep 6 seconds for expiration window to pass
        console.log('Sleeping 6 seconds to allow expiration window to pass...');
        await new Promise(resolve => setTimeout(resolve, 6000));

        // Verification after expiration
        const afterRes = await request(app)
            .post('/api/v1/credentials/verify')
            .set('X-API-Key', env.API_KEY_GOV)
            .send({
                credentialId: expCredId,
                subjectDID: citizenDid,
                credentialCommitment: expHash
            });
        expect(afterRes.body.data.valid).toBe(false);
        expect(afterRes.body.data.reason).toBe('EXPIRED');

        // Status query reports effectiveStatus: EXPIRED while stored status remains ACTIVE
        const statusRes = await request(app)
            .get(`/api/v1/credentials/${expCredId}/status`)
            .set('X-API-Key', env.API_KEY_GOV);
        expect(statusRes.body.data.effectiveStatus).toBe('EXPIRED');
        expect(statusRes.body.data.status).toBe('ACTIVE');

        // Read credential confirms stored record remains ACTIVE
        const readRes = await request(app)
            .get(`/api/v1/credentials/${expCredId}`)
            .set('X-API-Key', env.API_KEY_GOV);
        expect(readRes.body.data.status).toBe('ACTIVE');
    }, 30000);
});
