/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { logger } from '../utils/logger.js';

const PROHIBITED_PII_KEYWORDS = [
    'name',
    'firstname',
    'lastname',
    'dob',
    'dateofbirth',
    'ssn',
    'aadhaar',
    'passportnumber',
    'email',
    'phone',
    'mobile',
    'address',
    'biometric'
];

/**
 * Zero Raw PII Gatekeeper Middleware
 *
 * NOTE ON PRIVACY LIMITATIONS:
 * This keyword-based screening is a defense-in-depth gatekeeper for the research prototype,
 * NOT a mathematical proof of complete privacy, data anonymization, or full GDPR compliance.
 * It prevents accidental inclusion of standard plaintext PII attributes before ledger submission.
 */
export function zeroRawPiiGatekeeper(req: Request, res: Response, next: NextFunction): void {
    if (!req.body || typeof req.body !== 'object') {
        next();
        return;
    }

    const detectedKeys: string[] = [];

    function inspect(obj: Record<string, unknown>): void {
        for (const key of Object.keys(obj)) {
            const lowerKey = key.toLowerCase();
            if (PROHIBITED_PII_KEYWORDS.includes(lowerKey)) {
                detectedKeys.push(key);
            }

            const val = obj[key];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                inspect(val as Record<string, unknown>);
            }
        }
    }

    inspect(req.body as Record<string, unknown>);

    if (detectedKeys.length > 0) {
        logger.warn(`Rejected request payload containing raw PII keyword fields: [${detectedKeys.join(', ')}]`);
        res.status(400).json({
            error: 'INVALID_REQUEST_PAYLOAD',
            message: `Request payload rejected by privacy gatekeeper: raw PII fields detected [${detectedKeys.join(', ')}]. Only cryptographic commitments (SHA-256 hashes) and non-PII identifiers are permitted.`
        });
        return;
    }

    next();
}

/**
 * Zod Schema Validation Middleware Factory
 */
export function validateBody(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('; ');
                res.status(400).json({
                    error: 'INVALID_REQUEST_BODY',
                    message: errorMessages,
                    details: error.errors
                });
                return;
            }
            res.status(400).json({
                error: 'INVALID_REQUEST_BODY',
                message: 'Malformed request payload'
            });
        }
    };
}
