/*
 * SPDX-License-Identifier: Apache-2.0
 */

import * as grpc from '@grpc/grpc-js';
import { connect, Gateway, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { OrgConfig } from '../types/index.js';
import { resolvePrivateKeyFile } from '../utils/keyResolver.js';
import { logger } from '../utils/logger.js';

export interface GatewayConnection {
    gateway: Gateway;
    client: grpc.Client;
    mspId: string;
}

export async function createGatewayConnection(config: OrgConfig): Promise<GatewayConnection> {
    logger.info(`Establishing Fabric Gateway connection for ${config.mspId} -> ${config.peerEndpoint} (${config.peerHostOverride})`);

    // Verify and read TLS CA certificate
    if (!fs.existsSync(config.tlsCertPath)) {
        throw new Error(`TLS certificate not found for ${config.mspId} at ${config.tlsCertPath}`);
    }
    const tlsCert = fs.readFileSync(config.tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsCert);

    // Create persistent gRPC Client
    const client = new grpc.Client(config.peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': config.peerHostOverride,
        'grpc.default_authority': config.peerHostOverride,
        'grpc.max_receive_message_length': 100 * 1024 * 1024,
        'grpc.max_send_message_length': 100 * 1024 * 1024
    });

    // Read user signing certificate
    if (!fs.existsSync(config.userCertPath)) {
        throw new Error(`User certificate not found for ${config.mspId} at ${config.userCertPath}`);
    }
    const credentials = fs.readFileSync(config.userCertPath);
    const identity: Identity = {
        mspId: config.mspId,
        credentials
    };

    // Read user private key
    const privateKeyPath = resolvePrivateKeyFile(config.keystoreDir);
    const privateKeyPem = fs.readFileSync(privateKeyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const signer: Signer = signers.newPrivateKeySigner(privateKey);

    // Connect to Gateway service
    const gateway = connect({
        client,
        identity,
        signer,
        evaluateOptions: () => ({
            deadline: Date.now() + 10000 // 10s query timeout
        }),
        endorseOptions: () => ({
            deadline: Date.now() + 30000 // 30s endorsement timeout
        }),
        submitOptions: () => ({
            deadline: Date.now() + 15000 // 15s orderer submit timeout
        }),
        commitStatusOptions: () => ({
            deadline: Date.now() + 60000 // 60s commit status timeout
        })
    });

    logger.info(`Successfully connected Fabric Gateway for ${config.mspId}`);

    return {
        gateway,
        client,
        mspId: config.mspId
    };
}
