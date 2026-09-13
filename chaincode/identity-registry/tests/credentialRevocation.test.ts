/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from 'chai';
import { IdentityRegistryContract } from '../src/identityRegistryContract';
import { CredentialRecord, CredentialStatus, CredentialStatusResult, RevocationReason, VerificationResult } from '../src/models/credentialRecord';
import { ChaincodeError, ErrorCode } from '../src/utils/errors';
import { MockContext } from './mocks/mockContext';

describe('CredentialRevocationContract Unit Tests (Milestone 6)', () => {
    let contract: IdentityRegistryContract;
    let mockCtx: MockContext;

    const SUBJECT_DID = 'did:example:citizen101';
    const GOV_ISSUER_DID = 'did:example:gov-authority';
    const VALID_COMMITMENT = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const SCHEMA_ID = 'schema:example:credentials-v1';
    const FUTURE_EXPIRATION = '2030-01-01T00:00:00.000Z';

    beforeEach(async () => {
        contract = new IdentityRegistryContract();
        mockCtx = new MockContext('GovMSP');
        // Set fixed transaction timestamp (1773420000s = 2026-03-13T16:40:00.000Z)
        mockCtx.setTxTimestamp(1773420000);
    });

    async function issueTestCredential(id: string = 'cred-test-001', expiresAt: string = FUTURE_EXPIRATION): Promise<CredentialRecord> {
        const ctx = mockCtx.getContext();
        const resStr = await contract.IssueCredential(
            ctx,
            id,
            SUBJECT_DID,
            GOV_ISSUER_DID,
            'GovernmentIdCredential',
            SCHEMA_ID,
            VALID_COMMITMENT,
            expiresAt
        );
        return JSON.parse(resStr);
    }

    describe('Positive Test Suite (12 Tests)', () => {
        it('1. ACTIVE credential can be suspended', async () => {
            await issueTestCredential('cred-001');
            mockCtx.setTxTimestamp(1773421000);
            const ctx = mockCtx.getContext();

            const resStr = await contract.SuspendCredential(ctx, 'cred-001', RevocationReason.AFFILIATION_CHANGED);
            const record: CredentialRecord = JSON.parse(resStr);

            expect(record.status).to.equal(CredentialStatus.SUSPENDED);
            expect(record.version).to.equal(2);
            expect(record.revokedAt).to.be.undefined;
            expect(record.revocationReason).to.be.undefined;
            expect(mockCtx.stub.setEvent.calledWith('CredentialSuspended')).to.be.true;
        });

        it('2. SUSPENDED credential can be reinstated', async () => {
            await issueTestCredential('cred-002');
            mockCtx.setTxTimestamp(1773421000);
            const ctx = mockCtx.getContext();
            await contract.SuspendCredential(ctx, 'cred-002', RevocationReason.AFFILIATION_CHANGED);

            mockCtx.setTxTimestamp(1773422000);
            const reinstateStr = await contract.ReinstateCredential(ctx, 'cred-002');
            const record: CredentialRecord = JSON.parse(reinstateStr);

            expect(record.status).to.equal(CredentialStatus.ACTIVE);
            expect(record.version).to.equal(3);
            expect(record.revokedAt).to.be.undefined;
            expect(mockCtx.stub.setEvent.calledWith('CredentialReinstated')).to.be.true;
        });

        it('3. ACTIVE credential can be revoked', async () => {
            await issueTestCredential('cred-003');
            mockCtx.setTxTimestamp(1773423000);
            const ctx = mockCtx.getContext();

            const resStr = await contract.RevokeCredential(ctx, 'cred-003', RevocationReason.KEY_COMPROMISE);
            const record: CredentialRecord = JSON.parse(resStr);

            expect(record.status).to.equal(CredentialStatus.REVOKED);
            expect(record.version).to.equal(2);
            expect(record.revocationReason).to.equal(RevocationReason.KEY_COMPROMISE);
            expect(record.revokedAt).to.equal(new Date(1773423000 * 1000).toISOString());
            expect(mockCtx.stub.setEvent.calledWith('CredentialRevoked')).to.be.true;
        });

        it('4. SUSPENDED credential can be revoked', async () => {
            await issueTestCredential('cred-004');
            mockCtx.setTxTimestamp(1773421000);
            const ctx = mockCtx.getContext();
            await contract.SuspendCredential(ctx, 'cred-004', RevocationReason.CESSATION_OF_OPERATION);

            mockCtx.setTxTimestamp(1773424000);
            const resStr = await contract.RevokeCredential(ctx, 'cred-004', RevocationReason.PRIVILEGE_WITHDRAWN);
            const record: CredentialRecord = JSON.parse(resStr);

            expect(record.status).to.equal(CredentialStatus.REVOKED);
            expect(record.version).to.equal(3);
            expect(record.revocationReason).to.equal(RevocationReason.PRIVILEGE_WITHDRAWN);
            expect(record.revokedAt).to.equal(new Date(1773424000 * 1000).toISOString());
            expect(mockCtx.stub.setEvent.calledWith('CredentialRevoked')).to.be.true;
        });

        it('5. Correct revocation reason is stored', async () => {
            await issueTestCredential('cred-005');
            const ctx = mockCtx.getContext();
            const resStr = await contract.RevokeCredential(ctx, 'cred-005', RevocationReason.SUPERSEDED);
            const record: CredentialRecord = JSON.parse(resStr);

            expect(record.revocationReason).to.equal(RevocationReason.SUPERSEDED);
        });

        it('6. revokedAt is populated using transaction timestamp', async () => {
            await issueTestCredential('cred-006');
            const expectedTimeSeconds = 1773450000;
            mockCtx.setTxTimestamp(expectedTimeSeconds);
            const ctx = mockCtx.getContext();

            const resStr = await contract.RevokeCredential(ctx, 'cred-006', RevocationReason.KEY_COMPROMISE);
            const record: CredentialRecord = JSON.parse(resStr);

            const expectedIso = new Date(expectedTimeSeconds * 1000).toISOString();
            expect(record.revokedAt).to.equal(expectedIso);
        });

        it('7. GetCredentialStatus returns correct status and metadata', async () => {
            await issueTestCredential('cred-007');
            const ctx = mockCtx.getContext();

            // ACTIVE state
            const statusStr1 = await contract.GetCredentialStatus(ctx, 'cred-007');
            const status1: CredentialStatusResult = JSON.parse(statusStr1);
            expect(status1.status).to.equal(CredentialStatus.ACTIVE);
            expect(status1.effectiveStatus).to.equal('ACTIVE');
            expect(status1.revocationReason).to.be.undefined;
            expect(status1.revokedAt).to.be.undefined;

            // Revoked state
            mockCtx.setTxTimestamp(1773460000);
            await contract.RevokeCredential(ctx, 'cred-007', RevocationReason.KEY_COMPROMISE);
            const statusStr2 = await contract.GetCredentialStatus(ctx, 'cred-007');
            const status2: CredentialStatusResult = JSON.parse(statusStr2);
            expect(status2.status).to.equal(CredentialStatus.REVOKED);
            expect(status2.effectiveStatus).to.equal('REVOKED');
            expect(status2.revocationReason).to.equal(RevocationReason.KEY_COMPROMISE);
            expect(status2.revokedAt).to.equal(new Date(1773460000 * 1000).toISOString());
        });

        it('8. Active credential verifies as VALID', async () => {
            await issueTestCredential('cred-008');
            const ctx = mockCtx.getContext();

            const verifyStr = await contract.VerifyCredential(ctx, 'cred-008', SUBJECT_DID, VALID_COMMITMENT);
            const result: VerificationResult = JSON.parse(verifyStr);

            expect(result.valid).to.be.true;
            expect(result.reason).to.equal('VALID');
        });

        it('9. Suspended credential verifies as SUSPENDED', async () => {
            await issueTestCredential('cred-009');
            const ctx = mockCtx.getContext();
            await contract.SuspendCredential(ctx, 'cred-009', RevocationReason.UNSPECIFIED);

            const verifyStr = await contract.VerifyCredential(ctx, 'cred-009', SUBJECT_DID, VALID_COMMITMENT);
            const result: VerificationResult = JSON.parse(verifyStr);

            expect(result.valid).to.be.false;
            expect(result.reason).to.equal('SUSPENDED');
        });

        it('10. Revoked credential verifies as REVOKED', async () => {
            await issueTestCredential('cred-010');
            const ctx = mockCtx.getContext();
            await contract.RevokeCredential(ctx, 'cred-010', RevocationReason.KEY_COMPROMISE);

            const verifyStr = await contract.VerifyCredential(ctx, 'cred-010', SUBJECT_DID, VALID_COMMITMENT);
            const result: VerificationResult = JSON.parse(verifyStr);

            expect(result.valid).to.be.false;
            expect(result.reason).to.equal('REVOKED');
        });

        it('11. History contains full lifecycle transitions', async () => {
            await issueTestCredential('cred-011');
            const ctx = mockCtx.getContext();

            mockCtx.setTxTimestamp(1773421000);
            await contract.SuspendCredential(ctx, 'cred-011', RevocationReason.UNSPECIFIED);

            mockCtx.setTxTimestamp(1773422000);
            await contract.ReinstateCredential(ctx, 'cred-011');

            mockCtx.setTxTimestamp(1773423000);
            await contract.RevokeCredential(ctx, 'cred-011', RevocationReason.SUPERSEDED);

            const historyStr = await contract.GetCredentialHistory(ctx, 'cred-011');
            const history = JSON.parse(historyStr);

            expect(history).to.be.an('array').with.lengthOf(4);
            expect(history[0].value.status).to.equal(CredentialStatus.ACTIVE);
            expect(history[1].value.status).to.equal(CredentialStatus.SUSPENDED);
            expect(history[2].value.status).to.equal(CredentialStatus.ACTIVE);
            expect(history[3].value.status).to.equal(CredentialStatus.REVOKED);
            expect(history[3].value.revocationReason).to.equal(RevocationReason.SUPERSEDED);
        });

        it('12. Controlled reason codes are all accepted', async () => {
            const reasons = [
                RevocationReason.KEY_COMPROMISE,
                RevocationReason.AFFILIATION_CHANGED,
                RevocationReason.SUPERSEDED,
                RevocationReason.CESSATION_OF_OPERATION,
                RevocationReason.PRIVILEGE_WITHDRAWN,
                RevocationReason.UNSPECIFIED
            ];

            const ctx = mockCtx.getContext();
            for (let i = 0; i < reasons.length; i++) {
                const credId = `cred-reason-${i}`;
                await issueTestCredential(credId);
                const resStr = await contract.RevokeCredential(ctx, credId, reasons[i]);
                const record: CredentialRecord = JSON.parse(resStr);
                expect(record.revocationReason).to.equal(reasons[i]);
            }
        });
    });

    describe('Negative Test Suite (15 Tests)', () => {
        it('13. Non-issuer cannot suspend (BankMSP cannot suspend Gov credential)', async () => {
            await issueTestCredential('cred-neg-013');
            mockCtx.setCallerMsp('BankMSP');
            const ctx = mockCtx.getContext();

            try {
                await contract.SuspendCredential(ctx, 'cred-neg-013', RevocationReason.UNSPECIFIED);
                expect.fail('Should have thrown UNAUTHORIZED error');
            } catch (err) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.UNAUTHORIZED);
            }
        });

        it('14. Non-issuer cannot reinstate (EmployerMSP cannot reinstate Gov credential)', async () => {
            await issueTestCredential('cred-neg-014');
            const govCtx = mockCtx.getContext();
            await contract.SuspendCredential(govCtx, 'cred-neg-014', RevocationReason.UNSPECIFIED);

            mockCtx.setCallerMsp('EmployerMSP');
            const empCtx = mockCtx.getContext();

            try {
                await contract.ReinstateCredential(empCtx, 'cred-neg-014');
                expect.fail('Should have thrown UNAUTHORIZED error');
            } catch (err) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.UNAUTHORIZED);
            }
        });

        it('15. Non-issuer cannot revoke (UniversityMSP cannot revoke Gov credential)', async () => {
            await issueTestCredential('cred-neg-015');
            mockCtx.setCallerMsp('UniversityMSP');
            const ctx = mockCtx.getContext();

            try {
                await contract.RevokeCredential(ctx, 'cred-neg-015', RevocationReason.KEY_COMPROMISE);
                expect.fail('Should have thrown UNAUTHORIZED error');
            } catch (err) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.UNAUTHORIZED);
            }
        });

        it('16. Verifier cannot modify status', async () => {
            await issueTestCredential('cred-neg-016');
            mockCtx.setCallerMsp('BankMSP'); // Bank acts as verifier
            const ctx = mockCtx.getContext();

            try {
                await contract.RevokeCredential(ctx, 'cred-neg-016', RevocationReason.KEY_COMPROMISE);
                expect.fail('Should have rejected verifier write attempt');
            } catch (err) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.UNAUTHORIZED);
            }
        });

        it('17. Invalid revocation reason is rejected', async () => {
            await issueTestCredential('cred-neg-017');
            const ctx = mockCtx.getContext();

            try {
                await contract.RevokeCredential(ctx, 'cred-neg-017', 'SOME_UNKNOWN_REASON');
                expect.fail('Should have rejected unknown revocation reason');
            } catch (err) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_REVOCATION_REASON);
            }
        });

        it('18. Empty revocation reason is rejected', async () => {
            await issueTestCredential('cred-neg-018');
            const ctx = mockCtx.getContext();

            try {
                await contract.RevokeCredential(ctx, 'cred-neg-018', '');
                expect.fail('Should have rejected empty revocation reason');
            } catch (err) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_REVOCATION_REASON);
            }
        });

        it('19. Arbitrary free-text reason is rejected', async () => {
            await issueTestCredential('cred-neg-019');
            const ctx = mockCtx.getContext();

            try {
                await contract.RevokeCredential(ctx, 'cred-neg-019', 'User left the country on 2026-05-01 due to tax audit');
                expect.fail('Should have rejected arbitrary free text reason');
            } catch (err) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_REVOCATION_REASON);
            }
        });

        it('20. REVOKED -> ACTIVE is rejected', async () => {
            await issueTestCredential('cred-neg-020');
            const ctx = mockCtx.getContext();
            await contract.RevokeCredential(ctx, 'cred-neg-020', RevocationReason.KEY_COMPROMISE);

            try {
                await contract.ReinstateCredential(ctx, 'cred-neg-020');
                expect.fail('Should have rejected reinstatement of REVOKED credential');
            } catch (err) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.CREDENTIAL_REVOCATION_IS_TERMINAL);
            }
        });

        it('21. REVOKED -> SUSPENDED is rejected', async () => {
            await issueTestCredential('cred-neg-021');
            const ctx = mockCtx.getContext();
            await contract.RevokeCredential(ctx, 'cred-neg-021', RevocationReason.KEY_COMPROMISE);

            try {
                await contract.SuspendCredential(ctx, 'cred-neg-021', RevocationReason.UNSPECIFIED);
                expect.fail('Should have rejected suspension of REVOKED credential');
            } catch (err) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.CREDENTIAL_REVOCATION_IS_TERMINAL);
            }
        });

        it('22. REVOKED cannot be revoked again', async () => {
            await issueTestCredential('cred-neg-022');
            const ctx = mockCtx.getContext();
            await contract.RevokeCredential(ctx, 'cred-neg-022', RevocationReason.KEY_COMPROMISE);

            try {
                await contract.RevokeCredential(ctx, 'cred-neg-022', RevocationReason.SUPERSEDED);
                expect.fail('Should have rejected re-revocation of already REVOKED credential');
            } catch (err) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.CREDENTIAL_REVOCATION_IS_TERMINAL);
            }
        });

        it('23. Nonexistent credential rejected for revocation', async () => {
            const ctx = mockCtx.getContext();

            try {
                await contract.RevokeCredential(ctx, 'cred-nonexistent-999', RevocationReason.KEY_COMPROMISE);
                expect.fail('Should have thrown CREDENTIAL_NOT_FOUND');
            } catch (err) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.CREDENTIAL_NOT_FOUND);
            }
        });

        it('24. Wrong subject rejected during verification', async () => {
            await issueTestCredential('cred-neg-024');
            const ctx = mockCtx.getContext();

            const resStr = await contract.VerifyCredential(ctx, 'cred-neg-024', 'did:example:wrongsubject', VALID_COMMITMENT);
            const result: VerificationResult = JSON.parse(resStr);

            expect(result.valid).to.be.false;
            expect(result.reason).to.equal('SUBJECT_MISMATCH');
        });

        it('25. Wrong commitment rejected during verification', async () => {
            await issueTestCredential('cred-neg-025');
            const ctx = mockCtx.getContext();
            const wrongCommitment = '0000000000000000000000000000000000000000000000000000000000000000';

            const resStr = await contract.VerifyCredential(ctx, 'cred-neg-025', SUBJECT_DID, wrongCommitment);
            const result: VerificationResult = JSON.parse(resStr);

            expect(result.valid).to.be.false;
            expect(result.reason).to.equal('COMMITMENT_MISMATCH');
        });

        it('26. Expired credential rejected by verification (deterministic timestamp progression)', async () => {
            // Issuing credential expiring in year 2028 (1830297600s)
            const expireIso = '2028-01-01T00:00:00.000Z';
            await issueTestCredential('cred-neg-026', expireIso);

            // Step A: Verification before expiration (2026-03-13) -> VALID
            mockCtx.setTxTimestamp(1773420000);
            const ctxBefore = mockCtx.getContext();
            const resBefore = JSON.parse(await contract.VerifyCredential(ctxBefore, 'cred-neg-026', SUBJECT_DID, VALID_COMMITMENT));
            expect(resBefore.valid).to.be.true;
            expect(resBefore.reason).to.equal('VALID');

            const statusBefore = JSON.parse(await contract.GetCredentialStatus(ctxBefore, 'cred-neg-026'));
            expect(statusBefore.status).to.equal(CredentialStatus.ACTIVE);
            expect(statusBefore.effectiveStatus).to.equal('ACTIVE');

            // Step B: Advance transaction time past expiration (2029-01-01 = 1861920000s)
            mockCtx.setTxTimestamp(1861920000);
            const ctxAfter = mockCtx.getContext();

            // VerifyCredential evaluates EXPIRED
            const resAfter = JSON.parse(await contract.VerifyCredential(ctxAfter, 'cred-neg-026', SUBJECT_DID, VALID_COMMITMENT));
            expect(resAfter.valid).to.be.false;
            expect(resAfter.reason).to.equal('EXPIRED');

            // GetCredentialStatus reports effectiveStatus EXPIRED without mutating world state status
            const statusAfter = JSON.parse(await contract.GetCredentialStatus(ctxAfter, 'cred-neg-026'));
            expect(statusAfter.status).to.equal(CredentialStatus.ACTIVE);
            expect(statusAfter.effectiveStatus).to.equal('EXPIRED');

            // Stored world state record status remains ACTIVE
            const readRecord = JSON.parse(await contract.ReadCredential(ctxAfter, 'cred-neg-026'));
            expect(readRecord.status).to.equal(CredentialStatus.ACTIVE);
        });

        it('27. Invalid credential ID rejected', async () => {
            const ctx = mockCtx.getContext();

            try {
                await contract.RevokeCredential(ctx, '', RevocationReason.KEY_COMPROMISE);
                expect.fail('Should have rejected empty credential ID');
            } catch (err) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_CREDENTIAL_ID);
            }
        });
    });
});
