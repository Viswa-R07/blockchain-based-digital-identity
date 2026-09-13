#!/bin/bash
set -euo pipefail

export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=/home/viswa_r07/blockchain-identity/fabric-samples/config
NET=/home/viswa_r07/blockchain-identity/network
ORDERER_CA="${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/ca.crt"
ORDERER_ADMIN_LISTEN="localhost:7050"
CHANNEL_NAME="identity-channel"
WORK_DIR="${NET}/channel-artifacts/anchor_update"
mkdir -p "${WORK_DIR}"

set_anchor_for_org() {
  local ORG_NAME=$1
  local MSP_ID=$2
  local PEER_HOST=$3
  local PEER_PORT=$4
  local ANCHOR_HOST=$5
  local ANCHOR_PORT=$6

  echo "--------------------------------------------------------"
  echo "Setting Anchor Peer for ${MSP_ID} -> ${ANCHOR_HOST}:${ANCHOR_PORT}"
  echo "--------------------------------------------------------"

  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP_ID}"
  export CORE_PEER_TLS_ROOTCERT_FILE="${NET}/organizations/peerOrganizations/${ORG_NAME}/peers/${PEER_HOST}/tls/ca.crt"
  export CORE_PEER_MSPCONFIGPATH="${NET}/organizations/peerOrganizations/${ORG_NAME}/users/Admin@${ORG_NAME}/msp"
  export CORE_PEER_ADDRESS="localhost:${PEER_PORT}"

  # 1. Fetch current config block
  peer channel fetch config "${WORK_DIR}/${MSP_ID}_config_block.pb" \
    -o "${ORDERER_ADMIN_LISTEN}" \
    --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
    -c "${CHANNEL_NAME}" \
    --tls --cafile "${ORDERER_CA}"

  # 2. Decode block to JSON and isolate config
  configtxlator proto_decode --input "${WORK_DIR}/${MSP_ID}_config_block.pb" --type common.Block --output "${WORK_DIR}/${MSP_ID}_config_block.json"
  jq .data.data[0].payload.data.config "${WORK_DIR}/${MSP_ID}_config_block.json" > "${WORK_DIR}/${MSP_ID}_config.json"

  # 3. Add AnchorPeers to the organization config
  jq '.channel_group.groups.Application.groups.'${MSP_ID}'.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "'${ANCHOR_HOST}'","port": '${ANCHOR_PORT}'}]},"version": "0"}}' \
    "${WORK_DIR}/${MSP_ID}_config.json" > "${WORK_DIR}/${MSP_ID}_modified_config.json"

  # 4. Compute config update
  configtxlator proto_encode --input "${WORK_DIR}/${MSP_ID}_config.json" --type common.Config --output "${WORK_DIR}/${MSP_ID}_original_config.pb"
  configtxlator proto_encode --input "${WORK_DIR}/${MSP_ID}_modified_config.json" --type common.Config --output "${WORK_DIR}/${MSP_ID}_modified_config.pb"
  configtxlator compute_update --channel_id "${CHANNEL_NAME}" \
    --original "${WORK_DIR}/${MSP_ID}_original_config.pb" \
    --updated "${WORK_DIR}/${MSP_ID}_modified_config.pb" \
    --output "${WORK_DIR}/${MSP_ID}_config_update.pb"

  configtxlator proto_decode --input "${WORK_DIR}/${MSP_ID}_config_update.pb" --type common.ConfigUpdate --output "${WORK_DIR}/${MSP_ID}_config_update.json"
  echo '{"payload":{"header":{"channel_header":{"channel_id":"'${CHANNEL_NAME}'", "type":2}},"data":{"config_update":'$(cat "${WORK_DIR}/${MSP_ID}_config_update.json")'}}}' | jq . > "${WORK_DIR}/${MSP_ID}_config_update_in_envelope.json"
  configtxlator proto_encode --input "${WORK_DIR}/${MSP_ID}_config_update_in_envelope.json" --type common.Envelope --output "${WORK_DIR}/${MSP_ID}_anchors.tx"

  # 5. Submit anchor peer update transaction
  peer channel update -o "${ORDERER_ADMIN_LISTEN}" \
    --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
    -c "${CHANNEL_NAME}" \
    -f "${WORK_DIR}/${MSP_ID}_anchors.tx" \
    --tls --cafile "${ORDERER_CA}"

  echo "Anchor peer successfully updated for ${MSP_ID}!"
}

# Update anchor peers for all 4 orgs
set_anchor_for_org "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051 "peer0.gov.identity.example.com" 7051
set_anchor_for_org "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051 "peer0.university.example.com" 8051
set_anchor_for_org "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051 "peer0.bank.example.com" 9051
set_anchor_for_org "employer.example.com" "EmployerMSP" "peer0.employer.example.com" 10051 "peer0.employer.example.com" 10051

echo "========================================================"
echo "All 4 Organizations have Anchor Peers configured!"
echo "========================================================"
