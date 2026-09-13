/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { IdentityStatus } from '../models/identityRecord';
import { ChaincodeError, ErrorCode } from './errors';

const DID_REGEX = /^did:[a-z0-9]+:[a-zA-Z0-9_.:-]+$/;
const COMMITMENT_REGEX = /^[a-f0-9]{64}$/;

export function validateDID(did: string): void {
    if (!did || typeof did !== 'string' || did.trim().length === 0) {
        throw new ChaincodeError(
            ErrorCode.INVALID_DID,
            'DID must be a non-empty string'
        );
    }

    if (!DID_REGEX.test(did.trim())) {
        throw new ChaincodeError(
            ErrorCode.INVALID_DID,
            `Invalid DID format: "${did}". Must follow W3C DID syntax (e.g. did:example:citizen101)`
        );
    }
}

export function validateCommitment(commitment: string): void {
    if (!commitment || typeof commitment !== 'string' || commitment.trim().length === 0) {
        throw new ChaincodeError(
            ErrorCode.INVALID_COMMITMENT,
            'Identity commitment must be a non-empty string'
        );
    }

    const trimmed = commitment.trim().toLowerCase();
    if (trimmed.length !== 64 || !COMMITMENT_REGEX.test(trimmed)) {
        throw new ChaincodeError(
            ErrorCode.INVALID_COMMITMENT,
            `Invalid identity commitment: "${commitment}". Must be a 64-character lowercase hexadecimal hash string`
        );
    }
}

export function parseAndValidateStatus(statusStr: string): IdentityStatus {
    if (!statusStr || typeof statusStr !== 'string') {
        throw new ChaincodeError(
            ErrorCode.INVALID_STATUS,
            'Status must be a non-empty string'
        );
    }

    const upper = statusStr.trim().toUpperCase();
    if (!Object.values(IdentityStatus).includes(upper as IdentityStatus)) {
        throw new ChaincodeError(
            ErrorCode.INVALID_STATUS,
            `Unsupported identity status: "${statusStr}". Allowed statuses: ${Object.values(IdentityStatus).join(', ')}`
        );
    }

    return upper as IdentityStatus;
}

export function validateStatusTransition(currentStatus: IdentityStatus, newStatus: IdentityStatus): void {
    if (currentStatus === IdentityStatus.REVOKED) {
        throw new ChaincodeError(
            ErrorCode.REVOCATION_IS_TERMINAL,
            'Cannot update status of an identity that is REVOKED. Revocation is a permanent terminal state.'
        );
    }

    if (currentStatus === newStatus) {
        throw new ChaincodeError(
            ErrorCode.NOOP_STATUS_TRANSITION,
            `Identity is already in status ${currentStatus}. No-op status transitions are rejected.`
        );
    }

    // Permitted transitions:
    // ACTIVE -> SUSPENDED
    // ACTIVE -> REVOKED
    // SUSPENDED -> ACTIVE
    // SUSPENDED -> REVOKED
    const isPermitted =
        (currentStatus === IdentityStatus.ACTIVE && (newStatus === IdentityStatus.SUSPENDED || newStatus === IdentityStatus.REVOKED)) ||
        (currentStatus === IdentityStatus.SUSPENDED && (newStatus === IdentityStatus.ACTIVE || newStatus === IdentityStatus.REVOKED));

    if (!isPermitted) {
        throw new ChaincodeError(
            ErrorCode.INVALID_LIFECYCLE_TRANSITION,
            `Illegal lifecycle transition from ${currentStatus} to ${newStatus}`
        );
    }
}
