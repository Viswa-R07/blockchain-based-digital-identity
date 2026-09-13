/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { gatewayManager } from '../fabric/gatewayManager.js';

export class HealthController {
    public static async check(req: Request, res: Response): Promise<void> {
        const start = Date.now();
        try {
            const health = await gatewayManager.checkHealth();
            const latencyMs = Date.now() - start;

            // Return 200 for UP or DEGRADED (service is reachable, payload indicates degradation),
            // 503 if DOWN
            const httpCode = health.status === 'DOWN' ? 503 : 200;

            res.status(httpCode).json({
                status: health.status,
                service: 'digital-identity-backend',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                latencyMs,
                fabric: {
                    channel: env.FABRIC_CHANNEL_NAME,
                    chaincode: env.FABRIC_CHAINCODE_NAME,
                    gateways: health.orgs,
                    topology: health.details
                }
            });
        } catch (error) {
            const latencyMs = Date.now() - start;
            res.status(503).json({
                status: 'DOWN',
                service: 'digital-identity-backend',
                timestamp: new Date().toISOString(),
                latencyMs,
                error: (error as Error).message
            });
        }
    }
}
