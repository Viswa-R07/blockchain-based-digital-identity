#!/bin/bash
set -euo pipefail

export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=/home/viswa_r07/blockchain-identity/fabric-samples/config

NET=/home/viswa_r07/blockchain-identity/network
ORDERER_CA="${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/ca.crt"
PKG_FILE="${NET}/channel-artifacts/chaincode/identity-registry_1.0.tar.gz"

CC_NAME="identity-registry"
CC_VERSION="1.0"
CC_SEQUENCE=1
CHANNEL_NAME="identity-channel"
SIGNATURE_POLICY="OutOf(3, 'GovMSP.peer', 'UniversityMSP.peer', 'BankMSP.peer', 'EmployerMSP.peer')"

GOV_CA="${NET}/organizations/peerOrganizations/gov.identity.example.com/peers/peer0.gov.identity.example.com/tls/ca.crt"
UNI_CA="${NET}/organizations/peerOrganizations/university.example.com/peers/peer0.university.example.com/tls/ca.crt"
BANK_CA="${NET}/organizations/peerOrganizations/bank.example.com/peers/peer0.bank.example.com/tls/ca.crt"
EMP_CA="${NET}/organizations/peerOrganizations/employer.example.com/peers/peer0.employer.example.com/tls/ca.crt"

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

echo "========================================================="
echo " Installing ${CC_NAME}_${CC_VERSION} across all 4 Organizations"
echo "========================================================="

# 1. Install on GovMSP
echo "Installing on peer0.gov (7051)..."
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
peer lifecycle chaincode install "${PKG_FILE}" || true

# 2. Install on UniversityMSP
echo "Installing on peer0.uni (8051)..."
set_peer_env "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
peer lifecycle chaincode install "${PKG_FILE}" || true

# 3. Install on BankMSP
echo "Installing on peer0.bank (9051)..."
set_peer_env "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
peer lifecycle chaincode install "${PKG_FILE}" || true

# 4. Install on EmployerMSP
echo "Installing on peer0.emp (10051)..."
set_peer_env "employer.example.com" "EmployerMSP" "peer0.employer.example.com" 10051
peer lifecycle chaincode install "${PKG_FILE}" || true

# Extract package ID from queryinstalled
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
CC_PACKAGE_ID=$(peer lifecycle chaincode calculatepackageid "${PKG_FILE}")
echo ">>> Computed Package ID: ${CC_PACKAGE_ID}"

echo "========================================================="
echo " Approving Chaincode Definition across all 4 Orgs"
echo " Signature Policy: ${SIGNATURE_POLICY}"
echo "========================================================="

approve_for_org() {
  local ORG=$1
  local MSP=$2
  local PEER=$3
  local PORT=$4

  echo "Approving for ${MSP}..."
  set_peer_env "${ORG}" "${MSP}" "${PEER}" "${PORT}"
  peer lifecycle chaincode approveformyorg \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
    --tls --cafile "${ORDERER_CA}" \
    --channelID "${CHANNEL_NAME}" \
    --name "${CC_NAME}" \
    --version "${CC_VERSION}" \
    --package-id "${CC_PACKAGE_ID}" \
    --sequence "${CC_SEQUENCE}" \
    --signature-policy "${SIGNATURE_POLICY}"
}

approve_for_org "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
approve_for_org "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
approve_for_org "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
approve_for_org "employer.example.com" "EmployerMSP" "peer0.employer.example.com" 10051

echo "========================================================="
echo " Checking Commit Readiness"
echo "========================================================="
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
peer lifecycle chaincode checkcommitreadiness \
  --channelID "${CHANNEL_NAME}" \
  --name "${CC_NAME}" \
  --version "${CC_VERSION}" \
  --sequence "${CC_SEQUENCE}" \
  --signature-policy "${SIGNATURE_POLICY}" \
  --output json

echo "========================================================="
echo " Committing Chaincode Definition on ${CHANNEL_NAME}"
echo "========================================================="
peer lifecycle chaincode commit \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  --channelID "${CHANNEL_NAME}" \
  --name "${CC_NAME}" \
  --version "${CC_VERSION}" \
  --sequence "${CC_SEQUENCE}" \
  --signature-policy "${SIGNATURE_POLICY}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "${EMP_CA}"

echo "========================================================="
echo " Querying Committed Definition on all 4 Orgs"
echo "========================================================="
for org_spec in \
  "gov.identity.example.com GovMSP peer0.gov.identity.example.com 7051" \
  "university.example.com UniversityMSP peer0.university.example.com 8051" \
  "bank.example.com BankMSP peer0.bank.example.com 9051" \
  "employer.example.com EmployerMSP peer0.employer.example.com 10051"; do
  set -- ${org_spec}
  echo "Checking ${2}..."
  set_peer_env "$1" "$2" "$3" "$4"
  peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" --name "${CC_NAME}"
done

echo ">>> Chaincode ${CC_NAME}_${CC_VERSION} successfully deployed and active on ${CHANNEL_NAME}!"
