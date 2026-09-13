# Blockchain-Based Digital Identity Verification System

> **Security & Research Disclaimer**: This system is a **research-grade prototype** designed to demonstrate decentralized digital identity, verifiable credential registries, and multi-party consortium authorization using Hyperledger Fabric. It does NOT claim formal W3C DID specification compliance, full GDPR or data protection legal compliance, Byzantine Fault Tolerant (BFT) consensus, or production-ready security hardening. Transaction latencies reported are observed experimental values from local execution environments.

---

## 1. System Overview & Purpose

The **Blockchain-Based Digital Identity Verification System** provides an auditable, decentralized ledger for managing digital identities and verifiable credential commitments across four independent consortium organizations:
- **Government (GovMSP)**: Root national identity authority (authorized to register citizen identities and issue government-backed ID credentials).
- **University (UniversityMSP)**: Higher education institution (authorized to issue academic degree credentials).
- **Bank (BankMSP)**: Financial institution (authorized to issue KYC validation credentials).
- **Employer (EmployerMSP)**: Corporate enterprise (authorized to issue employment verification credentials).

### Milestone 7 Backend Gateway
Milestone 7 introduces an external **Node.js/TypeScript REST API backend** operating outside the Fabric network. It connects to the consortium via the native Fabric Gateway service (`@hyperledger/fabric-gateway` v1.5.1) without requiring end users (citizens or verifying third parties) to hold Fabric MSP credentials or run blockchain nodes.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    External Clients                     │
│         (React Frontend / Third-Party Verifiers)        │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP/JSON REST API
                             ▼
┌─────────────────────────────────────────────────────────┐
│              Backend REST API (Node.js/Express)         │
│  - Zod Request Schema Validation                        │
│  - Zero-Raw-PII Gatekeeper (prototype keyword filter)   │
│  - Deterministic Organizational Routing (Gov/Uni/Bank/Emp│
│  - Persistent Gateway & gRPC Connection Pool            │
│  - Redacting Structured Winston Logger                  │
│  - Centralized Error Code & Status Mapping              │
└────────────────────────────┬────────────────────────────┘
                             │ gRPC with TLS
                             ▼
┌─────────────────────────────────────────────────────────┐
│           Hyperledger Fabric v2.5.16 LTS Network        │
│  Channel: identity-channel                              │
│  Chaincode: identity-registry (v3.0.0, Sequence 3)      │
│  Endorsement Policy: OutOf(3, Gov, Uni, Bank, Emp)      │
│  Ordering: 3-Node Raft Cluster (Crash Fault Tolerant)   │
│  Peers: 8 Peers (2 per org) with 8 CouchDB Instances    │
└─────────────────────────────────────────────────────────┘
```

### Architectural Principles
1. **Separation of Concerns**: The backend acts strictly as an authorized gateway. Citizens are not MSP members.
2. **Deterministic Server-Side Identity Routing**: Callers cannot spoof organizations by supplying arbitrary headers (`X-Calling-Org`). Issuance and administrative routes are mapped server-side to the respective Fabric organizational signing credentials.
3. **Defense in Depth**: Chaincode Attribute-Based Access Control (ABAC) remains the ultimate, non-bypassable authorization boundary on-chain.
4. **Zero Raw PII Ledger**: The blockchain stores only SHA-256 cryptographic commitments and DIDs. Raw personal identifiable information (name, address, national IDs, biometrics) is never committed to the ledger.

---

## 3. Technology Stack

- **Runtime**: Node.js (v20+ LTS recommended)
- **Language**: TypeScript (ES2022 / NodeNext modules)
- **Framework**: Express.js
- **Blockchain Gateway**: `@hyperledger/fabric-gateway` (v1.5.1)
- **RPC Transport**: `@grpc/grpc-js` (with TLS CA validation)
- **Validation**: Zod (v3.23)
- **Logging**: Winston (v3.13) with sensitive credential & key redaction
- **Testing**: Vitest & Supertest

---

## 4. Prerequisites

1. **Active Hyperledger Fabric Network**:
   - Fabric v2.5.16 LTS, Fabric CA v1.5.17
   - 4 Organizations (`GovMSP`, `UniversityMSP`, `BankMSP`, `EmployerMSP`)
   - Channel `identity-channel` joined by all 8 peers
   - Chaincode `identity-registry` (Version 3.0.0, Sequence 3) committed
2. **Node.js**: v18.x or v20.x installed
3. **Crypto Material**: Generated MSP user certificates and private keys under `network/organizations/peerOrganizations/`

---

## 5. Configuration (`.env`)

Configuration is managed via environment variables. Create a `.env` file in the `backend/` directory based on `.env.example`:

```bash
cp backend/.env.example backend/.env
```

Key environment parameters:
- `PORT`: HTTP port for Express server (default `3000`).
- `NODE_ENV`: `development`, `test`, or `production`.
- `FABRIC_CHANNEL_NAME`: `identity-channel`
- `FABRIC_CHAINCODE_NAME`: `identity-registry`
- `CRYPTO_BASE_PATH`: Relative or absolute path to the Fabric crypto-config tree.
- Organizational Peer Endpoints & Host Overrides:
  - `GOV_PEER_ENDPOINT`: `localhost:7051` (Host override: `peer0.gov.identity.example.com`)
  - `UNI_PEER_ENDPOINT`: `localhost:8051` (Host override: `peer0.university.identity.example.com`)
  - `BANK_PEER_ENDPOINT`: `localhost:9051` (Host override: `peer0.bank.identity.example.com`)
  - `EMP_PEER_ENDPOINT`: `localhost:10051` (Host override: `peer0.employer.identity.example.com`)
- Organizational API Keys (for prototype caller authentication):
  - `GOV_API_KEY`: Key mapped to GovMSP
  - `UNI_API_KEY`: Key mapped to UniversityMSP
  - `BANK_API_KEY`: Key mapped to BankMSP
  - `EMP_API_KEY`: Key mapped to EmployerMSP

> **Security Note**: Never commit `.env` or any private key files to version control. `backend/.env` is included in `.gitignore`.

---

## 6. Startup & Execution

### Install Dependencies
```bash
cd backend
npm install
```

### Build TypeScript
```bash
npm run build
```

### Run in Development Mode
```bash
npm run dev
```

### Run in Production Mode
```bash
npm start
```

---

## 7. API Endpoints Specification

All endpoints are prefixed with `/api/v1`.

### Health Check
- `GET /api/v1/health`
  - Returns backend status, channel info, and connectivity states for all 4 consortium gateway connections.

### Identity API (GovMSP Authorized)
- `POST /api/v1/identities`
  - Register a new citizen identity commitment (GovMSP only).
  - Body: `{ "did": "did:example:...", "identityCommitment": "<64-hex>" }`
- `GET /api/v1/identities/:did`
  - Retrieve identity record by DID.
- `GET /api/v1/identities/:did/exists`
  - Check whether an identity exists on-chain.
- `PATCH /api/v1/identities/:did/status`
  - Update status (`ACTIVE`, `SUSPENDED`, `REVOKED`) with justification (GovMSP only).
- `GET /api/v1/identities/:did/history`
  - Retrieve chronological audit trail of identity revisions.

### Credential API (Institutional Issuers)
- `POST /api/v1/credentials/government-id`
  - Issue Government ID Credential (automatically bound to GovMSP).
- `POST /api/v1/credentials/academic`
  - Issue Academic Degree Credential (automatically bound to UniversityMSP).
- `POST /api/v1/credentials/kyc`
  - Issue KYC Verification Credential (automatically bound to BankMSP).
- `POST /api/v1/credentials/employment`
  - Issue Employment Verification Credential (automatically bound to EmployerMSP).
- `GET /api/v1/credentials/:credentialId`
  - Read credential record by ID.
- `GET /api/v1/credentials/:credentialId/exists`
  - Check if credential exists on-chain.

### Lifecycle API (Issuer-Controlled Mutations)
- `POST /api/v1/credentials/:credentialId/suspend`
  - Suspend an active credential with reason.
- `POST /api/v1/credentials/:credentialId/reinstate`
  - Reinstate a suspended credential.
- `POST /api/v1/credentials/:credentialId/revoke`
  - Permanently revoke a credential (`KEY_COMPROMISE`, `AFFILIATION_CHANGED`, etc.). Revocation is terminal.
- `PATCH /api/v1/credentials/:credentialId/status`
  - Generalized lifecycle transition following state-machine rules.

### Verification & History API (Public / Third-Party)
- `GET /api/v1/credentials/:credentialId/status`
  - Evaluates real-time verification status including dynamic timestamp expiration.
- `POST /api/v1/credentials/verify`
  - Comprehensive multi-attribute verification (ID existence, commitment match, expiration check).
- `GET /api/v1/credentials/:credentialId/history`
  - Retrieve immutable revision history for a credential.

---

## 8. Testing Suite

### Unit Tests
Unit tests mock the Fabric Gateway contract service to test controllers, validation schemas, PII gatekeeping, error mapping, and authentication in total isolation.
```bash
npm run test:unit
```

### Integration Tests (Live Fabric Consortium)
Integration tests run against the live 4-organization Fabric network using persistent gRPC TLS connections:
```bash
npm run test:integration
```

### Full Verification Suite
The complete end-to-end verification script tests compilation, unit tests, live integration tests, CouchDB schema & PII audits, and regression tests across Milestones 4, 5, and 6:
```bash
./scripts/verify_backend.sh
```

---

## 9. Security & Prototype Limitations

1. **Zero Raw PII Gatekeeper**:
   - The backend enforces a request-body keyword filter rejecting obvious PII fields (`name`, `ssn`, `dob`, `address`, `biometric`, etc.).
   - *Limitation*: Keyword filtering is a defense-in-depth gatekeeper for this research prototype, **not** mathematical proof of zero PII leakage or GDPR compliance. Production systems require cryptographic client-side blinding or zero-knowledge proof generation prior to gateway submission.
2. **API Key Authentication**:
   - The current prototype uses configured API keys to map client requests to organizational identities.
   - *Production Requirement*: Production implementations must replace API keys with enterprise identity providers (OAuth2, OpenID Connect, mTLS, and role-based access control).
3. **Consensus & Fault Tolerance**:
   - Raft ordering provides Crash Fault Tolerance (CFT). It does **not** protect against malicious/Byzantine ordering nodes (BFT).
4. **Experimental Latency**:
   - Latencies (e.g., reads ~10 ms, submits ~1.0 s) reflect local Docker-on-WSL benchmark conditions and vary depending on host hardware, network topologies, and endorsement policy complexity.
