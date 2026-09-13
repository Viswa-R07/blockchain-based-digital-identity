/*
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';

export function resolvePrivateKeyFile(keystoreDir: string): string {
    if (!fs.existsSync(keystoreDir)) {
        throw new Error(`Keystore directory does not exist: ${keystoreDir}`);
    }

    const files = fs.readdirSync(keystoreDir);
    const keyFile = files.find(file => file.endsWith('_sk') || file.endsWith('.key') || file.endsWith('.priv'));

    if (!keyFile) {
        throw new Error(`No private key file (*_sk) found in keystore directory: ${keystoreDir}`);
    }

    return path.join(keystoreDir, keyFile);
}
