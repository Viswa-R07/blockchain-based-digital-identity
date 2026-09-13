/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { CredentialStatus } from '../models/credentialRecord';
import { ChaincodeError, ErrorCode } from './errors';

const CREDENTIAL_ID_REGEX = /^[a-zA-Z0-9_.:-]+$/;
const CREDENTIAL_TYPE_REGEX = /^[a-zA-Z0-9_-]+$/;
const SCHEMA_ID_REGEX = /^[a-zA-Z0-9_.:/-]+$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export function validateCredentialId(credentialId: string): void {
    if (!credentialId || typeof credentialId !== 'string' || credentialId.trim().length === 0) {
        throw new ChaincodeError(
            ErrorCode.INVALID_CREDENTIAL_ID,
            'Credential ID must be a non-empty string'
        );
    }

    const trimmed = credentialId.trim();
    if (trimmed.length > 128) {
        throw new ChaincodeError(
            ErrorCode.INVALID_CREDENTIAL_ID,
            `Credential ID exceeds maximum length of 128 characters: ${trimmed.length}`
        );
    }

    if (!CREDENTIAL_ID_REGEX.test(trimmed)) {
        throw new ChaincodeError(
            ErrorCode.INVALID_CREDENTIAL_ID,
            `Invalid Credential ID format: "${credentialId}". Allowed characters: alphanumeric, underscore, dot, colon, hyphen.`
        );
    }

    // Reject obvious PII-bearing patterns in the identifier
    if (trimmed.includes('@') || /^\d{3}-\d{2}-\d{4}$/.test(trimmed)) {
        throw new ChaincodeError(
            ErrorCode.INVALID_CREDENTIAL_ID,
            'Credential ID must not contain raw personal identifying information (e.g. email or national ID)'
        );
    }
}

export function validateCredentialType(credentialType: string): void {
    if (!credentialType || typeof credentialType !== 'string' || credentialType.trim().length === 0) {
        throw new ChaincodeError(
            ErrorCode.INVALID_CREDENTIAL_TYPE,
            'Credential type must be a non-empty string'
        );
    }

    const trimmed = credentialType.trim();
    if (trimmed.length > 64) {
        throw new ChaincodeError(
            ErrorCode.INVALID_CREDENTIAL_TYPE,
            `Credential type exceeds maximum length of 64 characters: ${trimmed.length}`
        );
    }

    if (!CREDENTIAL_TYPE_REGEX.test(trimmed)) {
        throw new ChaincodeError(
            ErrorCode.INVALID_CREDENTIAL_TYPE,
            `Invalid credential type format: "${credentialType}". Allowed characters: alphanumeric, underscore, hyphen.`
        );
    }
}

export function validateSchemaId(schemaId: string): void {
    if (!schemaId || typeof schemaId !== 'string' || schemaId.trim().length === 0) {
        throw new ChaincodeError(
            ErrorCode.INVALID_SCHEMA_ID,
            'Schema ID must be a non-empty string'
        );
    }

    const trimmed = schemaId.trim();
    if (trimmed.length > 128) {
        throw new ChaincodeError(
            ErrorCode.INVALID_SCHEMA_ID,
            `Schema ID exceeds maximum length of 128 characters: ${trimmed.length}`
        );
    }

    if (!SCHEMA_ID_REGEX.test(trimmed)) {
        throw new ChaincodeError(
            ErrorCode.INVALID_SCHEMA_ID,
            `Invalid schema ID format: "${schemaId}". Allowed characters: alphanumeric, underscore, dot, colon, slash, hyphen.`
        );
    }
}

export function validateExpiresAt(expiresAt: string, issuedAtIso: string): void {
    if (!expiresAt || typeof expiresAt !== 'string' || expiresAt.trim().length === 0) {
        throw new ChaincodeError(
            ErrorCode.INVALID_EXPIRATION,
            'Expiration timestamp (expiresAt) must be a non-empty ISO-8601 UTC string'
        );
    }

    const trimmed = expiresAt.trim();
    const expiresMillis = Date.parse(trimmed);

    if (isNaN(expiresMillis) || !ISO_DATE_REGEX.test(trimmed)) {
        throw new ChaincodeError(
            ErrorCode.INVALID_EXPIRATION,
            `Malformed expiration timestamp: "${expiresAt}". Must be a valid ISO-8601 UTC timestamp (e.g. 2027-01-01T00:00:00.000Z)`
        );
    }

    const issuedMillis = Date.parse(issuedAtIso);
    if (expiresMillis <= issuedMillis) {
        throw new ChaincodeError(
            ErrorCode.INVALID_EXPIRATION,
            `Expiration timestamp (${trimmed}) must be strictly later than issuance timestamp (${issuedAtIso})`
        );
    }
}

export function parseAndValidateCredentialStatus(statusStr: string): CredentialStatus {
    if (!statusStr || typeof statusStr !== 'string') {
        throw new ChaincodeError(
            ErrorCode.INVALID_STATUS,
            'Credential status must be a non-empty string'
        );
    }

    const upper = statusStr.trim().toUpperCase();
    if (!Object.values(CredentialStatus).includes(upper as CredentialStatus)) {
        throw new ChaincodeError(
            ErrorCode.INVALID_STATUS,
            `Unsupported credential status: "${statusStr}". Allowed statuses: ${Object.values(CredentialStatus).join(', ')}`
        );
    }

    return upper as CredentialStatus;
}

export function validateCredentialStatusTransition(
    currentStatus: CredentialStatus,
    newStatus: CredentialStatus
): void {
    if (currentStatus === CredentialStatus.REVOKED) {
        throw new ChaincodeError(
            ErrorCode.CREDENTIAL_REVOCATION_IS_TERMINAL,
            'Cannot update status of a credential that is REVOKED. Revocation is a permanent terminal state.'
        );
    }

    if (currentStatus === newStatus) {
        throw new ChaincodeError(
            ErrorCode.NOOP_STATUS_TRANSITION,
            `Credential is already in status ${currentStatus}. No-op status transitions are rejected.`
        );
    }

    const isPermitted =
        (currentStatus === CredentialStatus.ACTIVE && (newStatus === CredentialStatus.SUSPENDED || newStatus === CredentialStatus.REVOKED)) ||
        (currentStatus === CredentialStatus.SUSPENDED && (newStatus === CredentialStatus.ACTIVE || newStatus === CredentialStatus.REVOKED));

    if (!isPermitted) {
        throw new ChaincodeError(
            ErrorCode.INVALID_LIFECYCLE_TRANSITION,
            `Illegal credential lifecycle transition from ${currentStatus} to ${newStatus}`
        );
    }
}

/**
 * Application-level ABAC validation enforcing organization-specific credential issuance scopes.
 *
 * GovMSP: Government identity and citizenship credentials
 * UniversityMSP: Academic and educational credentials
 * BankMSP: Financial, KYC, and credit credentials
 * EmployerMSP: Employment, workplace, and income credentials
 */
export function validateIssuerOrganization(callerMsp: string, credentialType: string): void {
    const typeUpper = credentialType.toUpperCase();

    switch (callerMsp) {
        case 'GovMSP':
            if (
                typeUpper.includes('GOVERNMENT') ||
                typeUpper.includes('IDENTITY') ||
                typeUpper.includes('CITIZEN') ||
                typeUpper.includes('NATIONAL') ||
                typeUpper.includes('RESIDENT') ||
                typeUpper.includes('PASSPORT') ||
                typeUpper.includes('LICENSE')
            ) {
                return;
            }
            break;

        case 'UniversityMSP':
            if (
                typeUpper.includes('ACADEMIC') ||
                typeUpper.includes('DEGREE') ||
                typeUpper.includes('DIPLOMA') ||
                typeUpper.includes('UNIVERSITY') ||
                typeUpper.includes('TRANSCRIPT') ||
                typeUpper.includes('ENROLLMENT') ||
                typeUpper.includes('EDUCATION') ||
                typeUpper.includes('COURSE')
            ) {
                return;
            }
            break;

        case 'BankMSP':
            if (
                typeUpper.includes('KYC') ||
                typeUpper.includes('BANK') ||
                typeUpper.includes('FINANCIAL') ||
                typeUpper.includes('ACCOUNT') ||
                typeUpper.includes('CREDIT')
            ) {
                return;
            }
            break;

        case 'EmployerMSP':
            if (
                typeUpper.includes('EMPLOYMENT') ||
                typeUpper.includes('JOB') ||
                typeUpper.includes('WORK') ||
                typeUpper.includes('EMPLOYER') ||
                typeUpper.includes('SALARY') ||
                typeUpper.includes('EXPERIENCE')
            ) {
                return;
            }
            break;

        default:
            throw new ChaincodeError(
                ErrorCode.UNAUTHORIZED,
                `Caller from organization "${callerMsp}" is not recognized as an authorized credential issuer.`
            );
    }

    throw new ChaincodeError(
        ErrorCode.UNAUTHORIZED_CREDENTIAL_TYPE,
        `Organization "${callerMsp}" is not authorized to issue credentials of type "${credentialType}". Credential types must correspond to organizational domains.`
    );
}
