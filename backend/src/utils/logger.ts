/*
 * SPDX-License-Identifier: Apache-2.0
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        // Redact any potentially sensitive keys if accidentally passed in metadata
        const sanitized = { ...metadata };
        const sensitiveKeys = ['privateKey', 'key', 'cert', 'token', 'authorization', 'apiKey', 'password', 'secret', 'ssn', 'aadhaar'];
        for (const key of Object.keys(sanitized)) {
            if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
                sanitized[key] = '[REDACTED]';
            }
        }
        msg += ` ${JSON.stringify(sanitized)}`;
    }
    return msg;
});

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        logFormat
    ),
    transports: [
        new winston.transports.Console({
            format: combine(
                colorize(),
                timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
                logFormat
            )
        })
    ]
});
