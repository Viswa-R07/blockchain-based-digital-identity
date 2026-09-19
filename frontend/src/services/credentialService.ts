import { apiClient } from './apiClient';
import {
  IdentityRecord,
  IdentityExistsResponse,
  IdentityHistoryEvent,
  CredentialRecord,
  CredentialStatusResult,
  CredentialHistoryEvent,
  VerificationRequest,
  VerificationResult,
  StorageMetadata,
  RetrieveCredentialResponse,
  VerifyStorageResponse,
  DeleteStorageResponse,
  IssueCredentialRequest,
  CredentialType,
  RevocationReason,
} from '../types';

/**
 * credentialService
 * Strongly typed service wrapper around apiClient for Phase 3 Identity, Credential, Verification, and Storage endpoints.
 * Consumes ONLY real, existing backend routes under /api/v1/.
 * Preserves backend response payloads and latencyMs exactly as returned.
 */
export const credentialService = {
  // =========================================================================
  // Identity APIs
  // =========================================================================

  /**
   * GET /api/v1/identities/:did
   * Retrieves authoritative subject identity record from Hyperledger Fabric ledger.
   * Returns { data: IdentityRecord, latencyMs }
   */
  async getIdentity(did: string) {
    return apiClient.get<IdentityRecord>(`/identities/${encodeURIComponent(did.trim())}`);
  },

  /**
   * GET /api/v1/identities/:did/exists
   * Liveness and registration check for subject DID on Fabric ledger.
   * Returns { exists: boolean, latencyMs }
   */
  async checkIdentityExists(did: string) {
    return apiClient.get<IdentityExistsResponse>(`/identities/${encodeURIComponent(did.trim())}/exists`);
  },

  /**
   * GET /api/v1/identities/:did/history
   * Retrieves complete blockchain transaction audit history for the subject DID.
   * Returns { data: IdentityHistoryEvent[], latencyMs }
   */
  async getIdentityHistory(did: string) {
    return apiClient.get<IdentityHistoryEvent[]>(`/identities/${encodeURIComponent(did.trim())}/history`);
  },

  // =========================================================================
  // Credential APIs
  // =========================================================================

  /**
   * GET /api/v1/credentials/:credentialId
   * Reads on-chain credential record and SHA-256 commitment from Fabric ledger.
   * Returns { data: CredentialRecord, latencyMs }
   */
  async getCredential(credentialId: string) {
    return apiClient.get<CredentialRecord>(`/credentials/${encodeURIComponent(credentialId.trim())}`);
  },

  /**
   * GET /api/v1/credentials/:credentialId/status
   * Reads current lifecycle status and effective timestamps from Fabric ledger.
   * Returns { data: CredentialStatusResult, latencyMs }
   */
  async getCredentialStatus(credentialId: string) {
    return apiClient.get<CredentialStatusResult>(`/credentials/${encodeURIComponent(credentialId.trim())}/status`);
  },

  /**
   * GET /api/v1/credentials/:credentialId/history
   * Retrieves chronological state transitions (issuance, suspension, reinstatement, revocation).
   * Returns { data: CredentialHistoryEvent[], latencyMs }
   */
  async getCredentialHistory(credentialId: string) {
    return apiClient.get<CredentialHistoryEvent[]>(`/credentials/${encodeURIComponent(credentialId.trim())}/history`);
  },

  // =========================================================================
  // Verification API
  // =========================================================================

  /**
   * POST /api/v1/credentials/verify
   * Evaluates cryptographic SHA-256 commitment and revocation status on Hyperledger Fabric.
   * Overloaded to accept either a VerificationRequest object or discrete arguments.
   * Preserves exact backend VerificationResult payload and latencyMs without fabrication.
   */
  async verifyCredential(
    reqOrId: VerificationRequest | string,
    subjectDID?: string,
    credentialCommitment?: string
  ) {
    const payload: VerificationRequest =
      typeof reqOrId === 'string'
        ? {
            credentialId: reqOrId.trim(),
            subjectDID: (subjectDID || '').trim(),
            credentialCommitment: (credentialCommitment || '').trim().toLowerCase(),
          }
        : {
            credentialId: reqOrId.credentialId.trim(),
            subjectDID: reqOrId.subjectDID.trim(),
            credentialCommitment: reqOrId.credentialCommitment.trim().toLowerCase(),
          };

    return apiClient.post<VerificationResult>('/credentials/verify', payload);
  },

  // =========================================================================
  // Issuance APIs (Milestone 11)
  // =========================================================================

  /**
   * POST /api/v1/credentials/:typeKey
   * Submits new credential record to Hyperledger Fabric channel.
   */
  async issueCredential(typeKey: CredentialType, payload: IssueCredentialRequest) {
    return apiClient.post<CredentialRecord>(`/credentials/${typeKey}`, payload);
  },

  // =========================================================================
  // Lifecycle Mutation APIs (Milestone 6 / Milestone 11)
  // =========================================================================

  /**
   * POST /api/v1/credentials/:credentialId/suspend
   * Temporarily suspends an active credential on Hyperledger Fabric ledger.
   */
  async suspendCredential(credentialId: string, reason?: RevocationReason) {
    return apiClient.post<CredentialRecord>(
      `/credentials/${encodeURIComponent(credentialId.trim())}/suspend`,
      { reason: reason || 'PRIVILEGE_WITHDRAWN' }
    );
  },

  /**
   * POST /api/v1/credentials/:credentialId/reinstate
   * Reinstates a suspended credential back to ACTIVE on Fabric ledger.
   */
  async reinstateCredential(credentialId: string) {
    return apiClient.post<CredentialRecord>(
      `/credentials/${encodeURIComponent(credentialId.trim())}/reinstate`,
      {}
    );
  },

  /**
   * POST /api/v1/credentials/:credentialId/revoke
   * Permanently revokes a credential on Fabric ledger. Irreversible terminal mutation.
   */
  async revokeCredential(credentialId: string, reason: RevocationReason) {
    return apiClient.post<CredentialRecord>(
      `/credentials/${encodeURIComponent(credentialId.trim())}/revoke`,
      { reason }
    );
  },

  /**
   * POST /api/v1/credentials/:credentialId/storage
   * Encrypts and persists credential claims payload off-chain (AES-256-GCM).
   */
  async storeCredential(credentialId: string, payload: Record<string, any>) {
    return apiClient.post<{ message: string; metadata: StorageMetadata }>(
      `/credentials/${encodeURIComponent(credentialId.trim())}/storage`,
      payload
    );
  },

  // =========================================================================
  // Off-Chain Encrypted Storage APIs
  // =========================================================================

  /**
   * GET /api/v1/credentials/:credentialId/storage
   * Retrieves off-chain encrypted storage metadata (AES-256-GCM parameters, IV, authTag, keyId, version).
   * Strictly avoids returning decrypted plaintext claims.
   */
  async getStorageMetadata(credentialId: string) {
    return apiClient.get<StorageMetadata>(`/credentials/${encodeURIComponent(credentialId.trim())}/storage`);
  },

  /**
   * POST /api/v1/credentials/:credentialId/retrieve
   * Authorized retrieval and AES-256-GCM decryption of off-chain credential payload.
   * Authorization restricted to issuing MSP or GOV_ADMIN.
   */
  async retrieveCredential(credentialId: string) {
    return apiClient.post<RetrieveCredentialResponse>(
      `/credentials/${encodeURIComponent(credentialId.trim())}/retrieve`
    );
  },

  /**
   * Backward-compatibility alias for retrieveCredential
   */
  async retrieveDecrypted(credentialId: string) {
    return this.retrieveCredential(credentialId);
  },

  /**
   * POST /api/v1/credentials/:credentialId/verify-storage
   * Performs end-to-end off-chain storage integrity check against Fabric on-chain commitment.
   */
  async verifyStorage(credentialId: string) {
    return apiClient.post<VerifyStorageResponse>(
      `/credentials/${encodeURIComponent(credentialId.trim())}/verify-storage`
    );
  },

  /**
   * DELETE /api/v1/credentials/:credentialId/storage
   * Permanently deletes encrypted off-chain ciphertext while preserving immutable ledger commitment.
   */
  async deleteStorage(credentialId: string) {
    return apiClient.delete<DeleteStorageResponse>(
      `/credentials/${encodeURIComponent(credentialId.trim())}/storage`
    );
  },
};
