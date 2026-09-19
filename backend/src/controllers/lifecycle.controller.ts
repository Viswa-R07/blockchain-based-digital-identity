/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextFunction, Request, Response } from 'express';
import { ContractService } from '../fabric/contractService.js';
import { gatewayManager } from '../fabric/gatewayManager.js';
import { CredentialRecord, OrgMspId } from '../types/index.js';

const VALID_ISSUING_ROLES: Record<string, OrgMspId> = {
    GOV_ADMIN: 'GovMSP',
    UNI_REGISTRAR: 'UniversityMSP',
    BANK_COMPLIANCE: 'BankMSP',
    EMP_HR: 'EmployerMSP'
};

export class LifecycleController {
    /**
     * Validates that caller is an authorized institutional principal and derives the gateway contract.
     * Prevents verifiers and unauthorized callers from accessing lifecycle operations.
     */
    private static getAuthorizedContract(req: Request, res: Response) {
        // SEC-AUTHZ-02: External verifiers cannot mutate credential lifecycle
        if (req.user?.role === 'VERIFIER' || req.user?.org === 'VerifierOrg') {
            res.status(403).json({
                error: 'FORBIDDEN',
                message: 'External verifiers are strictly prohibited from mutating credential lifecycle.'
            });
            return null;
        }

        const callerRole = req.user?.role || '';
        const callerOrg = req.user?.org;
        const expectedOrg = VALID_ISSUING_ROLES[callerRole];

        if (!expectedOrg || expectedOrg !== callerOrg) {
            res.status(403).json({
                error: 'FORBIDDEN',
                message: `Caller with role ${callerRole} and org ${callerOrg} is not authorized for lifecycle mutations.`
            });
            return null;
        }

        // Fix 3: Organization selection is strictly derived from authenticated principal - no fallback
        return gatewayManager.getContract(expectedOrg);
    }

    public static async revokeCredential(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const contract = LifecycleController.getAuthorizedContract(req, res);
            if (!contract) return;

            const { credentialId } = req.params;
            const { reason } = req.body;

            const result = await ContractService.submit<CredentialRecord>(
                contract,
                'RevokeCredential',
                credentialId,
                reason
            );

            res.status(200).json({
                message: 'Credential revoked successfully',
                data: result.data,
                latencyMs: result.latencyMs
            });
        } catch (error) {
            next(error);
        }
    }

    public static async suspendCredential(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const contract = LifecycleController.getAuthorizedContract(req, res);
            if (!contract) return;

            const { credentialId } = req.params;
            const { reason } = req.body;

            const result = await ContractService.submit<CredentialRecord>(
                contract,
                'SuspendCredential',
                credentialId,
                reason || 'PRIVILEGE_WITHDRAWN'
            );

            res.status(200).json({
                message: 'Credential suspended successfully',
                data: result.data,
                latencyMs: result.latencyMs
            });
        } catch (error) {
            next(error);
        }
    }

    public static async reinstateCredential(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const contract = LifecycleController.getAuthorizedContract(req, res);
            if (!contract) return;

            const { credentialId } = req.params;

            const result = await ContractService.submit<CredentialRecord>(
                contract,
                'ReinstateCredential',
                credentialId
            );

            res.status(200).json({
                message: 'Credential reinstated successfully',
                data: result.data,
                latencyMs: result.latencyMs
            });
        } catch (error) {
            next(error);
        }
    }

    public static async updateCredentialStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const contract = LifecycleController.getAuthorizedContract(req, res);
            if (!contract) return;

            const { credentialId } = req.params;
            const { status } = req.body;

            const result = await ContractService.submit<CredentialRecord>(
                contract,
                'UpdateCredentialStatus',
                credentialId,
                status
            );

            res.status(200).json({
                message: 'Credential status updated successfully',
                data: result.data,
                latencyMs: result.latencyMs
            });
        } catch (error) {
            next(error);
        }
    }
}
