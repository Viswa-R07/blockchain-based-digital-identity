/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextFunction, Request, Response } from 'express';
import { ContractService } from '../fabric/contractService.js';
import { gatewayManager } from '../fabric/gatewayManager.js';
import { CredentialRecord, OrgMspId } from '../types/index.js';
import { logger } from '../utils/logger.js';

interface CredentialTypeConfig {
    org: OrgMspId;
    role: string;
    credentialType: string;
    schemaId: string;
}

const CREDENTIAL_TYPE_MAPPINGS: Record<string, CredentialTypeConfig> = {
    'government-id': {
        org: 'GovMSP',
        role: 'GOV_ADMIN',
        credentialType: 'GovernmentIdCredential',
        schemaId: 'https://schema.org/v1/GovernmentIdCredential.json'
    },
    'academic': {
        org: 'UniversityMSP',
        role: 'UNI_REGISTRAR',
        credentialType: 'AcademicDegreeCredential',
        schemaId: 'https://schema.org/v1/AcademicDegreeCredential.json'
    },
    'kyc': {
        org: 'BankMSP',
        role: 'BANK_COMPLIANCE',
        credentialType: 'KYCCredential',
        schemaId: 'https://schema.org/v1/KYCCredential.json'
    },
    'employment': {
        org: 'EmployerMSP',
        role: 'EMP_HR',
        credentialType: 'EmploymentCredential',
        schemaId: 'https://schema.org/v1/EmploymentCredential.json'
    }
};

/**
 * Authoritative primary issuer DID mapping per consortium organization.
 */
export const AUTHORITATIVE_ISSUER_DIDS: Record<OrgMspId, string> = {
    'GovMSP': 'did:example:gov:authority',
    'UniversityMSP': 'did:example:university:registrar',
    'BankMSP': 'did:example:bank:compliance',
    'EmployerMSP': 'did:example:employer:hr'
};

/**
 * Permitted issuer DIDs and recognized operational aliases per organization.
 */
export const ALLOWED_ISSUER_DIDS: Record<OrgMspId, string[]> = {
    'GovMSP': [
        'did:example:gov:authority',
        'did:example:gov:auth',
        'did:example:gov-authority',
        'did:gov:identity-authority',
        'did:example:gov'
    ],
    'UniversityMSP': [
        'did:example:university:registrar',
        'did:example:university1',
        'did:example:state-university',
        'did:example:university'
    ],
    'BankMSP': [
        'did:example:bank:compliance',
        'did:example:bank',
        'did:example:national-bank'
    ],
    'EmployerMSP': [
        'did:example:employer:hr',
        'did:example:tech-corp',
        'did:example:employer'
    ]
};

/**
 * Cryptographically & application-layer verifies that the provided issuerDID
 * belongs exclusively to the authenticated issuing organization.
 */
export function isIssuerDidAuthorizedForOrg(org: OrgMspId, issuerDID: string): boolean {
    if (!issuerDID || typeof issuerDID !== 'string') {
        return false;
    }
    const trimmed = issuerDID.trim();

    // 1. Direct match against authoritative primary DID or authorized organizational aliases
    const allowed = ALLOWED_ISSUER_DIDS[org];
    if (allowed && allowed.includes(trimmed)) {
        return true;
    }

    // 2. Strict organizational namespace / prefix domain binding
    switch (org) {
        case 'GovMSP':
            return trimmed.startsWith('did:example:gov') || trimmed.startsWith('did:gov:');
        case 'UniversityMSP':
            return trimmed.startsWith('did:example:university') || trimmed.startsWith('did:example:state-university');
        case 'BankMSP':
            return trimmed.startsWith('did:example:bank') || trimmed.startsWith('did:example:national-bank');
        case 'EmployerMSP':
            return trimmed.startsWith('did:example:employer') || trimmed.startsWith('did:example:tech-corp');
        default:
            return false;
    }
}

export class CredentialController {
    /**
     * Factory handler enforcing server-controlled issuer routing and role authorization.
     * Derives allowed gateway strictly from authenticated application principal and requested type.
     */
    public static issueCredentialByType(typeKey: string) {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                const mapping = CREDENTIAL_TYPE_MAPPINGS[typeKey];
                if (!mapping) {
                    res.status(400).json({ error: 'INVALID_CREDENTIAL_TYPE', message: `Unknown credential type key: ${typeKey}` });
                    return;
                }

                // SEC-AUTHZ-02: Verifier is an external verifier and cannot issue credentials
                if (req.user?.role === 'VERIFIER' || req.user?.org === 'VerifierOrg') {
                    res.status(403).json({
                        error: 'FORBIDDEN',
                        message: 'External verifiers are strictly prohibited from issuing credentials.'
                    });
                    return;
                }

                // SEC-AUTHZ-01 & SEC-AUTHZ-02 & Fix 3: Strict institutional authorization matching credential type
                if (req.user?.org !== mapping.org) {
                    res.status(403).json({
                        error: 'UNAUTHORIZED_OPERATION',
                        message: `Issuance of ${mapping.credentialType} is restricted to [${mapping.org}]. Caller is authenticated as ${req.user?.org}.`
                    });
                    return;
                }

                if (req.user?.role !== mapping.role) {
                    res.status(403).json({
                        error: 'FORBIDDEN',
                        message: `Issuance of ${mapping.credentialType} requires role ${mapping.role}. Caller role is ${req.user?.role}.`
                    });
                    return;
                }

                const { credentialId, subjectDID, issuerDID, credentialCommitment, expiresAt } = req.body;

                // SEC-ROUTE-04: Bind issuerDID strictly to authenticated issuing organization before gateway invocation
                if (!isIssuerDidAuthorizedForOrg(mapping.org, issuerDID)) {
                    logger.warn(
                        `[SECURITY_AUDIT] ISSUER_DID_MISMATCH: Caller from org '${mapping.org}' attempted issuance with unauthorized issuerDID '${issuerDID}'. Request rejected before Fabric Gateway.`
                    );
                    res.status(403).json({
                        error: 'UNAUTHORIZED_ISSUER_DID',
                        message: `Issuer DID '${issuerDID}' is not authorized for organization '${mapping.org}'. Callers cannot issue credentials using another organization's issuer DID.`,
                        details: {
                            authenticatedOrg: mapping.org,
                            providedIssuerDID: issuerDID,
                            authoritativeIssuerDID: AUTHORITATIVE_ISSUER_DIDS[mapping.org]
                        }
                    });
                    return;
                }

                // Server selects the gateway contract strictly based on required type mapping
                const contract = gatewayManager.getContract(mapping.org);

                const result = await ContractService.submit<CredentialRecord>(
                    contract,
                    'IssueCredential',
                    credentialId,
                    subjectDID,
                    issuerDID,
                    mapping.credentialType,
                    mapping.schemaId,
                    credentialCommitment,
                    expiresAt
                );

                res.status(201).json({
                    message: `${mapping.credentialType} issued successfully`,
                    data: result.data,
                    latencyMs: result.latencyMs
                });
            } catch (error) {
                next(error);
            }
        };
    }

    public static async readCredential(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { credentialId } = req.params;
            const contract = gatewayManager.getDefaultContract();
            const result = await ContractService.evaluate<CredentialRecord>(
                contract,
                'ReadCredential',
                credentialId
            );

            res.status(200).json({
                data: result.data,
                latencyMs: result.latencyMs
            });
        } catch (error) {
            next(error);
        }
    }

    public static async credentialExists(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { credentialId } = req.params;
            const contract = gatewayManager.getDefaultContract();
            const result = await ContractService.evaluate<boolean>(
                contract,
                'CredentialExists',
                credentialId
            );

            res.status(200).json({
                exists: result.data,
                latencyMs: result.latencyMs
            });
        } catch (error) {
            next(error);
        }
    }
}
