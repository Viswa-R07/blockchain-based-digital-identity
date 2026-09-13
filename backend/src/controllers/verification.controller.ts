/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextFunction, Request, Response } from 'express';
import { ContractService } from '../fabric/contractService.js';
import { gatewayManager } from '../fabric/gatewayManager.js';
import { CredentialStatusResult, VerificationResult } from '../types/index.js';

export class VerificationController {
    public static async getCredentialStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { credentialId } = req.params;
            const contract = gatewayManager.getDefaultContract();
            const result = await ContractService.evaluate<CredentialStatusResult>(
                contract,
                'GetCredentialStatus',
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

    public static async verifyCredential(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { credentialId, subjectDID, credentialCommitment } = req.body;
            const contract = gatewayManager.getDefaultContract();
            const result = await ContractService.evaluate<VerificationResult>(
                contract,
                'VerifyCredential',
                credentialId,
                subjectDID,
                credentialCommitment
            );

            res.status(200).json({
                data: result.data,
                latencyMs: result.latencyMs
            });
        } catch (error) {
            next(error);
        }
    }

    public static async getCredentialHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { credentialId } = req.params;
            const contract = gatewayManager.getDefaultContract();
            const result = await ContractService.evaluate<unknown[]>(
                contract,
                'GetCredentialHistory',
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
}
