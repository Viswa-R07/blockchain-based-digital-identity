# Hyperledger Fabric 4-Organization Permissioned Network Runbook

## 1. Network Architecture Overview

This multi-organization permissioned blockchain network implements the foundation for the **"Blockchain-Based Digital Identity Verification System"** on **Hyperledger Fabric v2.5.16 LTS** and **Fabric CA v1.5.17**.

### Organizations & Topology
| Organization | MSP ID | Fabric CA (Port) | Orderer Node (Port / Admin) | Peers (Host Ports) | Dedicated CouchDB Instances | Anchor Peer |
|---|---|---|---|---|---|---|
| **Government Identity Authority** | `GovMSP` / `OrdererOrgGovMSP` | `ca.gov.identity.example.com` (7054) | `orderer1.gov.identity.example.com` (7050 / 7053) | `peer0` (7051), `peer1` (7052) | `couchdb0.gov` (5984), `couchdb1.gov` (5985) | `peer0.gov.identity.example.com:7051` |
| **University** | `UniversityMSP` / `OrdererOrgUniMSP` | `ca.university.example.com` (8054) | `orderer2.university.example.com` (8050 / 8053) | `peer0` (8051), `peer1` (8052) | `couchdb0.uni` (6984), `couchdb1.uni` (6985) | `peer0.university.example.com:8051` |
| **Bank** | `BankMSP` / `OrdererOrgBankMSP` | `ca.bank.example.com` (9054) | `orderer3.bank.example.com` (9050 / 9053) | `peer0` (9051), `peer1` (9052) | `couchdb0.bank` (7984), `couchdb1.bank` (7985) | `peer0.bank.example.com:9051` |
| **Employer** | `EmployerMSP` | `ca.employer.example.com` (10054) | — (Participates as Consenter Consumer) | `peer0` (10051), `peer1` (10052) | `couchdb0.emp` (8984), `couchdb1.emp` (8985) | `peer0.employer.example.com:10051` |

### Totals
- **Total Containers**: 23 (4 CAs + 3 Raft Orderers + 8 Dedicated CouchDBs + 8 Fabric Peers)
- **Consensus**: 3-Node Raft (`etcdraft`) across Gov, University, and Bank orderers
- **Channel**: `identity-channel`
- **Security Policy**: Zero raw PII on-chain; Docker socket (`/var/run/docker.sock`) strictly unmounted on all peers.

---

## 2. Security Notice & Credential Classification

> [!WARNING]
> **DEVELOPMENT & LOCAL TEST CREDENTIALS ONLY**
>
> The credentials used throughout this development environment (specifically username `admin` and password `adminpw` for Fabric CAs and CouchDB instances) are **strictly intended for local testing and prototype development**.
>
> **Do not claim or treat these credentials as production-grade secrets.**
>
> In a production deployment:
> 1. All CA bootstrap passwords, database credentials, and admin private keys MUST be generated using cryptographically secure pseudorandom generators with high entropy.
> 2. Credentials MUST be managed via external secrets managers or hardware security modules (HSM / PKCS#11).
> 3. Mutual TLS authentication with strictly scoped IP/firewall boundaries MUST be enforced.
> 4. Default database admin credentials must be replaced prior to onboarding live data.

---

## 3. Directory Layout

The primary network files reside inside the Linux WSL2 environment at:
`/home/viswa_r07/blockchain-identity/network/`
(Mirrored on Windows at `c:\Users\Viswa R\OneDrive\Documents\Blockchain Project 1\network\`)

```
network/
├── channel-artifacts/
│   ├── identity-channel.block             # Channel creation configuration block
│   ├── anchor_update/                     # Extracted channel configs and envelopes
│   └── resilience_test/                   # Artifacts from Raft resilience validation
├── compose/
│   ├── docker-compose-ca.yaml             # 4 Fabric CAs
│   ├── docker-compose-orderer.yaml        # 3 Raft Orderers (BOOTSTRAPMETHOD=none)
│   ├── docker-compose-couch.yaml          # 8 Dedicated CouchDBs (couchdb:3.3.3)
│   └── docker-compose-peers.yaml          # 8 Fabric Peers (no docker.sock mounted)
├── configtx/
│   └── configtx.yaml                      # Channel profile, MSP definitions, Anchor Peers
├── organizations/
│   ├── fabric-ca/                         # CA server operational files
│   ├── ordererOrganizations/              # Crypto material for orderer orgs
│   └── peerOrganizations/                 # Crypto material for peer orgs
├── registerEnroll.sh                      # Enrolls CA admins, registers & enrolls nodes/users
├── fix_certs.sh                           # Synchronizes CA certs into node MSP cacerts
├── join_orderers.sh                       # Joins Raft orderers via osnadmin channel join
├── join_peers.sh                          # Joins all 8 peers to identity-channel
├── set_anchor_peers.sh                    # Anchor peer verification & extraction
├── verify_network.sh                      # 6-step automated health suite (strict non-zero exit)
├── resilience_test.sh                     # 4-phase Raft resilience and quorum test suite
└── NETWORK_RUNBOOK.md                     # This operations guide
```

---

## 4. Operational Procedures

### 4.1. Complete Network Startup
To start the network from a clean stopped state:

```bash
cd /home/viswa_r07/blockchain-identity/network/compose

# 1. Start Certificate Authorities
docker compose -f docker-compose-ca.yaml up -d

# 2. Start Dedicated State Databases (CouchDB)
docker compose -f docker-compose-couch.yaml up -d

# 3. Start Raft Ordering Nodes
docker compose -f docker-compose-orderer.yaml up -d

# 4. Start Peer Nodes
docker compose -f docker-compose-peers.yaml up -d
```

### 4.2. Automated Health Verification
Run the verification suite:

```bash
/home/viswa_r07/blockchain-identity/network/verify_network.sh
```

**Exit Code Semantics**:
- `0`: All 23 containers running, all 8 CouchDB endpoints healthy, all 3 orderers active, all 8 peers joined, and ledger heights consistent across all peers.
- `1`: Any container missing, CouchDB down, channel list non-200, peer disconnected, or ledger height mismatch.

To verify against a specific target block height (e.g. after config updates):
```bash
/home/viswa_r07/blockchain-identity/network/verify_network.sh 2
```

---

## 5. Raft Consensus Resilience & Quorum Behavior

The 3-node Raft consensus cluster (`orderer1.gov`, `orderer2.uni`, `orderer3.bank`) implements crash fault tolerance (CFT) with the mathematical quorum rule:
$$\text{Quorum} = \left\lfloor \frac{N}{2} \right\rfloor + 1 = \left\lfloor \frac{3}{2} \right\rfloor + 1 = 2$$

### 5.1. Single Node Failure ($N=3, F=1$)
- If any single orderer fails (e.g., `orderer3.bank.example.com` stopped):
  - Remaining alive orderers: 2 of 3.
  - Quorum is preserved ($2 \ge 2$).
  - If the failed node was the leader, remaining nodes elect a new leader within the election timeout (~5-8s).
  - Normal transaction ordering and block creation continue uninterrupted.
  - When the stopped orderer is restarted, it rejoins the cluster, catches up via Raft log replication, and resumes active consenter participation.

### 5.2. Quorum Loss ($N=3, F=2$)
- If two orderers fail (e.g., `orderer2.uni` and `orderer3.bank` stopped):
  - Remaining alive orderers: 1 of 3.
  - Quorum is lost ($1 < 2$).
  - The remaining orderer refuses to commit or order transactions (`SERVICE_UNAVAILABLE` / consensus error).
  - Blockchain ledger heights remain frozen; no phantom or divergent blocks are created.
  - Once stopped orderers are restarted, the cluster re-elects a leader, achieves quorum, and transaction processing safely resumes.

### 5.3. Running the Automated Resilience Test Suite
```bash
/home/viswa_r07/blockchain-identity/network/resilience_test.sh
```
This script executes:
1. Baseline state recording (orderer participation, all 8 peer heights).
2. Controlled shutdown of `orderer3.bank`, quorum validation ($2 \ge 2$), submission of a network-level config update (adding `peer1.gov` as high-availability anchor peer), verification of block height advancement across all 8 peers, and restart/rejoin of `orderer3`.
3. Controlled shutdown of `orderer2` and `orderer3`, verification of quorum loss, confirmation that transactions cannot commit without quorum, and restoration of the cluster.
4. Comprehensive re-verification of all 23 containers and peer heights.

---

## 6. Status & Inspection Commands

### 6.1. Inspecting Raft Consensus (`osnadmin`)
```bash
export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH
NET=/home/viswa_r07/blockchain-identity/network

# Query orderer1
osnadmin channel list -o localhost:7053 \
  --ca-file "${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/ca.crt" \
  --client-cert "${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/server.crt" \
  --client-key "${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/server.key"
```

### 6.2. Querying Peer Ledger Heights (`peer channel`)
```bash
export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=/home/viswa_r07/blockchain-identity/fabric-samples/config
NET=/home/viswa_r07/blockchain-identity/network

export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="BankMSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${NET}/organizations/peerOrganizations/bank.example.com/peers/peer0.bank.example.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="${NET}/organizations/peerOrganizations/bank.example.com/users/Admin@bank.example.com/msp"
export CORE_PEER_ADDRESS="localhost:9051"

peer channel getinfo -c identity-channel
```

### 6.3. Graceful Network Shutdown
To halt the network while preserving all ledger and crypto state:

```bash
cd /home/viswa_r07/blockchain-identity/network/compose
docker compose -f docker-compose-peers.yaml stop
docker compose -f docker-compose-orderer.yaml stop
docker compose -f docker-compose-couch.yaml stop
docker compose -f docker-compose-ca.yaml stop
```

To resume after a stop:
```bash
cd /home/viswa_r07/blockchain-identity/network/compose
docker compose -f docker-compose-ca.yaml start
docker compose -f docker-compose-couch.yaml start
docker compose -f docker-compose-orderer.yaml start
docker compose -f docker-compose-peers.yaml start
```
