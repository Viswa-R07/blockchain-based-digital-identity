/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextFunction, Request, Response } from 'express';

/**
 * SEC-API-02: HTTP Security Headers & Explicit CORS Middleware.
 * Implements security headers (conforming to Helmet standards) and strict CORS configuration
 * without external runtime dependencies.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
    // 1. Core Security Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 2. Suppress technology fingerprinting
    res.removeHeader('X-Powered-By');

    // 3. Explicit CORS configuration (No unsafe wildcard credentials)
    const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

    // If request is OPTIONS pre-flight, respond immediately with 204
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    next();
}
