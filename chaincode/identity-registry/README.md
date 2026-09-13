# Identity & Credential Registry Chaincode (`identity-registry`)

## Overview

The `identity-registry` smart contract maintains the on-chain registry of sovereign citizen Decentralized Identifiers (DIDs), cryptographic commitments, and privacy-preserving verifiable credentials on **Hyperledger Fabric v2.5.16 LTS**.

This chaincode is a **security-oriented research prototype** designed to explore decentralized identity and credential lifecycle management.

### Key Architectural Principles
- **Zero Raw PII on-chain**: No personal attributes (names, national ID numbers, DOB, biometrics, or raw credential claims) are stored on the blockchain ledger or world state databases. Only cryptographic commitments (SHA-256 hashes) and non-PII metadata are recorded.
- **Single Canonical Source of Truth**: `CredentialRecord.status` is the sole authoritative source of truth for credential status. There is no separate `RevocationRecord`, revocation bitmap, or secondary status database, preventing split-brain states.
- **Explicit Lifecycle APIs**: Purpose-built functions (`RevokeCredential`, `SuspendCredential`, `ReinstateCredential`) govern status transitions with strict ABAC authorization and terminal revocation enforcement.
- **Generic Compatibility Path**: `UpdateCredentialStatus` is retained for backwards compatibility, safely mapping generic revocations to controlled defaults.
- **Separation of Status Query & Verification**:
  - `GetCredentialStatus(ctx, credentialId)` retrieves current ledger lifecycle state and evaluates dynamic expiration without modifying world state.
  - `VerifyCredential(ctx, credentialId, subjectDID, credentialCommitment)` evaluates subject DID matching, cryptographic commitment validity, lifecycle status, and expiration.
- **Controlled Revocation Reasons**: Strict application-defined controlled reason codes (`KEY_COMPROMISE`, `AFFILIATION_CHANGED`, `SUPERSEDED`, `CESSATION_OF_OPERATION`, `PRIVILEGE_WITHDRAWN`, `UNSPECIFIED`). Arbitrary free-text strings and PII patterns are strictly rejected.
- **Deterministic Blockchain Timestamps**: All temporal decisions, state timestamps, and expiration evaluations use `ctx.stub.getTxTimestamp()`. Host clock (`Date.now()`) is never used for ledger state logic.
- **Immutable Fabric Audit Trail**: Full lifecycle state transitions (`ISSUED` → `SUSPENDED` → `ACTIVE` → `REVOKED`) are preserved across block transactions via `GetCredentialHistory`.
- **Crash Fault Tolerant (CFT) Consensus**: Operates on Raft consensus (CFT), not Byzantine Fault Tolerant (BFT).

---

## Data Models

### 1. IdentityRecord
```typescript
export enum IdentityStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    REVOKED = 'REVOKED'
}

export interface IdentityRecord {
    did: string;                 // Application-level Decentralized Identifier (e.g. did:example:...)
    identityCommitment: string;  // Cryptographic commitment (SHA-256 hash)
    status: IdentityStatus;      // Controlled lifecycle state
    issuerOrg: string;           // MSP ID that registered the identity (GovMSP)
    createdAt: string;           // ISO-8601 string from deterministic ChannelHeader timestamp
    updatedAt: string;           // ISO-8601 string from deterministic ChannelHeader timestamp
    version: number;             // Monotonically increasing record version
}
```

### 2. CredentialRecord (Milestone 5 & 6)
```typescript
export enum CredentialStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    REVOKED = 'REVOKED'
}

export enum RevocationReason {
    KEY_COMPROMISE = 'KEY_COMPROMISE',
    AFFILIATION_CHANGED = 'AFFILIATION_CHANGED',
    SUPERSEDED = 'SUPERSEDED',
    CESSATION_OF_OPERATION = 'CESSATION_OF_OPERATION',
    PRIVILEGE_WITHDRAWN = 'PRIVILEGE_WITHDRAWN',
    UNSPECIFIED = 'UNSPECIFIED'
}

export interface CredentialRecord {
    credentialId: string;               // Unique credential identifier (e.g. cred:gov:...)
    subjectDID: string;                 // DID of the credential holder
    issuerDID: string;                  // DID of the issuing authority
    issuerOrg: string;                  // MSP ID of the issuing organization
    credentialType: string;             // Type descriptor (e.g. GovernmentIdCredential)
    schemaId: string;                   // Schema URI descriptor
    credentialCommitment: string;       // SHA-256 hash of credential claims + salt
    issuedAt: string;                   // ISO-8601 timestamp from ctx.stub.getTxTimestamp()
    expiresAt: string;                  // ISO-8601 expiration timestamp
    status: CredentialStatus;           // Canonical lifecycle status (ACTIVE | SUSPENDED | REVOKED)
    createdAt: string;                  // ISO-8601 record creation timestamp
    updatedAt: string;                  // ISO-8601 last update timestamp
    version: number;                    // Monotonically increasing record version
    revocationReason?: RevocationReason;// Controlled reason code (populated only on REVOKED)
    revokedAt?: string;                 // ISO-8601 timestamp (populated only on REVOKED)
}
```

---

## Contract API Methods

### Identity Management
- `RegisterIdentity(ctx, did, identityCommitment)`: Restricted to `GovMSP`. Emits `IdentityRegistered`.
- `ReadIdentity(ctx, did)`: Read-only query for authenticated consortium members.
- `IdentityExists(ctx, did)`: Read-only boolean check.
- `UpdateIdentityStatus(ctx, did, newStatus)`: Restricted to `GovMSP`. Emits `IdentityStatusUpdated`.
- `GetIdentityHistory(ctx, did)`: Chronological audit trail of identity records.

### Credential Issuance & Management
- `IssueCredential(ctx, credentialId, subjectDID, issuerDID, credentialType, schemaId, credentialCommitment, expiresAt)`:
  - Role-based ABAC:
    - `GovMSP` -> `GovernmentIdCredential`
    - `UniversityMSP` -> `AcademicDegreeCredential`
    - `BankMSP` -> `KYCCredential`
    - `EmployerMSP` -> `EmploymentCredential`
  - Emits `CredentialIssued`.
- `ReadCredential(ctx, credentialId)`: Read-only query for full `CredentialRecord`.
- `CredentialExists(ctx, credentialId)`: Read-only boolean check.

### Credential Lifecycle APIs (Milestone 6)
- `RevokeCredential(ctx, credentialId, reason)`:
  - Caller must be original `issuerOrg`.
  - Status must be `ACTIVE` or `SUSPENDED` (terminal revocation: cannot revoke already `REVOKED`).
  - Reason must be one of the 6 controlled `RevocationReason` enum values (no free text, no PII).
  - Sets `status = REVOKED`, `revocationReason = reason`, `revokedAt = txTimestamp`.
  - Emits `CredentialRevoked` and `CredentialStatusUpdated`.
- `SuspendCredential(ctx, credentialId, reason)`:
  - Caller must be original `issuerOrg`.
  - Status must be `ACTIVE`.
  - Sets `status = SUSPENDED`. Does not set `revokedAt`.
  - Emits `CredentialSuspended` and `CredentialStatusUpdated`.
- `ReinstateCredential(ctx, credentialId)`:
  - Caller must be original `issuerOrg`.
  - Status must be `SUSPENDED`. Cannot reinstate `REVOKED`.
  - Sets `status = ACTIVE`.
  - Emits `CredentialReinstated` and `CredentialStatusUpdated`.
- `UpdateCredentialStatus(ctx, credentialId, newStatus)`:
  - Retained for backwards compatibility with Milestone 5 test suites.
  - When transitioning to `REVOKED`, sets `revocationReason = RevocationReason.UNSPECIFIED` and `revokedAt = txTimestamp`.
  - Emits `CredentialStatusUpdated`.

### Credential Query & Verification
- `GetCredentialStatus(ctx, credentialId)`:
  - Read-only lightweight query (`@Transaction(false)`).
  - Returns `credentialId`, `status`, `effectiveStatus`, `issuerOrg`, `credentialType`, `issuedAt`, `expiresAt`, `version`, `evaluatedAt`.
  - Includes `revocationReason` and `revokedAt` if revoked.
  - If `status === ACTIVE` but `txTimestamp >= expiresAt`, returns `effectiveStatus: "EXPIRED"` without mutating stored `status`.
- `VerifyCredential(ctx, credentialId, subjectDID, presentedCredentialCommitment)`:
  - Read-only evaluation (`@Transaction(false)`).
  - Evaluation sequence:
    1. Check existence (`CREDENTIAL_NOT_FOUND` -> `valid: false, reason: "NOT_FOUND"`)
    2. Check subject matching (`valid: false, reason: "SUBJECT_MISMATCH"`)
    3. Check commitment hash (`valid: false, reason: "COMMITMENT_MISMATCH"`)
    4. Check revoked status (`valid: false, reason: "REVOKED"`)
    5. Check suspended status (`valid: false, reason: "SUSPENDED"`)
    6. Check expiration against `txTimestamp` (`valid: false, reason: "EXPIRED"`)
    7. Success: returns `valid: true, reason: "VALID"`.
  - Emits `CredentialVerified`.
- `GetCredentialHistory(ctx, credentialId)`:
  - Historical provenance query returning all past block revisions for auditability.

---

## Endorsement & Lifecycle Policy

- **Chaincode Package**: `identity-registry_3.0.tar.gz` (Version 3.0, Sequence 3)
- **Channel Lifecycle Endorsement Policy**: `MAJORITY` (all 4 orgs approved)
- **Chaincode Endorsement Policy**:
  ```
  OutOf(3, 'GovMSP.peer', 'UniversityMSP.peer', 'BankMSP.peer', 'EmployerMSP.peer')
  ```
  Requires endorsements from at least 3 distinct organizations on all transaction proposals.
- **Consortium Members**:
  - `GovMSP` (Government Identity Authority)
  - `UniversityMSP` (Higher Education Institutions)
  - `BankMSP` (Financial & KYC Institutions)
  - `EmployerMSP` (Employment Verification Authorities)

---

## Important Disclaimers

1. **Security-Oriented Research Prototype**: This implementation is developed as a research and educational prototype, not a certified production deployment.
2. **Crash Fault Tolerant Consensus**: The ordering service utilizes Raft consensus, which provides Crash Fault Tolerance (CFT) rather than Byzantine Fault Tolerance (BFT).
3. **Standards Alignment**: The DIDs and controlled reason codes are application-defined structures inspired by established standards. This contract does not claim compliance with official W3C DID Method specifications, W3C Verifiable Credentials Data Model v2.0, or W3C Revocation List 2020 / Bitstring Status List specifications.
4. **Privacy & Data Protection**: Zero raw PII is written to the blockchain, and all identities and credentials are represented as one-way SHA-256 hash commitments. However, full GDPR/regulatory compliance involves off-chain data governance, right-to-be-forgotten considerations, and formal legal audits beyond the smart contract layer.
