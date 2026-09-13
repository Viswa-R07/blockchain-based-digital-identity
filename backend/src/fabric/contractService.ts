/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Contract } from '@hyperledger/fabric-gateway';
import { logger } from '../utils/logger.js';

export interface InvocationResult<T = unknown> {
    data: T;
    latencyMs: number;
}

export class ContractService {
    public static async evaluate<T = unknown>(
        contract: Contract,
        fnName: string,
        ...args: string[]
    ): Promise<InvocationResult<T>> {
        const start = Date.now();
        try {
            const resultBytes = await contract.evaluateTransaction(fnName, ...args);
            const latencyMs = Date.now() - start;
            const resultString = new TextDecoder().decode(resultBytes);

            let data: T;
            if (resultString === 'true') {
                data = true as unknown as T;
            } else if (resultString === 'false') {
                data = false as unknown as T;
            } else if (!resultString || resultString.trim().length === 0) {
                data = null as unknown as T;
            } else {
                try {
                    data = JSON.parse(resultString) as T;
                } catch {
                    data = resultString as unknown as T;
                }
            }

            logger.debug(`evaluateTransaction: ${fnName} completed in ${latencyMs}ms`);
            return { data, latencyMs };
        } catch (error) {
            const latencyMs = Date.now() - start;
            logger.debug(`evaluateTransaction: ${fnName} failed after ${latencyMs}ms: ${(error as Error).message}`);
            throw error;
        }
    }

    public static async submit<T = unknown>(
        contract: Contract,
        fnName: string,
        ...args: string[]
    ): Promise<InvocationResult<T>> {
        const start = Date.now();
        try {
            const resultBytes = await contract.submitTransaction(fnName, ...args);
            const latencyMs = Date.now() - start;
            const resultString = new TextDecoder().decode(resultBytes);

            let data: T;
            if (resultString === 'true') {
                data = true as unknown as T;
            } else if (resultString === 'false') {
                data = false as unknown as T;
            } else if (!resultString || resultString.trim().length === 0) {
                data = null as unknown as T;
            } else {
                try {
                    data = JSON.parse(resultString) as T;
                } catch {
                    data = resultString as unknown as T;
                }
            }

            logger.info(`submitTransaction: ${fnName} committed in ${latencyMs}ms`);
            return { data, latencyMs };
        } catch (error) {
            const latencyMs = Date.now() - start;
            logger.error(`submitTransaction: ${fnName} failed after ${latencyMs}ms: ${(error as Error).message}`);
            throw error;
        }
    }
}
