/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Object as FabricObject, Property } from 'fabric-contract-api';

export enum CredentialStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    REVOKED = 'REVOKED'
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
    public createdAt: string = '';

    @Property()
    public updatedAt: string = '';

    @Property()
    public version: number = 1;
}
