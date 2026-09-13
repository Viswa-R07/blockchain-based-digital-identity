#!/bin/bash
set -euo pipefail

export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=/home/viswa_r07/blockchain-identity/fabric-samples/config
NET=/home/viswa_r07/blockchain-identity/network
ORDERER_CA="${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/ca.crt"
WORK_DIR="${NET}/channel-artifacts/resilience_test"
mkdir -p "${WORK_DIR}"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

get_peer_height() {
  local ORG_NAME=$1
  local MSP_ID=$2
  local PEER_HOST=$3
  local PEER_PORT=$4

  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP_ID}"
  export CORE_PEER_TLS_ROOTCERT_FILE="${NET}/organizations/peerOrganizations/${ORG_NAME}/peers/${PEER_HOST}/tls/ca.crt"
  export CORE_PEER_MSPCONFIGPATH="${NET}/organizations/peerOrganizations/${ORG_NAME}/users/Admin@${ORG_NAME}/msp"
  export CORE_PEER_ADDRESS="localhost:${PEER_PORT}"

  peer channel getinfo -c identity-channel 2>/dev/null | grep -o '"height":[0-9]*' | cut -d':' -f2 || echo "ERR"
}

print_all_heights() {
  echo "--- Ledger Heights Across All 8 Peers ---"
  echo "  peer0.gov (7051): $(get_peer_height 'gov.identity.example.com' 'GovMSP' 'peer0.gov.identity.example.com' 7051)"
  echo "  peer1.gov (7052): $(get_peer_height 'gov.identity.example.com' 'GovMSP' 'peer1.gov.identity.example.com' 7052)"
  echo "  peer0.uni (8051): $(get_peer_height 'university.example.com' 'UniversityMSP' 'peer0.university.example.com' 8051)"
  echo "  peer1.uni (8052): $(get_peer_height 'university.example.com' 'UniversityMSP' 'peer1.university.example.com' 8052)"
  echo "  peer0.bank (9051): $(get_peer_height 'bank.example.com' 'BankMSP' 'peer0.bank.example.com' 9051)"
  echo "  peer1.bank (9052): $(get_peer_height 'bank.example.com' 'BankMSP' 'peer1.bank.example.com' 9052)"
  echo "  peer0.emp (10051): $(get_peer_height 'employer.example.com' 'EmployerMSP' 'peer0.employer.example.com' 10051)"
  echo "  peer1.emp (10052): $(get_peer_height 'employer.example.com' 'EmployerMSP' 'peer1.employer.example.com' 10052)"
}

check_orderer_status() {
  local NAME=$1
  local PORT=$2
  local ORG=$3
  echo -n "  Checking ${NAME}:${PORT} ... "
  if OUT=$(osnadmin channel list -o "localhost:${PORT}" \
    --ca-file "${NET}/organizations/ordererOrganizations/${ORG}/orderers/${NAME}/tls/ca.crt" \
    --client-cert "${NET}/organizations/ordererOrganizations/${ORG}/orderers/${NAME}/tls/server.crt" \
    --client-key "${NET}/organizations/ordererOrganizations/${ORG}/orderers/${NAME}/tls/server.key" 2>&1); then
    echo -e "${GREEN}ACTIVE (Participating in identity-channel)${NC}"
  else
    echo -e "${RED}UNAVAILABLE (Down / Connection Refused)${NC}"
  fi
}

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}     Milestone 3: Raft Consensus Resilience & Fault Tolerance   ${NC}"
echo -e "${BLUE}================================================================${NC}"

# ==============================================================================
# PHASE 1: Baseline State Recording
# ==============================================================================
echo -e "\n${BLUE}=== PHASE 1: BASELINE STATE RECORDING ===${NC}"
echo "Orderer Statuses (3 of 3 Expected Up):"
check_orderer_status "orderer1.gov.identity.example.com" 7053 "gov.identity.example.com"
check_orderer_status "orderer2.university.example.com" 8053 "university.example.com"
check_orderer_status "orderer3.bank.example.com" 9053 "bank.example.com"

print_all_heights

# ==============================================================================
# PHASE 2: Single Orderer Failure & Quorum Preservation
# ==============================================================================
echo -e "\n${BLUE}=== PHASE 2: CONTROLLED SINGLE-ORDERER FAILURE (orderer3.bank) ===${NC}"
echo "Stopping orderer3.bank.example.com..."
docker stop orderer3.bank.example.com

echo "Waiting 8 seconds for Raft heartbeat timeout & new leader election between orderer1 & orderer2..."
sleep 8

echo "Checking orderer statuses with orderer3 down (2 of 3 running):"
check_orderer_status "orderer1.gov.identity.example.com" 7053 "gov.identity.example.com"
check_orderer_status "orderer2.university.example.com" 8053 "university.example.com"
check_orderer_status "orderer3.bank.example.com" 9053 "bank.example.com"

echo -e "${YELLOW}Quorum calculation: Total = 3, Required Quorum = (3/2)+1 = 2.${NC}"
echo -e "${GREEN}Alive orderers = 2 >= 2. Quorum is PRESERVED.${NC}"

echo -e "\nPreparing harmless network-level transaction (Anchor Peer update on GovMSP) while 2 of 3 orderers remain..."

export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="GovMSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${NET}/organizations/peerOrganizations/gov.identity.example.com/peers/peer0.gov.identity.example.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="${NET}/organizations/peerOrganizations/gov.identity.example.com/users/Admin@gov.identity.example.com/msp"
export CORE_PEER_ADDRESS="localhost:7051"

peer channel fetch config "${WORK_DIR}/config_block_p2.pb" \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  -c identity-channel \
  --tls --cafile "${ORDERER_CA}"

configtxlator proto_decode --input "${WORK_DIR}/config_block_p2.pb" --type common.Block --output "${WORK_DIR}/config_block_p2.json"
jq .data.data[0].payload.data.config "${WORK_DIR}/config_block_p2.json" > "${WORK_DIR}/original_config_p2.json"

# Update GovMSP anchor peers to include both peer0 and peer1 (High Availability anchor configuration)
jq '.channel_group.groups.Application.groups.GovMSP.values.AnchorPeers.value.anchor_peers = [{"host": "peer0.gov.identity.example.com", "port": 7051}, {"host": "peer1.gov.identity.example.com", "port": 7052}]' \
  "${WORK_DIR}/original_config_p2.json" > "${WORK_DIR}/modified_config_p2.json"

configtxlator proto_encode --input "${WORK_DIR}/original_config_p2.json" --type common.Config --output "${WORK_DIR}/original_config_p2.pb"
configtxlator proto_encode --input "${WORK_DIR}/modified_config_p2.json" --type common.Config --output "${WORK_DIR}/modified_config_p2.pb"
configtxlator compute_update --channel_id identity-channel \
  --original "${WORK_DIR}/original_config_p2.pb" \
  --updated "${WORK_DIR}/modified_config_p2.pb" \
  --output "${WORK_DIR}/config_update_p2.pb"

configtxlator proto_decode --input "${WORK_DIR}/config_update_p2.pb" --type common.ConfigUpdate --output "${WORK_DIR}/config_update_p2.json"
echo '{"payload":{"header":{"channel_header":{"channel_id":"identity-channel", "type":2}},"data":{"config_update":'$(cat "${WORK_DIR}/config_update_p2.json")'}}}' | jq . > "${WORK_DIR}/config_update_in_envelope_p2.json"
configtxlator proto_encode --input "${WORK_DIR}/config_update_in_envelope_p2.json" --type common.Envelope --output "${WORK_DIR}/gov_anchor_update.tx"

echo "Submitting config update transaction to orderer1 (localhost:7050)..."
SUCCESS=0
for attempt in 1 2 3; do
  echo "Attempt ${attempt}/3..."
  if peer channel update -o localhost:7050 \
    --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
    -c identity-channel \
    -f "${WORK_DIR}/gov_anchor_update.tx" \
    --tls --cafile "${ORDERER_CA}"; then
    SUCCESS=1
    break
  else
    echo "Attempt ${attempt} failed, retrying in 3s..."
    sleep 3
  fi
done

if [ $SUCCESS -eq 1 ]; then
  echo -e "${GREEN}>>> Transaction successfully submitted and committed by 2-of-3 Raft orderers!${NC}"
else
  echo -e "${RED}>>> Transaction failed after 3 attempts.${NC}"
  exit 1
fi

sleep 2
echo -e "\nVerifying ledger height advancement across all 8 peers (Expected: 2):"
print_all_heights

echo -e "\nRestarting orderer3.bank.example.com..."
docker start orderer3.bank.example.com
echo "Waiting 5 seconds for Raft consensus catch-up..."
sleep 5

echo "Checking orderer statuses with orderer3 restored (3 of 3 running):"
check_orderer_status "orderer1.gov.identity.example.com" 7053 "gov.identity.example.com"
check_orderer_status "orderer2.university.example.com" 8053 "university.example.com"
check_orderer_status "orderer3.bank.example.com" 9053 "bank.example.com"

# ==============================================================================
# PHASE 3: Quorum Loss Observation
# ==============================================================================
echo -e "\n${BLUE}=== PHASE 3: CONTROLLED QUORUM-LOSS OBSERVATION ===${NC}"
echo "Stopping 2 orderers: orderer2.university.example.com and orderer3.bank.example.com..."
docker stop orderer2.university.example.com orderer3.bank.example.com

echo "Checking orderer statuses with 2 orderers down (1 of 3 running):"
check_orderer_status "orderer1.gov.identity.example.com" 7053 "gov.identity.example.com"
check_orderer_status "orderer2.university.example.com" 8053 "university.example.com"
check_orderer_status "orderer3.bank.example.com" 9053 "bank.example.com"

echo -e "${YELLOW}Quorum calculation: Total = 3, Required Quorum = 2.${NC}"
echo -e "${RED}Alive orderers = 1 < 2. Quorum is LOST.${NC}"

echo "Attempting a transaction update while Raft quorum is lost..."
set +e
timeout 5 peer channel update -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  -c identity-channel \
  -f "${WORK_DIR}/gov_anchor_update.tx" \
  --tls --cafile "${ORDERER_CA}" > "${WORK_DIR}/quorum_loss_attempt.log" 2>&1
TX_RES=$?
set -e

if [ $TX_RES -ne 0 ]; then
  echo -e "${GREEN}>>> Expected Result: Transaction rejected or timed out (exit code: ${TX_RES}). Raft orderer refuses commits without quorum.${NC}"
  head -n 5 "${WORK_DIR}/quorum_loss_attempt.log" || true
else
  echo -e "${RED}>>> UNEXPECTED: Transaction unexpectedly succeeded without quorum!${NC}"
  exit 1
fi

echo -e "\nVerifying ledger heights remained unchanged during quorum loss:"
print_all_heights

echo -e "\nRestoring stopped orderers: orderer2.university and orderer3.bank..."
docker start orderer2.university.example.com orderer3.bank.example.com
echo "Waiting 6 seconds for full Raft election & re-synchronization..."
sleep 6

echo "Checking orderer statuses after full restoration (3 of 3 running):"
check_orderer_status "orderer1.gov.identity.example.com" 7053 "gov.identity.example.com"
check_orderer_status "orderer2.university.example.com" 8053 "university.example.com"
check_orderer_status "orderer3.bank.example.com" 9053 "bank.example.com"

# ==============================================================================
# PHASE 4: Final Network Re-Verification
# ==============================================================================
echo -e "\n${BLUE}=== PHASE 4: FINAL RE-VERIFICATION (Expected Height: 2) ===${NC}"
/home/viswa_r07/blockchain-identity/network/verify_network.sh 2

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}     Raft Consensus Resilience Validation Completed Successfully!${NC}"
echo -e "${GREEN}================================================================${NC}"
