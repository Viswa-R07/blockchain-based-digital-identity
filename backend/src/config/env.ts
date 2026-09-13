/*
 * SPDX-License-Identifier: Apache-2.0
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

export const env = {
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',

    // API Keys for Prototype Role-based Access Control
    API_KEY_GOV: process.env.API_KEY_GOV || 'gov-admin-secret-key-12345',
    API_KEY_UNI: process.env.API_KEY_UNI || 'uni-registrar-secret-key-12345',
    API_KEY_BANK: process.env.API_KEY_BANK || 'bank-compliance-secret-key-12345',
    API_KEY_EMP: process.env.API_KEY_EMP || 'emp-hr-secret-key-12345',
    API_KEY_VERIFIER: process.env.API_KEY_VERIFIER || 'verifier-public-secret-key-12345',

    // Fabric Core
    FABRIC_CHANNEL_NAME: process.env.FABRIC_CHANNEL_NAME || 'identity-channel',
    FABRIC_CHAINCODE_NAME: process.env.FABRIC_CHAINCODE_NAME || 'identity-registry',

    // Base Crypto Path
    CRYPTO_BASE_PATH: process.env.CRYPTO_BASE_PATH || path.resolve(__dirname, '../../../network/organizations/peerOrganizations'),

    // GovMSP
    GOV_PEER_ENDPOINT: process.env.GOV_PEER_ENDPOINT || 'localhost:7051',
    GOV_PEER_HOST_OVERRIDE: process.env.GOV_PEER_HOST_OVERRIDE || 'peer0.gov.identity.example.com',
    GOV_TLS_CERT_PATH: process.env.GOV_TLS_CERT_PATH || '',
    GOV_USER_CERT_PATH: process.env.GOV_USER_CERT_PATH || '',
    GOV_KEYSTORE_DIR: process.env.GOV_KEYSTORE_DIR || '',

    // UniversityMSP
    UNI_PEER_ENDPOINT: process.env.UNI_PEER_ENDPOINT || 'localhost:8051',
    UNI_PEER_HOST_OVERRIDE: process.env.UNI_PEER_HOST_OVERRIDE || 'peer0.university.example.com',
    UNI_TLS_CERT_PATH: process.env.UNI_TLS_CERT_PATH || '',
    UNI_USER_CERT_PATH: process.env.UNI_USER_CERT_PATH || '',
    UNI_KEYSTORE_DIR: process.env.UNI_KEYSTORE_DIR || '',

    // BankMSP
    BANK_PEER_ENDPOINT: process.env.BANK_PEER_ENDPOINT || 'localhost:9051',
    BANK_PEER_HOST_OVERRIDE: process.env.BANK_PEER_HOST_OVERRIDE || 'peer0.bank.example.com',
    BANK_TLS_CERT_PATH: process.env.BANK_TLS_CERT_PATH || '',
    BANK_USER_CERT_PATH: process.env.BANK_USER_CERT_PATH || '',
    BANK_KEYSTORE_DIR: process.env.BANK_KEYSTORE_DIR || '',

    // EmployerMSP
    EMP_PEER_ENDPOINT: process.env.EMP_PEER_ENDPOINT || 'localhost:10051',
    EMP_PEER_HOST_OVERRIDE: process.env.EMP_PEER_HOST_OVERRIDE || 'peer0.employer.example.com',
    EMP_TLS_CERT_PATH: process.env.EMP_TLS_CERT_PATH || '',
    EMP_USER_CERT_PATH: process.env.EMP_USER_CERT_PATH || '',
    EMP_KEYSTORE_DIR: process.env.EMP_KEYSTORE_DIR || '',

    // Milestone 8 Off-Chain Encrypted Storage Configuration
    STORAGE_MASTER_KEY: process.env.STORAGE_MASTER_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    STORAGE_KEY_ID: process.env.STORAGE_KEY_ID || 'key-dev-master-01',
    CREDENTIAL_STORAGE_PATH: process.env.CREDENTIAL_STORAGE_PATH || path.resolve(__dirname, '../../../storage/credentials')
};

