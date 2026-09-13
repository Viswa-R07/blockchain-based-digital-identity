/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AuthenticatedUser, OrgMspId } from '../types/index.js';

// Extend Express Request to attach authenticated user context
declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

/**
 * Maps controlled API keys to authenticated institutional organization principals.
 *
 * NOTE FOR PRODUCTION:
 * This prototype uses API-key-based institutional principal mapping for automated testing.
 * A production deployment must integrate enterprise Identity Providers (IdP) via OAuth 2.0 / OpenID Connect (OIDC),
 * utilizing cryptographically signed JSON Web Tokens (JWT) or mutual TLS (mTLS) with role-based access control (RBAC).
 *
 * Client-supplied headers such as `X-Calling-Org` are strictly ignored as identity proof to prevent spoofing.
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'];

    let apiKey = '';
    if (apiKeyHeader && typeof apiKeyHeader === 'string') {
        apiKey = apiKeyHeader.trim();
    } else if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.slice(7).trim();
    }

    if (!apiKey) {
        res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Missing authentication credentials. Provide a valid X-API-Key or Bearer token.'
        });
        return;
    }

    let user: AuthenticatedUser | undefined;

    if (apiKey === env.API_KEY_GOV) {
        user = { org: 'GovMSP', role: 'GOV_ADMIN', apiKeyName: 'GovernmentAuthorityKey' };
    } else if (apiKey === env.API_KEY_UNI) {
        user = { org: 'UniversityMSP', role: 'UNI_REGISTRAR', apiKeyName: 'UniversityRegistrarKey' };
    } else if (apiKey === env.API_KEY_BANK) {
        user = { org: 'BankMSP', role: 'BANK_COMPLIANCE', apiKeyName: 'BankComplianceKey' };
    } else if (apiKey === env.API_KEY_EMP) {
        user = { org: 'EmployerMSP', role: 'EMP_HR', apiKeyName: 'EmployerHrKey' };
    } else if (apiKey === env.API_KEY_VERIFIER) {
        user = { org: 'GovMSP', role: 'VERIFIER', apiKeyName: 'PublicVerifierKey' };
    }

    if (!user) {
        res.status(401).json({
            error: 'INVALID_CREDENTIALS',
            message: 'Provided API key is invalid or unrecognized.'
        });
        return;
    }

    req.user = user;
    next();
}

/**
 * Middleware factory enforcing organization-level authorization.
 */
export function requireOrg(...allowedOrgs: OrgMspId[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'Authentication required'
            });
            return;
        }

        if (!allowedOrgs.includes(req.user.org)) {
            res.status(403).json({
                error: 'FORBIDDEN',
                message: `Operation restricted to [${allowedOrgs.join(', ')}]. Caller is authenticated as ${req.user.org}.`
            });
            return;
        }

        next();
    };
}
