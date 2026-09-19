/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { storageController } from '../controllers/storage.controller.js';
import { authenticateApiKey } from '../middleware/auth.middleware.js';
import { storageLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router({ mergeParams: true });

// All storage operations require institutional authentication
router.use(authenticateApiKey);

// SEC-API-01: Tiered rate limiting for computationally expensive cryptographic storage operations
router.use(storageLimiter.middleware());

// 1. Store encrypted credential payload
router.post('/storage', storageController.storeCredential);

// 2. Retrieve encrypted storage metadata (without plaintext)
router.get('/storage', storageController.getStorageMetadata);

// 3. Authorized retrieval and decryption of credential payload
router.post('/retrieve', storageController.retrieveCredential);

// 4. Delete off-chain credential payload (GDPR erasure model)
router.delete('/storage', storageController.deleteStorage);

// 5. Verify off-chain storage integrity against Hyperledger Fabric
router.post('/verify-storage', storageController.verifyStorage);

export default router;
