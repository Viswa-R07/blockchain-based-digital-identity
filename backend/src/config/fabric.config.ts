/*
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'path';
import { env } from './env.js';
import { OrgConfig, OrgMspId } from '../types/index.js';

export function getOrgConfig(mspId: OrgMspId): OrgConfig {
    const base = env.CRYPTO_BASE_PATH;

    switch (mspId) {
        case 'GovMSP':
            return {
                mspId: 'GovMSP',
                peerEndpoint: env.GOV_PEER_ENDPOINT || 'localhost:7051',
                peerHostOverride: env.GOV_PEER_HOST_OVERRIDE || 'peer0.gov.identity.example.com',
                tlsCertPath: env.GOV_TLS_CERT_PATH || path.join(base, 'gov.identity.example.com/peers/peer0.gov.identity.example.com/tls/ca.crt'),
                userCertPath: env.GOV_USER_CERT_PATH || path.join(base, 'gov.identity.example.com/users/User1@gov.identity.example.com/msp/signcerts/cert.pem'),
                keystoreDir: env.GOV_KEYSTORE_DIR || path.join(base, 'gov.identity.example.com/users/User1@gov.identity.example.com/msp/keystore')
            };

        case 'UniversityMSP':
            return {
                mspId: 'UniversityMSP',
                peerEndpoint: env.UNI_PEER_ENDPOINT || 'localhost:8051',
                peerHostOverride: env.UNI_PEER_HOST_OVERRIDE || 'peer0.university.example.com',
                tlsCertPath: env.UNI_TLS_CERT_PATH || path.join(base, 'university.example.com/peers/peer0.university.example.com/tls/ca.crt'),
                userCertPath: env.UNI_USER_CERT_PATH || path.join(base, 'university.example.com/users/User1@university.example.com/msp/signcerts/cert.pem'),
                keystoreDir: env.UNI_KEYSTORE_DIR || path.join(base, 'university.example.com/users/User1@university.example.com/msp/keystore')
            };

        case 'BankMSP':
            return {
                mspId: 'BankMSP',
                peerEndpoint: env.BANK_PEER_ENDPOINT || 'localhost:9051',
                peerHostOverride: env.BANK_PEER_HOST_OVERRIDE || 'peer0.bank.example.com',
                tlsCertPath: env.BANK_TLS_CERT_PATH || path.join(base, 'bank.example.com/peers/peer0.bank.example.com/tls/ca.crt'),
                userCertPath: env.BANK_USER_CERT_PATH || path.join(base, 'bank.example.com/users/User1@bank.example.com/msp/signcerts/cert.pem'),
                keystoreDir: env.BANK_KEYSTORE_DIR || path.join(base, 'bank.example.com/users/User1@bank.example.com/msp/keystore')
            };

        case 'EmployerMSP':
            return {
                mspId: 'EmployerMSP',
                peerEndpoint: env.EMP_PEER_ENDPOINT || 'localhost:10051',
                peerHostOverride: env.EMP_PEER_HOST_OVERRIDE || 'peer0.employer.example.com',
                tlsCertPath: env.EMP_TLS_CERT_PATH || path.join(base, 'employer.example.com/peers/peer0.employer.example.com/tls/ca.crt'),
                userCertPath: env.EMP_USER_CERT_PATH || path.join(base, 'employer.example.com/users/User1@employer.example.com/msp/signcerts/cert.pem'),
                keystoreDir: env.EMP_KEYSTORE_DIR || path.join(base, 'employer.example.com/users/User1@employer.example.com/msp/keystore')
            };

        default:
            throw new Error(`Unsupported organization MSP: ${mspId}`);
    }
}
