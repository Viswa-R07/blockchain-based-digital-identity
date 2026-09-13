/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { IdentityController } from '../controllers/identity.controller.js';
import { authenticateApiKey } from '../middleware/auth.middleware.js';
import { validateBody, zeroRawPiiGatekeeper } from '../middleware/validate.middleware.js';
import { RegisterIdentitySchema, UpdateIdentityStatusSchema } from '../types/dtos.js';

const router = Router();

// Apply authentication to all identity routes
router.use(authenticateApiKey);

router.post(
    '/',
    zeroRawPiiGatekeeper,
    validateBody(RegisterIdentitySchema),
    IdentityController.registerIdentity
);

router.get('/:did', IdentityController.readIdentity);
router.get('/:did/exists', IdentityController.identityExists);

router.patch(
    '/:did/status',
    zeroRawPiiGatekeeper,
    validateBody(UpdateIdentityStatusSchema),
    IdentityController.updateIdentityStatus
);

router.get('/:did/history', IdentityController.getIdentityHistory);

export default router;
