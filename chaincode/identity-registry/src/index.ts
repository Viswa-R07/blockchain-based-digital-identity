/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { IdentityRegistryContract } from './identityRegistryContract';

export { IdentityRegistryContract } from './identityRegistryContract';
export { IdentityRecord, IdentityStatus } from './models/identityRecord';
export { CredentialRecord, CredentialStatus, VerificationResult, VerificationReason } from './models/credentialRecord';

export const contracts: unknown[] = [IdentityRegistryContract];

