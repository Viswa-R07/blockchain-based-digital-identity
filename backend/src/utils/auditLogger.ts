/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './logger.js';

export type AuditEventType =
    | 'CREDENTIAL_STORED'
    | 'CREDENTIAL_RETRIEVED'
    | 'CREDENTIAL_DELETED'
    | 'STORAGE_INTEGRITY_VERIFIED'
    | 'STORAGE_INTEGRITY_FAILED'
    | 'UNAUTHORIZED_STORAGE_ACCESS'
    | 'DECRYPTION_FAILED';

export interface AuditContext {
    credentialId?: string;
    org?: string;
    role?: string;
    apiKeyName?: string;
    action?: string;
    status?: string;
    reason?: string;
    latencyMs?: number;
    details?: string;
}

/**
 * Privacy-Preserving Audit Logger for Off-Chain Credential Storage Operations.
 *
 * Strict Privacy Guarantees:
 * - NEVER logs plaintext credential contents, attributes, or claims.
 * - NEVER logs symmetric encryption keys, master secrets, or passwords.
 * - NEVER logs full raw ciphertext or sensitive request payloads.
 * - Records exclusively non-PII operational events, timestamps, institutional principals, and credential IDs.
 */
export class AuditLogger {
    public static logEvent(event: AuditEventType, context: AuditContext): void {
        const sanitizedContext: Record<string, unknown> = {
            eventType: event,
            timestamp: new Date().toISOString(),
            ...context
        };

        // Redact any potential accidental leakage of sensitive keys
        const sensitiveKeys = [
            'key',
            'privateKey',
            'secret',
            'password',
            'claims',
            'payload',
            'ciphertext',
            'aad',
            'token',
            'ssn',
            'aadhaar',
            'name',
            'email'
        ];

        for (const key of Object.keys(sanitizedContext)) {
            if (sensitiveKeys.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
                delete sanitizedContext[key];
            }
        }

        logger.info(`[AUDIT] ${event} - Credential: ${context.credentialId || 'N/A'} - Org: ${context.org || 'ANONYMOUS'}`, sanitizedContext);
    }
}
