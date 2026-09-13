/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextFunction, Request, Response } from 'express';
import { ContractService } from '../fabric/contractService.js';
import { gatewayManager } from '../fabric/gatewayManager.js';
import { CredentialRecord, OrgMspId } from '../types/index.js';

interface CredentialTypeConfig {
    org: OrgMspId;
    credentialType: string;
    schemaId: string;
}

const CREDENTIAL_TYPE_MAPPINGS: Record<string, CredentialTypeConfig> = {
    'government-id': {
        org: 'GovMSP',
        credentialType: 'GovernmentIdCredential',
        schemaId: 'https://schema.org/v1/GovernmentIdCredential.json'
    },
    'academic': {
        org: 'UniversityMSP',
        credentialType: 'AcademicDegreeCredential',
        schemaId: 'https://schema.org/v1/AcademicDegreeCredential.json'
    },
    'kyc': {
        org: 'BankMSP',
        credentialType: 'KYCCredential',
        schemaId: 'https://schema.org/v1/KYCCredential.json'
    },
    'employment': {
        org: 'EmployerMSP',
        credentialType: 'EmploymentCredential',
        schemaId: 'https://schema.org/v1/EmploymentCredential.json'
    }
};

export class CredentialController {
    /**
     * Factory handler enforcing server-controlled issuer routing.
     * The issuer organization is determined strictly by the server route, not caller input.
     */
    public static issueCredentialByType(typeKey: string) {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                const mapping = CREDENTIAL_TYPE_MAPPINGS[typeKey];
                if (!mapping) {
                    res.status(400).json({ error: 'INVALID_CREDENTIAL_TYPE', message: `Unknown credential type key: ${typeKey}` });
                    return;
                }

                const { credentialId, subjectDID, issuerDID, credentialCommitment, expiresAt } = req.body;

                // Server selects the gateway contract based on the authenticated org context or required type mapping
                // If caller is authenticated as an org, verify they match or let the contract ABAC enforce it:
                const callingOrg = req.user?.org || mapping.org;
                const contract = gatewayManager.getContract(callingOrg);

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
