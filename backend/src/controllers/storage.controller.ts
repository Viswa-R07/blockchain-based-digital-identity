/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { ContractService } from '../fabric/contractService.js';
import { gatewayManager } from '../fabric/gatewayManager.js';
import { CredentialStorage, EncryptedStorageRecord } from '../storage/credentialStorage.js';
import { EncryptedFileStorage } from '../storage/encryptedFileStorage.js';
import {
    buildStorageAAD,
    calculateCredentialCommitment,
    canonicalizeJson,
    decryptPayload,
    encryptPayload
} from '../storage/encryption.js';
import { EnvKeyProvider, KeyProvider } from '../storage/keyProvider.js';
import { CredentialRecord } from '../types/index.js';
import { AuditLogger } from '../utils/auditLogger.js';

export class StorageController {
    private readonly storage: CredentialStorage;
    private readonly keyProvider: KeyProvider;

    constructor(storage?: CredentialStorage, keyProvider?: KeyProvider) {
        this.storage = storage || new EncryptedFileStorage(env.CREDENTIAL_STORAGE_PATH);
        this.keyProvider = keyProvider || new EnvKeyProvider(env.STORAGE_MASTER_KEY, env.STORAGE_KEY_ID);
    }

    /**
     * POST /api/v1/credentials/:credentialId/storage
     * Encrypts and persists credential payload off-chain.
     * Enforces that the authoritative Fabric record exists, the caller is the authorized issuer,
     * and the computed canonical commitment exactly matches the on-chain commitment.
     */
    public storeCredential = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { credentialId } = req.params;
            const payload = req.body;

            if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
                res.status(400).json({
                    error: 'INVALID_REQUEST_BODY',
                    message: 'A non-empty credential payload object is required for off-chain storage.'
                });
                return;
            }

            // 1. Fetch authoritative credential record from Hyperledger Fabric
            const contract = gatewayManager.getDefaultContract();
            const fabricResult = await ContractService.evaluate<CredentialRecord>(
                contract,
                'ReadCredential',
                credentialId
            );

            const record = fabricResult.data;
            if (!record) {
                res.status(404).json({
                    error: 'NOT_FOUND',
                    message: `Credential ${credentialId} does not exist on Hyperledger Fabric ledger.`
                });
                return;
            }

            // 2. Enforce Storage Ownership: caller must be authoritative issuer org or admin (verifiers strictly excluded)
            const callerOrg = req.user?.org;
            const callerRole = req.user?.role;
            const isVerifier = callerRole === 'VERIFIER' || callerOrg === 'VerifierOrg';
            if (isVerifier || (callerOrg !== record.issuerOrg && callerRole !== 'GOV_ADMIN')) {
                AuditLogger.logEvent('UNAUTHORIZED_STORAGE_ACCESS', {
                    credentialId,
                    org: callerOrg,
                    role: callerRole,
                    action: 'STORE',
                    details: `Caller org ${callerOrg} cannot store off-chain payload for issuer ${record.issuerOrg}`
                });
                res.status(403).json({
                    error: 'FORBIDDEN',
                    message: `Only the authoritative issuing organization (${record.issuerOrg}) or administrator can store off-chain payload.`
                });
                return;
            }

            // 3. Compute deterministic canonical commitment and verify against Fabric
            const computedCommitment = calculateCredentialCommitment(payload);
            if (computedCommitment !== record.credentialCommitment.toLowerCase()) {
                res.status(400).json({
                    error: 'COMMITMENT_MISMATCH',
                    message: `Calculated payload commitment (${computedCommitment}) does not match authoritative on-chain commitment (${record.credentialCommitment}).`
                });
                return;
            }

            // 4. Enforce Lifecycle State: Reject storage ingestion for REVOKED, SUSPENDED, or EXPIRED credentials
            if (record.status === 'REVOKED') {
                AuditLogger.logEvent('UNAUTHORIZED_STORAGE_ACCESS', {
                    credentialId,
                    org: callerOrg,
                    role: callerRole,
                    status: 'REVOKED',
                    action: 'STORE',
                    details: 'Cannot store off-chain payload for permanently REVOKED credential'
                });
                res.status(403).json({
                    error: 'CREDENTIAL_REVOKED',
                    message: `Credential ${credentialId} is permanently REVOKED and cannot be stored off-chain.`
                });
                return;
            }

            if (record.status === 'SUSPENDED') {
                AuditLogger.logEvent('UNAUTHORIZED_STORAGE_ACCESS', {
                    credentialId,
                    org: callerOrg,
                    role: callerRole,
                    status: 'SUSPENDED',
                    action: 'STORE',
                    details: 'Cannot store off-chain payload for SUSPENDED credential'
                });
                res.status(403).json({
                    error: 'CREDENTIAL_SUSPENDED',
                    message: `Credential ${credentialId} is SUSPENDED. Storage is restricted.`
                });
                return;
            }

            const now = new Date();
            const expiresAtDate = new Date(record.expiresAt);
            if (now.getTime() > expiresAtDate.getTime()) {
                res.status(400).json({
                    error: 'CREDENTIAL_EXPIRED',
                    message: `Credential ${credentialId} expired at ${record.expiresAt} (current server UTC: ${now.toISOString()}).`
                });
                return;
            }

            // 5. Encrypt payload using AES-256-GCM with AAD
            const { keyId, key } = await this.keyProvider.getKey();
            const version = 1;
            const aad = buildStorageAAD(credentialId, record.credentialCommitment, version);
            const encrypted = encryptPayload(payload, key, aad);

            // 6. Construct and persist EncryptedStorageRecord
            const nowIso = new Date().toISOString();
            const storageRecord: EncryptedStorageRecord = {
                credentialId,
                credentialCommitment: record.credentialCommitment.toLowerCase(),
                encryptionAlgorithm: 'AES-256-GCM',
                keyId,
                iv: encrypted.iv,
                authTag: encrypted.authTag,
                ciphertext: encrypted.ciphertext,
                createdAt: nowIso,
                updatedAt: nowIso,
                version
            };

            await this.storage.store(storageRecord);

            AuditLogger.logEvent('CREDENTIAL_STORED', {
                credentialId,
                org: callerOrg,
                role: callerRole,
                action: 'STORE',
                status: 'SUCCESS'
            });

            res.status(201).json({
                message: 'Credential payload encrypted and stored successfully off-chain.',
                data: {
                    credentialId,
                    credentialCommitment: record.credentialCommitment,
                    keyId,
                    encryptionAlgorithm: 'AES-256-GCM',
                    version,
                    stored: true
                }
            });
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/credentials/:credentialId/storage
     * Retrieves off-chain storage metadata.
     * Strictly avoids returning decrypted plaintext claims.
     */
    public getStorageMetadata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { credentialId } = req.params;

            // 1. SEC-AUTHZ-03: Fetch authoritative Fabric record first
            const contract = gatewayManager.getDefaultContract();
            let fabricRecord: CredentialRecord | null = null;
            try {
                const fabricResult = await ContractService.evaluate<CredentialRecord>(
                    contract,
                    'ReadCredential',
                    credentialId
                );
                fabricRecord = fabricResult.data;
            } catch (err: any) {
                res.status(404).json({
                    error: 'NOT_FOUND',
                    message: `Credential ${credentialId} not found on ledger.`
                });
                return;
            }

            if (!fabricRecord) {
                res.status(404).json({
                    error: 'NOT_FOUND',
                    message: `Credential ${credentialId} not found on ledger.`
                });
                return;
            }

            // 2. SEC-AUTHZ-03 & Fix 4: Least-privilege metadata access
            // Allowed: issuing organization or GOV_ADMIN. Denied: external verifier or unrelated org
            const callerOrg = req.user?.org;
            const callerRole = req.user?.role;
            const isVerifier = callerRole === 'VERIFIER' || callerOrg === 'VerifierOrg';
            const isAuthorized = !isVerifier && (callerOrg === fabricRecord.issuerOrg || callerRole === 'GOV_ADMIN');

            if (!isAuthorized) {
                AuditLogger.logEvent('UNAUTHORIZED_STORAGE_ACCESS', {
                    credentialId,
                    org: callerOrg,
                    role: callerRole,
                    action: 'GET_METADATA',
                    details: 'Caller not authorized to view storage metadata'
                });
                res.status(403).json({
                    error: 'FORBIDDEN',
                    message: `Storage metadata access restricted to issuing organization (${fabricRecord.issuerOrg}) or administrator.`
                });
                return;
            }

            // 3. Retrieve off-chain storage record
            const record = await this.storage.retrieve(credentialId);

            if (!record) {
                res.status(404).json({
                    error: 'STORAGE_NOT_FOUND',
                    message: `Off-chain storage record for credential ${credentialId} not found.`
                });
                return;
            }

            res.status(200).json({
                data: {
                    credentialId: record.credentialId,
                    credentialCommitment: record.credentialCommitment,
                    encryptionAlgorithm: record.encryptionAlgorithm,
                    keyId: record.keyId,
                    iv: record.iv,
                    authTag: record.authTag,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt,
                    version: record.version
                }
            });
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/v1/credentials/:credentialId/retrieve
     * Authorized retrieval and decryption of credential payload.
     * Enforces:
     * 1. Caller authentication and institutional authorization
     * 2. Authoritative Fabric lifecycle verification (denies REVOKED, SUSPENDED)
     * 3. Current UTC expiration check (now > expiresAt)
     * 4. AES-256-GCM authenticated decryption and integrity check
     */
    public retrieveCredential = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { credentialId } = req.params;

            // 1. Fetch authoritative credential record from Fabric
            const contract = gatewayManager.getDefaultContract();
            const fabricResult = await ContractService.evaluate<CredentialRecord>(
                contract,
                'ReadCredential',
                credentialId
            );

            const record = fabricResult.data;
            if (!record) {
                res.status(404).json({
                    error: 'NOT_FOUND',
                    message: `Credential ${credentialId} not found on ledger.`
                });
                return;
            }

            const callerOrg = req.user?.org;
            const callerRole = req.user?.role;

            // 2. Authorization check: Plaintext retrieval restricted to issuer or admin (verifiers explicitly excluded)
            const isVerifier = callerRole === 'VERIFIER' || callerOrg === 'VerifierOrg';
            const isAuthorizedIssuer = !isVerifier && (callerOrg === record.issuerOrg || callerRole === 'GOV_ADMIN');

            if (!isAuthorizedIssuer) {
                AuditLogger.logEvent('UNAUTHORIZED_STORAGE_ACCESS', {
                    credentialId,
                    org: callerOrg,
                    role: callerRole,
                    action: 'RETRIEVE',
                    details: 'Caller does not possess plaintext retrieval privilege for this credential'
                });
                res.status(403).json({
                    error: 'FORBIDDEN',
                    message: `Plaintext credential retrieval restricted to issuing organization (${record.issuerOrg}) or administrator. Verifiers must use cryptographic verification.`
                });
                return;
            }


            // 3. Lifecycle checks against authoritative Fabric state
            if (record.status === 'REVOKED') {
                AuditLogger.logEvent('UNAUTHORIZED_STORAGE_ACCESS', {
                    credentialId,
                    org: callerOrg,
                    role: callerRole,
                    status: 'REVOKED',
                    action: 'RETRIEVE'
                });
                res.status(403).json({
                    error: 'CREDENTIAL_REVOKED',
                    message: `Credential ${credentialId} is permanently REVOKED and cannot be retrieved for presentation.`
                });
                return;
            }

            if (record.status === 'SUSPENDED') {
                AuditLogger.logEvent('UNAUTHORIZED_STORAGE_ACCESS', {
                    credentialId,
                    org: callerOrg,
                    role: callerRole,
                    status: 'SUSPENDED',
                    action: 'RETRIEVE'
                });
                res.status(403).json({
                    error: 'CREDENTIAL_SUSPENDED',
                    message: `Credential ${credentialId} is SUSPENDED. Active retrieval is restricted.`
                });
                return;
            }

            // 4. Current UTC Expiration Check (now > expiresAt)
            const now = new Date();
            const expiresAtDate = new Date(record.expiresAt);
            if (now.getTime() > expiresAtDate.getTime()) {
                res.status(400).json({
                    error: 'CREDENTIAL_EXPIRED',
                    message: `Credential ${credentialId} expired at ${record.expiresAt} (current server UTC: ${now.toISOString()}).`
                });
                return;
            }

            // 5. Retrieve encrypted storage record
            const storageRecord = await this.storage.retrieve(credentialId);
            if (!storageRecord) {
                res.status(404).json({
                    error: 'STORAGE_NOT_FOUND',
                    message: `Off-chain encrypted storage payload not found for credential ${credentialId}.`
                });
                return;
            }

            // 6. Decrypt payload
            const { key } = await this.keyProvider.getKey(storageRecord.keyId);
            const aad = buildStorageAAD(credentialId, storageRecord.credentialCommitment, storageRecord.version);

            let decryptedText: string;
            try {
                decryptedText = decryptPayload(
                    {
                        ciphertext: storageRecord.ciphertext,
                        iv: storageRecord.iv,
                        authTag: storageRecord.authTag
                    },
                    key,
                    aad
                );
            } catch (decryptionError: any) {
                AuditLogger.logEvent('DECRYPTION_FAILED', {
                    credentialId,
                    org: callerOrg,
                    role: callerRole,
                    details: decryptionError.message
                });
                res.status(500).json({
                    error: 'DECRYPTION_FAILED',
                    message: 'Decryption or authentication tag verification failed. Ciphertext or metadata may have been altered.'
                });
                return;
            }

            // 7. Verify integrity: recompute canonical commitment
            const parsedPayload = JSON.parse(decryptedText);
            const recomputedCommitment = calculateCredentialCommitment(parsedPayload);
            if (recomputedCommitment !== record.credentialCommitment.toLowerCase()) {
                AuditLogger.logEvent('STORAGE_INTEGRITY_FAILED', {
                    credentialId,
                    org: callerOrg,
                    details: 'Decrypted payload commitment mismatch'
                });
                res.status(500).json({
                    error: 'STORAGE_INTEGRITY_FAILED',
                    message: 'Decrypted payload commitment does not match authoritative on-chain commitment.'
                });
                return;
            }

            AuditLogger.logEvent('CREDENTIAL_RETRIEVED', {
                credentialId,
                org: callerOrg,
                role: callerRole,
                action: 'RETRIEVE',
                status: 'SUCCESS'
            });

            res.status(200).json({
                credentialId,
                issuerOrg: record.issuerOrg,
                subjectDID: record.subjectDID,
                credentialType: record.credentialType,
                status: record.status,
                payload: parsedPayload
            });
        } catch (error) {
            next(error);
        }
    };

    /**
     * DELETE /api/v1/credentials/:credentialId/storage
     * Off-chain credential erasure.
     * Deletes the encrypted off-chain payload while preserving the immutable Fabric ledger history.
     */
    public deleteStorage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { credentialId } = req.params;

            // 1. Fetch authoritative Fabric record
            const contract = gatewayManager.getDefaultContract();
            const fabricResult = await ContractService.evaluate<CredentialRecord>(
                contract,
                'ReadCredential',
                credentialId
            );

            const record = fabricResult.data;
            if (!record) {
                res.status(404).json({
                    error: 'NOT_FOUND',
                    message: `Credential ${credentialId} not found on ledger.`
                });
                return;
            }

            // 2. Ownership check: caller must be issuer org or admin (verifiers strictly excluded)
            const callerOrg = req.user?.org;
            const callerRole = req.user?.role;
            const isVerifier = callerRole === 'VERIFIER' || callerOrg === 'VerifierOrg';
            if (isVerifier || (callerOrg !== record.issuerOrg && callerRole !== 'GOV_ADMIN')) {
                AuditLogger.logEvent('UNAUTHORIZED_STORAGE_ACCESS', {
                    credentialId,
                    org: callerOrg,
                    role: callerRole,
                    action: 'DELETE',
                    details: 'Caller cannot delete off-chain payload for another issuer'
                });
                res.status(403).json({
                    error: 'FORBIDDEN',
                    message: `Deletion restricted to issuing organization (${record.issuerOrg}) or administrator.`
                });
                return;
            }

            // 3. Delete from storage provider
            const deleted = await this.storage.delete(credentialId);
            if (!deleted) {
                res.status(404).json({
                    error: 'STORAGE_NOT_FOUND',
                    message: `Off-chain storage record for credential ${credentialId} not found.`
                });
                return;
            }

            AuditLogger.logEvent('CREDENTIAL_DELETED', {
                credentialId,
                org: callerOrg,
                role: callerRole,
                action: 'DELETE',
                status: 'SUCCESS'
            });

            res.status(200).json({
                message: 'Off-chain encrypted credential payload successfully deleted.',
                credentialId,
                ledgerIntact: true
            });
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/v1/credentials/:credentialId/verify-storage
     * End-to-end off-chain storage integrity check against the Fabric ledger.
     * Decrypts off-chain record, recomputes canonical commitment, and validates against ledger state.
     */
    public verifyStorage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { credentialId } = req.params;

            // 1. Retrieve off-chain record
            const storageRecord = await this.storage.retrieve(credentialId);
            if (!storageRecord) {
                res.status(200).json({
                    valid: false,
                    reason: 'STORAGE_NOT_FOUND',
                    credentialId,
                    verifiedAt: new Date().toISOString()
                });
                return;
            }

            // 2. Query Fabric ledger state
            const contract = gatewayManager.getDefaultContract();
            let fabricRecord: CredentialRecord | null = null;
            try {
                const result = await ContractService.evaluate<CredentialRecord>(
                    contract,
                    'ReadCredential',
                    credentialId
                );
                fabricRecord = result.data;
            } catch {
                res.status(200).json({
                    valid: false,
                    reason: 'LEDGER_RECORD_NOT_FOUND',
                    credentialId,
                    verifiedAt: new Date().toISOString()
                });
                return;
            }

            if (!fabricRecord) {
                res.status(200).json({
                    valid: false,
                    reason: 'LEDGER_RECORD_NOT_FOUND',
                    credentialId,
                    verifiedAt: new Date().toISOString()
                });
                return;
            }

            // 3. Decrypt off-chain payload and authenticate AAD
            const { key } = await this.keyProvider.getKey(storageRecord.keyId);
            const aad = buildStorageAAD(credentialId, storageRecord.credentialCommitment, storageRecord.version);

            let decryptedText: string;
            try {
                decryptedText = decryptPayload(
                    {
                        ciphertext: storageRecord.ciphertext,
                        iv: storageRecord.iv,
                        authTag: storageRecord.authTag
                    },
                    key,
                    aad
                );
            } catch {
                AuditLogger.logEvent('STORAGE_INTEGRITY_FAILED', {
                    credentialId,
                    reason: 'DECRYPTION_FAILED'
                });
                res.status(200).json({
                    valid: false,
                    reason: 'DECRYPTION_FAILED',
                    credentialId,
                    verifiedAt: new Date().toISOString()
                });
                return;
            }

            // 4. Recompute canonical commitment
            const parsedPayload = JSON.parse(decryptedText);
            const computedCommitment = calculateCredentialCommitment(parsedPayload);

            if (computedCommitment !== fabricRecord.credentialCommitment.toLowerCase()) {
                AuditLogger.logEvent('STORAGE_INTEGRITY_FAILED', {
                    credentialId,
                    reason: 'COMMITMENT_MISMATCH'
                });
                res.status(200).json({
                    valid: false,
                    reason: 'COMMITMENT_MISMATCH',
                    credentialId,
                    verifiedAt: new Date().toISOString()
                });
                return;
            }

            // 5. Check Fabric lifecycle status
            if (fabricRecord.status === 'REVOKED') {
                res.status(200).json({
                    valid: false,
                    reason: 'CREDENTIAL_REVOKED',
                    credentialId,
                    status: 'REVOKED',
                    verifiedAt: new Date().toISOString()
                });
                return;
            }

            if (fabricRecord.status === 'SUSPENDED') {
                res.status(200).json({
                    valid: false,
                    reason: 'CREDENTIAL_SUSPENDED',
                    credentialId,
                    status: 'SUSPENDED',
                    verifiedAt: new Date().toISOString()
                });
                return;
            }

            // 6. Check expiration
            const now = new Date();
            if (now.getTime() > new Date(fabricRecord.expiresAt).getTime()) {
                res.status(200).json({
                    valid: false,
                    reason: 'CREDENTIAL_EXPIRED',
                    credentialId,
                    status: 'EXPIRED',
                    verifiedAt: new Date().toISOString()
                });
                return;
            }

            AuditLogger.logEvent('STORAGE_INTEGRITY_VERIFIED', {
                credentialId,
                status: 'VALID'
            });

            res.status(200).json({
                valid: true,
                reason: 'VALID',
                credentialId,
                issuerOrg: fabricRecord.issuerOrg,
                credentialType: fabricRecord.credentialType,
                status: fabricRecord.status,
                verifiedAt: new Date().toISOString()
            });
        } catch (error) {
            next(error);
        }
    };
}

export const storageController = new StorageController();
