/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
    let fullErrorText = err.message || '';

    // Extract detail messages from Fabric Gateway EndorseError / SubmitError
    if ((err as any).details && Array.isArray((err as any).details)) {
        const detailsStr = (err as any).details.map((d: any) => d.message || '').join(' ');
        fullErrorText = `${fullErrorText} ${detailsStr}`;
    }

    logger.error(`Error processing ${req.method} ${req.originalUrl}: ${fullErrorText}`);

    // Clean message: extract chaincode response message
    let cleanMessage = fullErrorText;
    const chaincodeMatch = fullErrorText.match(/\[([A-Z_]+)\]\s*([^",\n]+)/);
    if (chaincodeMatch && chaincodeMatch[2]) {
        cleanMessage = chaincodeMatch[2].trim();
    } else {
        const match = fullErrorText.match(/message:\s*"(\[[A-Z_]+\]\s*)?([^"]+)"/);
        if (match && match[2]) {
            cleanMessage = match[2].trim();
        } else {
            cleanMessage = fullErrorText.replace(/Error:\s*/, '').replace(/\[[A-Z_]+\]\s*/, '');
        }
    }

    // 1. Not Found Errors -> 404
    if (fullErrorText.includes('NOT_FOUND') || fullErrorText.includes('does not exist')) {
        res.status(404).json({
            error: 'NOT_FOUND',
            message: cleanMessage
        });
        return;
    }

    // 2. Conflict / Duplicate Errors -> 409
    if (fullErrorText.includes('ALREADY_EXISTS') || fullErrorText.includes('DUPLICATE') || fullErrorText.includes('already exists')) {
        res.status(409).json({
            error: 'RESOURCE_CONFLICT',
            message: cleanMessage
        });
        return;
    }

    // 3. Authorization Errors -> 403
    if (fullErrorText.includes('UNAUTHORIZED') || fullErrorText.includes('UNAUTHORIZED_ISSUER_ORG') || fullErrorText.includes('not authorized')) {
        res.status(403).json({
            error: 'UNAUTHORIZED_OPERATION',
            message: cleanMessage
        });
        return;
    }

    // 4. Terminal State / Lifecycle Conflict Errors -> 422
    if (fullErrorText.includes('REVOCATION_IS_TERMINAL') || fullErrorText.includes('CANNOT_TRANSITION') || fullErrorText.includes('ALREADY_REVOKED') || fullErrorText.includes('permanent terminal state')) {
        res.status(422).json({
            error: 'TERMINAL_STATE_CONFLICT',
            message: cleanMessage
        });
        return;
    }

    // 5. Validation / Malformed Request Errors -> 400
    if (fullErrorText.includes('INVALID_') || fullErrorText.includes('MALFORMED') || fullErrorText.includes('Invalid') || fullErrorText.includes('NOOP_TRANSITION')) {
        res.status(400).json({
            error: 'INVALID_REQUEST',
            message: cleanMessage
        });
        return;
    }

    // 6. Endorsement Policy Failure -> 502
    if (fullErrorText.includes('ENDORSEMENT_POLICY_FAILURE') || fullErrorText.includes('endorsement failure')) {
        res.status(502).json({
            error: 'ENDORSEMENT_POLICY_FAILURE',
            message: cleanMessage
        });
        return;
    }

    // 7. gRPC / Peer Connectivity Errors -> 503
    if (fullErrorText.includes('UNAVAILABLE') || fullErrorText.includes('Connect Failed') || fullErrorText.includes('14 UNAVAILABLE')) {
        res.status(503).json({
            error: 'FABRIC_PEER_UNAVAILABLE',
            message: 'Hyperledger Fabric peer connection failed or is unavailable'
        });
        return;
    }

    // Default Internal Server Error -> 500 (Sanitized)
    res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred while processing the transaction.'
    });
}
