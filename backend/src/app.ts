/*
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Express, Request, Response } from 'express';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import apiRouter from './routes/index.js';
import { logger } from './utils/logger.js';

export function createApp(): Express {
    const app = express();

    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Request logging middleware (does NOT log bodies, headers, or PII)
    app.use((req: Request, res: Response, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
        });
        next();
    });

    // Mount API v1
    app.use('/api/v1', apiRouter);

    // Root endpoint
    app.get('/', (req: Request, res: Response) => {
        res.status(200).json({
            service: 'Digital Identity & Credential Registry API Backend',
            version: '1.0.0',
            docs: '/api/v1/health',
            status: 'OPERATIONAL'
        });
    });

    // 404 Handler for undefined routes
    app.use((req: Request, res: Response) => {
        res.status(404).json({
            error: 'ROUTE_NOT_FOUND',
            message: `Endpoint ${req.method} ${req.originalUrl} does not exist.`
        });
    });

    // Centralized error handling middleware
    app.use(errorHandler);

    return app;
}
