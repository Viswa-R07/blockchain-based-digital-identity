/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextFunction, Request, Response } from 'express';
import { ContractService } from '../fabric/contractService.js';
import { gatewayManager } from '../fabric/gatewayManager.js';
import { IdentityRecord } from '../types/index.js';

export class IdentityController {
    public static async registerIdentity(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // SEC-AUTHZ-01: Explicit defense-in-depth check: Civil identity registration strictly restricted to GovMSP GOV_ADMIN
            if (req.user?.org !== 'GovMSP' || req.user?.role !== 'GOV_ADMIN') {
                res.status(403).json({
                    error: 'FORBIDDEN',
                    message: `Identity registration is strictly restricted to GovMSP GOV_ADMIN. Caller authenticated as ${req.user?.org} (${req.user?.role}).`
                });
                return;
            }

            const { did, identityCommitment } = req.body;
            // Strict server-side routing: Civil identity registration MUST use GovMSP gateway
            const contract = gatewayManager.getContract('GovMSP');
            const result = await ContractService.submit<IdentityRecord>(
                contract,
                'RegisterIdentity',
                did,
                identityCommitment
            );

            res.status(201).json({
                message: 'Identity registered successfully',
                data: result.data,
                latencyMs: result.latencyMs
            });
        } catch (error) {
            next(error);
        }
    }

    public static async readIdentity(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { did } = req.params;
            const contract = gatewayManager.getDefaultContract();
            const result = await ContractService.evaluate<IdentityRecord>(
                contract,
                'ReadIdentity',
                did
            );

            res.status(200).json({
                data: result.data,
                latencyMs: result.latencyMs
            });
        } catch (error) {
            next(error);
        }
    }

    public static async identityExists(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { did } = req.params;
            const contract = gatewayManager.getDefaultContract();
            const result = await ContractService.evaluate<boolean>(
                contract,
                'IdentityExists',
                did
            );

            res.status(200).json({
                exists: result.data,
                latencyMs: result.latencyMs
            });
        } catch (error) {
            next(error);
        }
    }

    public static async updateIdentityStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // SEC-AUTHZ-01: Explicit defense-in-depth check: Identity status updates strictly restricted to GovMSP GOV_ADMIN
            if (req.user?.org !== 'GovMSP' || req.user?.role !== 'GOV_ADMIN') {
                res.status(403).json({
                    error: 'FORBIDDEN',
                    message: `Identity status updates are strictly restricted to GovMSP GOV_ADMIN. Caller authenticated as ${req.user?.org} (${req.user?.role}).`
                });
                return;
            }

            const { did } = req.params;
            const { status } = req.body;
            // Strict server-side routing: Identity status updates strictly restricted to GovMSP
            const contract = gatewayManager.getContract('GovMSP');
            const result = await ContractService.submit<IdentityRecord>(
                contract,
                'UpdateIdentityStatus',
                did,
                status
            );

            res.status(200).json({
                message: 'Identity status updated successfully',
                data: result.data,
                latencyMs: result.latencyMs
            });
        } catch (error) {
            next(error);
        }
    }

    public static async getIdentityHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { did } = req.params;
            const contract = gatewayManager.getDefaultContract();
            const result = await ContractService.evaluate<unknown[]>(
                contract,
                'GetIdentityHistory',
                did
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
