#!/bin/bash
set -uo pipefail

export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=/home/viswa_r07/blockchain-identity/fabric-samples/config

NET=/home/viswa_r07/blockchain-identity/network
ORDERER_CA="${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/ca.crt"
CHANNEL_NAME="identity-channel"
CC_NAME="identity-registry"

GOV_CA="${NET}/organizations/peerOrganizations/gov.identity.example.com/peers/peer0.gov.identity.example.com/tls/ca.crt"
UNI_CA="${NET}/organizations/peerOrganizations/university.example.com/peers/peer0.university.example.com/tls/ca.crt"
BANK_CA="${NET}/organizations/peerOrganizations/bank.example.com/peers/peer0.bank.example.com/tls/ca.crt"

set_peer_env() {
  local ORG=$1
  local MSP=$2
  local PEER=$3
  local PORT=$4

  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP}"
  export CORE_PEER_TLS_ROOTCERT_FILE="${NET}/organizations/peerOrganizations/${ORG}/peers/${PEER}/tls/ca.crt"
  export CORE_PEER_MSPCONFIGPATH="${NET}/organizations/peerOrganizations/${ORG}/users/Admin@${ORG}/msp"
  export CORE_PEER_ADDRESS="localhost:${PORT}"
}

set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051

echo "Testing 2-of-4 Endorsement (Gov + University only)..."
OUTPUT_2OF4=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  -c "{\"function\":\"RegisterIdentity\",\"Args\":[\"did:example:test_endorse_2of4\",\"1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff\"]}" \
  --waitForEvent 2>&1 || true)

echo "=== Output from 2-of-4 Invoke ==="
echo "${OUTPUT_2OF4}"

echo "Testing 3-of-4 Endorsement (Gov + University + Bank)..."
OUTPUT_3OF4=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"RegisterIdentity\",\"Args\":[\"did:example:test_endorse_3of4\",\"2222333344445555666677778888999900001111aaaabbbbccccddddeeeeffff\"]}" \
  --waitForEvent 2>&1 || true)

echo "=== Output from 3-of-4 Invoke ==="
echo "${OUTPUT_3OF4}"
