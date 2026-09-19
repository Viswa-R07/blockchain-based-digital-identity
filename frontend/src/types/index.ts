/**
 * FabricID Core Type Definitions
 * Aligned strictly with Hyperledger Fabric v2.5.16 backend DTOs,
 * chaincode identityRegistryContract, and Google Stitch specifications.
 */

export type DataClassification = 'LIVE' | 'DERIVED' | 'STATIC' | 'SAMPLE';

export type PersonaType =
  | 'GOV'
  | 'UNI'
  | 'BANK'
  | 'EMP'
  | 'VERIFIER'
  | 'CITIZEN';

export type MspId =
  | 'GovMSP'
  | 'UniversityMSP'
  | 'BankMSP'
  | 'EmployerMSP'
  | 'VerifierOrg'
  | 'Public';

export interface PersonaConfig {
  id: PersonaType;
  name: string;
  roleTitle: string;
  mspId: MspId;
  issuerDid?: string;
  description: string;
  allowedCredentialTypes: CredentialType[];
  badgeColor: 'cyan' | 'verified' | 'suspended' | 'revoked' | 'neutral';
}

export type CredentialType =
  | 'government-id'
  | 'academic'
  | 'kyc'
  | 'employment';

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: any;
  };
  latencyMs?: number;
  message?: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  service?: string;
  network?: string;
  channel?: string;
  chaincode?: {
    name: string;
    version: string;
    sequence: number;
  };
}

/* ==========================================================================
   1. Identity Domain Types (GET /api/v1/identities/...)
   Aligned with backend IdentityController & chaincode IdentityRecord
   ========================================================================== */

/**
 * Authoritative Identity Status lifecycle states in Hyperledger Fabric chaincode:
 * ACTIVE, SUSPENDED, REVOKED
 */
export type IdentityStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface IdentityRecord {
  did: string;
  identityCommitment: string;
  status: IdentityStatus;
  issuerOrg: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface IdentityResponse {
  data: IdentityRecord;
  latencyMs: number;
}

export interface IdentityExistsResponse {
  exists: boolean;
  did?: string;
  latencyMs: number;
}

export interface IdentityHistoryEvent {
  txId: string;
  timestamp: string;
  isDelete: boolean;
  value: unknown;
}

export interface IdentityHistoryResponse {
  data: IdentityHistoryEvent[];
  latencyMs: number;
}

/* ==========================================================================
   2. Credential Domain Types (GET /api/v1/credentials/...)
   Aligned with backend CredentialController & chaincode CredentialRecord
   ========================================================================== */

export type CredentialStatus = 'ACTIVE' | 'ISSUED' | 'SUSPENDED' | 'REVOKED';

export type RevocationReason =
  | 'KEY_COMPROMISE'
  | 'AFFILIATION_CHANGED'
  | 'SUPERSEDED'
  | 'CESSATION_OF_OPERATION'
  | 'PRIVILEGE_WITHDRAWN'
  | 'UNSPECIFIED';

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
  revocationReason?: RevocationReason | string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
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
  revocationReason?: RevocationReason | string;
  revokedAt?: string;
  evaluatedAt: string;
}

export interface CredentialStatusResponse {
  data: CredentialStatusResult;
  latencyMs: number;
}

export interface CredentialHistoryEvent {
  txId: string;
  timestamp: string;
  isDelete: boolean;
  value: unknown;
}

export interface CredentialHistoryResponse {
  data: CredentialHistoryEvent[];
  latencyMs: number;
}

/* ==========================================================================
   3. Verification Domain Types (POST /api/v1/credentials/verify)
   Aligned with backend VerificationController & chaincode VerifyCredential
   ========================================================================== */

export interface VerificationRequest {
  credentialId: string;
  subjectDID: string;
  credentialCommitment: string;
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
  reason: VerificationReason | string;
  credentialId: string;
  subjectDID?: string;
  issuerOrg?: string;
  credentialType?: string;
  status?: CredentialStatus | string;
  verifiedAt: string;
}

export interface VerificationResponse {
  data: VerificationResult;
  latencyMs: number;
}

/* ==========================================================================
   4. Storage Domain Types (GET/POST/DELETE /api/v1/credentials/:id/storage)
   Aligned with backend StorageController & EncryptedStorageRecord
   ========================================================================== */

export interface StorageMetadata {
  credentialId: string;
  credentialCommitment: string;
  encryptionAlgorithm: 'AES-256-GCM' | string;
  keyId: string;
  iv: string;
  authTag: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StorageMetadataResponse {
  data: StorageMetadata;
}

export interface RetrieveCredentialResponse {
  credentialId: string;
  issuerOrg: string;
  subjectDID: string;
  credentialType: string;
  status: string;
  payload: Record<string, any>;
}

export interface VerifyStorageResponse {
  valid: boolean;
  credentialId: string;
  onChainCommitment?: string;
  computedCommitment?: string;
  commitmentMatch?: boolean;
  onChainStatus?: string;
  reason?: string;
  verifiedAt: string;
}

export interface DeleteStorageResponse {
  message: string;
  credentialId: string;
  ledgerIntact: boolean;
}

/* ==========================================================================
   5. Issuance & Lifecycle Mutation Types
   ========================================================================== */

export interface IssueCredentialRequest {
  credentialId: string;
  subjectDID: string;
  issuerDID: string;
  credentialCommitment: string;
  expiresAt: string;
}

export interface IssueCredentialResponse {
  message: string;
  data: CredentialRecord;
  latencyMs: number;
}

export interface SuspendCredentialRequest {
  reason?: RevocationReason;
}

export interface RevokeCredentialRequest {
  reason: RevocationReason;
}

export interface LifecycleMutationResponse {
  message: string;
  data: CredentialRecord;
  latencyMs: number;
}

/* ==========================================================================
   6. Backward Compatibility Aliases & Audit Types
   ========================================================================== */

export type StorageVerifyResult = VerifyStorageResponse;
export type DecryptedPayloadResult = RetrieveCredentialResponse;
export type HistoryRecord = CredentialHistoryEvent;

export interface AuditEvent {
  txId: string;
  timestamp: string;
  action: string;
  actor: string;
  mspId: string;
  targetId: string;
  status: string;
  isSample?: boolean;
}
