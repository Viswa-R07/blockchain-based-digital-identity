/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextFunction, Request, Response } from 'express';

interface RateLimitRecord {
    count: number;
    resetTime: number;
}

interface RateLimitOptions {
    windowMs: number;
    maxRequests: number;
    name: string;
}

export class MemoryRateLimiter {
    private records: Map<string, RateLimitRecord> = new Map();
    private readonly windowMs: number;
    private readonly maxRequests: number;
    private readonly name: string;

    constructor(options: RateLimitOptions) {
        this.windowMs = options.windowMs;
        this.maxRequests = options.maxRequests;
        this.name = options.name;
    }

    public middleware() {
        return (req: Request, res: Response, next: NextFunction): void => {
            // Allow disabling via environment for heavy automated integration test runs
            if (process.env.RATE_LIMIT_DISABLED === 'true') {
                return next();
            }

            const now = Date.now();
            const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
            const key = `${this.name}:${clientIp}`;

            let record = this.records.get(key);

            if (!record || now >= record.resetTime) {
                record = {
                    count: 1,
                    resetTime: now + this.windowMs
                };
                this.records.set(key, record);
            } else {
                record.count += 1;
            }

            const remaining = Math.max(0, this.maxRequests - record.count);
            const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

            res.setHeader('X-RateLimit-Limit', this.maxRequests);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-RateLimit-Reset', resetSeconds);

            if (record.count > this.maxRequests) {
                res.setHeader('Retry-After', resetSeconds);
                res.status(429).json({
                    error: 'TOO_MANY_REQUESTS',
                    message: `Rate limit exceeded for ${this.name}. Maximum allowed: ${this.maxRequests} requests per minute.`,
                    retryAfterSeconds: resetSeconds
                });
                return;
            }

            next();
        };
    }

    public reset(): void {
        this.records.clear();
    }
}

// SEC-API-01: Tiered rate limiter instances
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

export const generalLimiter = new MemoryRateLimiter({
    name: 'general',
    windowMs,
    maxRequests: parseInt(process.env.RATE_LIMIT_GENERAL_MAX || '100', 10)
});

export const sensitiveLimiter = new MemoryRateLimiter({
    name: 'sensitive',
    windowMs,
    maxRequests: parseInt(process.env.RATE_LIMIT_SENSITIVE_MAX || '20', 10)
});

export const storageLimiter = new MemoryRateLimiter({
    name: 'storage',
    windowMs,
    maxRequests: parseInt(process.env.RATE_LIMIT_STORAGE_MAX || '30', 10)
});

export function resetAllRateLimits(): void {
    generalLimiter.reset();
    sensitiveLimiter.reset();
    storageLimiter.reset();
}
