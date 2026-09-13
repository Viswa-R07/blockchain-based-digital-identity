/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { createApp } from './app.js';
import { env } from './config/env.js';
import { gatewayManager } from './fabric/gatewayManager.js';
import { logger } from './utils/logger.js';

async function main() {
    try {
        logger.info('Starting Digital Identity & Credential Registry Backend Service...');

        // 1. Initialize Fabric Gateway Manager (Connecting all 4 Org Gateways)
        await gatewayManager.initialize();

        // 2. Create Express Application
        const app = createApp();

        // 3. Start HTTP Server
        const server = app.listen(env.PORT, () => {
            logger.info(`REST API Server listening on port ${env.PORT} (Environment: ${env.NODE_ENV})`);
            logger.info(`Health check available at: http://localhost:${env.PORT}/api/v1/health`);
        });

        // 4. Graceful Shutdown Handlers
        const shutdown = async (signal: string) => {
            logger.info(`Received ${signal}. Starting graceful shutdown...`);
            server.close(async () => {
                logger.info('HTTP server closed.');
                try {
                    await gatewayManager.closeAll();
                    logger.info('All Fabric Gateway connections cleanly terminated.');
                    process.exit(0);
                } catch (err) {
                    logger.error('Error during Gateway termination:', { error: (err as Error).message });
                    process.exit(1);
                }
            });

            // Force close after 10s if hanging
            setTimeout(() => {
                logger.error('Forcefully terminating after timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

    } catch (error) {
        logger.error('Fatal startup error:', { error: (error as Error).message, stack: (error as Error).stack });
        process.exit(1);
    }
}

main();
