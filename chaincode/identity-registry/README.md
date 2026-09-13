# Identity Registry Chaincode (`identity-registry`)

## Overview

The `identity-registry` smart contract maintains the on-chain registry of sovereign citizen Decentralized Identifiers (DIDs) and their associated cryptographic commitments on **Hyperledger Fabric v2.5.16 LTS**.

This chaincode enforces:
- **Zero Raw PII on-chain**: No personal attributes (names, Aadhaar numbers, DOB, biometrics, etc.) are stored.
- **W3C DID Core Compliance**: Citizen DIDs follow standard URI syntax (e.g. `did:example:<unique-id>`).
- **Cryptographic Commitment Integrity**: 64-character lowercase hexadecimal hash commitments (`^[a-f0-9]{64}$`).
- **Attribute-Based Access Control (ABAC)**: Civil identity registrations restricted strictly to Government Identity Authority (`GovMSP`).
- **Controlled Lifecycle**: Deterministic state machine (`ACTIVE`, `SUSPENDED`, `REVOKED`) with terminal revocation.
- **Auditability**: Complete historical transaction audit trail queryable via `GetIdentityHistory`.

---

## Data Model

```typescript
export enum IdentityStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    REVOKED = 'REVOKED'
}

export interface IdentityRecord {
    did: string;                 // Application-level Decentralized Identifier
    identityCommitment: string;  // Cryptographic commitment (SHA-256 hash)
    status: IdentityStatus;      // Controlled lifecycle state
    issuerOrg: string;           // MSP ID that registered the identity (GovMSP)
    createdAt: string;           // ISO-8601 string from deterministic ChannelHeader timestamp
    updatedAt: string;           // ISO-8601 string from deterministic ChannelHeader timestamp
    version: number;             // Monotonically increasing record version
}
```

---

## Contract API Methods

### 1. `RegisterIdentity(ctx, did, identityCommitment)`
- **Caller**: Restricted to `GovMSP`.
- **Inputs**: `did` (string), `identityCommitment` (64-char hex string).
- **Output**: JSON string of created `IdentityRecord`.
- **Event**: Emits `IdentityRegistered`.

### 2. `ReadIdentity(ctx, did)`
- **Caller**: Authenticated members (`GovMSP`, `UniversityMSP`, `BankMSP`, `EmployerMSP`).
- **Inputs**: `did` (string).
- **Output**: JSON string of stored `IdentityRecord`.

### 3. `IdentityExists(ctx, did)`
- **Caller**: Authenticated members.
- **Inputs**: `did` (string).
- **Output**: Boolean `true` or `false`.

### 4. `UpdateIdentityStatus(ctx, did, newStatus)`
- **Caller**: `GovMSP` or original `issuerOrg`.
- **Inputs**: `did` (string), `newStatus` (`ACTIVE`, `SUSPENDED`, `REVOKED`).
- **Output**: JSON string of updated `IdentityRecord`.
- **Event**: Emits `IdentityStatusUpdated`.

### 5. `GetIdentityHistory(ctx, did)`
- **Caller**: Authenticated members.
- **Inputs**: `did` (string).
- **Output**: JSON array of historical block modifications with timestamps, versions, and values.

---

## Endorsement & Governance

- **Channel Lifecycle Endorsement Policy**: `MAJORITY` (governs chaincode definition approvals across orgs).
- **Chaincode Endorsement Policy**:
  ```
  OutOf(3, 'GovMSP.peer', 'UniversityMSP.peer', 'BankMSP.peer', 'EmployerMSP.peer')
  ```
  Requires endorsements from at least 3 distinct organizations on all transaction proposals.
- **Application ABAC**: Enforced within contract logic based on `ctx.clientIdentity.getMSPID()`.
