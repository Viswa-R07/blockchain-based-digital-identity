# Hyperledger Fabric Development Environment Setup & Verification Guide

**Project Title:** Blockchain-Based Digital Identity Verification System  
**Milestone:** Infrastructure Readiness & Fabric Development Environment Verification  
**Primary Platform:** Hyperledger Fabric v2.5.16 LTS (with Fabric CA v1.5.17)

---

## 1. System & Environment Specifications

| Component | Installed Version | Notes |
|---|---|---|
| **Host Operating System** | Windows 11 (build 26100) | Host machine |
| **WSL2 Linux Distribution** | Ubuntu 26.04 LTS (`resolute`) | Primary Linux execution environment |
| **Linux Kernel** | 6.18.33.1-microsoft-standard-WSL2 | x86_64 architecture |
| **Docker Engine** | Docker version 29.7.2 (build a7dcaa6) | WSL2 backend integration active |
| **Docker Compose** | Docker Compose version v5.5.1 | Built-in compose plugin |
| **Hyperledger Fabric** | **v2.5.16** (Long-Term Support) | Production LTS baseline |
| **Fabric CA** | **v1.5.17** | Certificate Authority for identity generation |
| **fabric-samples Commit** | `8fa2cccb204529690a91a7358a4a1a48db9268be` (`main`) | Tagged & verified compatible with v2.5.16 |
| **Linux Working Directory** | `/home/viswa_r07/blockchain-identity/` | Isolated from Windows OneDrive sync & drvfs overhead |
| **Windows Workspace** | `C:\Users\Viswa R\OneDrive\Documents\Blockchain Project 1\` | Documentation & repo access |

---

## 2. Directory Structure

```
/home/viswa_r07/blockchain-identity/
├── FABRIC_SETUP.md                           # Infrastructure setup guide (this document)
├── verify_ledger.sh                          # Automated verification test script
├── install-fabric.sh                         # Official Fabric bootstrap script
└── fabric-samples/
    ├── bin/                                  # Fabric platform binaries (symlinked to /usr/local/bin)
    │   ├── configtxgen                       # Channel & genesis configuration tool
    │   ├── configtxlator                     # Config translation/inspection utility
    │   ├── cryptogen                         # Crypto material generation tool
    │   ├── discover                          # Service discovery CLI
    │   ├── fabric-ca-client                  # Fabric CA enrollment/registration CLI
    │   ├── fabric-ca-server                  # Fabric CA daemon binary
    │   ├── ledgerutil                        # Ledger comparison/validation utility
    │   ├── orderer                           # Fabric ordering node binary
    │   ├── osnadmin                          # Ordering Service Node administration CLI
    │   └── peer                              # Fabric peer CLI
    ├── config/                               # Core YAML configurations
    │   ├── configtx.yaml
    │   ├── core.yaml
    │   └── orderer.yaml
    ├── test-network/                         # Standard 2-Org test network
    │   ├── compose/                          # Docker compose definitions
    │   ├── organizations/                    # Generated crypto material (MSP, TLS certificates)
    │   ├── scripts/                          # Bootstrap & lifecycle scripts
    │   ├── network.sh                        # Network control script
    │   └── setOrgEnv.sh                      # Environment variable exporter
    └── asset-transfer-basic/                 # Verification chaincode
        └── chaincode-javascript/             # JavaScript smart contract used for validation
```

---

## 3. Fabric Binaries & Docker Images

### 3.1 Binaries Installed & Verified
All binaries are installed in `/home/viswa_r07/blockchain-identity/fabric-samples/bin` and symlinked to `/usr/local/bin` for system-wide availability in WSL2:
- `peer version`: `v2.5.16` (Commit `f871cf9`, Go `go1.26.4`)
- `orderer version`: `v2.5.16` (Commit `f871cf9`, Go `go1.26.4`)
- `cryptogen version`: `v2.5.16` (Commit `f871cf9`, Go `go1.26.4`)
- `configtxgen -version`: `v2.5.16` (Commit `f871cf9`, Go `go1.26.4`)
- `fabric-ca-client version`: `v1.5.17` (Go `go1.25.7`)

### 3.2 Docker Images Present
- `hyperledger/fabric-peer:2.5.16` / `latest`
- `hyperledger/fabric-orderer:2.5.16` / `latest`
- `hyperledger/fabric-ca:1.5.17` / `latest`
- `hyperledger/fabric-ccenv:2.5.16` / `latest`
- `hyperledger/fabric-baseos:2.5.16` / `latest`
- `hyperledger/fabric-nodeenv:2.5` / `latest` (cached to support Node.js/TypeScript chaincode)

---

## 4. Operational Runbook

All commands should be executed within WSL2 Ubuntu (`wsl -d Ubuntu`).

### 4.1 Prerequisites Setup
```bash
# Ensure jq, curl, git, and docker are installed in Ubuntu
sudo apt-get update && sudo apt-get install -y jq curl git docker.io
```

### 4.2 Start the Network with Certificate Authorities & Create Channel
```bash
cd /home/viswa_r07/blockchain-identity/fabric-samples/test-network

# Bring up the network with Org1 CA, Org2 CA, Orderer CA, and create 'mychannel'
./network.sh up createChannel -ca -c mychannel
```

Containers started:
- `orderer.example.com` (Ordering Service)
- `peer0.org1.example.com` (Org1 Peer)
- `peer0.org2.example.com` (Org2 Peer)
- `ca_orderer` (Orderer CA)
- `ca_org1` (Org1 CA)
- `ca_org2` (Org2 CA)

### 4.3 Deploy Chaincode (Lifecycle v2.0)
```bash
cd /home/viswa_r07/blockchain-identity/fabric-samples/test-network

# Deploy the asset-transfer-basic chaincode using JavaScript/Node runtime
./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-javascript -ccl javascript
```

### 4.4 Test Ledger Read / Write Interactions
Run the included verification script:
```bash
/home/viswa_r07/blockchain-identity/verify_ledger.sh
```

Or manually interact via Peer CLI:
```bash
cd /home/viswa_r07/blockchain-identity/fabric-samples/test-network
source scripts/envVar.sh
setGlobals 1
export FABRIC_CFG_PATH=/home/viswa_r07/blockchain-identity/fabric-samples/config

# 1. Query all assets
peer chaincode query -C mychannel -n basic -c '{"Args":["GetAllAssets"]}'

# 2. Invoke InitLedger (requires endorsement from both Org1 and Org2)
peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile "$ORDERER_CA" \
  -C mychannel \
  -n basic \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles "$PEER0_ORG1_CA" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "$PEER0_ORG2_CA" \
  -c '{"function":"InitLedger","Args":[]}'

# 3. Query specific asset
peer chaincode query -C mychannel -n basic -c '{"Args":["ReadAsset","asset1"]}'

# 4. Invoke CreateAsset
peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile "$ORDERER_CA" \
  -C mychannel \
  -n basic \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles "$PEER0_ORG1_CA" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "$PEER0_ORG2_CA" \
  -c '{"function":"CreateAsset","Args":["asset7","violet","15","GovIdentity","450"]}'
```

### 4.5 Stop the Network
```bash
cd /home/viswa_r07/blockchain-identity/fabric-samples/test-network
./network.sh down
```

### 4.6 Reset / Clean the Test Network
The `./network.sh down` command completely tears down containers, deletes crypto certificates (`organizations/peerOrganizations`, `organizations/ordererOrganizations`), removes generated channel blocks, and cleans chaincode images.

---

## 5. Verification Results Log

1. **Pre-Invoke Query:**
   ```json
   []
   ```
2. **InitLedger Invoke:**
   `Chaincode invoke successful. result: status:200`
3. **Post-Invoke Query (GetAllAssets):**
   Ledger returned 6 initialized assets (`asset1` through `asset6`) populated with attributes (AppraisedValue, Color, Owner, Size).
4. **Custom Asset Creation Invoke:**
   Created asset `asset7` (Color: `violet`, Owner: `GovIdentity`, AppraisedValue: `450`).
5. **Post-Create Query (ReadAsset `asset7`):**
   ```json
   {
     "AppraisedValue": 450,
     "Color": "violet",
     "ID": "asset7",
     "Owner": "GovIdentity",
     "Size": 15
   }
   ```

---

## 6. Compatibility Decisions & Troubleshooting Notes

1. **Working Directory Location:**
   Running Hyperledger Fabric test networks directly on Windows 9P mount paths (e.g. `/mnt/c/Users/...`) causes permission drift on TLS private key files (`0644` vs `0600`), line-ending discrepancies (`CRLF` vs `LF`), and degraded I/O performance. As required, the environment was established entirely within WSL2 Linux root (`/home/viswa_r07/blockchain-identity/`), keeping the Windows OneDrive project purely for documentation and IDE project tracking.

2. **Docker In Docker & Chaincode Execution (`fabric-nodeenv`):**
   The standard Fabric 2.5 installer script pulls `fabric-peer`, `fabric-orderer`, `fabric-ccenv`, `fabric-baseos`, and `fabric-ca`. When deploying a Node.js chaincode under standard Docker orchestration, the peer requires `hyperledger/fabric-nodeenv:2.5` to construct the chaincode container image. Because it was not pre-pulled by default, an initial simulation timeout occurred. Pre-pulling and tagging `hyperledger/fabric-nodeenv:2.5` immediately solved this issue, allowing seamless packaging and execution.

3. **Binary Availability across Shells:**
   Instead of relying exclusively on user profile scripts, symlinks were created in `/usr/local/bin` for all Fabric binaries (`peer`, `orderer`, `cryptogen`, `configtxgen`, `fabric-ca-client`, etc.), ensuring both interactive and non-interactive scripts can invoke Fabric tools without path errors.
