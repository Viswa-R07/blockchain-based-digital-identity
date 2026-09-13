/*
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'path';
import { Contract, Network } from '@hyperledger/fabric-gateway';
import { env } from '../config/env.js';
import { getOrgConfig } from '../config/fabric.config.js';
import { OrgConfig, OrgMspId } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { createGatewayConnection, GatewayConnection } from './connection.js';

export interface OrgHealthDetail {
    connected: boolean;
    endpoint: string;
    peerHostOverride: string;
    error?: string;
}

export interface HealthCheckResult {
    status: 'UP' | 'DEGRADED' | 'DOWN';
    orgs: Record<OrgMspId, boolean>;
    details: Record<OrgMspId, OrgHealthDetail>;
}

export class GatewayManager {
    private connections: Map<OrgMspId, GatewayConnection> = new Map();
    private networks: Map<OrgMspId, Network> = new Map();
    private contracts: Map<OrgMspId, Contract> = new Map();

    // Coordinator connections for multi-org endorsement policy satisfaction
    private coordinatorConnections: Map<OrgMspId, GatewayConnection> = new Map();
    private coordinatorContracts: Map<OrgMspId, Contract> = new Map();

    private initialized = false;

    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        const orgs: OrgMspId[] = ['GovMSP', 'UniversityMSP', 'BankMSP', 'EmployerMSP'];
        const base = env.CRYPTO_BASE_PATH;
        const govTlsCert = env.GOV_TLS_CERT_PATH || path.join(base, 'gov.identity.example.com/peers/peer0.gov.identity.example.com/tls/ca.crt');
        const govEndpoint = env.GOV_PEER_ENDPOINT || 'localhost:7051';
        const govHostOverride = env.GOV_PEER_HOST_OVERRIDE || 'peer0.gov.identity.example.com';

        for (const org of orgs) {
            try {
                // 1. Direct gateway connection to the organization's own peer
                const config = getOrgConfig(org);
                const conn = await createGatewayConnection(config);
                this.connections.set(org, conn);

                const network = conn.gateway.getNetwork(env.FABRIC_CHANNEL_NAME);
                this.networks.set(org, network);

                const contract = network.getContract(env.FABRIC_CHAINCODE_NAME);
                this.contracts.set(org, contract);

                // 2. Channel coordinator connection with the organization's User1 identity
                if (org === 'GovMSP') {
                    this.coordinatorConnections.set(org, conn);
                    this.coordinatorContracts.set(org, contract);
                } else {
                    const coordinatorConfig: OrgConfig = {
                        mspId: org,
                        peerEndpoint: govEndpoint,
                        peerHostOverride: govHostOverride,
                        tlsCertPath: govTlsCert,
                        userCertPath: config.userCertPath,
                        keystoreDir: config.keystoreDir
                    };
                    const coordConn = await createGatewayConnection(coordinatorConfig);
                    this.coordinatorConnections.set(org, coordConn);

                    const coordNetwork = coordConn.gateway.getNetwork(env.FABRIC_CHANNEL_NAME);
                    const coordContract = coordNetwork.getContract(env.FABRIC_CHAINCODE_NAME);
                    this.coordinatorContracts.set(org, coordContract);
                }
            } catch (error) {
                logger.error(`Failed to initialize gateway for ${org}:`, { error: (error as Error).message });
                throw error;
            }
        }

        this.initialized = true;
        logger.info(`GatewayManager fully initialized with all ${orgs.length} organizational gateways.`);
    }

    public getContract(org: OrgMspId): Contract {
        const primary = this.contracts.get(org);
        if (!primary) {
            throw new Error(`Fabric Gateway contract not initialized for organization: ${org}`);
        }

        const coordinator = this.coordinatorContracts.get(org);
        if (!coordinator || primary === coordinator) {
            return primary;
        }

        // Return contract proxy: evaluate runs on direct peer; submit falls back to coordinator if multi-org discovery fails
        return {
            getChaincodeName: () => primary.getChaincodeName(),
            getContractName: () => primary.getContractName(),
            evaluateTransaction: (name: string, ...args: any[]) => primary.evaluateTransaction(name, ...args),
            submitTransaction: async (name: string, ...args: any[]) => {
                try {
                    return await primary.submitTransaction(name, ...args);
                } catch (error: any) {
                    const msg = (error?.message || '').toLowerCase();
                    if (msg.includes('no combination of peers can be derived') || msg.includes('no peer combination can satisfy')) {
                        logger.warn(`Direct gateway on ${org} could not satisfy multi-org endorsement policy; submitting with ${org} identity via channel coordinator...`);
                        return await coordinator.submitTransaction(name, ...args);
                    }
                    throw error;
                }
            },
            evaluate: (name: string, options: any) => primary.evaluate(name, options),
            submit: async (name: string, options: any) => {
                try {
                    return await primary.submit(name, options);
                } catch (error: any) {
                    const msg = (error?.message || '').toLowerCase();
                    if (msg.includes('no combination of peers can be derived') || msg.includes('no peer combination can satisfy')) {
                        return await coordinator.submit(name, options);
                    }
                    throw error;
                }
            },
            submitAsync: (name: string, options: any) => primary.submitAsync(name, options),
            newProposal: (name: string, options: any) => primary.newProposal(name, options)
        } as unknown as Contract;
    }

    public getDefaultContract(): Contract {
        return this.getContract('GovMSP');
    }

    /**
     * Checks health of all organizational gateways.
     * Rules:
     * 1. Missing contract -> false
     * 2. Successful lightweight evaluateTransaction -> true
     * 3. Actual gRPC/TLS/network/connectivity failure -> false
     * 4. Chaincode/application-level response proving peer was reached -> true
     * 5. Overall status: UP if all succeed, DEGRADED if 1 or more fail, DOWN if all fail.
     */
    public async checkHealth(): Promise<HealthCheckResult> {
        const orgs: OrgMspId[] = ['GovMSP', 'UniversityMSP', 'BankMSP', 'EmployerMSP'];
        const orgResults: Partial<Record<OrgMspId, boolean>> = {};
        const details: Partial<Record<OrgMspId, OrgHealthDetail>> = {};
        let successCount = 0;

        for (const org of orgs) {
            const config = getOrgConfig(org);
            const contract = this.contracts.get(org);

            // 1. Missing contract -> false
            if (!contract) {
                orgResults[org] = false;
                details[org] = {
                    connected: false,
                    endpoint: config.peerEndpoint,
                    peerHostOverride: config.peerHostOverride,
                    error: 'Contract not initialized'
                };
                continue;
            }

            try {
                // 2. Successful lightweight probe
                await contract.evaluateTransaction('IdentityExists', 'did:probe:healthcheck');
                orgResults[org] = true;
                details[org] = {
                    connected: true,
                    endpoint: config.peerEndpoint,
                    peerHostOverride: config.peerHostOverride
                };
                successCount++;
            } catch (error: any) {
                if (this.isConnectivityError(error)) {
                    // 3. Actual gRPC/TLS/network/connectivity failure -> false
                    orgResults[org] = false;
                    details[org] = {
                        connected: false,
                        endpoint: config.peerEndpoint,
                        peerHostOverride: config.peerHostOverride,
                        error: error.message || 'Connectivity failure'
                    };
                } else {
                    // 4. Application-level response proving the peer was reached -> true
                    orgResults[org] = true;
                    details[org] = {
                        connected: true,
                        endpoint: config.peerEndpoint,
                        peerHostOverride: config.peerHostOverride
                    };
                    successCount++;
                }
            }
        }

        let overallStatus: 'UP' | 'DEGRADED' | 'DOWN' = 'UP';
        if (successCount === 0) {
            overallStatus = 'DOWN';
        } else if (successCount < orgs.length) {
            overallStatus = 'DEGRADED';
        }

        return {
            status: overallStatus,
            orgs: orgResults as Record<OrgMspId, boolean>,
            details: details as Record<OrgMspId, OrgHealthDetail>
        };
    }

    public isConnectivityError(error: any): boolean {
        if (!error) return true;

        // gRPC status code check
        // 14 = UNAVAILABLE, 4 = DEADLINE_EXCEEDED, 1 = CANCELLED
        const code = error.code ?? error.status;
        if (code === 14 || code === 4 || code === 1) {
            return true;
        }

        const msg = (error.message || '').toLowerCase();
        const connectivityKeywords = [
            'unavailable',
            'econnrefused',
            'connect failed',
            'failed to connect',
            'channel closed',
            'socket closed',
            'handshake failed',
            'ssl',
            'tls',
            'endpoint unreachable',
            'connection reset',
            'no connection established',
            'transport error',
            'connection refused',
            'network error'
        ];

        for (const keyword of connectivityKeywords) {
            if (msg.includes(keyword)) {
                return true;
            }
        }

        // Check if error is from chaincode application level (e.g. EndorseError with details)
        // proving peer was reached and evaluated transaction, but chaincode threw application error
        if (error.name === 'EndorseError' || (Array.isArray(error.details) && error.details.length > 0)) {
            return false;
        }

        // If error message indicates chaincode execution or missing DID / not found
        if (msg.includes('chaincode') || msg.includes('does not exist') || msg.includes('not found')) {
            return false;
        }

        // Unclassified error -> treat as connectivity failure for safety
        return true;
    }

    public async closeAll(): Promise<void> {
        logger.info('Closing all Fabric Gateway connections...');
        for (const [org, conn] of this.connections.entries()) {
            try {
                conn.gateway.close();
                conn.client.close();
                logger.info(`Closed direct gateway connection for ${org}`);
            } catch (err) {
                logger.error(`Error closing gateway for ${org}:`, { error: (err as Error).message });
            }
        }

        for (const [org, conn] of this.coordinatorConnections.entries()) {
            if (org !== 'GovMSP') {
                try {
                    conn.gateway.close();
                    conn.client.close();
                    logger.info(`Closed coordinator gateway connection for ${org}`);
                } catch (err) {
                    logger.error(`Error closing coordinator gateway for ${org}:`, { error: (err as Error).message });
                }
            }
        }

        this.connections.clear();
        this.networks.clear();
        this.contracts.clear();
        this.coordinatorConnections.clear();
        this.coordinatorContracts.clear();
        this.initialized = false;
    }
}

export const gatewayManager = new GatewayManager();
