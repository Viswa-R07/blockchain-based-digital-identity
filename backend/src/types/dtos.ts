/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import { RevocationReason } from './index.js';

export const DID_REGEX = /^did:[a-z0-9]+:[a-zA-Z0-9_.:-]+$/;
export const COMMITMENT_REGEX = /^[a-f0-9]{64}$/;
export const CREDENTIAL_ID_REGEX = /^[a-zA-Z0-9_.:-]+$/;
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export const RegisterIdentitySchema = z.object({
    did: z.string().regex(DID_REGEX, {
        message: 'Invalid DID format. Must match standard format e.g. did:example:12345'
    }),
    identityCommitment: z.string().regex(COMMITMENT_REGEX, {
        message: 'Invalid identity commitment. Must be a 64-character lowercase hex SHA-256 digest'
    })
});

export const UpdateIdentityStatusSchema = z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED'])
});

export const IssueCredentialSchema = z.object({
    credentialId: z.string().min(1).max(128).regex(CREDENTIAL_ID_REGEX, {
        message: 'Invalid credential ID format'
    }),
    subjectDID: z.string().regex(DID_REGEX, {
        message: 'Invalid subject DID format'
    }),
    issuerDID: z.string().regex(DID_REGEX, {
        message: 'Invalid issuer DID format'
    }),
    credentialCommitment: z.string().regex(COMMITMENT_REGEX, {
        message: 'Invalid credential commitment. Must be a 64-character lowercase hex SHA-256 digest'
    }),
    expiresAt: z.string().regex(ISO_DATE_REGEX, {
        message: 'expiresAt must be a valid ISO-8601 UTC timestamp string (e.g. 2035-01-01T00:00:00.000Z)'
    })
});

export const RevokeCredentialSchema = z.object({
    reason: z.nativeEnum(RevocationReason, {
        errorMap: () => ({ message: 'Invalid revocation reason. Must be one of KEY_COMPROMISE, AFFILIATION_CHANGED, SUPERSEDED, CESSATION_OF_OPERATION, PRIVILEGE_WITHDRAWN, UNSPECIFIED' })
    })
});

export const SuspendCredentialSchema = z.object({
    reason: z.nativeEnum(RevocationReason).optional().default(RevocationReason.PRIVILEGE_WITHDRAWN)
});

export const UpdateCredentialStatusSchema = z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED'])
});

export const VerifyCredentialSchema = z.object({
    credentialId: z.string().min(1).max(128).regex(CREDENTIAL_ID_REGEX),
    subjectDID: z.string().regex(DID_REGEX),
    credentialCommitment: z.string().regex(COMMITMENT_REGEX)
});
