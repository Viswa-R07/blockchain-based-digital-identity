#!/bin/bash
set -euo pipefail

export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=/home/viswa_r07/blockchain-identity/fabric-samples/config

NET="/home/viswa_r07/blockchain-identity/network"
ORDERER_CA="${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/ca.crt"
PKG_DIR="${NET}/channel-artifacts/chaincode"
mkdir -p "${PKG_DIR}"

CC_NAME="identity-registry"
CC_VERSION="3.0"
CC_SEQUENCE=3
CHANNEL_NAME="identity-channel"
SIGNATURE_POLICY="OutOf(3, 'GovMSP.peer', 'UniversityMSP.peer', 'BankMSP.peer', 'EmployerMSP.peer')"
CC_SRC_PATH="/home/viswa_r07/blockchain-identity/chaincode/identity-registry"
PKG_FILE="${PKG_DIR}/${CC_NAME}_${CC_VERSION}.tar.gz"

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
echo " Step 1: Compiling & Packaging ${CC_NAME}_${CC_VERSION}"
echo "========================================================="
cd "${CC_SRC_PATH}"
npm run build
npm test

echo "Packaging ${CC_NAME}_${CC_VERSION}..."
peer lifecycle chaincode package "${PKG_FILE}" \
  --path "${CC_SRC_PATH}" \
  --lang node \
  --label "${CC_NAME}_${CC_VERSION}"

echo "Package created successfully: ${PKG_FILE}"
ls -lh "${PKG_FILE}"

echo "========================================================="
echo " Step 2: Installing ${CC_NAME}_${CC_VERSION} across all 4 Orgs"
echo "========================================================="

echo "Installing on peer0.gov (7051)..."
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
peer lifecycle chaincode install "${PKG_FILE}"

echo "Installing on peer0.uni (8051)..."
set_peer_env "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
peer lifecycle chaincode install "${PKG_FILE}"

echo "Installing on peer0.bank (9051)..."
set_peer_env "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
peer lifecycle chaincode install "${PKG_FILE}"

echo "Installing on peer0.emp (10051)..."
set_peer_env "employer.example.com" "EmployerMSP" "peer0.employer.example.com" 10051
peer lifecycle chaincode install "${PKG_FILE}"

CC_PACKAGE_ID=$(peer lifecycle chaincode calculatepackageid "${PKG_FILE}")
echo ">>> Computed Package ID: ${CC_PACKAGE_ID}"

echo "========================================================="
echo " Step 3: Approving Chaincode Definition (Sequence ${CC_SEQUENCE})"
echo "========================================================="

approve_for_org() {
  local ORG=$1
  local MSP=$2
  local PEER=$3
  local PORT=$4

  echo "Approving sequence ${CC_SEQUENCE} for ${MSP}..."
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
echo " Step 4: Checking Commit Readiness (Sequence ${CC_SEQUENCE})"
echo "========================================================="
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
READINESS=$(peer lifecycle chaincode checkcommitreadiness \
  --channelID "${CHANNEL_NAME}" \
  --name "${CC_NAME}" \
  --version "${CC_VERSION}" \
  --sequence "${CC_SEQUENCE}" \
  --signature-policy "${SIGNATURE_POLICY}" \
  --output json)

echo "${READINESS}"

# Verify all 4 orgs have approved
if echo "${READINESS}" | grep -q '"BankMSP": true' && \
   echo "${READINESS}" | grep -q '"EmployerMSP": true' && \
   echo "${READINESS}" | grep -q '"GovMSP": true' && \
   echo "${READINESS}" | grep -q '"UniversityMSP": true'; then
  echo ">>> All 4 organizations have approved sequence ${CC_SEQUENCE}."
else
  echo "ERROR: Not all organizations have approved sequence ${CC_SEQUENCE}!"
  exit 1
fi

echo "========================================================="
echo " Step 5: Committing Chaincode Definition (Sequence ${CC_SEQUENCE})"
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
echo " Step 6: Verifying Committed Definition on all 4 Orgs"
echo "========================================================="
for org_spec in \
  "gov.identity.example.com GovMSP peer0.gov.identity.example.com 7051" \
  "university.example.com UniversityMSP peer0.university.example.com 8051" \
  "bank.example.com BankMSP peer0.bank.example.com 9051" \
  "employer.example.com EmployerMSP peer0.employer.example.com 10051"; do
  set -- ${org_spec}
  echo "Checking ${2}..."
  set_peer_env "$1" "$2" "$3" "$4"
  COMMITTED_DEF=$(peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" --name "${CC_NAME}")
  echo "${COMMITTED_DEF}"
  if echo "${COMMITTED_DEF}" | grep -q "Sequence: ${CC_SEQUENCE}"; then
    echo "  [+] ${2}: Confirmed Sequence ${CC_SEQUENCE} active."
  else
    echo "  [-] ${2}: FAILED - Expected sequence ${CC_SEQUENCE} not found!"
    exit 1
  fi
done

echo ">>> Chaincode ${CC_NAME}_${CC_VERSION} (Sequence ${CC_SEQUENCE}) successfully upgraded and active on ${CHANNEL_NAME}!"
