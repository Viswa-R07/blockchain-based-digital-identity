/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from 'chai';
import { IdentityRegistryContract } from '../src/identityRegistryContract';
import { IdentityRecord, IdentityStatus } from '../src/models/identityRecord';
import { ChaincodeError, ErrorCode } from '../src/utils/errors';
import { MockContext } from './mocks/mockContext';

describe('IdentityRegistryContract Unit Tests', () => {
    let contract: IdentityRegistryContract;
    let mockCtx: MockContext;

    const VALID_DID = 'did:example:citizen101';
    const VALID_COMMITMENT = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    beforeEach(() => {
        contract = new IdentityRegistryContract();
        mockCtx = new MockContext('GovMSP');
    });

    describe('Positive Test Suite', () => {
        it('1. test_register_identity_success: Should register a valid identity when called by GovMSP', async () => {
            const ctx = mockCtx.getContext();
            const resStr = await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);
            const record: IdentityRecord = JSON.parse(resStr);

            expect(record.did).to.equal(VALID_DID);
            expect(record.identityCommitment).to.equal(VALID_COMMITMENT);
            expect(record.status).to.equal(IdentityStatus.ACTIVE);
            expect(record.issuerOrg).to.equal('GovMSP');
            expect(record.version).to.equal(1);
            expect(record.createdAt).to.be.a('string');
            expect(record.updatedAt).to.be.a('string');
            expect(mockCtx.stub.setEvent.calledWith('IdentityRegistered')).to.be.true;
        });

        it('2. test_read_identity_success: Should read an existing identity record', async () => {
            const ctx = mockCtx.getContext();
            await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);

            // Read from another org (BankMSP)
            mockCtx.setCallerMsp('BankMSP');
            const readResStr = await contract.ReadIdentity(ctx, VALID_DID);
            const record: IdentityRecord = JSON.parse(readResStr);

            expect(record.did).to.equal(VALID_DID);
            expect(record.status).to.equal(IdentityStatus.ACTIVE);
        });

        it('3. test_identity_exists_true: IdentityExists should return true for registered identity and false for nonexistent', async () => {
            const ctx = mockCtx.getContext();
            await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);

            const exists = await contract.IdentityExists(ctx, VALID_DID);
            expect(exists).to.be.true;

            const notExists = await contract.IdentityExists(ctx, 'did:example:ghost');
            expect(notExists).to.be.false;
        });

        it('4. test_update_status_active_to_suspended: GovMSP can update ACTIVE to SUSPENDED', async () => {
            const ctx = mockCtx.getContext();
            await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);

            const updatedStr = await contract.UpdateIdentityStatus(ctx, VALID_DID, 'SUSPENDED');
            const record: IdentityRecord = JSON.parse(updatedStr);

            expect(record.status).to.equal(IdentityStatus.SUSPENDED);
            expect(record.version).to.equal(2);
            expect(mockCtx.stub.setEvent.calledWith('IdentityStatusUpdated')).to.be.true;
        });

        it('5. test_update_status_suspended_to_active: GovMSP can reinstate SUSPENDED to ACTIVE', async () => {
            const ctx = mockCtx.getContext();
            await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);
            await contract.UpdateIdentityStatus(ctx, VALID_DID, 'SUSPENDED');

            const reinstatedStr = await contract.UpdateIdentityStatus(ctx, VALID_DID, 'ACTIVE');
            const record: IdentityRecord = JSON.parse(reinstatedStr);

            expect(record.status).to.equal(IdentityStatus.ACTIVE);
            expect(record.version).to.equal(3);
        });

        it('6. test_update_status_to_revoked: GovMSP can permanently REVOKE an identity', async () => {
            const ctx = mockCtx.getContext();
            await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);

            const revokedStr = await contract.UpdateIdentityStatus(ctx, VALID_DID, 'REVOKED');
            const record: IdentityRecord = JSON.parse(revokedStr);

            expect(record.status).to.equal(IdentityStatus.REVOKED);
            expect(record.version).to.equal(2);
        });
    });

    describe('Negative Test Suite', () => {
        it('1. test_register_duplicate_did: Should reject duplicate DID registration', async () => {
            const ctx = mockCtx.getContext();
            await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);

            try {
                await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);
                expect.fail('Should have thrown DUPLICATE_IDENTITY error');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.DUPLICATE_IDENTITY);
            }
        });

        it('2. test_register_empty_did: Should reject empty DID', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.RegisterIdentity(ctx, '', VALID_COMMITMENT);
                expect.fail('Should have thrown INVALID_DID');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_DID);
            }
        });

        it('3. test_register_invalid_did_format: Should reject malformed DID string', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.RegisterIdentity(ctx, 'not-a-valid-did', VALID_COMMITMENT);
                expect.fail('Should have thrown INVALID_DID');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_DID);
            }
        });

        it('4. test_register_invalid_commitment_length: Should reject commitment with wrong length', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.RegisterIdentity(ctx, VALID_DID, 'abc123short');
                expect.fail('Should have thrown INVALID_COMMITMENT');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_COMMITMENT);
            }
        });

        it('5. test_register_invalid_commitment_characters: Should reject commitment with non-hex chars', async () => {
            const ctx = mockCtx.getContext();
            const nonHex = 'z'.repeat(64);
            try {
                await contract.RegisterIdentity(ctx, VALID_DID, nonHex);
                expect.fail('Should have thrown INVALID_COMMITMENT');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_COMMITMENT);
            }
        });

        it('6. test_register_unauthorized_org: Non-GovMSP callers cannot register identities', async () => {
            mockCtx.setCallerMsp('BankMSP');
            const ctx = mockCtx.getContext();
            try {
                await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);
                expect.fail('Should have thrown UNAUTHORIZED');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.UNAUTHORIZED);
            }
        });

        it('7. test_update_status_unauthorized_org: Unauthorized caller cannot update status', async () => {
            const ctx = mockCtx.getContext();
            await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);

            mockCtx.setCallerMsp('EmployerMSP');
            try {
                await contract.UpdateIdentityStatus(ctx, VALID_DID, 'SUSPENDED');
                expect.fail('Should have thrown UNAUTHORIZED');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.UNAUTHORIZED);
            }
        });

        it('8. test_update_status_invalid_status_enum: Should reject unsupported status enum string', async () => {
            const ctx = mockCtx.getContext();
            await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);

            try {
                await contract.UpdateIdentityStatus(ctx, VALID_DID, 'PENDING_APPROVAL');
                expect.fail('Should have thrown INVALID_STATUS');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.INVALID_STATUS);
            }
        });

        it('9. test_update_status_noop: Should reject no-op transition (ACTIVE to ACTIVE)', async () => {
            const ctx = mockCtx.getContext();
            await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);

            try {
                await contract.UpdateIdentityStatus(ctx, VALID_DID, 'ACTIVE');
                expect.fail('Should have thrown NOOP_STATUS_TRANSITION');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.NOOP_STATUS_TRANSITION);
            }
        });

        it('10. test_update_status_from_terminal_revoked: Should reject any transition out of REVOKED', async () => {
            const ctx = mockCtx.getContext();
            await contract.RegisterIdentity(ctx, VALID_DID, VALID_COMMITMENT);
            await contract.UpdateIdentityStatus(ctx, VALID_DID, 'REVOKED');

            try {
                await contract.UpdateIdentityStatus(ctx, VALID_DID, 'ACTIVE');
                expect.fail('Should have thrown REVOCATION_IS_TERMINAL');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.REVOCATION_IS_TERMINAL);
            }
        });

        it('11. test_read_nonexistent_did: Should throw IDENTITY_NOT_FOUND when reading unknown DID', async () => {
            const ctx = mockCtx.getContext();
            try {
                await contract.ReadIdentity(ctx, 'did:example:nonexistent');
                expect.fail('Should have thrown IDENTITY_NOT_FOUND');
            } catch (err: unknown) {
                expect((err as ChaincodeError).code).to.equal(ErrorCode.IDENTITY_NOT_FOUND);
            }
        });
    });
});
