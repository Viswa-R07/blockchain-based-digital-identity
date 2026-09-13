/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { getOrgConfig } from '../../src/config/fabric.config.js';
import { GatewayManager } from '../../src/fabric/gatewayManager.js';
import { OrgMspId } from '../../src/types/index.js';

describe('Milestone 7 Gateway Configuration & Health Check Unit Tests', () => {

    describe('Requirement A: getOrgConfig() Distinct Gateway Topology', () => {
        const orgs: OrgMspId[] = ['GovMSP', 'UniversityMSP', 'BankMSP', 'EmployerMSP'];

        it('should return distinct peerEndpoints for all four organizations', () => {
            const configs = orgs.map(org => getOrgConfig(org));
            const endpoints = configs.map(c => c.peerEndpoint);

            expect(endpoints).toHaveLength(4);
            expect(new Set(endpoints).size).toBe(4);

            expect(getOrgConfig('GovMSP').peerEndpoint).toBe('localhost:7051');
            expect(getOrgConfig('UniversityMSP').peerEndpoint).toBe('localhost:8051');
            expect(getOrgConfig('BankMSP').peerEndpoint).toBe('localhost:9051');
            expect(getOrgConfig('EmployerMSP').peerEndpoint).toBe('localhost:10051');
        });

        it('should return distinct peerHostOverrides for all four organizations', () => {
            const configs = orgs.map(org => getOrgConfig(org));
            const hosts = configs.map(c => c.peerHostOverride);

            expect(hosts).toHaveLength(4);
            expect(new Set(hosts).size).toBe(4);

            expect(getOrgConfig('GovMSP').peerHostOverride).toBe('peer0.gov.identity.example.com');
            expect(getOrgConfig('UniversityMSP').peerHostOverride).toBe('peer0.university.example.com');
            expect(getOrgConfig('BankMSP').peerHostOverride).toBe('peer0.bank.example.com');
            expect(getOrgConfig('EmployerMSP').peerHostOverride).toBe('peer0.employer.example.com');
        });

        it('should return distinct tlsCertPaths for all four organizations', () => {
            const configs = orgs.map(org => getOrgConfig(org));
            const tlsPaths = configs.map(c => c.tlsCertPath);

            expect(tlsPaths).toHaveLength(4);
            expect(new Set(tlsPaths).size).toBe(4);

            expect(getOrgConfig('GovMSP').tlsCertPath).toContain('gov.identity.example.com');
            expect(getOrgConfig('UniversityMSP').tlsCertPath).toContain('university.example.com');
            expect(getOrgConfig('BankMSP').tlsCertPath).toContain('bank.example.com');
            expect(getOrgConfig('EmployerMSP').tlsCertPath).toContain('employer.example.com');
        });

        it('should retain respective User1 certificates and keystores for each organization', () => {
            expect(getOrgConfig('GovMSP').userCertPath).toContain('User1@gov.identity.example.com');
            expect(getOrgConfig('UniversityMSP').userCertPath).toContain('User1@university.example.com');
            expect(getOrgConfig('BankMSP').userCertPath).toContain('User1@bank.example.com');
            expect(getOrgConfig('EmployerMSP').userCertPath).toContain('User1@employer.example.com');

            expect(getOrgConfig('GovMSP').keystoreDir).toContain('gov.identity.example.com');
            expect(getOrgConfig('UniversityMSP').keystoreDir).toContain('university.example.com');
            expect(getOrgConfig('BankMSP').keystoreDir).toContain('bank.example.com');
            expect(getOrgConfig('EmployerMSP').keystoreDir).toContain('employer.example.com');
        });

        it('should throw for an unsupported organization MSP', () => {
            expect(() => getOrgConfig('InvalidMSP' as any)).toThrow('Unsupported organization MSP');
        });
    });

    describe('Requirement B: GatewayManager.checkHealth() Accurate Health Classification', () => {

        function createMockManagerWithContracts(contractsMap: Map<string, any>): GatewayManager {
            const manager = new GatewayManager();
            (manager as any).contracts = contractsMap;
            return manager;
        }

        it('should report UP when all four organizational gateways probe successfully', async () => {
            const contracts = new Map<string, any>();
            const orgs: OrgMspId[] = ['GovMSP', 'UniversityMSP', 'BankMSP', 'EmployerMSP'];

            for (const org of orgs) {
                contracts.set(org, {
                    evaluateTransaction: vi.fn().mockResolvedValue(Buffer.from('false'))
                });
            }

            const manager = createMockManagerWithContracts(contracts);
            const result = await manager.checkHealth();

            expect(result.status).toBe('UP');
            expect(result.orgs.GovMSP).toBe(true);
            expect(result.orgs.UniversityMSP).toBe(true);
            expect(result.orgs.BankMSP).toBe(true);
            expect(result.orgs.EmployerMSP).toBe(true);
            expect(result.details.GovMSP.connected).toBe(true);
            expect(result.details.UniversityMSP.connected).toBe(true);
            expect(result.details.BankMSP.connected).toBe(true);
            expect(result.details.EmployerMSP.connected).toBe(true);
        });

        it('should report DEGRADED and mark org false on actual gRPC/network connectivity failure', async () => {
            const contracts = new Map<string, any>();
            const orgs: OrgMspId[] = ['GovMSP', 'UniversityMSP', 'BankMSP', 'EmployerMSP'];

            for (const org of orgs) {
                if (org === 'BankMSP') {
                    const connErr = new Error('14 UNAVAILABLE: connection refused');
                    (connErr as any).code = 14;
                    contracts.set(org, {
                        evaluateTransaction: vi.fn().mockRejectedValue(connErr)
                    });
                } else {
                    contracts.set(org, {
                        evaluateTransaction: vi.fn().mockResolvedValue(Buffer.from('false'))
                    });
                }
            }

            const manager = createMockManagerWithContracts(contracts);
            const result = await manager.checkHealth();

            expect(result.status).toBe('DEGRADED');
            expect(result.orgs.GovMSP).toBe(true);
            expect(result.orgs.UniversityMSP).toBe(true);
            expect(result.orgs.BankMSP).toBe(false);
            expect(result.orgs.EmployerMSP).toBe(true);
            expect(result.details.BankMSP.connected).toBe(false);
            expect(result.details.BankMSP.error).toContain('UNAVAILABLE');
        });

        it('should report DEGRADED and mark org false on missing contract', async () => {
            const contracts = new Map<string, any>();
            // Only set GovMSP, UniversityMSP, EmployerMSP (BankMSP is missing)
            contracts.set('GovMSP', { evaluateTransaction: vi.fn().mockResolvedValue(Buffer.from('false')) });
            contracts.set('UniversityMSP', { evaluateTransaction: vi.fn().mockResolvedValue(Buffer.from('false')) });
            contracts.set('EmployerMSP', { evaluateTransaction: vi.fn().mockResolvedValue(Buffer.from('false')) });

            const manager = createMockManagerWithContracts(contracts);
            const result = await manager.checkHealth();

            expect(result.status).toBe('DEGRADED');
            expect(result.orgs.GovMSP).toBe(true);
            expect(result.orgs.UniversityMSP).toBe(true);
            expect(result.orgs.BankMSP).toBe(false);
            expect(result.orgs.EmployerMSP).toBe(true);
            expect(result.details.BankMSP.connected).toBe(false);
            expect(result.details.BankMSP.error).toBe('Contract not initialized');
        });

        it('should report DOWN when all four organizational gateways fail connectivity', async () => {
            const contracts = new Map<string, any>();
            const orgs: OrgMspId[] = ['GovMSP', 'UniversityMSP', 'BankMSP', 'EmployerMSP'];

            for (const org of orgs) {
                const connErr = new Error('connect ECONNREFUSED 127.0.0.1');
                contracts.set(org, {
                    evaluateTransaction: vi.fn().mockRejectedValue(connErr)
                });
            }

            const manager = createMockManagerWithContracts(contracts);
            const result = await manager.checkHealth();

            expect(result.status).toBe('DOWN');
            expect(result.orgs.GovMSP).toBe(false);
            expect(result.orgs.UniversityMSP).toBe(false);
            expect(result.orgs.BankMSP).toBe(false);
            expect(result.orgs.EmployerMSP).toBe(false);
        });

        it('should treat chaincode application-level responses as reachable/connected', async () => {
            const contracts = new Map<string, any>();
            const orgs: OrgMspId[] = ['GovMSP', 'UniversityMSP', 'BankMSP', 'EmployerMSP'];

            for (const org of orgs) {
                if (org === 'EmployerMSP') {
                    // Application error proving peer was reached and responded with chaincode status
                    const appError = new Error('Identity does not exist');
                    (appError as any).name = 'EndorseError';
                    (appError as any).details = [{ message: 'Chaincode execution error' }];
                    contracts.set(org, {
                        evaluateTransaction: vi.fn().mockRejectedValue(appError)
                    });
                } else {
                    contracts.set(org, {
                        evaluateTransaction: vi.fn().mockResolvedValue(Buffer.from('false'))
                    });
                }
            }

            const manager = createMockManagerWithContracts(contracts);
            const result = await manager.checkHealth();

            expect(result.status).toBe('UP');
            expect(result.orgs.EmployerMSP).toBe(true);
            expect(result.details.EmployerMSP.connected).toBe(true);
        });
    });
});
