/*
 * SPDX-License-Identifier: Apache-2.0
 */

export type OrgMspId = 'GovMSP' | 'UniversityMSP' | 'BankMSP' | 'EmployerMSP';
export type ApplicationOrg = OrgMspId | 'VerifierOrg';

export enum IdentityStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    REVOKED = 'REVOKED'
}

export enum CredentialStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    REVOKED = 'REVOKED'
}

export enum RevocationReason {
    KEY_COMPROMISE = 'KEY_COMPROMISE',
    AFFILIATION_CHANGED = 'AFFILIATION_CHANGED',
    SUPERSEDED = 'SUPERSEDED',
    CESSATION_OF_OPERATION = 'CESSATION_OF_OPERATION',
    PRIVILEGE_WITHDRAWN = 'PRIVILEGE_WITHDRAWN',
    UNSPECIFIED = 'UNSPECIFIED'
}

export interface IdentityRecord {
    did: string;
    identityCommitment: string;
    status: IdentityStatus;
    issuerOrg: string;
    createdAt: string;
    updatedAt: string;
    version: number;
}

export interface CredentialRecord {
    credentialId: string;
    subjectDID: string;
    issuerDID: string;
    issuerOrg: string;
    credentialType: string;
    schemaId: string;
    credentialCommitment: string;
    issuedAt: string;
    expiresAt: string;
    status: CredentialStatus;
    createdAt: string;
    updatedAt: string;
    version: number;
    revocationReason?: RevocationReason;
    revokedAt?: string;
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
    evaluatedAt: string;
    revocationReason?: RevocationReason;
    revokedAt?: string;
}

export interface VerificationResult {
    valid: boolean;
    reason: string;
    credentialId?: string;
    subjectDID?: string;
    issuerOrg?: string;
    credentialType?: string;
    status?: string;
    verifiedAt: string;
}

export interface OrgConfig {
    mspId: OrgMspId;
    peerEndpoint: string;
    peerHostOverride: string;
    tlsCertPath: string;
    userCertPath: string;
    keystoreDir: string;
}

export interface AuthenticatedUser {
    org: ApplicationOrg;
    role: string;
    apiKeyName: string;
}
