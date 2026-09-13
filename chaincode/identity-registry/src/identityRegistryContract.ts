/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';
import stringify from 'json-stringify-deterministic';
import sortKeysRecursive from 'sort-keys-recursive';
import { CredentialRecord, CredentialStatus, CredentialStatusResult, RevocationReason, VerificationResult } from './models/credentialRecord';
import { IdentityRecord, IdentityStatus } from './models/identityRecord';
import {
    parseAndValidateCredentialStatus,
    validateCredentialId,
    validateCredentialStatusTransition,
    validateCredentialType,
    validateExpiresAt,
    validateIssuerOrganization,
    validateRevocationReason,
    validateSchemaId
} from './utils/credentialValidation';
import { ChaincodeError, ErrorCode } from './utils/errors';
import { getTxTimestampISO } from './utils/timestamp';
import { parseAndValidateStatus, validateCommitment, validateDID, validateStatusTransition } from './utils/validation';

const RECORD_OBJECT_TYPE = 'IdentityRecord';
const CREDENTIAL_OBJECT_TYPE = 'CredentialRecord';
const GOV_MSP_ID = 'GovMSP';

@Info({
    title: 'IdentityRegistryContract',
    description: 'Tamper-evident on-chain identity registry with immutable transaction history'
})
export class IdentityRegistryContract extends Contract {

    constructor() {
        super('IdentityRegistryContract');
    }

    /**
     * Registers a new sovereign citizen identity.
     * Restricted to Government Identity Authority (GovMSP).
     *
     * @param ctx Fabric transaction context
     * @param did W3C Decentralized Identifier (e.g. did:example:citizen101)
     * @param identityCommitment 64-character lowercase hexadecimal hash commitment
     * @returns JSON-serialized IdentityRecord
     */
    @Transaction()
    @Returns('string')
    public async RegisterIdentity(
        ctx: Context,
        did: string,
        identityCommitment: string
    ): Promise<string> {
        // 1. ABAC Authorization Check
        const callerMsp = ctx.clientIdentity.getMSPID();
        if (callerMsp !== GOV_MSP_ID) {
            throw new ChaincodeError(
                ErrorCode.UNAUTHORIZED,
                `Caller from organization ${callerMsp} is not authorized to register sovereign identities. Registration is strictly restricted to ${GOV_MSP_ID}.`
            );
        }

        // 2. Syntactic & Cryptographic Validations
        validateDID(did);
        validateCommitment(identityCommitment);

        // 3. Prevent Duplicate Registration
        const compositeKey = ctx.stub.createCompositeKey(RECORD_OBJECT_TYPE, [did.trim()]);
        const existingBytes = await ctx.stub.getState(compositeKey);
        if (existingBytes && existingBytes.length > 0) {
            throw new ChaincodeError(
                ErrorCode.DUPLICATE_IDENTITY,
                `Identity record for DID "${did}" already exists on the ledger.`
            );
        }

        // 4. Deterministic Timestamping from ChannelHeader
        const txTimestamp = getTxTimestampISO(ctx);

        // 5. Construct Identity Record (Zero Raw PII)
        const identityRecord: IdentityRecord = {
            did: did.trim(),
            identityCommitment: identityCommitment.trim().toLowerCase(),
            status: IdentityStatus.ACTIVE,
            issuerOrg: GOV_MSP_ID,
            createdAt: txTimestamp,
            updatedAt: txTimestamp,
            version: 1
        };

        // 6. Write to State Ledger
        const recordBytes = Buffer.from(stringify(sortKeysRecursive(identityRecord)));
        await ctx.stub.putState(compositeKey, recordBytes);

        // 7. Emit Audit Event (Zero Raw PII)
        const eventPayload = {
            did: identityRecord.did,
            identityCommitment: identityRecord.identityCommitment,
            issuerOrg: identityRecord.issuerOrg,
            timestamp: txTimestamp,
            version: identityRecord.version
        };
        ctx.stub.setEvent('IdentityRegistered', Buffer.from(JSON.stringify(eventPayload)));

        return JSON.stringify(identityRecord);
    }

    /**
     * Reads an identity record by DID.
     * Accessible to all authenticated consortium members (GovMSP, UniversityMSP, BankMSP, EmployerMSP).
     *
     * @param ctx Fabric transaction context
     * @param did W3C Decentralized Identifier
     * @returns JSON-serialized IdentityRecord
     */
    @Transaction(false)
    @Returns('string')
    public async ReadIdentity(ctx: Context, did: string): Promise<string> {
        validateDID(did);

        const compositeKey = ctx.stub.createCompositeKey(RECORD_OBJECT_TYPE, [did.trim()]);
        const recordBytes = await ctx.stub.getState(compositeKey);

        if (!recordBytes || recordBytes.length === 0) {
            throw new ChaincodeError(
                ErrorCode.IDENTITY_NOT_FOUND,
                `Identity record for DID "${did}" does not exist on the ledger.`
            );
        }

        return Buffer.from(recordBytes).toString('utf8');
    }

    /**
     * Checks whether an identity record exists for a given DID.
     *
     * @param ctx Fabric transaction context
     * @param did W3C Decentralized Identifier
     * @returns boolean true if identity exists, false otherwise
     */
    @Transaction(false)
    @Returns('boolean')
    public async IdentityExists(ctx: Context, did: string): Promise<boolean> {
        validateDID(did);

        const compositeKey = ctx.stub.createCompositeKey(RECORD_OBJECT_TYPE, [did.trim()]);
        const recordBytes = await ctx.stub.getState(compositeKey);

        return Boolean(recordBytes && recordBytes.length > 0);
    }

    /**
     * Updates the status of an existing identity record.
     * Enforces valid lifecycle state transitions (ACTIVE, SUSPENDED, REVOKED) and terminal revocation.
     * Restricted to GovMSP or the original issuerOrg.
     *
     * @param ctx Fabric transaction context
     * @param did W3C Decentralized Identifier
     * @param newStatus Target IdentityStatus (ACTIVE, SUSPENDED, REVOKED)
     * @returns JSON-serialized updated IdentityRecord
     */
    @Transaction()
    @Returns('string')
    public async UpdateIdentityStatus(
        ctx: Context,
        did: string,
        newStatus: string
    ): Promise<string> {
        validateDID(did);
        const parsedTargetStatus = parseAndValidateStatus(newStatus);

        // 1. Retrieve Current Record
        const compositeKey = ctx.stub.createCompositeKey(RECORD_OBJECT_TYPE, [did.trim()]);
        const recordBytes = await ctx.stub.getState(compositeKey);

        if (!recordBytes || recordBytes.length === 0) {
            throw new ChaincodeError(
                ErrorCode.IDENTITY_NOT_FOUND,
                `Identity record for DID "${did}" does not exist on the ledger.`
            );
        }

        const record: IdentityRecord = JSON.parse(Buffer.from(recordBytes).toString('utf8'));

        // 2. ABAC Authorization Check
        const callerMsp = ctx.clientIdentity.getMSPID();
        if (callerMsp !== GOV_MSP_ID && callerMsp !== record.issuerOrg) {
            throw new ChaincodeError(
                ErrorCode.UNAUTHORIZED,
                `Caller organization ${callerMsp} is not authorized to update status for DID "${did}". Required: ${GOV_MSP_ID} or ${record.issuerOrg}.`
            );
        }

        // 3. Lifecycle Transition Validation
        validateStatusTransition(record.status, parsedTargetStatus);

        // 4. Update Mutable State & Increment Version
        const previousStatus = record.status;
        const txTimestamp = getTxTimestampISO(ctx);

        record.status = parsedTargetStatus;
        record.updatedAt = txTimestamp;
        record.version += 1;

        // 5. Commit Updated State to Ledger
        const updatedBytes = Buffer.from(stringify(sortKeysRecursive(record)));
        await ctx.stub.putState(compositeKey, updatedBytes);

        // 6. Emit Status Update Event
        const eventPayload = {
            did: record.did,
            previousStatus,
            newStatus: record.status,
            issuerOrg: record.issuerOrg,
            timestamp: txTimestamp,
            version: record.version
        };
        ctx.stub.setEvent('IdentityStatusUpdated', Buffer.from(JSON.stringify(eventPayload)));

        return JSON.stringify(record);
    }

    /**
     * Retrieves the complete transaction audit history for a given DID.
     * Returns chronological modifications, block timestamps, and versions.
     *
     * @param ctx Fabric transaction context
     * @param did W3C Decentralized Identifier
     * @returns JSON array of historical modifications
     */
    @Transaction(false)
    @Returns('string')
    public async GetIdentityHistory(ctx: Context, did: string): Promise<string> {
        validateDID(did);

        const compositeKey = ctx.stub.createCompositeKey(RECORD_OBJECT_TYPE, [did.trim()]);
        const iterator = await ctx.stub.getHistoryForKey(compositeKey);

        const allResults = [];
        let result = await iterator.next();

        while (!result.done) {
            const modification: {
                txId: string;
                timestamp: string;
                isDelete: boolean;
                value: unknown;
            } = {
                txId: result.value.txId,
                timestamp: new Date(Number(result.value.timestamp.seconds.low ?? result.value.timestamp.seconds) * 1000).toISOString(),
                isDelete: result.value.isDelete,
                value: null
            };

            if (result.value.value && result.value.value.length > 0) {
                try {
                    modification.value = JSON.parse(Buffer.from(result.value.value).toString('utf8'));
                } catch {
                    modification.value = Buffer.from(result.value.value).toString('utf8');
                }
            }

            allResults.push(modification);
            result = await iterator.next();
        }

        await iterator.close();
        return JSON.stringify(allResults);
    }

    /**
     * Issues a new verifiable credential record.
     * Enforces organization-specific ABAC:
     * - GovMSP: Government/identity credentials
     * - UniversityMSP: Academic credentials
     * - BankMSP: KYC/financial credentials
     * - EmployerMSP: Employment credentials
     *
     * @param ctx Fabric transaction context
     * @param credentialId Unique, non-PII credential identifier
     * @param subjectDID Application DID of the citizen subject (did:example:...)
     * @param issuerDID Application DID of the issuing authority (did:example:...)
     * @param credentialType Type descriptor of the credential
     * @param schemaId Identifier of the credential schema
     * @param credentialCommitment 64-character lowercase hexadecimal hash commitment
     * @param expiresAt ISO-8601 UTC expiration timestamp strictly in the future
     * @returns JSON-serialized CredentialRecord
     */
    @Transaction()
    @Returns('string')
    public async IssueCredential(
        ctx: Context,
        credentialId: string,
        subjectDID: string,
        issuerDID: string,
        credentialType: string,
        schemaId: string,
        credentialCommitment: string,
        expiresAt: string
    ): Promise<string> {
        // 1. Authenticate caller and enforce issuer ABAC
        const callerMsp = ctx.clientIdentity.getMSPID();
        validateCredentialType(credentialType);
        validateIssuerOrganization(callerMsp, credentialType);

        // 2. Syntactic & Cryptographic Validations
        validateCredentialId(credentialId);
        validateDID(subjectDID);
        validateDID(issuerDID);
        validateSchemaId(schemaId);
        validateCommitment(credentialCommitment);

        // 3. Prevent Duplicate Credential Registration
        const compositeKey = ctx.stub.createCompositeKey(CREDENTIAL_OBJECT_TYPE, [credentialId.trim()]);
        const existingBytes = await ctx.stub.getState(compositeKey);
        if (existingBytes && existingBytes.length > 0) {
            throw new ChaincodeError(
                ErrorCode.DUPLICATE_CREDENTIAL,
                `Credential record for ID "${credentialId}" already exists on the ledger.`
            );
        }

        // 4. Deterministic Timestamping from ChannelHeader
        const txTimestamp = getTxTimestampISO(ctx);

        // 5. Expiration Validation relative to transaction issuance time
        validateExpiresAt(expiresAt, txTimestamp);

        // 6. Construct Credential Record (Zero Raw PII, Zero Credential Payload)
        const credentialRecord: CredentialRecord = {
            credentialId: credentialId.trim(),
            subjectDID: subjectDID.trim(),
            issuerDID: issuerDID.trim(),
            issuerOrg: callerMsp,
            credentialType: credentialType.trim(),
            schemaId: schemaId.trim(),
            credentialCommitment: credentialCommitment.trim().toLowerCase(),
            issuedAt: txTimestamp,
            expiresAt: expiresAt.trim(),
            status: CredentialStatus.ACTIVE,
            createdAt: txTimestamp,
            updatedAt: txTimestamp,
            version: 1
        };

        // 7. Write to State Ledger
        const recordBytes = Buffer.from(stringify(sortKeysRecursive(credentialRecord)));
        await ctx.stub.putState(compositeKey, recordBytes);

        // 8. Emit Event
        const eventPayload = {
            credentialId: credentialRecord.credentialId,
            subjectDID: credentialRecord.subjectDID,
            issuerDID: credentialRecord.issuerDID,
            issuerOrg: credentialRecord.issuerOrg,
            credentialType: credentialRecord.credentialType,
            schemaId: credentialRecord.schemaId,
            issuedAt: credentialRecord.issuedAt,
            expiresAt: credentialRecord.expiresAt,
            version: credentialRecord.version
        };
        ctx.stub.setEvent('CredentialIssued', Buffer.from(JSON.stringify(eventPayload)));

        return JSON.stringify(credentialRecord);
    }

    /**
     * Reads a credential record by credential ID.
     * Accessible to all authenticated consortium members.
     *
     * @param ctx Fabric transaction context
     * @param credentialId Unique credential identifier
     * @returns JSON-serialized CredentialRecord
     */
    @Transaction(false)
    @Returns('string')
    public async ReadCredential(ctx: Context, credentialId: string): Promise<string> {
        validateCredentialId(credentialId);

        const compositeKey = ctx.stub.createCompositeKey(CREDENTIAL_OBJECT_TYPE, [credentialId.trim()]);
        const recordBytes = await ctx.stub.getState(compositeKey);

        if (!recordBytes || recordBytes.length === 0) {
            throw new ChaincodeError(
                ErrorCode.CREDENTIAL_NOT_FOUND,
                `Credential record for ID "${credentialId}" does not exist on the ledger.`
            );
        }

        return Buffer.from(recordBytes).toString('utf8');
    }

    /**
     * Checks whether a credential record exists for a given credential ID.
     *
     * @param ctx Fabric transaction context
     * @param credentialId Unique credential identifier
     * @returns boolean true if credential exists, false otherwise
     */
    @Transaction(false)
    @Returns('boolean')
    public async CredentialExists(ctx: Context, credentialId: string): Promise<boolean> {
        validateCredentialId(credentialId);

        const compositeKey = ctx.stub.createCompositeKey(CREDENTIAL_OBJECT_TYPE, [credentialId.trim()]);
        const recordBytes = await ctx.stub.getState(compositeKey);

        return Boolean(recordBytes && recordBytes.length > 0);
    }

    /**
     * Explicit lifecycle method: Permanently revokes an active or suspended credential.
     * Controlled application revocation reason codes are strictly enforced.
     * Restricted strictly to the original issuing organization (record.issuerOrg).
     * Revocation is a permanent terminal state: once revoked, the credential cannot be reinstated or suspended.
     *
     * @param ctx Fabric transaction context
     * @param credentialId Unique credential identifier
     * @param reason Controlled application revocation reason code
     * @returns JSON-serialized updated CredentialRecord
     */
    @Transaction()
    @Returns('string')
    public async RevokeCredential(
        ctx: Context,
        credentialId: string,
        reason: string
    ): Promise<string> {
        validateCredentialId(credentialId);
        const validatedReason = validateRevocationReason(reason);

        // 1. Retrieve Current Record
        const compositeKey = ctx.stub.createCompositeKey(CREDENTIAL_OBJECT_TYPE, [credentialId.trim()]);
        const recordBytes = await ctx.stub.getState(compositeKey);

        if (!recordBytes || recordBytes.length === 0) {
            throw new ChaincodeError(
                ErrorCode.CREDENTIAL_NOT_FOUND,
                `Credential record for ID "${credentialId}" does not exist on the ledger.`
            );
        }

        const record: CredentialRecord = JSON.parse(Buffer.from(recordBytes).toString('utf8'));

        // 2. ABAC Authorization: strictly original issuerOrg
        const callerMsp = ctx.clientIdentity.getMSPID();
        if (callerMsp !== record.issuerOrg) {
            throw new ChaincodeError(
                ErrorCode.UNAUTHORIZED,
                `Caller organization "${callerMsp}" is not authorized to revoke credential "${credentialId}". Required issuer organization: ${record.issuerOrg}.`
            );
        }

        // 3. Lifecycle validation: must be ACTIVE or SUSPENDED. Cannot revoke if already REVOKED.
        if (record.status === CredentialStatus.REVOKED) {
            throw new ChaincodeError(
                ErrorCode.CREDENTIAL_REVOCATION_IS_TERMINAL,
                'Cannot update status of a credential that is REVOKED. Revocation is a permanent terminal state.'
            );
        }

        const previousStatus = record.status;
        const txTimestamp = getTxTimestampISO(ctx);

        // 4. Update mutable state & attach controlled revocation metadata
        record.status = CredentialStatus.REVOKED;
        record.revocationReason = validatedReason;
        record.revokedAt = txTimestamp;
        record.updatedAt = txTimestamp;
        record.version += 1;

        // 5. Commit to ledger
        const updatedBytes = Buffer.from(stringify(sortKeysRecursive(record)));
        await ctx.stub.putState(compositeKey, updatedBytes);

        // 6. Emit specialized CredentialRevoked event (zero PII, non-sensitive audit metadata)
        const revokedEventPayload = {
            credentialId: record.credentialId,
            issuerOrg: record.issuerOrg,
            previousStatus,
            revocationReason: record.revocationReason,
            revokedAt: record.revokedAt,
            version: record.version
        };
        ctx.stub.setEvent('CredentialRevoked', Buffer.from(JSON.stringify(revokedEventPayload)));

        // Also emit generic CredentialStatusUpdated for backward compatibility
        const statusUpdatedPayload = {
            credentialId: record.credentialId,
            previousStatus,
            newStatus: record.status,
            issuerOrg: record.issuerOrg,
            timestamp: txTimestamp,
            version: record.version
        };
        ctx.stub.setEvent('CredentialStatusUpdated', Buffer.from(JSON.stringify(statusUpdatedPayload)));

        return JSON.stringify(record);
    }

    /**
     * Explicit lifecycle method: Temporarily suspends an active credential.
     * Restricted strictly to the original issuing organization (record.issuerOrg).
     * Does not populate revokedAt or mark terminal revocation.
     *
     * @param ctx Fabric transaction context
     * @param credentialId Unique credential identifier
     * @param reason Controlled application reason code
     * @returns JSON-serialized updated CredentialRecord
     */
    @Transaction()
    @Returns('string')
    public async SuspendCredential(
        ctx: Context,
        credentialId: string,
        reason: string
    ): Promise<string> {
        validateCredentialId(credentialId);
        const validatedReason = validateRevocationReason(reason);

        // 1. Retrieve Current Record
        const compositeKey = ctx.stub.createCompositeKey(CREDENTIAL_OBJECT_TYPE, [credentialId.trim()]);
        const recordBytes = await ctx.stub.getState(compositeKey);

        if (!recordBytes || recordBytes.length === 0) {
            throw new ChaincodeError(
                ErrorCode.CREDENTIAL_NOT_FOUND,
                `Credential record for ID "${credentialId}" does not exist on the ledger.`
            );
        }

        const record: CredentialRecord = JSON.parse(Buffer.from(recordBytes).toString('utf8'));

        // 2. ABAC Authorization: strictly original issuerOrg
        const callerMsp = ctx.clientIdentity.getMSPID();
        if (callerMsp !== record.issuerOrg) {
            throw new ChaincodeError(
                ErrorCode.UNAUTHORIZED,
                `Caller organization "${callerMsp}" is not authorized to suspend credential "${credentialId}". Required issuer organization: ${record.issuerOrg}.`
            );
        }

        // 3. Lifecycle validation
        if (record.status === CredentialStatus.REVOKED) {
            throw new ChaincodeError(
                ErrorCode.CREDENTIAL_REVOCATION_IS_TERMINAL,
                'Cannot update status of a credential that is REVOKED. Revocation is a permanent terminal state.'
            );
        }

        if (record.status === CredentialStatus.SUSPENDED) {
            throw new ChaincodeError(
                ErrorCode.NOOP_STATUS_TRANSITION,
                'Credential is already in status SUSPENDED. No-op status transitions are rejected.'
            );
        }

        const previousStatus = record.status;
        const txTimestamp = getTxTimestampISO(ctx);

        // 4. Update mutable state (do NOT set revokedAt)
        record.status = CredentialStatus.SUSPENDED;
        record.updatedAt = txTimestamp;
        record.version += 1;

        // 5. Commit to ledger
        const updatedBytes = Buffer.from(stringify(sortKeysRecursive(record)));
        await ctx.stub.putState(compositeKey, updatedBytes);

        // 6. Emit specialized CredentialSuspended event
        const suspendedEventPayload = {
            credentialId: record.credentialId,
            issuerOrg: record.issuerOrg,
            previousStatus,
            reason: validatedReason,
            timestamp: txTimestamp,
            version: record.version
        };
        ctx.stub.setEvent('CredentialSuspended', Buffer.from(JSON.stringify(suspendedEventPayload)));

        // Also emit generic CredentialStatusUpdated
        const statusUpdatedPayload = {
            credentialId: record.credentialId,
            previousStatus,
            newStatus: record.status,
            issuerOrg: record.issuerOrg,
            timestamp: txTimestamp,
            version: record.version
        };
        ctx.stub.setEvent('CredentialStatusUpdated', Buffer.from(JSON.stringify(statusUpdatedPayload)));

        return JSON.stringify(record);
    }

    /**
     * Explicit lifecycle method: Reinstates a suspended credential back to ACTIVE status.
     * Restricted strictly to the original issuing organization (record.issuerOrg).
     * Cannot reinstate a REVOKED credential (terminal state).
     *
     * @param ctx Fabric transaction context
     * @param credentialId Unique credential identifier
     * @returns JSON-serialized updated CredentialRecord
     */
    @Transaction()
    @Returns('string')
    public async ReinstateCredential(
        ctx: Context,
        credentialId: string
    ): Promise<string> {
        validateCredentialId(credentialId);

        // 1. Retrieve Current Record
        const compositeKey = ctx.stub.createCompositeKey(CREDENTIAL_OBJECT_TYPE, [credentialId.trim()]);
        const recordBytes = await ctx.stub.getState(compositeKey);

        if (!recordBytes || recordBytes.length === 0) {
            throw new ChaincodeError(
                ErrorCode.CREDENTIAL_NOT_FOUND,
                `Credential record for ID "${credentialId}" does not exist on the ledger.`
            );
        }

        const record: CredentialRecord = JSON.parse(Buffer.from(recordBytes).toString('utf8'));

        // 2. ABAC Authorization: strictly original issuerOrg
        const callerMsp = ctx.clientIdentity.getMSPID();
        if (callerMsp !== record.issuerOrg) {
            throw new ChaincodeError(
                ErrorCode.UNAUTHORIZED,
                `Caller organization "${callerMsp}" is not authorized to reinstate credential "${credentialId}". Required issuer organization: ${record.issuerOrg}.`
            );
        }

        // 3. Lifecycle validation
        if (record.status === CredentialStatus.REVOKED) {
            throw new ChaincodeError(
                ErrorCode.CREDENTIAL_REVOCATION_IS_TERMINAL,
                'Cannot update status of a credential that is REVOKED. Revocation is a permanent terminal state.'
            );
        }

        if (record.status === CredentialStatus.ACTIVE) {
            throw new ChaincodeError(
                ErrorCode.NOOP_STATUS_TRANSITION,
                'Credential is already in status ACTIVE. No-op status transitions are rejected.'
            );
        }

        const previousStatus = record.status;
        const txTimestamp = getTxTimestampISO(ctx);

        // 4. Update mutable state
        record.status = CredentialStatus.ACTIVE;
        record.updatedAt = txTimestamp;
        record.version += 1;

        // 5. Commit to ledger
        const updatedBytes = Buffer.from(stringify(sortKeysRecursive(record)));
        await ctx.stub.putState(compositeKey, updatedBytes);

        // 6. Emit specialized CredentialReinstated event
        const reinstatedEventPayload = {
            credentialId: record.credentialId,
            issuerOrg: record.issuerOrg,
            previousStatus,
            timestamp: txTimestamp,
            version: record.version
        };
        ctx.stub.setEvent('CredentialReinstated', Buffer.from(JSON.stringify(reinstatedEventPayload)));

        // Also emit generic CredentialStatusUpdated
        const statusUpdatedPayload = {
            credentialId: record.credentialId,
            previousStatus,
            newStatus: record.status,
            issuerOrg: record.issuerOrg,
            timestamp: txTimestamp,
            version: record.version
        };
        ctx.stub.setEvent('CredentialStatusUpdated', Buffer.from(JSON.stringify(statusUpdatedPayload)));

        return JSON.stringify(record);
    }

    /**
     * Updates the status of an existing credential record (generic compatibility path).
     * Retained for backward compatibility with Milestone 5 test harnesses.
     * Enforces valid lifecycle state transitions (ACTIVE, SUSPENDED, REVOKED) and terminal revocation.
     * Restricted strictly to the authenticated issuing organization (record.issuerOrg).
     *
     * @param ctx Fabric transaction context
     * @param credentialId Unique credential identifier
     * @param newStatus Target CredentialStatus (ACTIVE, SUSPENDED, REVOKED)
     * @returns JSON-serialized updated CredentialRecord
     */
    @Transaction()
    @Returns('string')
    public async UpdateCredentialStatus(
        ctx: Context,
        credentialId: string,
        newStatus: string
    ): Promise<string> {
        validateCredentialId(credentialId);
        const parsedTargetStatus = parseAndValidateCredentialStatus(newStatus);

        // 1. Retrieve Current Record
        const compositeKey = ctx.stub.createCompositeKey(CREDENTIAL_OBJECT_TYPE, [credentialId.trim()]);
        const recordBytes = await ctx.stub.getState(compositeKey);

        if (!recordBytes || recordBytes.length === 0) {
            throw new ChaincodeError(
                ErrorCode.CREDENTIAL_NOT_FOUND,
                `Credential record for ID "${credentialId}" does not exist on the ledger.`
            );
        }

        const record: CredentialRecord = JSON.parse(Buffer.from(recordBytes).toString('utf8'));

        // 2. ABAC Authorization Check: Only original issuerOrg may update status
        const callerMsp = ctx.clientIdentity.getMSPID();
        if (callerMsp !== record.issuerOrg) {
            throw new ChaincodeError(
                ErrorCode.UNAUTHORIZED,
                `Caller organization "${callerMsp}" is not authorized to update status for credential "${credentialId}". Required issuer organization: ${record.issuerOrg}.`
            );
        }

        // 3. Lifecycle Transition Validation
        validateCredentialStatusTransition(record.status, parsedTargetStatus);

        // 4. Update Mutable State & Increment Version
        const previousStatus = record.status;
        const txTimestamp = getTxTimestampISO(ctx);

        record.status = parsedTargetStatus;
        if (parsedTargetStatus === CredentialStatus.REVOKED) {
            if (!record.revocationReason) {
                record.revocationReason = RevocationReason.UNSPECIFIED;
            }
            if (!record.revokedAt) {
                record.revokedAt = txTimestamp;
            }
        }
        record.updatedAt = txTimestamp;
        record.version += 1;

        // 5. Commit to Ledger
        const updatedBytes = Buffer.from(stringify(sortKeysRecursive(record)));
        await ctx.stub.putState(compositeKey, updatedBytes);

        // 6. Emit Status Update Events
        const eventPayload = {
            credentialId: record.credentialId,
            previousStatus,
            newStatus: record.status,
            issuerOrg: record.issuerOrg,
            timestamp: txTimestamp,
            version: record.version
        };
        ctx.stub.setEvent('CredentialStatusUpdated', Buffer.from(JSON.stringify(eventPayload)));

        if (parsedTargetStatus === CredentialStatus.REVOKED) {
            const revokedPayload = {
                credentialId: record.credentialId,
                issuerOrg: record.issuerOrg,
                previousStatus,
                revocationReason: record.revocationReason,
                revokedAt: record.revokedAt,
                version: record.version
            };
            ctx.stub.setEvent('CredentialRevoked', Buffer.from(JSON.stringify(revokedPayload)));
        } else if (parsedTargetStatus === CredentialStatus.SUSPENDED) {
            const suspendedPayload = {
                credentialId: record.credentialId,
                issuerOrg: record.issuerOrg,
                previousStatus,
                reason: RevocationReason.UNSPECIFIED,
                timestamp: txTimestamp,
                version: record.version
            };
            ctx.stub.setEvent('CredentialSuspended', Buffer.from(JSON.stringify(suspendedPayload)));
        } else if (parsedTargetStatus === CredentialStatus.ACTIVE) {
            const reinstatedPayload = {
                credentialId: record.credentialId,
                issuerOrg: record.issuerOrg,
                previousStatus,
                timestamp: txTimestamp,
                version: record.version
            };
            ctx.stub.setEvent('CredentialReinstated', Buffer.from(JSON.stringify(reinstatedPayload)));
        }

        return JSON.stringify(record);
    }

    /**
     * Lightweight read-only lifecycle status query.
     * Retrieves the current on-chain lifecycle status without requiring subject DID or hash commitment.
     * Evaluates effective expiration dynamically against deterministic transaction timestamp without mutating state.
     *
     * @param ctx Fabric transaction context
     * @param credentialId Unique credential identifier
     * @returns JSON-serialized CredentialStatusResult
     */
    @Transaction(false)
    @Returns('string')
    public async GetCredentialStatus(
        ctx: Context,
        credentialId: string
    ): Promise<string> {
        validateCredentialId(credentialId);

        const compositeKey = ctx.stub.createCompositeKey(CREDENTIAL_OBJECT_TYPE, [credentialId.trim()]);
        const recordBytes = await ctx.stub.getState(compositeKey);

        if (!recordBytes || recordBytes.length === 0) {
            throw new ChaincodeError(
                ErrorCode.CREDENTIAL_NOT_FOUND,
                `Credential record for ID "${credentialId}" does not exist on the ledger.`
            );
        }

        const record: CredentialRecord = JSON.parse(Buffer.from(recordBytes).toString('utf8'));
        const txTimestamp = getTxTimestampISO(ctx);

        // Evaluate effective status: if stored ACTIVE but txTimestamp >= expiresAt, report effectiveStatus as EXPIRED
        let effectiveStatus: string = record.status;
        const txMillis = Date.parse(txTimestamp);
        const expMillis = Date.parse(record.expiresAt);

        if (record.status === CredentialStatus.ACTIVE && txMillis >= expMillis) {
            effectiveStatus = 'EXPIRED';
        }

        const result: CredentialStatusResult = {
            credentialId: record.credentialId,
            status: record.status,
            effectiveStatus,
            issuerOrg: record.issuerOrg,
            credentialType: record.credentialType,
            issuedAt: record.issuedAt,
            expiresAt: record.expiresAt,
            version: record.version,
            evaluatedAt: txTimestamp
        };

        if (record.status === CredentialStatus.REVOKED) {
            result.revocationReason = record.revocationReason;
            result.revokedAt = record.revokedAt;
        }

        return JSON.stringify(result);
    }

    /**
     * Performs registry-level verification of a credential against current on-chain state.
     * Evaluates existence, subject DID match, commitment hash match, revocation, suspension, and expiration.
     * Uses the deterministic transaction timestamp as reference time for expiration evaluation.
     *
     * @param ctx Fabric transaction context
     * @param credentialId Unique credential identifier
     * @param subjectDID Expected subject application DID
     * @param presentedCredentialCommitment 64-character lowercase hex hash commitment
     * @returns JSON-serialized VerificationResult
     */
    @Transaction(false)
    @Returns('string')
    public async VerifyCredential(
        ctx: Context,
        credentialId: string,
        subjectDID: string,
        presentedCredentialCommitment: string
    ): Promise<string> {
        validateCredentialId(credentialId);
        validateDID(subjectDID);
        validateCommitment(presentedCredentialCommitment);

        const txTimestamp = getTxTimestampISO(ctx);
        const compositeKey = ctx.stub.createCompositeKey(CREDENTIAL_OBJECT_TYPE, [credentialId.trim()]);
        const recordBytes = await ctx.stub.getState(compositeKey);

        // 1. Existence check
        if (!recordBytes || recordBytes.length === 0) {
            const notFoundResult: VerificationResult = {
                valid: false,
                reason: 'NOT_FOUND',
                credentialId: credentialId.trim(),
                verifiedAt: txTimestamp
            };
            return JSON.stringify(notFoundResult);
        }

        const record: CredentialRecord = JSON.parse(Buffer.from(recordBytes).toString('utf8'));

        // 2. Subject DID match
        if (record.subjectDID !== subjectDID.trim()) {
            const subjectMismatchResult: VerificationResult = {
                valid: false,
                reason: 'SUBJECT_MISMATCH',
                credentialId: record.credentialId,
                subjectDID: subjectDID.trim(),
                issuerOrg: record.issuerOrg,
                credentialType: record.credentialType,
                status: record.status,
                verifiedAt: txTimestamp
            };
            return JSON.stringify(subjectMismatchResult);
        }

        // 3. Commitment hash match
        if (record.credentialCommitment !== presentedCredentialCommitment.trim().toLowerCase()) {
            const commitmentMismatchResult: VerificationResult = {
                valid: false,
                reason: 'COMMITMENT_MISMATCH',
                credentialId: record.credentialId,
                subjectDID: record.subjectDID,
                issuerOrg: record.issuerOrg,
                credentialType: record.credentialType,
                status: record.status,
                verifiedAt: txTimestamp
            };
            return JSON.stringify(commitmentMismatchResult);
        }

        // 4. Revocation check
        if (record.status === CredentialStatus.REVOKED) {
            const revokedResult: VerificationResult = {
                valid: false,
                reason: 'REVOKED',
                credentialId: record.credentialId,
                subjectDID: record.subjectDID,
                issuerOrg: record.issuerOrg,
                credentialType: record.credentialType,
                status: record.status,
                verifiedAt: txTimestamp
            };
            return JSON.stringify(revokedResult);
        }

        // 5. Suspension check
        if (record.status === CredentialStatus.SUSPENDED) {
            const suspendedResult: VerificationResult = {
                valid: false,
                reason: 'SUSPENDED',
                credentialId: record.credentialId,
                subjectDID: record.subjectDID,
                issuerOrg: record.issuerOrg,
                credentialType: record.credentialType,
                status: record.status,
                verifiedAt: txTimestamp
            };
            return JSON.stringify(suspendedResult);
        }

        // 6. Expiration check against transaction timestamp
        const txMillis = Date.parse(txTimestamp);
        const expMillis = Date.parse(record.expiresAt);
        if (txMillis >= expMillis) {
            const expiredResult: VerificationResult = {
                valid: false,
                reason: 'EXPIRED',
                credentialId: record.credentialId,
                subjectDID: record.subjectDID,
                issuerOrg: record.issuerOrg,
                credentialType: record.credentialType,
                status: record.status,
                verifiedAt: txTimestamp
            };
            return JSON.stringify(expiredResult);
        }

        // 7. Success - Credential is valid
        const successResult: VerificationResult = {
            valid: true,
            reason: 'VALID',
            credentialId: record.credentialId,
            subjectDID: record.subjectDID,
            issuerOrg: record.issuerOrg,
            credentialType: record.credentialType,
            status: record.status,
            verifiedAt: txTimestamp
        };

        const eventPayload = {
            credentialId: record.credentialId,
            valid: true,
            reason: 'VALID',
            verifiedAt: txTimestamp
        };
        ctx.stub.setEvent('CredentialVerified', Buffer.from(JSON.stringify(eventPayload)));

        return JSON.stringify(successResult);
    }

    /**
     * Retrieves the complete transaction audit history for a given credential ID.
     *
     * @param ctx Fabric transaction context
     * @param credentialId Unique credential identifier
     * @returns JSON array of historical modifications
     */
    @Transaction(false)
    @Returns('string')
    public async GetCredentialHistory(ctx: Context, credentialId: string): Promise<string> {
        validateCredentialId(credentialId);

        const compositeKey = ctx.stub.createCompositeKey(CREDENTIAL_OBJECT_TYPE, [credentialId.trim()]);
        const iterator = await ctx.stub.getHistoryForKey(compositeKey);

        const allResults = [];
        let result = await iterator.next();

        while (!result.done) {
            const modification: {
                txId: string;
                timestamp: string;
                isDelete: boolean;
                value: unknown;
            } = {
                txId: result.value.txId,
                timestamp: new Date(Number(result.value.timestamp.seconds.low ?? result.value.timestamp.seconds) * 1000).toISOString(),
                isDelete: result.value.isDelete,
                value: null
            };

            if (result.value.value && result.value.value.length > 0) {
                try {
                    modification.value = JSON.parse(Buffer.from(result.value.value).toString('utf8'));
                } catch {
                    modification.value = Buffer.from(result.value.value).toString('utf8');
                }
            }

            allResults.push(modification);
            result = await iterator.next();
        }

        await iterator.close();
        return JSON.stringify(allResults);
    }
}

