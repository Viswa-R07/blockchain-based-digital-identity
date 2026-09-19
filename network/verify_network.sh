#!/bin/bash
set -euo pipefail

export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=/home/viswa_r07/blockchain-identity/fabric-samples/config
NET=/home/viswa_r07/blockchain-identity/network
ORDERER_CA="${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/ca.crt"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

echo -e "${BLUE}==============================================================${NC}"
echo -e "${BLUE}     Milestone 3: 4-Org Permissioned Network Verification      ${NC}"
echo -e "${BLUE}==============================================================${NC}"

# Optional expected height parameter (default: auto-check consistency)
EXPECTED_HEIGHT=${1:-""}

# 1. Container Verification
echo -e "\n${BLUE}[1/6] Verifying Running Docker Containers (Expected: 27)${NC}"
CONTAINER_COUNT=$(docker ps -q | wc -l)
echo "Total running containers: ${CONTAINER_COUNT}"

EXPECTED_CONTAINERS=(
  "ca.gov.identity.example.com"
  "ca.university.example.com"
  "ca.bank.example.com"
  "ca.employer.example.com"
  "orderer1.gov.identity.example.com"
  "orderer2.university.example.com"
  "orderer3.bank.example.com"
  "couchdb0.gov"
  "couchdb1.gov"
  "couchdb0.uni"
  "couchdb1.uni"
  "couchdb0.bank"
  "couchdb1.bank"
  "couchdb0.emp"
  "couchdb1.emp"
  "peer0.gov.identity.example.com"
  "peer1.gov.identity.example.com"
  "peer0.university.example.com"
  "peer1.university.example.com"
  "peer0.bank.example.com"
  "peer1.bank.example.com"
  "peer0.employer.example.com"
  "peer1.employer.example.com"
)

MISSING=0
for c in "${EXPECTED_CONTAINERS[@]}"; do
  if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
    echo -e "  [+] ${c} ... ${GREEN}RUNNING${NC}"
  else
    echo -e "  [-] ${c} ... ${RED}MISSING/STOPPED${NC}"
    MISSING=$((MISSING + 1))
    ERRORS=$((ERRORS + 1))
  fi
done

CC_ORGS=("gov" "university" "bank" "employer")
for org in "${CC_ORGS[@]}"; do
  if docker ps --format '{{.Names}}' | grep -q "dev-peer0\.${org}\..*identity-registry"; then
    CC_NAME=$(docker ps --format '{{.Names}}' | grep "dev-peer0\.${org}\..*identity-registry" | head -1)
    echo -e "  [+] ${CC_NAME} ... ${GREEN}RUNNING${NC}"
  else
    echo -e "  [-] dev-peer0.${org} chaincode (identity-registry) ... ${RED}MISSING/STOPPED${NC}"
    MISSING=$((MISSING + 1))
    ERRORS=$((ERRORS + 1))
  fi
done

if [ "$MISSING" -eq 0 ] && [ "$CONTAINER_COUNT" -eq 27 ]; then
  echo -e "${GREEN}>>> All 27 expected containers (23 Fabric nodes + 4 chaincode instances) are active and running.${NC}"
else
  echo -e "${RED}>>> Container verification failed! Missing: ${MISSING}, Total: ${CONTAINER_COUNT} (Expected: 27)${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 2. CouchDB Health & Ping
echo -e "\n${BLUE}[2/6] Verifying CouchDB Endpoints (8 Dedicated Instances)${NC}"
COUCH_PORTS=(5984 5985 6984 6985 7984 7985 8984 8985)
for port in "${COUCH_PORTS[@]}"; do
  STATUS=$(curl -s -u admin:adminpw "http://localhost:${port}/" | jq -r .couchdb 2>/dev/null || echo "fail")
  if [ "$STATUS" == "Welcome" ]; then
    echo -e "  [+] CouchDB on port ${port} ... ${GREEN}OK (Welcome)${NC}"
  else
    echo -e "  [-] CouchDB on port ${port} ... ${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
  fi
done

# 3. Orderer Channel Participation
echo -e "\n${BLUE}[3/6] Verifying Raft Consensus & Orderer Channel Participation${NC}"
check_orderer() {
  local NAME=$1
  local PORT=$2
  local ORG=$3
  echo "Checking ${NAME} on port ${PORT}..."
  if ! OUT=$(osnadmin channel list -o "localhost:${PORT}" \
    --ca-file "${NET}/organizations/ordererOrganizations/${ORG}/orderers/${NAME}/tls/ca.crt" \
    --client-cert "${NET}/organizations/ordererOrganizations/${ORG}/orderers/${NAME}/tls/server.crt" \
    --client-key "${NET}/organizations/ordererOrganizations/${ORG}/orderers/${NAME}/tls/server.key" 2>&1); then
    echo -e "  [-] ${NAME} query failed: ${OUT} ... ${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
  else
    if echo "$OUT" | grep -q "identity-channel"; then
      echo -e "  [+] ${NAME} participates in identity-channel ... ${GREEN}ACTIVE${NC}"
    else
      echo -e "  [-] ${NAME} not participating in identity-channel ... ${RED}FAILED${NC}"
      ERRORS=$((ERRORS + 1))
    fi
  fi
}

check_orderer "orderer1.gov.identity.example.com" 7053 "gov.identity.example.com"
check_orderer "orderer2.university.example.com" 8053 "university.example.com"
check_orderer "orderer3.bank.example.com" 9053 "bank.example.com"

# 4. Peer Channel Membership
echo -e "\n${BLUE}[4/6] Verifying Channel Membership on all 8 Peers${NC}"
check_peer_channel() {
  local ORG_NAME=$1
  local MSP_ID=$2
  local PEER_HOST=$3
  local PEER_PORT=$4

  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP_ID}"
  export CORE_PEER_TLS_ROOTCERT_FILE="${NET}/organizations/peerOrganizations/${ORG_NAME}/peers/${PEER_HOST}/tls/ca.crt"
  export CORE_PEER_MSPCONFIGPATH="${NET}/organizations/peerOrganizations/${ORG_NAME}/users/Admin@${ORG_NAME}/msp"
  export CORE_PEER_ADDRESS="localhost:${PEER_PORT}"

  if ! CHANNELS=$(peer channel list 2>&1); then
    echo -e "  [-] ${PEER_HOST}:${PEER_PORT} (${MSP_ID}) connection failed ... ${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
  elif echo "$CHANNELS" | grep -q "identity-channel"; then
    echo -e "  [+] ${PEER_HOST}:${PEER_PORT} (${MSP_ID}) joined ... ${GREEN}identity-channel${NC}"
  else
    echo -e "  [-] ${PEER_HOST}:${PEER_PORT} (${MSP_ID}) ... ${RED}NOT JOINED${NC}"
    ERRORS=$((ERRORS + 1))
  fi
}

check_peer_channel "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
check_peer_channel "gov.identity.example.com" "GovMSP" "peer1.gov.identity.example.com" 7052
check_peer_channel "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
check_peer_channel "university.example.com" "UniversityMSP" "peer1.university.example.com" 8052
check_peer_channel "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
check_peer_channel "bank.example.com" "BankMSP" "peer1.bank.example.com" 9052
check_peer_channel "employer.example.com" "EmployerMSP" "peer0.employer.example.com" 10051
check_peer_channel "employer.example.com" "EmployerMSP" "peer1.employer.example.com" 10052

# 5. Ledger Height & Blockchain Info Consistency
echo -e "\n${BLUE}[5/6] Verifying Ledger Block Height Consistency on all 8 Peers${NC}"
FIRST_HEIGHT=""
HEIGHT_MISMATCH=0

check_peer_height() {
  local ORG_NAME=$1
  local MSP_ID=$2
  local PEER_HOST=$3
  local PEER_PORT=$4

  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP_ID}"
  export CORE_PEER_TLS_ROOTCERT_FILE="${NET}/organizations/peerOrganizations/${ORG_NAME}/peers/${PEER_HOST}/tls/ca.crt"
  export CORE_PEER_MSPCONFIGPATH="${NET}/organizations/peerOrganizations/${ORG_NAME}/users/Admin@${ORG_NAME}/msp"
  export CORE_PEER_ADDRESS="localhost:${PEER_PORT}"

  if ! INFO=$(peer channel getinfo -c identity-channel 2>&1); then
    echo -e "  [-] ${PEER_HOST}:${PEER_PORT} getinfo failed ... ${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
    return
  fi

  HEIGHT=$(echo "$INFO" | grep -o '"height":[0-9]*' | cut -d':' -f2 || echo "0")
  if [ -z "$HEIGHT" ] || [ "$HEIGHT" -lt 1 ]; then
    echo -e "  [-] ${PEER_HOST}:${PEER_PORT} invalid height (${HEIGHT}) ... ${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
    return
  fi

  if [ -z "$FIRST_HEIGHT" ]; then
    FIRST_HEIGHT="$HEIGHT"
  elif [ "$HEIGHT" != "$FIRST_HEIGHT" ]; then
    echo -e "  [-] ${PEER_HOST}:${PEER_PORT} height (${HEIGHT}) != reference height (${FIRST_HEIGHT}) ... ${RED}MISMATCH${NC}"
    HEIGHT_MISMATCH=$((HEIGHT_MISMATCH + 1))
    ERRORS=$((ERRORS + 1))
    return
  fi

  if [ -n "$EXPECTED_HEIGHT" ] && [ "$HEIGHT" != "$EXPECTED_HEIGHT" ]; then
    echo -e "  [-] ${PEER_HOST}:${PEER_PORT} height (${HEIGHT}) != expected (${EXPECTED_HEIGHT}) ... ${RED}MISMATCH${NC}"
    ERRORS=$((ERRORS + 1))
    return
  fi

  echo -e "  [+] ${PEER_HOST}:${PEER_PORT} ... ${GREEN}height: ${HEIGHT}${NC}"
}

check_peer_height "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
check_peer_height "gov.identity.example.com" "GovMSP" "peer1.gov.identity.example.com" 7052
check_peer_height "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
check_peer_height "university.example.com" "UniversityMSP" "peer1.university.example.com" 8052
check_peer_height "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
check_peer_height "bank.example.com" "BankMSP" "peer1.bank.example.com" 9052
check_peer_height "employer.example.com" "EmployerMSP" "peer0.employer.example.com" 10051
check_peer_height "employer.example.com" "EmployerMSP" "peer1.employer.example.com" 10052

if [ "$HEIGHT_MISMATCH" -eq 0 ] && [ -n "$FIRST_HEIGHT" ]; then
  echo -e "${GREEN}>>> Ledger height is consistent across all 8 peers (height: ${FIRST_HEIGHT}).${NC}"
fi

# 6. Anchor Peer Verification
echo -e "\n${BLUE}[6/6] Verifying Anchor Peers in Channel Configuration${NC}"
if [ -f "${NET}/channel-artifacts/anchor_update/GovMSP_config.json" ]; then
  jq '.channel_group.groups.Application.groups | to_entries[] | "  [+] " + .key + " Anchor Peer: " + (.value.values.AnchorPeers.value.anchor_peers[0].host // "NONE") + ":" + ((.value.values.AnchorPeers.value.anchor_peers[0].port // 0) | tostring)' "${NET}/channel-artifacts/anchor_update/GovMSP_config.json" -r
else
  echo -e "  [!] Config json not found, checking dynamically..."
fi

echo -e "\n=============================================================="
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}  Milestone 3 Verification FAILED with ${ERRORS} error(s)!${NC}"
  echo -e "=============================================================="
  exit 1
else
  echo -e "${GREEN}  Milestone 3 Network Verification Passed with 0 errors!     ${NC}"
  echo -e "=============================================================="
  exit 0
fi
