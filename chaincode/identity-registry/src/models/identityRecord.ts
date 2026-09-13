/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Object as FabricObject, Property } from 'fabric-contract-api';

export enum IdentityStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    REVOKED = 'REVOKED'
}

@FabricObject()
export class IdentityRecord {
    @Property()
    public did: string = '';

    @Property()
    public identityCommitment: string = '';

    @Property()
    public status: IdentityStatus = IdentityStatus.ACTIVE;

    @Property()
    public issuerOrg: string = '';

    @Property()
    public createdAt: string = '';

    @Property()
    public updatedAt: string = '';

    @Property()
    public version: number = 1;
}
