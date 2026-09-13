/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Object as FabricObject, Property } from 'fabric-contract-api';

export enum CredentialStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    REVOKED = 'REVOKED'
}

/**
 * Controlled application revocation reason codes inspired by established credential/revocation terminology.
 * These are application-defined controlled reason codes.
 */
export enum RevocationReason {
    KEY_COMPROMISE = 'KEY_COMPROMISE',
    AFFILIATION_CHANGED = 'AFFILIATION_CHANGED',
    SUPERSEDED = 'SUPERSEDED',
    CESSATION_OF_OPERATION = 'CESSATION_OF_OPERATION',
    PRIVILEGE_WITHDRAWN = 'PRIVILEGE_WITHDRAWN',
    UNSPECIFIED = 'UNSPECIFIED'
}

export type VerificationReason =
    | 'VALID'
    | 'NOT_FOUND'
    | 'SUBJECT_MISMATCH'
    | 'COMMITMENT_MISMATCH'
    | 'SUSPENDED'
    | 'REVOKED'
    | 'EXPIRED';

export interface VerificationResult {
    valid: boolean;
    reason: VerificationReason;
    credentialId: string;
    subjectDID?: string;
    issuerOrg?: string;
    credentialType?: string;
    status?: CredentialStatus;
    verifiedAt: string;
}

export interface CredentialStatusResult {
    credentialId: string;
    status: CredentialStatus;
    effectiveStatus: string;
    issuerOrg: string;
    credentialType: string;
    issuedAt: string;
    expiresAt: string;
    version: number;
    revocationReason?: RevocationReason;
    revokedAt?: string;
    evaluatedAt: string;
}

@FabricObject()
export class CredentialRecord {
    @Property()
    public credentialId: string = '';

    @Property()
    public subjectDID: string = '';

    @Property()
    public issuerDID: string = '';

    @Property()
    public issuerOrg: string = '';

    @Property()
    public credentialType: string = '';

    @Property()
    public schemaId: string = '';

    @Property()
    public credentialCommitment: string = '';

    @Property()
    public issuedAt: string = '';

    @Property()
    public expiresAt: string = '';

    @Property()
    public status: CredentialStatus = CredentialStatus.ACTIVE;

    @Property()
    public revocationReason?: RevocationReason;

    @Property()
    public revokedAt?: string;

    @Property()
    public createdAt: string = '';

    @Property()
    public updatedAt: string = '';

    @Property()
    public version: number = 1;
}
