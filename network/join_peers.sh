#!/bin/bash
set -euo pipefail

export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=/home/viswa_r07/blockchain-identity/fabric-samples/config
NET=/home/viswa_r07/blockchain-identity/network
BLOCK_FILE="${NET}/channel-artifacts/identity-channel.block"

join_peer() {
  local ORG_NAME=$1
  local MSP_ID=$2
  local PEER_HOST=$3
  local PEER_PORT=$4

  echo "--------------------------------------------------------"
  echo "Joining ${PEER_HOST} (${MSP_ID}) on port ${PEER_PORT}..."
  echo "--------------------------------------------------------"

  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP_ID}"
  export CORE_PEER_TLS_ROOTCERT_FILE="${NET}/organizations/peerOrganizations/${ORG_NAME}/peers/${PEER_HOST}/tls/ca.crt"
  export CORE_PEER_MSPCONFIGPATH="${NET}/organizations/peerOrganizations/${ORG_NAME}/users/Admin@${ORG_NAME}/msp"
  export CORE_PEER_ADDRESS="localhost:${PEER_PORT}"

  peer channel join -b "${BLOCK_FILE}"
}

echo "========================================================"
echo "Starting Peer Channel Join for identity-channel"
echo "========================================================"

# Gov peers
join_peer "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
join_peer "gov.identity.example.com" "GovMSP" "peer1.gov.identity.example.com" 7052

# Uni peers
join_peer "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
join_peer "university.example.com" "UniversityMSP" "peer1.university.example.com" 8052

# Bank peers
join_peer "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
join_peer "bank.example.com" "BankMSP" "peer1.bank.example.com" 9052

# Employer peers
join_peer "employer.example.com" "EmployerMSP" "peer0.employer.example.com" 10051
join_peer "employer.example.com" "EmployerMSP" "peer1.employer.example.com" 10052

echo "========================================================"
echo "Verifying channel membership across all 8 peers"
echo "========================================================"

verify_peer() {
  local ORG_NAME=$1
  local MSP_ID=$2
  local PEER_HOST=$3
  local PEER_PORT=$4

  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP_ID}"
  export CORE_PEER_TLS_ROOTCERT_FILE="${NET}/organizations/peerOrganizations/${ORG_NAME}/peers/${PEER_HOST}/tls/ca.crt"
  export CORE_PEER_MSPCONFIGPATH="${NET}/organizations/peerOrganizations/${ORG_NAME}/users/Admin@${ORG_NAME}/msp"
  export CORE_PEER_ADDRESS="localhost:${PEER_PORT}"

  echo "=== ${PEER_HOST} (port ${PEER_PORT}) ==="
  peer channel list
  peer channel getinfo -c identity-channel
}

verify_peer "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
verify_peer "gov.identity.example.com" "GovMSP" "peer1.gov.identity.example.com" 7052
verify_peer "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
verify_peer "university.example.com" "UniversityMSP" "peer1.university.example.com" 8052
verify_peer "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
verify_peer "bank.example.com" "BankMSP" "peer1.bank.example.com" 9052
verify_peer "employer.example.com" "EmployerMSP" "peer0.employer.example.com" 10051
verify_peer "employer.example.com" "EmployerMSP" "peer1.employer.example.com" 10052

echo "========================================================"
echo "All 8 peers successfully joined identity-channel!"
echo "========================================================"
