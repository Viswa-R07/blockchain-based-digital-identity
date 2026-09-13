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

echo "================================================================================"
echo " Starting Milestone 5 Credential Registry Verification Suite for ${CC_NAME}"
echo "================================================================================"

RUN_ID=$(date +%s)
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

record_pass() {
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  PASSED_TESTS=$((PASSED_TESTS + 1))
  echo -e "\e[32m[PASS]\e[0m $1"
}

record_fail() {
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  FAILED_TESTS=$((FAILED_TESTS + 1))
  echo -e "\e[31m[FAIL]\e[0m $1: $2"
}

# Define test credentials for all 4 organizations
GOV_CRED_ID="cred:gov:${RUN_ID}"
GOV_SUB_DID="did:example:citizen${RUN_ID}"
GOV_ISS_DID="did:example:gov:authority"
GOV_TYPE="GovernmentIdCredential"
GOV_SCHEMA="https://schema.org/v1/GovernmentIdCredential.json"
GOV_HASH=$(echo -n "gov_raw_payload_${RUN_ID}" | sha256sum | awk '{print $1}')
GOV_EXP="2035-01-01T00:00:00.000Z"

UNI_CRED_ID="cred:uni:${RUN_ID}"
UNI_SUB_DID="did:example:student${RUN_ID}"
UNI_ISS_DID="did:example:university:registrar"
UNI_TYPE="AcademicDegreeCredential"
UNI_SCHEMA="https://schema.org/v1/AcademicDegreeCredential.json"
UNI_HASH=$(echo -n "uni_raw_payload_${RUN_ID}" | sha256sum | awk '{print $1}')
UNI_EXP="2035-01-01T00:00:00.000Z"

BANK_CRED_ID="cred:bank:${RUN_ID}"
BANK_SUB_DID="did:example:citizen${RUN_ID}"
BANK_ISS_DID="did:example:bank:compliance"
BANK_TYPE="KYCCredential"
BANK_SCHEMA="https://schema.org/v1/KYCCredential.json"
BANK_HASH=$(echo -n "bank_raw_payload_${RUN_ID}" | sha256sum | awk '{print $1}')
BANK_EXP="2035-01-01T00:00:00.000Z"

EMP_CRED_ID="cred:emp:${RUN_ID}"
EMP_SUB_DID="did:example:employee${RUN_ID}"
EMP_ISS_DID="did:example:employer:hr"
EMP_TYPE="EmploymentCredential"
EMP_SCHEMA="https://schema.org/v1/EmploymentCredential.json"
EMP_HASH=$(echo -n "emp_raw_payload_${RUN_ID}" | sha256sum | awk '{print $1}')
EMP_EXP="2035-01-01T00:00:00.000Z"

echo ""
echo "--- TEST 1: GovMSP Issues GovernmentIdCredential (with 3-Org Endorsement: Gov, Uni, Bank) ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
OUT1=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"IssueCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"${GOV_SUB_DID}\",\"${GOV_ISS_DID}\",\"${GOV_TYPE}\",\"${GOV_SCHEMA}\",\"${GOV_HASH}\",\"${GOV_EXP}\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT1}"
if echo "${OUT1}" | grep -q "Chaincode invoke successful. result: status:200"; then
  record_pass "Test 1: GovMSP successfully issued GovernmentIdCredential (${GOV_CRED_ID})"
else
  record_fail "Test 1" "GovMSP credential issuance failed"
fi

sleep 2

echo ""
echo "--- TEST 2: UniversityMSP Issues AcademicDegreeCredential (with 3-Org Endorsement: Uni, Bank, Emp) ---"
set_peer_env "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
OUT2=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "${EMP_CA}" \
  -c "{\"function\":\"IssueCredential\",\"Args\":[\"${UNI_CRED_ID}\",\"${UNI_SUB_DID}\",\"${UNI_ISS_DID}\",\"${UNI_TYPE}\",\"${UNI_SCHEMA}\",\"${UNI_HASH}\",\"${UNI_EXP}\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT2}"
if echo "${OUT2}" | grep -q "Chaincode invoke successful. result: status:200"; then
  record_pass "Test 2: UniversityMSP successfully issued AcademicDegreeCredential (${UNI_CRED_ID})"
else
  record_fail "Test 2" "UniversityMSP credential issuance failed"
fi

sleep 2

echo ""
echo "--- TEST 3: BankMSP Issues KYCCredential (with 3-Org Endorsement: Bank, Emp, Gov) ---"
set_peer_env "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
OUT3=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "${EMP_CA}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  -c "{\"function\":\"IssueCredential\",\"Args\":[\"${BANK_CRED_ID}\",\"${BANK_SUB_DID}\",\"${BANK_ISS_DID}\",\"${BANK_TYPE}\",\"${BANK_SCHEMA}\",\"${BANK_HASH}\",\"${BANK_EXP}\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT3}"
if echo "${OUT3}" | grep -q "Chaincode invoke successful. result: status:200"; then
  record_pass "Test 3: BankMSP successfully issued KYCCredential (${BANK_CRED_ID})"
else
  record_fail "Test 3" "BankMSP credential issuance failed"
fi

sleep 2

echo ""
echo "--- TEST 4: EmployerMSP Issues EmploymentCredential (with 3-Org Endorsement: Emp, Gov, Uni) ---"
set_peer_env "employer.example.com" "EmployerMSP" "peer0.employer.example.com" 10051
OUT4=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "${EMP_CA}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  -c "{\"function\":\"IssueCredential\",\"Args\":[\"${EMP_CRED_ID}\",\"${EMP_SUB_DID}\",\"${EMP_ISS_DID}\",\"${EMP_TYPE}\",\"${EMP_SCHEMA}\",\"${EMP_HASH}\",\"${EMP_EXP}\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT4}"
if echo "${OUT4}" | grep -q "Chaincode invoke successful. result: status:200"; then
  record_pass "Test 4: EmployerMSP successfully issued EmploymentCredential (${EMP_CRED_ID})"
else
  record_fail "Test 4" "EmployerMSP credential issuance failed"
fi

sleep 2

echo ""
echo "--- TEST 5: Consortium Read Access (ReadCredential across All 4 Orgs) ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
Q_GOV=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadCredential\",\"Args\":[\"${GOV_CRED_ID}\"]}" 2>&1 || true)
echo "Gov query GovCred: ${Q_GOV}"

set_peer_env "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
Q_UNI=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadCredential\",\"Args\":[\"${UNI_CRED_ID}\"]}" 2>&1 || true)
echo "Uni query UniCred: ${Q_UNI}"

set_peer_env "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
Q_BANK=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadCredential\",\"Args\":[\"${BANK_CRED_ID}\"]}" 2>&1 || true)
echo "Bank query BankCred: ${Q_BANK}"

set_peer_env "employer.example.com" "EmployerMSP" "peer0.employer.example.com" 10051
Q_EMP=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadCredential\",\"Args\":[\"${EMP_CRED_ID}\"]}" 2>&1 || true)
echo "Emp query EmpCred: ${Q_EMP}"

if echo "${Q_GOV}" | grep -q "\"status\":\"ACTIVE\"" && \
   echo "${Q_UNI}" | grep -q "\"status\":\"ACTIVE\"" && \
   echo "${Q_BANK}" | grep -q "\"status\":\"ACTIVE\"" && \
   echo "${Q_EMP}" | grep -q "\"status\":\"ACTIVE\""; then
  record_pass "Test 5: All 4 orgs successfully read credentials across the consortium"
else
  record_fail "Test 5" "Consortium read verification failed"
fi

echo ""
echo "--- TEST 6: CredentialExists Query ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
EXISTS_TRUE=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"CredentialExists\",\"Args\":[\"${GOV_CRED_ID}\"]}" 2>&1 || true)
EXISTS_FALSE=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"CredentialExists\",\"Args\":[\"cred:nonexistent:999\"]}" 2>&1 || true)
echo "Exists true: ${EXISTS_TRUE}, Exists false: ${EXISTS_FALSE}"
if [ "${EXISTS_TRUE}" = "true" ] && [ "${EXISTS_FALSE}" = "false" ]; then
  record_pass "Test 6: CredentialExists correctly returned true for existing and false for nonexistent"
else
  record_fail "Test 6" "CredentialExists test failed"
fi

echo ""
echo "--- TEST 7: VerifyCredential - Valid Credential Evaluation ---"
V_VALID=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"VerifyCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"${GOV_SUB_DID}\",\"${GOV_HASH}\"]}" 2>&1 || true)
echo "Verify result: ${V_VALID}"
if echo "${V_VALID}" | grep -q "\"valid\":true" && echo "${V_VALID}" | grep -q "\"reason\":\"VALID\""; then
  record_pass "Test 7: VerifyCredential correctly evaluated valid credential as VALID"
else
  record_fail "Test 7" "VerifyCredential valid test failed"
fi

echo ""
echo "--- TEST 8: VerifyCredential - Subject DID Mismatch ---"
V_SUB_MISMATCH=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"VerifyCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"did:example:wrongsubject\",\"${GOV_HASH}\"]}" 2>&1 || true)
echo "Subject mismatch result: ${V_SUB_MISMATCH}"
if echo "${V_SUB_MISMATCH}" | grep -q "\"valid\":false" && echo "${V_SUB_MISMATCH}" | grep -q "SUBJECT_MISMATCH"; then
  record_pass "Test 8: VerifyCredential correctly detected SUBJECT_MISMATCH"
else
  record_fail "Test 8" "VerifyCredential subject mismatch detection failed"
fi

echo ""
echo "--- TEST 9: VerifyCredential - Commitment Hash Mismatch ---"
WRONG_HASH="0000000000000000000000000000000000000000000000000000000000000000"
V_HASH_MISMATCH=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"VerifyCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"${GOV_SUB_DID}\",\"${WRONG_HASH}\"]}" 2>&1 || true)
echo "Commitment mismatch result: ${V_HASH_MISMATCH}"
if echo "${V_HASH_MISMATCH}" | grep -q "\"valid\":false" && echo "${V_HASH_MISMATCH}" | grep -q "COMMITMENT_MISMATCH"; then
  record_pass "Test 9: VerifyCredential correctly detected COMMITMENT_MISMATCH"
else
  record_fail "Test 9" "VerifyCredential commitment mismatch detection failed"
fi

echo ""
echo "--- TEST 10: ABAC Negative Test 1: BankMSP Attempting to Issue GovernmentIdCredential ---"
set_peer_env "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
OUT10=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "${EMP_CA}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  -c "{\"function\":\"IssueCredential\",\"Args\":[\"cred:abac1:${RUN_ID}\",\"${GOV_SUB_DID}\",\"${BANK_ISS_DID}\",\"GovernmentIdCredential\",\"${GOV_SCHEMA}\",\"${GOV_HASH}\",\"${GOV_EXP}\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT10}"
if echo "${OUT10}" | grep -q "UNAUTHORIZED_CREDENTIAL_TYPE" || echo "${OUT10}" | grep -q "endorsement failure during invoke"; then
  record_pass "Test 10: BankMSP correctly rejected when attempting to issue GovernmentIdCredential (ABAC enforced)"
else
  record_fail "Test 10" "ABAC test 1 failed to reject unauthorized credential type"
fi

echo ""
echo "--- TEST 11: ABAC Negative Test 2: UniversityMSP Attempting to Issue KYCCredential ---"
set_peer_env "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
OUT11=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "${EMP_CA}" \
  -c "{\"function\":\"IssueCredential\",\"Args\":[\"cred:abac2:${RUN_ID}\",\"${UNI_SUB_DID}\",\"${UNI_ISS_DID}\",\"KYCCredential\",\"${BANK_SCHEMA}\",\"${UNI_HASH}\",\"${UNI_EXP}\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT11}"
if echo "${OUT11}" | grep -q "UNAUTHORIZED_CREDENTIAL_TYPE" || echo "${OUT11}" | grep -q "endorsement failure during invoke"; then
  record_pass "Test 11: UniversityMSP correctly rejected when attempting to issue KYCCredential (ABAC enforced)"
else
  record_fail "Test 11" "ABAC test 2 failed to reject unauthorized credential type"
fi

echo ""
echo "--- TEST 12: Duplicate Credential Registration Rejection ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
OUT12=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"IssueCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"${GOV_SUB_DID}\",\"${GOV_ISS_DID}\",\"${GOV_TYPE}\",\"${GOV_SCHEMA}\",\"${GOV_HASH}\",\"${GOV_EXP}\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT12}"
if echo "${OUT12}" | grep -q "DUPLICATE_CREDENTIAL" || echo "${OUT12}" | grep -q "endorsement failure during invoke"; then
  record_pass "Test 12: Correctly rejected attempt to register duplicate credentialId (${GOV_CRED_ID})"
else
  record_fail "Test 12" "Duplicate credential registration was not rejected"
fi

echo ""
echo "--- TEST 13: Expiration Negative Test (Expiration Date in Past) ---"
OUT13=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"IssueCredential\",\"Args\":[\"cred:past:${RUN_ID}\",\"${GOV_SUB_DID}\",\"${GOV_ISS_DID}\",\"${GOV_TYPE}\",\"${GOV_SCHEMA}\",\"${GOV_HASH}\",\"2020-01-01T00:00:00.000Z\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT13}"
if echo "${OUT13}" | grep -q "INVALID_EXPIRATION" || echo "${OUT13}" | grep -q "endorsement failure during invoke"; then
  record_pass "Test 13: Correctly rejected credential issuance with expiration date in the past"
else
  record_fail "Test 13" "Past expiration validation was not rejected"
fi

echo ""
echo "--- TEST 14: Status Update: ACTIVE -> SUSPENDED by Issuing Org (GovMSP) ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
OUT14=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"UpdateCredentialStatus\",\"Args\":[\"${GOV_CRED_ID}\",\"SUSPENDED\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT14}"
if echo "${OUT14}" | grep -q "Chaincode invoke successful. result: status:200"; then
  record_pass "Test 14: GovMSP successfully updated status of ${GOV_CRED_ID} to SUSPENDED"
else
  record_fail "Test 14" "Status update to SUSPENDED failed"
fi

sleep 2

echo ""
echo "--- TEST 15: VerifyCredential for SUSPENDED Credential ---"
V_SUSP=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"VerifyCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"${GOV_SUB_DID}\",\"${GOV_HASH}\"]}" 2>&1 || true)
echo "Suspended verify result: ${V_SUSP}"
if echo "${V_SUSP}" | grep -q "\"valid\":false" && echo "${V_SUSP}" | grep -q "SUSPENDED"; then
  record_pass "Test 15: VerifyCredential correctly evaluated SUSPENDED credential as invalid (reason: SUSPENDED)"
else
  record_fail "Test 15" "Suspended credential verification failed"
fi

echo ""
echo "--- TEST 16: Status Update: SUSPENDED -> ACTIVE Reinstatement by Issuing Org ---"
OUT16=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"UpdateCredentialStatus\",\"Args\":[\"${GOV_CRED_ID}\",\"ACTIVE\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT16}"
if echo "${OUT16}" | grep -q "Chaincode invoke successful. result: status:200"; then
  record_pass "Test 16: GovMSP successfully reinstated ${GOV_CRED_ID} to ACTIVE"
else
  record_fail "Test 16" "Reinstatement to ACTIVE failed"
fi

sleep 2

echo ""
echo "--- TEST 17: Unauthorized Status Update Attempt by Non-Issuing Org (BankMSP) ---"
set_peer_env "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
OUT17=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "${EMP_CA}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  -c "{\"function\":\"UpdateCredentialStatus\",\"Args\":[\"${GOV_CRED_ID}\",\"SUSPENDED\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT17}"
if echo "${OUT17}" | grep -q "UNAUTHORIZED_STATUS_UPDATE" || echo "${OUT17}" | grep -q "endorsement failure during invoke"; then
  record_pass "Test 17: Non-issuing org (BankMSP) correctly rejected from updating GovMSP's credential status"
else
  record_fail "Test 17" "Unauthorized status update was not rejected"
fi

echo ""
echo "--- TEST 18: Status Update: ACTIVE -> REVOKED by Issuing Org ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
OUT18=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"UpdateCredentialStatus\",\"Args\":[\"${GOV_CRED_ID}\",\"REVOKED\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT18}"
if echo "${OUT18}" | grep -q "Chaincode invoke successful. result: status:200"; then
  record_pass "Test 18: GovMSP successfully transitioned ${GOV_CRED_ID} to REVOKED"
else
  record_fail "Test 18" "Status update to REVOKED failed"
fi

sleep 2

echo ""
echo "--- TEST 19: VerifyCredential for REVOKED Credential ---"
V_REV=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"VerifyCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"${GOV_SUB_DID}\",\"${GOV_HASH}\"]}" 2>&1 || true)
echo "Revoked verify result: ${V_REV}"
if echo "${V_REV}" | grep -q "\"valid\":false" && echo "${V_REV}" | grep -q "REVOKED"; then
  record_pass "Test 19: VerifyCredential correctly evaluated REVOKED credential as invalid (reason: REVOKED)"
else
  record_fail "Test 19" "Revoked credential verification failed"
fi

echo ""
echo "--- TEST 20: Terminal Revocation Negative Test (Attempting Transition from REVOKED) ---"
OUT20=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"UpdateCredentialStatus\",\"Args\":[\"${GOV_CRED_ID}\",\"ACTIVE\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT20}"
if echo "${OUT20}" | grep -q "CREDENTIAL_REVOCATION_IS_TERMINAL" || echo "${OUT20}" | grep -q "endorsement failure during invoke"; then
  record_pass "Test 20: Correctly rejected attempt to transition credential out of terminal REVOKED state"
else
  record_fail "Test 20" "Terminal revocation test failed to reject invalid transition"
fi

echo ""
echo "--- TEST 21: Chronological History Provenance (GetCredentialHistory) ---"
HIST=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"GetCredentialHistory\",\"Args\":[\"${GOV_CRED_ID}\"]}" 2>&1 || true)
echo "Credential History Output: ${HIST}"
if echo "${HIST}" | grep -q "\"status\":\"ACTIVE\"" && \
   echo "${HIST}" | grep -q "\"status\":\"SUSPENDED\"" && \
   echo "${HIST}" | grep -q "\"status\":\"REVOKED\""; then
  record_pass "Test 21: GetCredentialHistory returned complete chronological history with ACTIVE, SUSPENDED, and REVOKED states"
else
  record_fail "Test 21" "GetCredentialHistory verification failed"
fi

echo ""
echo "================================================================================"
echo " Verification Suite Summary: ${PASSED_TESTS}/${TOTAL_TESTS} Tests Passed"
echo "================================================================================"

if [ "${FAILED_TESTS}" -eq 0 ]; then
  echo -e "\e[32mALL MILESTONE 5 CREDENTIAL REGISTRY TESTS PASSED PERFECTLY!\e[0m"
  exit 0
else
  echo -e "\e[31mSOME TESTS FAILED: ${FAILED_TESTS} failures detected.\e[0m"
  exit 1
fi
