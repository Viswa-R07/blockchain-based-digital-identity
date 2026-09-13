/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from 'chai';
import { IdentityRegistryContract } from '../src/identityRegistryContract';
import { CredentialRecord, CredentialStatus, VerificationResult } from '../src/models/credentialRecord';
import { ChaincodeError, ErrorCode } from '../src/utils/errors';
import { MockContext } from './mocks/mockContext';

describe('CredentialRegistryContract Unit Tests (Milestone 5)', () => {
    let contract: IdentityRegistryContract;
    let mockCtx: MockContext;

    const SUBJECT_DID = 'did:example:citizen101';
    const GOV_ISSUER_DID = 'did:example:gov-authority';
    const UNI_ISSUER_DID = 'did:example:state-university';
    const BANK_ISSUER_DID = 'did:example:national-bank';
    const EMP_ISSUER_DID = 'did:example:tech-corp';

    const VALID_COMMITMENT = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const SCHEMA_ID = 'schema:example:credentials-v1';
    const FUTURE_EXPIRATION = '2030-01-01T00:00:00.000Z';

    beforeEach(() => {
        contract = new IdentityRegistryContract();
        mockCtx = new MockContext('GovMSP');
    });

    describe('Positive Test Suite (11 Tests)', () => {
        it('1. Government issues credential: Should issue GovernmentIdCredential when called by GovMSP', async () => {
            const ctx = mockCtx.getContext();
            const resStr = await contract.IssueCredential(
                ctx,
                'cred-gov-001',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );
            const record: CredentialRecord = JSON.parse(resStr);

            expect(record.credentialId).to.equal('cred-gov-001');
            expect(record.subjectDID).to.equal(SUBJECT_DID);
            expect(record.issuerDID).to.equal(GOV_ISSUER_DID);
            expect(record.issuerOrg).to.equal('GovMSP');
            expect(record.credentialType).to.equal('GovernmentIdCredential');
            expect(record.status).to.equal(CredentialStatus.ACTIVE);
            expect(record.version).to.equal(1);
            expect(record.issuedAt).to.be.a('string');
            expect(record.expiresAt).to.equal(FUTURE_EXPIRATION);
            expect(mockCtx.stub.setEvent.calledWith('CredentialIssued')).to.be.true;
        });

        it('2. University issues academic credential: Should issue AcademicDegreeCredential when called by UniversityMSP', async () => {
            mockCtx.setCallerMsp('UniversityMSP');
            const ctx = mockCtx.getContext();
            const resStr = await contract.IssueCredential(
                ctx,
                'cred-uni-001',
                SUBJECT_DID,
                UNI_ISSUER_DID,
                'AcademicDegreeCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );
            const record: CredentialRecord = JSON.parse(resStr);

            expect(record.credentialId).to.equal('cred-uni-001');
            expect(record.issuerOrg).to.equal('UniversityMSP');
            expect(record.credentialType).to.equal('AcademicDegreeCredential');
            expect(record.status).to.equal(CredentialStatus.ACTIVE);
        });

        it('3. Bank issues KYC credential: Should issue KYCCredential when called by BankMSP', async () => {
            mockCtx.setCallerMsp('BankMSP');
            const ctx = mockCtx.getContext();
            const resStr = await contract.IssueCredential(
                ctx,
                'cred-bank-001',
                SUBJECT_DID,
                BANK_ISSUER_DID,
                'KYCCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );
            const record: CredentialRecord = JSON.parse(resStr);

            expect(record.credentialId).to.equal('cred-bank-001');
            expect(record.issuerOrg).to.equal('BankMSP');
            expect(record.credentialType).to.equal('KYCCredential');
            expect(record.status).to.equal(CredentialStatus.ACTIVE);
        });

        it('4. Employer issues employment credential: Should issue EmploymentCredential when called by EmployerMSP', async () => {
            mockCtx.setCallerMsp('EmployerMSP');
            const ctx = mockCtx.getContext();
            const resStr = await contract.IssueCredential(
                ctx,
                'cred-emp-001',
                SUBJECT_DID,
                EMP_ISSUER_DID,
                'EmploymentCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );
            const record: CredentialRecord = JSON.parse(resStr);

            expect(record.credentialId).to.equal('cred-emp-001');
            expect(record.issuerOrg).to.equal('EmployerMSP');
            expect(record.credentialType).to.equal('EmploymentCredential');
            expect(record.status).to.equal(CredentialStatus.ACTIVE);
        });

        it('5. Read credential: Should read an existing credential record from any org', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-002',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );

            // Read by BankMSP
            mockCtx.setCallerMsp('BankMSP');
            const readResStr = await contract.ReadCredential(ctx, 'cred-gov-002');
            const record: CredentialRecord = JSON.parse(readResStr);

            expect(record.credentialId).to.equal('cred-gov-002');
            expect(record.status).to.equal(CredentialStatus.ACTIVE);
        });

        it('6. CredentialExists: Should return true for existing credential and false for nonexistent', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-003',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );

            const exists = await contract.CredentialExists(ctx, 'cred-gov-003');
            const nonExists = await contract.CredentialExists(ctx, 'cred-nonexistent');

            expect(exists).to.be.true;
            expect(nonExists).to.be.false;
        });

        it('7. Verify valid credential: Valid credential verification succeeds with reason VALID', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-004',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );

            const verResStr = await contract.VerifyCredential(ctx, 'cred-gov-004', SUBJECT_DID, VALID_COMMITMENT);
            const verResult: VerificationResult = JSON.parse(verResStr);

            expect(verResult.valid).to.be.true;
            expect(verResult.reason).to.equal('VALID');
            expect(verResult.credentialId).to.equal('cred-gov-004');
            expect(verResult.subjectDID).to.equal(SUBJECT_DID);
            expect(verResult.status).to.equal(CredentialStatus.ACTIVE);
            expect(mockCtx.stub.setEvent.calledWith('CredentialVerified')).to.be.true;
        });

        it('8. ACTIVE -> SUSPENDED: Issuing org can update ACTIVE to SUSPENDED', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-005',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );

            const updatedStr = await contract.UpdateCredentialStatus(ctx, 'cred-gov-005', 'SUSPENDED');
            const record: CredentialRecord = JSON.parse(updatedStr);

            expect(record.status).to.equal(CredentialStatus.SUSPENDED);
            expect(record.version).to.equal(2);
            expect(mockCtx.stub.setEvent.calledWith('CredentialStatusUpdated')).to.be.true;
        });

        it('9. SUSPENDED -> ACTIVE: Issuing org can reinstate SUSPENDED credential to ACTIVE', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-006',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );
            await contract.UpdateCredentialStatus(ctx, 'cred-gov-006', 'SUSPENDED');

            const updatedStr = await contract.UpdateCredentialStatus(ctx, 'cred-gov-006', 'ACTIVE');
            const record: CredentialRecord = JSON.parse(updatedStr);

            expect(record.status).to.equal(CredentialStatus.ACTIVE);
            expect(record.version).to.equal(3);
        });

        it('10. ACTIVE -> REVOKED: Issuing org can permanently REVOKE a credential', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-007',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );

            const updatedStr = await contract.UpdateCredentialStatus(ctx, 'cred-gov-007', 'REVOKED');
            const record: CredentialRecord = JSON.parse(updatedStr);

            expect(record.status).to.equal(CredentialStatus.REVOKED);
            expect(record.version).to.equal(2);
        });

        it('11. Credential history: GetCredentialHistory returns chronological audit trail', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-008',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );
            await contract.UpdateCredentialStatus(ctx, 'cred-gov-008', 'SUSPENDED');
            await contract.UpdateCredentialStatus(ctx, 'cred-gov-008', 'REVOKED');

            const historyStr = await contract.GetCredentialHistory(ctx, 'cred-gov-008');
            const history = JSON.parse(historyStr);

            expect(history).to.be.an('array');
            expect(history.length).to.equal(3);
            expect(history[0].value.status).to.equal('ACTIVE');
            expect(history[1].value.status).to.equal('SUSPENDED');
            expect(history[2].value.status).to.equal('REVOKED');
        });
    });

    describe('Negative Test Suite (21 Tests)', () => {
        it('1. Duplicate credential ID: Should reject duplicate credential registration', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-dup-001',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );

            try {
                await contract.IssueCredential(
                    ctx,
                    'cred-dup-001',
                    SUBJECT_DID,
                    GOV_ISSUER_DID,
                    'GovernmentIdCredential',
                    SCHEMA_ID,
                    VALID_COMMITMENT,
                    FUTURE_EXPIRATION
                );
                expect.fail('Should have thrown DUPLICATE_CREDENTIAL');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.DUPLICATE_CREDENTIAL);
            }
        });

        it('2. Empty credential ID: Should reject empty or blank credential ID', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.IssueCredential(
                    ctx,
                    '   ',
                    SUBJECT_DID,
                    GOV_ISSUER_DID,
                    'GovernmentIdCredential',
                    SCHEMA_ID,
                    VALID_COMMITMENT,
                    FUTURE_EXPIRATION
                );
                expect.fail('Should have thrown INVALID_CREDENTIAL_ID');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_CREDENTIAL_ID);
            }
        });

        it('3. Invalid subject DID: Should reject malformed subject DID', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.IssueCredential(
                    ctx,
                    'cred-bad-did',
                    'invalid-did-format',
                    GOV_ISSUER_DID,
                    'GovernmentIdCredential',
                    SCHEMA_ID,
                    VALID_COMMITMENT,
                    FUTURE_EXPIRATION
                );
                expect.fail('Should have thrown INVALID_DID');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_DID);
            }
        });

        it('4. Invalid issuer DID: Should reject malformed issuer DID', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.IssueCredential(
                    ctx,
                    'cred-bad-issuer',
                    SUBJECT_DID,
                    'bad:did:format',
                    'GovernmentIdCredential',
                    SCHEMA_ID,
                    VALID_COMMITMENT,
                    FUTURE_EXPIRATION
                );
                expect.fail('Should have thrown INVALID_DID');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_DID);
            }
        });

        it('5. Invalid commitment (length): Should reject commitment with wrong length', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.IssueCredential(
                    ctx,
                    'cred-bad-comm-len',
                    SUBJECT_DID,
                    GOV_ISSUER_DID,
                    'GovernmentIdCredential',
                    SCHEMA_ID,
                    'tooshort',
                    FUTURE_EXPIRATION
                );
                expect.fail('Should have thrown INVALID_COMMITMENT');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_COMMITMENT);
            }
        });

        it('6. Invalid commitment (characters): Should reject commitment with non-hex characters', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.IssueCredential(
                    ctx,
                    'cred-bad-comm-hex',
                    SUBJECT_DID,
                    GOV_ISSUER_DID,
                    'GovernmentIdCredential',
                    SCHEMA_ID,
                    'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
                    FUTURE_EXPIRATION
                );
                expect.fail('Should have thrown INVALID_COMMITMENT');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_COMMITMENT);
            }
        });

        it('7. Invalid credential type: Should reject blank credential type', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.IssueCredential(
                    ctx,
                    'cred-bad-type',
                    SUBJECT_DID,
                    GOV_ISSUER_DID,
                    '   ',
                    SCHEMA_ID,
                    VALID_COMMITMENT,
                    FUTURE_EXPIRATION
                );
                expect.fail('Should have thrown INVALID_CREDENTIAL_TYPE');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_CREDENTIAL_TYPE);
            }
        });

        it('8. Invalid schema ID: Should reject blank schema ID', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.IssueCredential(
                    ctx,
                    'cred-bad-schema',
                    SUBJECT_DID,
                    GOV_ISSUER_DID,
                    'GovernmentIdCredential',
                    '   ',
                    VALID_COMMITMENT,
                    FUTURE_EXPIRATION
                );
                expect.fail('Should have thrown INVALID_SCHEMA_ID');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_SCHEMA_ID);
            }
        });

        it('9. Malformed expiresAt: Should reject invalid date string', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.IssueCredential(
                    ctx,
                    'cred-bad-date',
                    SUBJECT_DID,
                    GOV_ISSUER_DID,
                    'GovernmentIdCredential',
                    SCHEMA_ID,
                    VALID_COMMITMENT,
                    'not-a-valid-date'
                );
                expect.fail('Should have thrown INVALID_EXPIRATION');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_EXPIRATION);
            }
        });

        it('10. Expiration <= issuance timestamp: Should reject expiration in the past', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.IssueCredential(
                    ctx,
                    'cred-past-date',
                    SUBJECT_DID,
                    GOV_ISSUER_DID,
                    'GovernmentIdCredential',
                    SCHEMA_ID,
                    VALID_COMMITMENT,
                    '2020-01-01T00:00:00.000Z'
                );
                expect.fail('Should have thrown INVALID_EXPIRATION');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_EXPIRATION);
            }
        });

        it('11. Unauthorized issuer organization: BankMSP cannot issue Academic credentials (ABAC)', async () => {
            mockCtx.setCallerMsp('BankMSP');
            const ctx = mockCtx.getContext();
            try {
                await contract.IssueCredential(
                    ctx,
                    'cred-unauth-type',
                    SUBJECT_DID,
                    BANK_ISSUER_DID,
                    'AcademicDegreeCredential',
                    SCHEMA_ID,
                    VALID_COMMITMENT,
                    FUTURE_EXPIRATION
                );
                expect.fail('Should have thrown UNAUTHORIZED_CREDENTIAL_TYPE');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.UNAUTHORIZED_CREDENTIAL_TYPE);
            }
        });

        it('12. Unauthorized status update: Caller from other org cannot update status', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-009',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );

            // Bank attempts to update Gov's credential status
            mockCtx.setCallerMsp('BankMSP');
            try {
                await contract.UpdateCredentialStatus(ctx, 'cred-gov-009', 'SUSPENDED');
                expect.fail('Should have thrown UNAUTHORIZED');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.UNAUTHORIZED);
            }
        });

        it('13. Invalid status: Should reject unknown status string', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-010',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );

            try {
                await contract.UpdateCredentialStatus(ctx, 'cred-gov-010', 'UNKNOWN_STATUS');
                expect.fail('Should have thrown INVALID_STATUS');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_STATUS);
            }
        });

        it('14. No-op transition: Should reject ACTIVE -> ACTIVE update', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-011',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );

            try {
                await contract.UpdateCredentialStatus(ctx, 'cred-gov-011', 'ACTIVE');
                expect.fail('Should have thrown NOOP_STATUS_TRANSITION');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.NOOP_STATUS_TRANSITION);
            }
        });

        it('15. REVOKED -> ACTIVE: Should reject reactivation of REVOKED credential', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-012',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );
            await contract.UpdateCredentialStatus(ctx, 'cred-gov-012', 'REVOKED');

            try {
                await contract.UpdateCredentialStatus(ctx, 'cred-gov-012', 'ACTIVE');
                expect.fail('Should have thrown CREDENTIAL_REVOCATION_IS_TERMINAL');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.CREDENTIAL_REVOCATION_IS_TERMINAL);
            }
        });

        it('16. REVOKED -> SUSPENDED: Should reject suspension of REVOKED credential', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-013',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );
            await contract.UpdateCredentialStatus(ctx, 'cred-gov-013', 'REVOKED');

            try {
                await contract.UpdateCredentialStatus(ctx, 'cred-gov-013', 'SUSPENDED');
                expect.fail('Should have thrown CREDENTIAL_REVOCATION_IS_TERMINAL');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.CREDENTIAL_REVOCATION_IS_TERMINAL);
            }
        });

        it('17. Nonexistent credential: ReadCredential throws CREDENTIAL_NOT_FOUND', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.ReadCredential(ctx, 'cred-missing');
                expect.fail('Should have thrown CREDENTIAL_NOT_FOUND');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.CREDENTIAL_NOT_FOUND);
            }
        });

        it('18. Wrong subject DID during verification: Returns valid=false, reason=SUBJECT_MISMATCH', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-014',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );

            const verStr = await contract.VerifyCredential(ctx, 'cred-gov-014', 'did:example:imposter', VALID_COMMITMENT);
            const res: VerificationResult = JSON.parse(verStr);

            expect(res.valid).to.be.false;
            expect(res.reason).to.equal('SUBJECT_MISMATCH');
        });

        it('19. Wrong commitment during verification: Returns valid=false, reason=COMMITMENT_MISMATCH', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-015',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );

            const wrongCommitment = '0000000000000000000000000000000000000000000000000000000000000000';
            const verStr = await contract.VerifyCredential(ctx, 'cred-gov-015', SUBJECT_DID, wrongCommitment);
            const res: VerificationResult = JSON.parse(verStr);

            expect(res.valid).to.be.false;
            expect(res.reason).to.equal('COMMITMENT_MISMATCH');
        });

        it('20. Suspended credential verification: Returns valid=false, reason=SUSPENDED', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-016',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );
            await contract.UpdateCredentialStatus(ctx, 'cred-gov-016', 'SUSPENDED');

            const verStr = await contract.VerifyCredential(ctx, 'cred-gov-016', SUBJECT_DID, VALID_COMMITMENT);
            const res: VerificationResult = JSON.parse(verStr);

            expect(res.valid).to.be.false;
            expect(res.reason).to.equal('SUSPENDED');
        });

        it('21. Revoked credential verification: Returns valid=false, reason=REVOKED', async () => {
            const ctx = mockCtx.getContext();
            await contract.IssueCredential(
                ctx,
                'cred-gov-017',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                FUTURE_EXPIRATION
            );
            await contract.UpdateCredentialStatus(ctx, 'cred-gov-017', 'REVOKED');

            const verStr = await contract.VerifyCredential(ctx, 'cred-gov-017', SUBJECT_DID, VALID_COMMITMENT);
            const res: VerificationResult = JSON.parse(verStr);

            expect(res.valid).to.be.false;
            expect(res.reason).to.equal('REVOKED');
        });

        it('22. Expired credential verification: Returns valid=false, reason=EXPIRED when txTimestamp >= expiresAt', async () => {
            const ctx = mockCtx.getContext();
            const expiresAt = '2026-06-01T00:00:00.000Z'; // Future relative to initial 1773420000 (~2026-03-13)
            await contract.IssueCredential(
                ctx,
                'cred-gov-018',
                SUBJECT_DID,
                GOV_ISSUER_DID,
                'GovernmentIdCredential',
                SCHEMA_ID,
                VALID_COMMITMENT,
                expiresAt
            );

            // Advance transaction timestamp to year 2027 (seconds = 1800000000)
            mockCtx.setTxTimestamp(1800000000);

            const verStr = await contract.VerifyCredential(ctx, 'cred-gov-018', SUBJECT_DID, VALID_COMMITMENT);
            const res: VerificationResult = JSON.parse(verStr);

            expect(res.valid).to.be.false;
            expect(res.reason).to.equal('EXPIRED');
            expect(res.status).to.equal(CredentialStatus.ACTIVE); // Stored status remains ACTIVE, verification reports EXPIRED
        });
    });
});
