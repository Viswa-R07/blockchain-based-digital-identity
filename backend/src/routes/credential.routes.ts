/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { CredentialController } from '../controllers/credential.controller.js';
import { LifecycleController } from '../controllers/lifecycle.controller.js';
import { VerificationController } from '../controllers/verification.controller.js';
import storageRoutes from './storage.routes.js';
import { authenticateApiKey } from '../middleware/auth.middleware.js';
import { sensitiveLimiter, storageLimiter } from '../middleware/rateLimit.middleware.js';

import { validateBody, zeroRawPiiGatekeeper } from '../middleware/validate.middleware.js';
import {
    IssueCredentialSchema,
    RevokeCredentialSchema,
    SuspendCredentialSchema,
    UpdateCredentialStatusSchema,
    VerifyCredentialSchema
} from '../types/dtos.js';

const router = Router();

// Apply authentication to all credential routes
router.use(authenticateApiKey);

// 1. Issuance Endpoints (Server-Controlled Issuer Routing)
router.post(
    '/government-id',
    sensitiveLimiter.middleware(),
    zeroRawPiiGatekeeper,
    validateBody(IssueCredentialSchema),
    CredentialController.issueCredentialByType('government-id')
);

router.post(
    '/academic',
    sensitiveLimiter.middleware(),
    zeroRawPiiGatekeeper,
    validateBody(IssueCredentialSchema),
    CredentialController.issueCredentialByType('academic')
);

router.post(
    '/kyc',
    sensitiveLimiter.middleware(),
    zeroRawPiiGatekeeper,
    validateBody(IssueCredentialSchema),
    CredentialController.issueCredentialByType('kyc')
);

router.post(
    '/employment',
    sensitiveLimiter.middleware(),
    zeroRawPiiGatekeeper,
    validateBody(IssueCredentialSchema),
    CredentialController.issueCredentialByType('employment')
);

// 2. Verification Endpoints (Read-Only)
router.post(
    '/verify',
    storageLimiter.middleware(),
    zeroRawPiiGatekeeper,
    validateBody(VerifyCredentialSchema),
    VerificationController.verifyCredential
);

// 3. Status & Provenance Queries
router.get('/:credentialId/status', VerificationController.getCredentialStatus);
router.get('/:credentialId/history', VerificationController.getCredentialHistory);
router.get('/:credentialId/exists', CredentialController.credentialExists);
router.get('/:credentialId', CredentialController.readCredential);

// 4. Milestone 6 Explicit Lifecycle Mutations
router.post(
    '/:credentialId/revoke',
    sensitiveLimiter.middleware(),
    zeroRawPiiGatekeeper,
    validateBody(RevokeCredentialSchema),
    LifecycleController.revokeCredential
);

router.post(
    '/:credentialId/suspend',
    sensitiveLimiter.middleware(),
    zeroRawPiiGatekeeper,
    validateBody(SuspendCredentialSchema),
    LifecycleController.suspendCredential
);

router.post(
    '/:credentialId/reinstate',
    sensitiveLimiter.middleware(),
    LifecycleController.reinstateCredential
);

// 5. Generic Status Update (Milestone 5 Compatibility)
router.patch(
    '/:credentialId/status',
    sensitiveLimiter.middleware(),
    zeroRawPiiGatekeeper,
    validateBody(UpdateCredentialStatusSchema),
    LifecycleController.updateCredentialStatus
);

// 6. Milestone 8 Off-Chain Encrypted Storage Endpoints
router.use('/:credentialId', storageRoutes);

export default router;
