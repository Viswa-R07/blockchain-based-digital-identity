/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import credentialRoutes from './credential.routes.js';
import healthRoutes from './health.routes.js';
import identityRoutes from './identity.routes.js';

const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/identities', identityRoutes);
apiRouter.use('/credentials', credentialRoutes);

export default apiRouter;
