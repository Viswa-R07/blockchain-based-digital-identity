/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextFunction, Request, Response } from 'express';
import { ContractService } from '../fabric/contractService.js';
import { gatewayManager } from '../fabric/gatewayManager.js';
import { CredentialRecord } from '../types/index.js';

export class LifecycleController {
    public static async revokeCredential(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { credentialId } = req.params;
            const { reason } = req.body;

            // Route proposal through the authenticated caller's gateway identity
            // The chaincode on-chain ABAC verifies callerMsp === record.issuerOrg
            const callingOrg = req.user?.org || 'GovMSP';
            const contract = gatewayManager.getContract(callingOrg);

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
            const { credentialId } = req.params;
            const { reason } = req.body;

            const callingOrg = req.user?.org || 'GovMSP';
            const contract = gatewayManager.getContract(callingOrg);

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
            const { credentialId } = req.params;

            const callingOrg = req.user?.org || 'GovMSP';
            const contract = gatewayManager.getContract(callingOrg);

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
            const { credentialId } = req.params;
            const { status } = req.body;

            const callingOrg = req.user?.org || 'GovMSP';
            const contract = gatewayManager.getContract(callingOrg);

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
