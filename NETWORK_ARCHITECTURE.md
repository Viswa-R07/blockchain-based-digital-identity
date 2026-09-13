# Blockchain-Based Digital Identity Verification System
## 4-Organization Permissioned Network Design & Topology Architecture Specification

**Document Version:** 2.1.0 (Milestone 2 - Final Technical Refinements)  
**Status:** Architecture Design Milestone (Milestone 2 - Final)  
**Target Platform:** Hyperledger Fabric v2.5.16 LTS | Fabric CA v1.5.17 | Raft Consensus  
**Author:** Research & Development Architecture Team  

---

## Table of Contents
1. [Executive Summary & Academic Context](#1-executive-summary--academic-context)
2. [Research Gaps, Literature Mapping & Architectural Scope](#2-research-gaps-literature-mapping--architectural-scope)
3. [Organizational Topology & Responsibility Matrix](#3-organizational-topology--responsibility-matrix)
4. [Cryptographic Identity: Fabric X.509 vs. Application DIDs](#4-cryptographic-identity-fabric-x509-vs-application-dids)
5. [Citizen Interaction Model & Gateway Architecture](#5-citizen-interaction-model--gateway-architecture)
6. [Peer Node & Network Infrastructure Topology (8 Peers, 8 Dedicated CouchDBs)](#6-peer-node--network-infrastructure-topology-8-peers-8-dedicated-couchdbs)
7. [Decentralized Ordering Service & Raft Consensus Architecture](#7-decentralized-ordering-service--raft-consensus-architecture)
8. [Channel Architecture & Ledger Topology](#8-channel-architecture--ledger-topology)
9. [On-Chain vs. Off-Chain Data Classification (Data Minimization)](#9-on-chain-vs-off-chain-data-classification-data-minimization)
10. [Private Data Collections (PDC) Architecture & Retention Policy](#10-private-data-collections-pdc-architecture--retention-policy)
11. [Multi-Tier Endorsement & Access Control Architecture](#11-multi-tier-endorsement--access-control-architecture)
12. [End-to-End Transaction Flow Diagrams](#12-end-to-end-transaction-flow-diagrams)
13. [Security Architecture & Realist Threat Modeling](#13-security-architecture--realist-threat-modeling)
14. [Privacy Engineering & GDPR Alignment](#14-privacy-engineering--gdpr-alignment)
15. [Scalability, Performance & Lifecycle Engineering](#15-scalability-performance--lifecycle-engineering)
16. [Architectural Decision Records (ADR) Summary](#16-architectural-decision-records-adr-summary)

---

## 1. Executive Summary & Academic Context

Traditional Digital Identity Management Systems (e.g., SAML 2.0, OpenID Connect, centralized OAuth federations) suffer from systemic vulnerabilities: centralized honeypots susceptible to data breaches, single points of failure (SPoF), vendor lock-in, and cross-domain user tracking without explicit citizen oversight.

This project designs a privacy-preserving, consortium-governed **Blockchain-Based Digital Identity Verification System** engineered upon **Hyperledger Fabric v2.5.16 LTS**. The consortium unites four sovereign organizations:
1. **Government Identity Authority (`GovMSP`)**: Root-of-trust for civil identity validation, responsible for anchoring sovereign citizen Decentralized Identifiers (DIDs) and issuing legal identity baseline assertions.
2. **University (`UniversityMSP`)**: Accredited educational institution issuing verifiable academic credentials (degrees, diplomas, transcripts).
3. **Bank (`BankMSP`)**: Regulated financial institution acting as a verifier and consumer of KYC identity credentials, while issuing financial standing attestations.
4. **Employer (`EmployerMSP`)**: Enterprise verifier validating academic and civil identity, while issuing verified employment credentials.

The architecture enforces a strict data boundary: **Zero Personally Identifiable Information (PII) is stored on the blockchain ledger**. Instead, cryptographic commitments (salted SHA-256 digests, digital signatures, schema descriptors, and revocation flags) are recorded on-chain, while encrypted verifiable credentials reside off-chain in peer-to-peer IPFS nodes and institutional identity repositories.

---

## 2. Research Gaps, Literature Mapping & Architectural Scope

```
+---------------------------+-------------------------------------------------------+-------------------------------------------------------------+
| Paradigm                  | Inherent Limitations / Literature Gaps                | Architectural Resolution in This Project                    |
+---------------------------+-------------------------------------------------------+-------------------------------------------------------------+
| Centralized IAM           | - Single Point of Failure (SPoF).                     | - Consortium-based distributed trust over 4 distinct        |
| (OAuth 2.0, SAML, LDAP)   | - Vulnerable to centralized data breaches & honeypots.|   organizations. No single entity owns the entire state.    |
|                           | - Identity provider (IdP) tracks all verifier logins. | - Peer-to-peer verification without contacting the issuer.  |
+---------------------------+-------------------------------------------------------+-------------------------------------------------------------+
| Public Blockchain SSI     | - Prohibitive and volatile transaction (gas) fees.    | - Hyperledger Fabric eliminates gas fees with predictable   |
| (Ethereum, Bitcoin, DID)  | - High latency and lack of immediate finality.        |   execution cost.                                           |
|                           | - Public transaction graph enables correlation.       | - Deterministic finality via Raft consensus (no forks).     |
|                           | - Conflicts with data privacy and right-to-erasure.   | - Granular MSPs, TLS mutual authentication & private PDCs.  |
+---------------------------+-------------------------------------------------------+-------------------------------------------------------------+
| Naive Permissioned POCs   | - Blockchain used only as a passive storage log.      | - Substantial Fabric utilization: multi-org Raft ordering,  |
| (Single-Org / Toy DLTs)   | - Centralized single orderer owned by one admin.      |   decentralized 3-org orderers, State-Based Endorsement     |
|                           | - Lacks realistic endorsement policies & CAs.         |   (SBE), Private Data Collections, and CA hierarchy.        |
+---------------------------+-------------------------------------------------------+-------------------------------------------------------------+
```

---

## 3. Organizational Topology & Responsibility Matrix

### 3.1 Consortium Organizations Overview

```
+-------------------------------------------------------------------------------------------------------------------------+
|                                      CONSORTIUM ORGANIZATIONS OVERVIEW                                                  |
+------------------------------+--------------------+--------------------------------+--------------------+---------------+
| Organization Name            | MSP Identifier     | Domain                         | Primary Node Role  | CA Service    |
+------------------------------+--------------------+--------------------------------+--------------------+---------------+
| Government Identity Authority| GovMSP             | gov.identity.example.com       | Peer + Raft Orderer| ca.gov        |
| University                   | UniversityMSP      | university.example.com         | Peer + Raft Orderer| ca.university |
| Bank                         | BankMSP            | bank.example.com               | Peer + Raft Orderer| ca.bank       |
| Employer                     | EmployerMSP        | employer.example.com           | Peer (Endorser)    | ca.employer   |
+------------------------------+--------------------+--------------------------------+--------------------+---------------+
```

### 3.2 Responsibility Matrix (RACI)

- **R** = Responsible (Executes transaction proposal)
- **A** = Accountable (Final policy authority / state signer)
- **C** = Consulted (Provides endorsement / co-validation)
- **I** = Informed (Receives ledger state event / commits block)

```
+---------------------------------------+--------+---------------+---------+-------------+
| Operation / Lifecycle Event           | GovMSP | UniversityMSP | BankMSP | EmployerMSP |
+---------------------------------------+--------+---------------+---------+-------------+
| Citizen Root Identity Anchor Creation |  R / A |       I       |    I    |      I      |
| Issuer Accreditation & Onboarding     |  R / A |       C       |    C    |      C      |
| Academic Credential Issuance          |    C   |     R / A     |    I    |      I      |
| Employment Credential Issuance        |    C   |       I       |    I    |    R / A    |
| Financial / KYC Status Verification   |    I   |       I       |  R / A  |      I      |
| Credential Revocation (Educational)   |    I   |     R / A     |    I    |      I      |
| Credential Revocation (Civil Identity)|  R / A |       I       |    I    |      I      |
| Channel Governance & Chaincode Update |    A   |       C       |    C    |      C      |
| Ordering Consensus Maintenance (Raft) |  R / A |     R / A     |  R / A  |      I      |
+---------------------------------------+--------+---------------+---------+-------------+
```

---

## 4. Cryptographic Identity: Fabric X.509 vs. Application DIDs

A critical architectural distinction in this system is the clear separation between **Fabric Network Identities** and **Application Citizen DIDs**:

```
+-------------------------------------------------------------+-------------------------------------------------------------+
| Dimension                   | Fabric X.509 Network Identity | Application Citizen DID                                     |
+-------------------------------------------------------------+-------------------------------------------------------------+
| **Issuing Authority**       | Organizational Fabric CA (ca.gov, ca.uni, etc.)             | Self-Generated / Client Keypair, anchored via Gov Registry|
| **Primary Purpose**         | Peer/Orderer authentication, MSP validation, channel access | Citizen identity, credential holder, verifiable presentations|
| **Standard / Format**       | X.509 v3 Digital Certificate (PKIX)                        | W3C Decentralized Identifier (e.g., did:example:...)        |
| **Scope of Authority**      | Network infrastructure & gateway transaction submission    | Application-level signature on credential presentations     |
| **Lifecycle Management**    | CA CRL / Fabric MSP config reload                          | Smart contract Identity Registry state & revocation record  |
| **Consortium Membership**   | Holds formal MSP affiliation (NodeOU: peer, client, admin) | Non-member end user interacting via organizational gateways |
+-------------------------------------------------------------+-------------------------------------------------------------+
```

### 4.1 Fabric CA Organization-Level PKI
Each organization operates an independent Fabric CA instance:
- `ca.gov:7054` (GovMSP Root & TLS CA)
- `ca.university:8054` (UniversityMSP Root & TLS CA)
- `ca.bank:9054` (BankMSP Root & TLS CA)
- `ca.employer:10054` (EmployerMSP Root & TLS CA)

Enrolled Fabric identities strictly represent institutional infrastructure nodes and authorized operational personnel:
- Node identities: `peer0`, `peer1`, `orderer1`, etc.
- Client identities: `admin.gov`, `registrar.gov`, `faculty.issuer`, `auditor.bank`, `hr.employer`, `app-gateway.gov`.

### 4.2 Application Decentralized Identifiers (DIDs)
Citizens and external relying parties hold standard W3C DID keypairs (e.g., Ed25519 or ECDSA secp256r1). 
- A **DID Document** contains the citizen's public verification keys and authentication endpoints.
- The DID Document is anchored in the on-chain Identity Registry via an authorized gateway transaction.
- **The citizen DID is NOT an X.509 certificate and does not confer Fabric network membership.**
- *Clarification:* The DID method used by the prototype will be explicitly defined and documented during implementation (e.g., conforming to standard W3C DID core syntax like `did:example:citizen101`).

---

## 5. Citizen Interaction Model & Gateway Architecture

Ordinary citizens are **not** members of the Fabric network and do not possess Fabric MSP credentials. Modeling millions of citizens as Fabric network participants would introduce severe key-management complexity, node bloat, and operational fragility.

Instead, citizens interact with the system via an **Authorized Application Gateway Pattern**:

```
+===================================================================================================+
|                                    CITIZEN INTERACTION MODEL                                      |
+===================================================================================================+

   +------------------------------------+
   |       Citizen Mobile Wallet        |
   |   - Holds Application DID Keypair  |
   |   - Signs Credential Presentations |
   |   - Stores Encrypted VCs (Off-chain|
   +------------------------------------+
                     |
         HTTPS / mTLS (Rest API)
                     |
                     v
   +------------------------------------+
   |     Organizational Web / API       |
   |             Gateway                |
   |   - Authenticates Citizen Request  |
   |   - Validates Citizen Signature    |
   +------------------------------------+
                     |
         Fabric Gateway Client API
                     |
                     v
   +------------------------------------+
   |        Fabric Gateway Client       |
   |   (Holds Authorized Client MSP     |
   |    e.g., 'app-gateway.gov')        |
   +------------------------------------+
                     |
              gRPC with mTLS
                     |
                     v
   +------------------------------------+
   |       Fabric Peer (GovMSP)         |
   |   - Simulates Transaction          |
   |   - Endorses Proposal              |
   +------------------------------------+
```

1. **Client Tier**: The citizen generates an asymmetric keypair locally in a secure enclave / digital identity wallet.
2. **API Tier**: The citizen submits signed verification or issuance requests to an organizational API Gateway (e.g., Government Portal, University Registrar API).
3. **Gateway Tier**: The organization's API service uses its enrolled Fabric client identity (e.g., `client@GovMSP`) to evaluate or submit transactions to Fabric peers via the Fabric Gateway SDK.
4. **Ledger Tier**: The smart contract verifies that the transaction was submitted by an authorized institutional gateway and validates the citizen's cryptographic signature contained in the transaction payload.

---

## 6. Peer Node & Network Infrastructure Topology (8 Peers, 8 Dedicated CouchDBs)

To guarantee strict state isolation, High Availability (HA), and fault tolerance, **every peer node is allocated its own private, dedicated CouchDB instance**. No CouchDB instance is ever shared between peers.

The consortium deploys **8 peer nodes and 8 dedicated CouchDB state databases**:
- **GovMSP**:
  - `peer0.gov.identity.example.com` $\rightarrow$ `couchdb0.gov.identity.example.com`
  - `peer1.gov.identity.example.com` $\rightarrow$ `couchdb1.gov.identity.example.com`
- **UniversityMSP**:
  - `peer0.university.example.com` $\rightarrow$ `couchdb0.university.example.com`
  - `peer1.university.example.com` $\rightarrow$ `couchdb1.university.example.com`
- **BankMSP**:
  - `peer0.bank.example.com` $\rightarrow$ `couchdb0.bank.example.com`
  - `peer1.bank.example.com` $\rightarrow$ `couchdb1.bank.example.com`
- **EmployerMSP**:
  - `peer0.employer.example.com` $\rightarrow$ `couchdb0.employer.example.com`
  - `peer1.employer.example.com` $\rightarrow$ `couchdb1.employer.example.com`

```
+=========================================================================================================================+
|                                     PHYSICAL 8-PEER & 8-COUCHDB NETWORK TOPOLOGY                                        |
+=========================================================================================================================+

   +-------------------------------------------------------------------------------------------------------------------+
   |                                            RAFT CONSENSUS CLUSTER                                                 |
   |                                                                                                                   |
   |             [ orderer1.gov:7050 ]              [ orderer2.university:8050 ]             [ orderer3.bank:9050 ]     |
   |                 (GovMSP OSN)                         (UniversityMSP OSN)                     (BankMSP OSN)        |
   |                       \                                       |                                     /             |
   +------------------------\--------------------------------------+------------------------------------/--------------+
                             \                                     |                                   /
                              \====================================+==================================/
                                                                   |
                                                                   v
                                                     +---------------------------+
                                                     | Channel: identity-channel |
                                                     +---------------------------+
                                                                   |
            +--------------------------+---------------------------+---------------------------+--------------------------+
            |                          |                                                       |                          |
            v                          v                                                       v                          v
    +-----------------------+  +-----------------------+                               +-----------------------+  +-----------------------+
    |        GovMSP         |  |     UniversityMSP     |                               |        BankMSP        |  |      EmployerMSP      |
    +-----------------------+  +-----------------------+                               +-----------------------+  +-----------------------+
    | [ca.gov:7054]         |  | [ca.uni:8054]         |                               | [ca.bank:9054]        |  | [ca.emp:10054]        |
    |                       |  |                       |                               |                       |  |                       |
    | [peer0.gov:7051]      |  | [peer0.uni:8051]      |                               | [peer0.bank:9051]     |  | [peer0.emp:10051]     |
    |   | (Dedicated DB)    |  |   | (Dedicated DB)    |                               |   | (Dedicated DB)    |  |   | (Dedicated DB)    |
    |   v                   |  |   v                   |                               |   v                   |  |   v                   |
    | [couchdb0.gov:5984]   |  | [couchdb0.uni:6984]   |                               | [couchdb0.bank:7984]  |  | [couchdb0.emp:8984]   |
    |                       |  |                       |                               |                       |  |                       |
    | [peer1.gov:7052]      |  | [peer1.uni:8052]      |                               | [peer1.bank:9052]     |  | [peer1.emp:10052]     |
    |   | (Dedicated DB)    |  |   | (Dedicated DB)    |                               |   | (Dedicated DB)    |  |   | (Dedicated DB)    |
    |   v                   |  |   v                   |                               |   v                   |  |   v                   |
    | [couchdb1.gov:5985]   |  | [couchdb1.uni:6985]   |                               | [couchdb1.bank:7985]  |  | [couchdb1.emp:8985]   |
    +-----------------------+  +-----------------------+                               +-----------------------+  +-----------------------+
```

### 6.1 Port Allocation Plan (8 Peers & 8 Dedicated CouchDBs)

```
+--------------------------+---------------------+-----------+-----------------------------------+
| Node Identifier          | Container Port      | Host Port | Purpose                           |
+--------------------------+---------------------+-----------+-----------------------------------+
| ca.gov                   | 7054                | 7054      | Gov CA Server API                 |
| peer0.gov                | 7051, 7052, 9443    | 7051      | Gov Anchor / Gateway Peer         |
| couchdb0.gov             | 5984                | 5984      | Dedicated State DB for peer0.gov  |
| peer1.gov                | 7051, 7052, 9443    | 7052      | Gov Redundant / Committing Peer   |
| couchdb1.gov             | 5984                | 5985      | Dedicated State DB for peer1.gov  |
| orderer1.gov             | 7050, 9443          | 7050      | Raft OSN Node 1 (GovMSP)          |
+--------------------------+---------------------+-----------+-----------------------------------+
| ca.university            | 7054                | 8054      | University CA Server API          |
| peer0.university         | 7051, 7052, 9443    | 8051      | University Anchor / Gateway Peer  |
| couchdb0.university      | 5984                | 6984      | Dedicated DB for peer0.university |
| peer1.university         | 7051, 7052, 9443    | 8052      | University Redundant Peer         |
| couchdb1.university      | 5984                | 6985      | Dedicated DB for peer1.university |
| orderer2.university      | 7050, 9443          | 8050      | Raft OSN Node 2 (UniversityMSP)   |
+--------------------------+---------------------+-----------+-----------------------------------+
| ca.bank                  | 7054                | 9054      | Bank CA Server API                |
| peer0.bank               | 7051, 7052, 9443    | 9051      | Bank Anchor / Gateway Peer        |
| couchdb0.bank            | 5984                | 7984      | Dedicated State DB for peer0.bank |
| peer1.bank               | 7051, 7052, 9443    | 9052      | Bank Redundant Peer               |
| couchdb1.bank            | 5984                | 7985      | Dedicated State DB for peer1.bank |
| orderer3.bank            | 7050, 9443          | 9050      | Raft OSN Node 3 (BankMSP)         |
+--------------------------+---------------------+-----------+-----------------------------------+
| ca.employer              | 7054                | 10054     | Employer CA Server API            |
| peer0.employer           | 7051, 7052, 9443    | 10051     | Employer Anchor / Gateway Peer    |
| couchdb0.employer        | 5984                | 8984      | Dedicated DB for peer0.employer   |
| peer1.employer           | 7051, 7052, 9443    | 10052     | Employer Redundant Peer           |
| couchdb1.employer        | 5984                | 8985      | Dedicated DB for peer1.employer   |
+--------------------------+---------------------+-----------+-----------------------------------+
```

---

## 7. Decentralized Ordering Service & Raft Consensus Architecture

### 7.1 Multi-Organization Raft Consenter Set
To eliminate single-party orderer dominance, ordering authority is distributed across three sovereign organizations:
- `orderer1.gov.identity.example.com` (`GovMSP`)
- `orderer2.university.example.com` (`UniversityMSP`)
- `orderer3.bank.example.com` (`BankMSP`)

```
                       +---------------------------------------------------+
                       |        3-NODE DECENTRALIZED RAFT CONSENSUS        |
                       +---------------------------------------------------+
                                    Quorum Requirement: 2 of 3
                                              
                       +---------------------------------------------------+
                       | [orderer1.gov]  <== TLS ==>  [orderer2.university]|
                       |      (GovMSP)                     (UniversityMSP) |
                       +---------------------------------------------------+
                                     \                       /
                               TLS Heartbeats          TLS Heartbeats
                                       \                   /
                                        v                 v
                               +-----------------------------------+
                               |        [orderer3.bank]            |
                               |           (BankMSP)               |
                               +-----------------------------------+
```

### 7.2 Consensus Capabilities & Realistic Fault Boundaries
- **Crash Fault Tolerance (CFT)**: **Raft provides crash fault tolerance and maintains ordering safety when a quorum is available. During loss of quorum, the ordering service cannot continue committing new blocks until quorum is restored.**
- **Byzantine Fault Boundaries**: Raft assumes all consenters act non-maliciously according to protocol. It does **not** provide Byzantine Fault Tolerance (BFT); an adversarial orderer possessing valid TLS credentials could attempt block withholding or equivocation, which must be mitigated through external consortium cross-audits.
- **Deterministic Finality**: Raft provides deterministic transaction ordering and finality without blockchain forks or state reorganizations. The time required for transaction commitment depends on network, endorsement, batching, and ordering conditions and will be measured experimentally.
- **Performance Evaluation Scope**: Transaction throughput and latency will be empirically evaluated under varying block sizes and timeouts during the benchmarking milestone rather than assumed.

---

## 8. Channel Architecture & Ledger Topology

### 8.1 Single Consortium Channel: `identity-channel`
All four consortium organizations join the unified channel **`identity-channel`**.

The channel ledger encompasses four core registries:
1. **Identity Registry**: Maps Citizen DIDs to public verification key fingerprints and root accreditation status.
2. **Issuer Registry**: Maintains accredited institutions authorized to issue specific credential schema types.
3. **Credential Registry**: Records cryptographic commitments (salted SHA-256 digests) of issued credentials, expiration epochs, and active revocation flags.
4. **Audit Trail Registry**: Immutable, append-only logs recording verification timestamps and relying party attestations.

### 8.2 State Database: CouchDB
Each peer uses its dedicated CouchDB instance:
- Supports rich JSON queries across credential schemas, issuer DIDs, and expiration ranges.
- **Query Optimization**: Declarative CouchDB JSON indexes are deployed alongside chaincode to improve the efficiency of structured credential and lifecycle queries (performance will be measured experimentally).

---

## 9. On-Chain vs. Off-Chain Data Classification (Data Minimization)

The architecture is built on strict data minimization: **Raw personal identity attributes are never recorded on-chain**.

```
+====================================================================================================+
|                               DATA CLASSIFICATION & STORAGE BOUNDARIES                             |
+====================================================================================================+

 [ OFF-CHAIN STORAGE (Private) ]                                 [ ON-CHAIN LEDGER (Immutable) ]
 +-------------------------------------+                         +-----------------------------------+
 | 1. Raw PII Attributes:              |                         | 1. Cryptographic Identifiers:     |
 |    - Full Name, Date of Birth       |                         |    - Decentralized Identifier:    |
 |    - National ID String             |      Cryptographic      |      did:example:citizen101       |
 |    - Biometric Hashes, Address      |   Salted Hashing &      |                                   |
 |    - Transcript / Degree Grades     |   Signature Synthesis   | 2. Credential Anchors:            |
 |                                     | ======================> |    - Credential Digest:           |
 | 2. Off-Chain Storage Engines:       |                         |      SHA256(Salt || VC_Payload)   |
 |    - InterPlanetary File System     |                         |    - Issuer Signature Commitment  |
 |      (IPFS): Encrypted JSON-LD      |                         |    - Schema URI & Version         |
 |    - Citizen Mobile Identity Wallet |                         |                                   |
 |      (Encrypted Secure Enclave)     |                         | 3. Lifecycle Metadata:            |
 |    - Institutional Vaults           |                         |    - Issuance Timestamp           |
 |      (Encrypted with AES-256-GCM)   |                         |    - Expiration Epoch             |
 |                                     |                         |    - Revocation Flag (Boolean)    |
 +-------------------------------------+                         +-----------------------------------+
                   |                                                               |
                   \_______________________________________________________________/
                                                   |
                     Verification: Match Off-Chain Presentation Hash with On-Chain Anchor
```

### 9.1 Storage Classification Breakdown

```
+------------------------------------+--------------------------+---------------------+-------------------------------+
| Data Element                       | Storage Location         | Encryption Mode     | Access Control Mechanism      |
+------------------------------------+--------------------------+---------------------+-------------------------------+
| Citizen National ID / Name / Photo | Off-Chain IPFS / Wallet  | AES-256-GCM         | Citizen Private Key Decryption|
| Academic Degree / GPA Grades       | Off-Chain IPFS / Mongo   | AES-256-GCM         | Citizen Consent / Token Grant |
| Employment Appraisal / Salary      | Off-Chain MongoDB Vault  | Institutional KMS   | Employer / Citizen Mutual Auth|
+------------------------------------+--------------------------+---------------------+-------------------------------+
| DID Document (Public Keys, Auth)   | On-Chain (World State)   | Plaintext JSON      | Channel Readers (Consortium)  |
| Credential Fingerprint (Hash)      | On-Chain (World State)   | SHA-256 (Salted)    | Channel Readers (Consortium)  |
| Issuer Digital Signature           | On-Chain (World State)   | ECDSA (secp256r1)   | Channel Readers (Consortium)  |
| Revocation Status Record           | On-Chain (World State)   | Plaintext Boolean   | Channel Readers (Consortium)  |
| Transaction Audit Nonce            | On-Chain (Ledger Blocks) | Cryptographic Hash  | Channel Readers (Consortium)  |
+------------------------------------+--------------------------+---------------------+-------------------------------+
```

---

## 10. Private Data Collections (PDC) Architecture & Retention Policy

Private Data Collections (PDCs) are used when sensitive bilateral verification metadata must be shared between a subset of organizations without broadcasting payloads to the entire consortium.

```
+----------------------------------------------------------------------------------------------------+
|                                 PRIVATE DATA COLLECTIONS CONFIGURATION                             |
+------------------------------+---------------------------+-----------------------+-----------------+
| Collection Name              | Authorized Members        | Dissemination         | BlockToLive     |
+------------------------------+---------------------------+-----------------------+-----------------+
| `PDC_Gov_Bank_KYC`           | `GovMSP`, `BankMSP`       | Gossip (P2P Private)  | 50,000 blocks   |
| `PDC_Uni_Employer_Academic`  | `UniversityMSP`, `EmpMSP` | Gossip (P2P Private)  | 50,000 blocks   |
| `PDC_Audit_Compliance`       | All 4 Organizations       | Gossip (Consortium)   | 0 (Permanent)   |
+------------------------------+---------------------------+-----------------------+-----------------+
```

### 10.1 Retention Policy Justification
- **Bilateral Verification Collections (`blockToLive: 50000`)**: **`blockToLive: 50000` is an initial experimental retention parameter. The effective retention duration will be calculated from observed block production rates during performance evaluation.** After the configured block span, private data payloads are automatically purged from the authorized peers' state databases. Crucially, the cryptographic hash of the private data remains permanently on the immutable ledger blocks, preserving non-repudiation auditability without unbounded storage growth.
- **Audit & Compliance Collection (`blockToLive: 0`)**: Regulatory audit logs are assigned a `blockToLive` of `0` (indefinite retention) to satisfy regulatory non-repudiation mandates.

### 10.2 Cryptographic Privacy Guarantee
Unauthorized peers from other organizations (`UniversityMSP`, `EmployerMSP`) receive only the **cryptographic hash of the private data envelope in the block transaction**, completely preventing unauthorized inspection of transient payloads while allowing state validation.

---

## 11. Multi-Tier Endorsement & Access Control Architecture

In Hyperledger Fabric, endorsement is not a single monolith. Our architecture cleanly delineates four distinct endorsement and access-control tiers:

```
+===================================================================================================+
|                               FOUR-TIER ENDORSEMENT & ACCESS CONTROL                              |
+===================================================================================================+

 1. Fabric Lifecycle Approval Policy:
    - Rule: MAJORITY (Requires 3 of 4 organizations to approve chaincode definitions before commit)
    
 2. Chaincode-Level Default Endorsement Policy:
    - Rule: MAJORITY (Default endorsement requires signatures from at least 3 consortium organizations)
    
 3. State-Based Endorsement (SBE) Policies:
    - Applied dynamically at the key/asset level via 'SetStateValidationParameter()'
    - Example: An individual Academic Credential key is bound to SBE: 'AND(UniversityMSP, GovMSP)'
    - Example: A Citizen DID key is bound to SBE: 'GovMSP'
    
 4. In-Chaincode Application Authorization & ABAC:
    - Evaluates caller identity via 'ctx.clientIdentity.getMSPID()' and 'getAssertAttributeValue()'
    - Enforces business logic roles: only GovMSP can register root DIDs; only accredited issuers can issue.
```

### 11.1 Functional Authorization & Endorsement Matrix

```
+----------------------------------+----------------------------------+------------------------------------+---------------------------------------------------------+
| Operation / Function Name        | In-Chaincode Auth (ABAC)         | Endorsement Mechanism              | Architectural Justification                             |
+----------------------------------+----------------------------------+------------------------------------+---------------------------------------------------------+
| `RegisterCitizenDID`             | Caller must be `GovMSP`          | State-Based: `GovMSP.peer`         | Sovereign civil identity anchoring requires Gov endorsement.|
| `AccreditIssuer`                 | Caller must be `GovMSP` admin    | SBE: `AND(GovMSP, UniMSP)`         | Accrediting new issuers requires bilateral governance. |
| `IssueAcademicCredential`        | Caller must be `UniversityMSP`   | SBE: `AND(UniMSP, GovMSP)`         | Prevents unverified issuance; validates root DID status.|
| `IssueEmploymentCredential`      | Caller must be `EmployerMSP`     | SBE: `AND(EmployerMSP, GovMSP)`    | Ensures employer issuance is co-verified with civil DID.|
| `VerifyCredentialStatus`         | Any valid consortium member      | Channel Default: `ANY` (Read query)| Read-only state lookup for fast verification.           |
| `RevokeCredential`               | Caller must be Originating Issuer| SBE: Bound Issuer Peer Signature   | Only originating accredited issuer can revoke.          |
| `RecordVerificationAudit`        | Caller must be Verifier MSP      | In-Chaincode PDC Append            | Verifier creates non-repudiable proof of audit.         |
+----------------------------------+----------------------------------+------------------------------------+---------------------------------------------------------+
```

---

## 12. End-to-End Transaction Flow Diagrams

### 12.1 Identity Registration Flow (Citizen Root DID)

```
 CITIZEN                   GOV API GATEWAY                  ca.gov (CA)           peer0.gov (GovMSP)        ORDERER CLUSTER
    |                             |                              |                        |                        |
 1. |-- Submit Civil Request ---->|                              |                        |                        |
    |   (Presents Verification)   |                              |                        |                        |
 2. |                             |-- Verify Identity In-House   |                        |                        |
    |                             |-- Register Gateway Client -->|                        |                        |
    |                             |<-- Client Cert (GovMSP) -----|                        |                        |
 3. |                             |                                                       |                        |
    |                             |-- Submit Proposal: RegisterCitizenDID(DID, PubKey) -->|                        |
 4. |                             |                                                       |-- In-Chaincode Auth    |
    |                             |                                                       |-- Simulate Execution   |
    |                             |<-- Signed Proposal Response (Endorsement) ------------|                        |
 5. |                             |                                                                                |
    |                             |-- Broadcast Endorsed Transaction Envelope ------------------------------------>|
 6. |                             |                                                                                |-- Order in Raft Block
 7. |                             |<-- Block Commit Event ---------------------------------------------------------|-- Deliver to Peers
    |<-- Registration Confirmed --|
```

---

### 12.2 Credential Issuance Flow (Academic Degree)

```
 CITIZEN WALLET           UNIVERSITY PORTAL         peer0.uni (UniMSP)      peer0.gov (GovMSP)       ORDERER CLUSTER
       |                          |                         |                       |                       |
  1.   |-- Request Credential --->|                         |                       |                       |
       |   (Signed DID Auth Proof)|                         |                       |                       |
  2.   |                          |-- Verify Student Record |                       |                       |
       |                          |-- Mint JSON-LD VC       |                       |                       |
       |                          |-- Calculate Hash & Salt |                       |                       |
       |                          |-- Store Encrypted to IPFS                       |                       |
  3.   |                          |                                                 |                       |
       |                          |-- Proposal: IssueAcademicCredential(Hash, Schema, Expiry) ------------->|
       |                          |                                                 |                       |
       |                          |                                                 |-- Verify UniMSP Sig   |
       |                          |-- Verify Citizen DID Active ------------------------------------------->|
       |                          |                                                 |                       |-- Verify GovMSP Sig
  4.   |                          |<-- Multi-Org Endorsements (Both Signatures) ----+-----------------------|
  5.   |                          |                                                                         |
       |                          |-- Broadcast Endorsed Tx Envelope -------------------------------------->|
  6.   |                          |                                                                         |-- Raft Consensus Block
       |                          |<-- Transaction Commit Notification -------------------------------------|-- Commit to World State
  7.   |<-- Return Signed VC -----|
       |    (With IPFS Anchor CID)|
```

---

### 12.3 Credential Verification Flow (Bank KYC / Employment Background)

```
 CITIZEN WALLET              VERIFIER (Bank / Employer)               VERIFIER PEER             LEDGER WORLD STATE
       |                                  |                                  |                           |
  1.   |--- Present Verifiable Proof ---->|                                  |                           |
       |    (VC Hash, Nonce, Issuer Sig)  |                                  |                           |
  2.   |                                  |-- Verify Issuer Signature        |                           |
       |                                  |   (Against On-chain Public Key)  |                           |
  3.   |                                  |                                  |                           |
       |                                  |-- Query: VerifyCredential(Hash) ->|                           |
       |                                  |                                  |-- Read Status & Expiry -->|
       |                                  |                                  |<-- Active (Not Revoked) --|
       |                                  |<-- Query Result: VALID ----------|                           |
  4.   |                                  |                                                              |
       |                                  |-- Invoke: RecordAuditTrail(VerifierID, Purpose, Hash) ------->|
       |                                  |   (Non-repudiation audit record written to immutable ledger) |
  5.   |<-- Verification Success Result --|
```

---

### 12.4 Credential Revocation Flow

```
 ISSUER (Uni / Gov)             ISSUER PEER                    ORDERING SERVICE              ALL CONSORTIUM PEERS
         |                            |                                |                               |
    1.   |-- RevokeCredential(Hash) ->|                                |                               |
         |    (Reason, Timestamp)     |-- Validate Issuer Identity     |                               |
         |                            |-- Simulate State Change:       |                               |
         |                            |   RevocationStatus = TRUE      |                               |
    2.   |<-- Signed Endorsement -----|                                |                               |
    3.   |                                                             |                               |
         |-- Submit Transaction -------------------------------------->|                               |
    4.   |                                                             |-- Order Block (Raft) -------->|
    5.   |                                                             |                               |-- Commit State Change
         |                                                             |<-- Event: CredentialRevoked --|-- Invalidate Cache
```

---

## 13. Security Architecture & Realist Threat Modeling

In an academic and production context, security properties must not be claimed blindly based on the presence of a technology. The threat model explicitly documents boundaries, failure modes, and residual risks:

```
+--------------------------------+-----------------------------------------------------------+-----------------------------------------------------------------+
| Threat Vector                  | Realist Risk Description                                  | Architectural Defense & Residual Risk Reality                   |
+--------------------------------+-----------------------------------------------------------+-----------------------------------------------------------------+
| Malicious / Corrupted Orderer  | An ordering node attempts to equivocate or delay blocks.  | **Defense:** Raft provides CFT (survives 1 crashed node).       |
|                                |                                                           | **Residual Risk:** Raft is NOT Byzantine Fault Tolerant (BFT).  |
|                                |                                                           | Malicious orderers could delay blocks; requires external audit. |
+--------------------------------+-----------------------------------------------------------+-----------------------------------------------------------------+
| Stolen Client Identity / Token | An unauthorized actor compromises an institutional cert.  | **Defense:** mTLS protects channels against eavesdropping/MitM. |
|                                |                                                           | **Residual Risk:** mTLS cannot detect a valid stolen private key|
|                                |                                                           | Requires short-lived certificates, CRLs, and HSM backing.       |
+--------------------------------+-----------------------------------------------------------+-----------------------------------------------------------------+
| Rogue Issuer Collusion         | A compromised university issues fake diplomas.            | **Defense:** SBE multi-org co-endorsement (`AND(Uni, Gov)`).    |
|                                |                                                           | Root DID must be valid on Gov registry before issue succeeds.   |
+--------------------------------+-----------------------------------------------------------+-----------------------------------------------------------------+
| Sybil / Unauthorized Nodes     | An unauthorized peer attempts to join gossip or channel.  | **Defense:** Strict MSP validation and channel genesis policies.|
+--------------------------------+-----------------------------------------------------------+-----------------------------------------------------------------+
| Replay Attack                  | An old verification presentation is replayed by an agent. | **Defense:** Transient challenges (nonce + timestamp) required. |
+--------------------------------+-----------------------------------------------------------+-----------------------------------------------------------------+
```

---

## 14. Privacy Engineering & GDPR Alignment

### 14.1 Privacy-Preserving Design (Minimizing GDPR Exposure)
The system is deliberately architected to **minimize GDPR exposure and support erasure of directly identifying off-chain data**:

1. **Zero Raw PII on Ledger**: No names, biometric records, national ID numbers, birth dates, or academic grades are ever written to the blockchain.
2. **Erasure of Directly Identifying Off-Chain Data**: Verifiable credentials reside in off-chain encrypted storage (IPFS/MongoDB). When a citizen exercises their right to data deletion, the off-chain credential and its encryption keys are permanently deleted.
3. **Cryptographic Integrity & Lifecycle Anchors**: **The on-chain representation contains cryptographic identifiers, integrity commitments, signatures, and lifecycle metadata rather than raw identity attributes.** This architecture eliminates direct exposure of personal identity attributes while maintaining tamper evidence for historical verification records.
4. **Data Minimization & Selective Disclosure**: Verifiable Presentations allow citizens to share only requested claims (e.g., "Age $\ge$ 21" or "Degree Conferred: True") without exposing full underlying transcripts.

---

## 15. Scalability, Performance & Lifecycle Engineering

### 15.1 Block-Cutting Optimization Parameters
```yaml
Orderer:
  BatchTimeout: 1s       # Low latency for interactive verification
  BatchSize:
    MaxMessageCount: 100 # Balanced throughput for enterprise credential issuance
    AbsoluteMaxBytes: 10 MB
    PreferredMaxBytes: 2 MB
```

### 15.2 CouchDB Indexing Strategy
To maintain search efficiency across large volumes of credentials, declarative JSON indices are pre-packaged within chaincode:
```json
{
  "index": {
    "fields": ["docType", "citizenDID", "revoked", "expirationDate"]
  },
  "name": "indexCitizenCredentialLookup",
  "type": "json"
}
```
*Note: The query execution characteristics across growing ledger depths will be empirically benchmarked and documented during the performance evaluation milestone.*

---

## 16. Architectural Decision Records (ADR) Summary

```
+--------+------------------------------------+-----------------------------+--------------------------------------------------------------+
| ADR ID | Decision Topic                     | Selected Approach           | Primary Rationale                                            |
+--------+------------------------------------+-----------------------------+--------------------------------------------------------------+
| ADR-01 | Platform Selection                 | Hyperledger Fabric v2.5 LTS | Permissioned privacy, zero gas fees, deterministic finality. |
| ADR-02 | State Database Engine              | CouchDB (8 Dedicated DBs)   | 1:1 dedicated DB per peer prevents state lock & interference.|
| ADR-03 | Consensus Architecture             | 3-Org Decentralized Raft    | Eliminates single-party orderer censorship; provides CFT.    |
| ADR-04 | Channel Topology                   | Single Consortium Channel   | Prevents fragmented state; PDCs handle private bilateral data|
| ADR-05 | Privacy & PII Handling             | Zero Raw PII On-Chain       | Minimizes GDPR exposure; off-chain credential erasure.       |
| ADR-06 | Citizen Identity Model             | Gateway + Application DIDs  | Citizens are not Fabric MSP members; interact via API gateway|
| ADR-07 | Endorsement Architecture           | Multi-Tier (Lifecycle + SBE)| Combines SBE with in-chaincode ABAC authorization.          |
| ADR-08 | Host OS & Filesystem Architecture  | Native Linux WSL2 Root      | Eliminates Windows 9P mount latency & permission drift.      |
+--------+------------------------------------+-----------------------------+--------------------------------------------------------------+
```

---

## Conclusion & Review Gate

This refined architectural specification incorporates all four final technical corrections:
1. **CouchDB Topology**: Defines 8 dedicated CouchDB instances paired 1:1 with the 8 peer nodes (zero sharing).
2. **PDC Retention**: Clarifies that `blockToLive: 50000` is an initial experimental retention parameter whose effective duration will be benchmarked.
3. **On-Chain Representation**: Formulates on-chain records accurately as cryptographic identifiers, integrity commitments, signatures, and lifecycle metadata.
4. **Raft Wording**: Specifies realistic CFT behavior and quorum loss boundaries without claiming BFT.

**No implementation or configuration generation has been initiated.** This document is submitted for final review before commencing Milestone 3.
