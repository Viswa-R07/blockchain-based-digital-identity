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
echo " Starting Milestone 6 Credential Revocation & Verification Suite for ${CC_NAME}"
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

# Credential parameters for primary lifecycle testing
GOV_CRED_ID="cred:m6:gov:${RUN_ID}"
GOV_SUB_DID="did:example:citizen${RUN_ID}"
GOV_ISS_DID="did:example:gov:authority"
GOV_TYPE="GovernmentIdCredential"
GOV_SCHEMA="https://schema.org/v1/GovernmentIdCredential.json"
GOV_HASH=$(echo -n "gov_raw_payload_${RUN_ID}" | sha256sum | awk '{print $1}')
GOV_EXP="2035-01-01T00:00:00.000Z"

# Secondary credential for cross-org authorization tests
UNI_CRED_ID="cred:m6:uni:${RUN_ID}"
UNI_SUB_DID="did:example:student${RUN_ID}"
UNI_ISS_DID="did:example:university:registrar"
UNI_TYPE="AcademicDegreeCredential"
UNI_SCHEMA="https://schema.org/v1/AcademicDegreeCredential.json"
UNI_HASH=$(echo -n "uni_raw_payload_${RUN_ID}" | sha256sum | awk '{print $1}')
UNI_EXP="2035-01-01T00:00:00.000Z"

echo ""
echo "--- PREPARATION: Issue Gov Credential (${GOV_CRED_ID}) ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
OUT_PREP=$(peer chaincode invoke \
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
echo "${OUT_PREP}"

echo ""
echo "--- TEST 1: Verify Newly Issued Credential is ACTIVE and Valid ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
Q_STAT1=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"GetCredentialStatus\",\"Args\":[\"${GOV_CRED_ID}\"]}" 2>&1 || true)
V_VAL1=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"VerifyCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"${GOV_SUB_DID}\",\"${GOV_HASH}\"]}" 2>&1 || true)
echo "Status: ${Q_STAT1}"
echo "Verify: ${V_VAL1}"

if echo "${Q_STAT1}" | grep -q "\"status\":\"ACTIVE\"" && \
   echo "${V_VAL1}" | grep -q "\"valid\":true" && \
   echo "${V_VAL1}" | grep -q "\"reason\":\"VALID\""; then
  record_pass "Test 1: Newly issued credential is ACTIVE and verifies as VALID"
else
  record_fail "Test 1" "Initial active check failed"
fi

sleep 2

echo ""
echo "--- TEST 2: Suspend Credential Using Original Issuer (GovMSP) ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
OUT_SUS=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"SuspendCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"PRIVILEGE_WITHDRAWN\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT_SUS}"

if echo "${OUT_SUS}" | grep -q "Chaincode invoke successful. result: status:200"; then
  record_pass "Test 2: GovMSP successfully invoked SuspendCredential"
else
  record_fail "Test 2" "SuspendCredential invocation failed"
fi

sleep 2

echo ""
echo "--- TEST 3: Verify Status is SUSPENDED & No Revocation Metadata Present ---"
Q_STAT2=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"GetCredentialStatus\",\"Args\":[\"${GOV_CRED_ID}\"]}" 2>&1 || true)
Q_READ2=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadCredential\",\"Args\":[\"${GOV_CRED_ID}\"]}" 2>&1 || true)
echo "Status: ${Q_STAT2}"
echo "Read: ${Q_READ2}"

if echo "${Q_STAT2}" | grep -q "\"status\":\"SUSPENDED\"" && \
   ! echo "${Q_READ2}" | grep -q "\"revokedAt\"" && \
   ! echo "${Q_READ2}" | grep -q "\"revocationReason\""; then
  record_pass "Test 3: Credential status is SUSPENDED and revocation metadata remains absent"
else
  record_fail "Test 3" "Suspended status verification failed"
fi

echo ""
echo "--- TEST 4: Verify Credential Fails with Reason SUSPENDED ---"
V_VAL2=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"VerifyCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"${GOV_SUB_DID}\",\"${GOV_HASH}\"]}" 2>&1 || true)
echo "Verify result: ${V_VAL2}"

if echo "${V_VAL2}" | grep -q "\"valid\":false" && \
   echo "${V_VAL2}" | grep -q "\"reason\":\"SUSPENDED\""; then
  record_pass "Test 4: VerifyCredential returns valid=false and reason=SUSPENDED"
else
  record_fail "Test 4" "VerifyCredential suspended check failed"
fi

sleep 2

echo ""
echo "--- TEST 5: Reinstate Credential Using Original Issuer (GovMSP) ---"
OUT_REIN=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"ReinstateCredential\",\"Args\":[\"${GOV_CRED_ID}\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT_REIN}"

if echo "${OUT_REIN}" | grep -q "Chaincode invoke successful. result: status:200"; then
  record_pass "Test 5: GovMSP successfully invoked ReinstateCredential"
else
  record_fail "Test 5" "ReinstateCredential invocation failed"
fi

sleep 2

echo ""
echo "--- TEST 6: Verify Status is ACTIVE after Reinstatement ---"
Q_STAT3=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"GetCredentialStatus\",\"Args\":[\"${GOV_CRED_ID}\"]}" 2>&1 || true)
echo "Status: ${Q_STAT3}"

if echo "${Q_STAT3}" | grep -q "\"status\":\"ACTIVE\""; then
  record_pass "Test 6: Credential status successfully restored to ACTIVE"
else
  record_fail "Test 6" "Reinstatement status check failed"
fi

echo ""
echo "--- TEST 7: Verify Credential Succeeds Again as VALID ---"
V_VAL3=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"VerifyCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"${GOV_SUB_DID}\",\"${GOV_HASH}\"]}" 2>&1 || true)
echo "Verify result: ${V_VAL3}"

if echo "${V_VAL3}" | grep -q "\"valid\":true" && \
   echo "${V_VAL3}" | grep -q "\"reason\":\"VALID\""; then
  record_pass "Test 7: VerifyCredential succeeds again with valid=true, reason=VALID"
else
  record_fail "Test 7" "VerifyCredential post-reinstatement check failed"
fi

sleep 2

echo ""
echo "--- TEST 8: Revoke Credential (KEY_COMPROMISE) by Original Issuer ---"
OUT_REV=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"RevokeCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"KEY_COMPROMISE\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT_REV}"

if echo "${OUT_REV}" | grep -q "Chaincode invoke successful. result: status:200"; then
  record_pass "Test 8: GovMSP successfully invoked RevokeCredential with KEY_COMPROMISE"
else
  record_fail "Test 8" "RevokeCredential invocation failed"
fi

sleep 2

echo ""
echo "--- TEST 9: Verify Status is REVOKED & Revocation Metadata Populated ---"
Q_STAT4=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"GetCredentialStatus\",\"Args\":[\"${GOV_CRED_ID}\"]}" 2>&1 || true)
Q_READ4=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadCredential\",\"Args\":[\"${GOV_CRED_ID}\"]}" 2>&1 || true)
echo "Status: ${Q_STAT4}"
echo "Read: ${Q_READ4}"

if echo "${Q_STAT4}" | grep -q "\"status\":\"REVOKED\"" && \
   echo "${Q_STAT4}" | grep -q "\"revocationReason\":\"KEY_COMPROMISE\"" && \
   echo "${Q_STAT4}" | grep -q "\"revokedAt\"" && \
   echo "${Q_READ4}" | grep -q "\"revokedAt\""; then
  record_pass "Test 9: Status is REVOKED and revocation metadata is properly populated"
else
  record_fail "Test 9" "Revocation metadata verification failed"
fi

echo ""
echo "--- TEST 10: Verify Credential Fails with Reason REVOKED ---"
V_VAL4=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"VerifyCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"${GOV_SUB_DID}\",\"${GOV_HASH}\"]}" 2>&1 || true)
echo "Verify result: ${V_VAL4}"

if echo "${V_VAL4}" | grep -q "\"valid\":false" && \
   echo "${V_VAL4}" | grep -q "\"reason\":\"REVOKED\""; then
  record_pass "Test 10: VerifyCredential returns valid=false and reason=REVOKED"
else
  record_fail "Test 10" "VerifyCredential revoked check failed"
fi

sleep 2

echo ""
echo "--- TEST 11: Terminal Revocation Negative Test: REVOKED -> ACTIVE Rejected ---"
OUT_NEG_ACT=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"ReinstateCredential\",\"Args\":[\"${GOV_CRED_ID}\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT_NEG_ACT}"

if echo "${OUT_NEG_ACT}" | grep -q "CREDENTIAL_REVOCATION_IS_TERMINAL"; then
  record_pass "Test 11: Reinstating REVOKED credential was correctly rejected (CREDENTIAL_REVOCATION_IS_TERMINAL)"
else
  record_fail "Test 11" "Reinstatement of REVOKED credential was not rejected as expected"
fi

echo ""
echo "--- TEST 12: Terminal Revocation Negative Test: REVOKED -> SUSPENDED Rejected ---"
OUT_NEG_SUS=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"SuspendCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"AFFILIATION_CHANGED\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT_NEG_SUS}"

if echo "${OUT_NEG_SUS}" | grep -q "CREDENTIAL_REVOCATION_IS_TERMINAL"; then
  record_pass "Test 12: Suspending REVOKED credential was correctly rejected (CREDENTIAL_REVOCATION_IS_TERMINAL)"
else
  record_fail "Test 12" "Suspending REVOKED credential was not rejected as expected"
fi

echo ""
echo "--- TEST 13: Terminal Revocation Negative Test: Re-revoking REVOKED Rejected ---"
OUT_NEG_REREV=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"RevokeCredential\",\"Args\":[\"${GOV_CRED_ID}\",\"SUPERSEDED\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT_NEG_REREV}"

if echo "${OUT_NEG_REREV}" | grep -q "CREDENTIAL_REVOCATION_IS_TERMINAL"; then
  record_pass "Test 13: Re-revoking an already REVOKED credential was correctly rejected (CREDENTIAL_REVOCATION_IS_TERMINAL)"
else
  record_fail "Test 13" "Re-revocation was not rejected as expected"
fi

sleep 2

echo ""
echo "--- PREPARATION FOR ABAC TESTS: Issue University Credential ---"
set_peer_env "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
OUT_UNI_ISS=$(peer chaincode invoke \
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
echo "${OUT_UNI_ISS}"

sleep 2

echo ""
echo "--- TEST 14: ABAC Negative Test: Non-Issuer (BankMSP) Cannot Revoke University Credential ---"
set_peer_env "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
OUT_NEG_REV_NON=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "${EMP_CA}" \
  -c "{\"function\":\"RevokeCredential\",\"Args\":[\"${UNI_CRED_ID}\",\"KEY_COMPROMISE\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT_NEG_REV_NON}"

if echo "${OUT_NEG_REV_NON}" | grep -q "UNAUTHORIZED"; then
  record_pass "Test 14: Non-issuer (BankMSP) was rejected from revoking University credential (ABAC)"
else
  record_fail "Test 14" "Non-issuer revocation was not rejected as expected"
fi

echo ""
echo "--- TEST 15: ABAC Negative Test: Non-Issuer (EmployerMSP) Cannot Suspend University Credential ---"
set_peer_env "employer.example.com" "EmployerMSP" "peer0.employer.example.com" 10051
OUT_NEG_SUS_NON=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "${EMP_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"SuspendCredential\",\"Args\":[\"${UNI_CRED_ID}\",\"PRIVILEGE_WITHDRAWN\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT_NEG_SUS_NON}"

if echo "${OUT_NEG_SUS_NON}" | grep -q "UNAUTHORIZED"; then
  record_pass "Test 15: Non-issuer (EmployerMSP) was rejected from suspending University credential (ABAC)"
else
  record_fail "Test 15" "Non-issuer suspension was not rejected as expected"
fi

sleep 2

# Suspend the Uni credential with original issuer first
set_peer_env "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "${EMP_CA}" \
  -c "{\"function\":\"SuspendCredential\",\"Args\":[\"${UNI_CRED_ID}\",\"CESSATION_OF_OPERATION\"]}" \
  --waitForEvent >/dev/null 2>&1 || true

sleep 2

echo ""
echo "--- TEST 16: ABAC Negative Test: Non-Issuer (GovMSP) Cannot Reinstate University Credential ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
OUT_NEG_REIN_NON=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"ReinstateCredential\",\"Args\":[\"${UNI_CRED_ID}\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT_NEG_REIN_NON}"

if echo "${OUT_NEG_REIN_NON}" | grep -q "UNAUTHORIZED"; then
  record_pass "Test 16: Non-issuer (GovMSP) was rejected from reinstating University credential (ABAC)"
else
  record_fail "Test 16" "Non-issuer reinstatement was not rejected as expected"
fi

echo ""
echo "--- TEST 17: Validation Negative Test: Invalid / Free-Text Revocation Reason Rejected ---"
set_peer_env "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
OUT_NEG_REASON=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "${EMP_CA}" \
  -c "{\"function\":\"RevokeCredential\",\"Args\":[\"${UNI_CRED_ID}\",\"Student dropped out email test@test.com\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT_NEG_REASON}"

if echo "${OUT_NEG_REASON}" | grep -q "INVALID_REVOCATION_REASON"; then
  record_pass "Test 17: Free-text / invalid revocation reason was rejected with INVALID_REVOCATION_REASON"
else
  record_fail "Test 17" "Invalid revocation reason was not rejected as expected"
fi

echo ""
echo "--- TEST 18: Audit Trail: Verify GetCredentialHistory Lifecycle Progression ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
HIST=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"GetCredentialHistory\",\"Args\":[\"${GOV_CRED_ID}\"]}" 2>&1 || true)
echo "History: ${HIST}"

# Verify history contains the progression: ACTIVE -> SUSPENDED -> ACTIVE -> REVOKED
if echo "${HIST}" | grep -q "ACTIVE" && \
   echo "${HIST}" | grep -q "SUSPENDED" && \
   echo "${HIST}" | grep -q "REVOKED"; then
  record_pass "Test 18: GetCredentialHistory confirmed immutable audit trail with full lifecycle transitions"
else
  record_fail "Test 18" "GetCredentialHistory lifecycle verification failed"
fi

sleep 2

echo ""
echo "--- TEST 19: Expiration Verification (Short Expiration Lifecycle Check) ---"
EXP_CRED_ID="cred:m6:exp:${RUN_ID}"
EXP_HASH=$(echo -n "exp_payload_${RUN_ID}" | sha256sum | awk '{print $1}')
# Expiration set to 5 seconds in future
FUTURE_EPOCH=$(date -u -d '+5 seconds' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u -v+5S +%Y-%m-%dT%H:%M:%S.000Z)
echo "Issuing credential with expiresAt: ${FUTURE_EPOCH}"

OUT_EXP_ISS=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"IssueCredential\",\"Args\":[\"${EXP_CRED_ID}\",\"${GOV_SUB_DID}\",\"${GOV_ISS_DID}\",\"${GOV_TYPE}\",\"${GOV_SCHEMA}\",\"${EXP_HASH}\",\"${FUTURE_EPOCH}\"]}" \
  --waitForEvent 2>&1 || true)
echo "${OUT_EXP_ISS}"

# Check immediate verification before expiration
V_BEFORE=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"VerifyCredential\",\"Args\":[\"${EXP_CRED_ID}\",\"${GOV_SUB_DID}\",\"${EXP_HASH}\"]}" 2>&1 || true)
echo "Verification before expiration: ${V_BEFORE}"

echo "Sleeping 7 seconds for expiration window to pass..."
sleep 7

# Check verification after expiration
V_AFTER=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"VerifyCredential\",\"Args\":[\"${EXP_CRED_ID}\",\"${GOV_SUB_DID}\",\"${EXP_HASH}\"]}" 2>&1 || true)
Q_STATUS_AFTER=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"GetCredentialStatus\",\"Args\":[\"${EXP_CRED_ID}\"]}" 2>&1 || true)
Q_RECORD_AFTER=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadCredential\",\"Args\":[\"${EXP_CRED_ID}\"]}" 2>&1 || true)
echo "Verification after expiration: ${V_AFTER}"
echo "GetCredentialStatus after expiration: ${Q_STATUS_AFTER}"
echo "ReadCredential after expiration: ${Q_RECORD_AFTER}"

if echo "${V_BEFORE}" | grep -q "\"valid\":true" && \
   echo "${V_AFTER}" | grep -q "\"valid\":false" && \
   echo "${V_AFTER}" | grep -q "\"reason\":\"EXPIRED\"" && \
   echo "${Q_STATUS_AFTER}" | grep -q "\"effectiveStatus\":\"EXPIRED\"" && \
   echo "${Q_RECORD_AFTER}" | grep -q "\"status\":\"ACTIVE\""; then
  record_pass "Test 19: Expiration verification passed (VALID before, EXPIRED after, world state record unmutated as ACTIVE)"
else
  record_fail "Test 19" "Expiration verification failed"
fi

echo ""
echo "--- TEST 20: 8-Node CouchDB Privacy & Schema Audit ---"
AUDIT_OUT=$(python3 "${NET}/../chaincode/identity-registry/scripts/audit_couchdb.py" 2>&1 || true)
echo "${AUDIT_OUT}"

if echo "${AUDIT_OUT}" | grep -q "No raw PII fields or detected PII-keyword fields were present in the audited ledger documents"; then
  record_pass "Test 20: All 8 CouchDB nodes passed schema and privacy audit (zero raw PII detected)"
else
  record_fail "Test 20" "CouchDB privacy/schema audit failed"
fi

echo ""
echo "--- TEST 21: Ledger Height Synchronization Across All 8 Peers ---"
SYNC_OK=true
FIRST_HEIGHT=""
for peer_spec in \
  "gov.identity.example.com GovMSP peer0.gov.identity.example.com 7051" \
  "gov.identity.example.com GovMSP peer1.gov.identity.example.com 7052" \
  "university.example.com UniversityMSP peer0.university.example.com 8051" \
  "university.example.com UniversityMSP peer1.university.example.com 8052" \
  "bank.example.com BankMSP peer0.bank.example.com 9051" \
  "bank.example.com BankMSP peer1.bank.example.com 9052" \
  "employer.example.com EmployerMSP peer0.employer.example.com 10051" \
  "employer.example.com EmployerMSP peer1.employer.example.com 10052"; do
  set -- ${peer_spec}
  set_peer_env "$1" "$2" "$3" "$4"
  C_INFO=$(peer channel getinfo -c "${CHANNEL_NAME}" 2>/dev/null || echo "ERROR")
  HEIGHT=$(echo "${C_INFO}" | grep -o '"height":[0-9]*' | cut -d':' -f2 || echo "0")
  echo "  Peer $3 (Port $4): Block Height = ${HEIGHT}"
  if [ -z "${FIRST_HEIGHT}" ]; then
    FIRST_HEIGHT="${HEIGHT}"
  elif [ "${HEIGHT}" != "${FIRST_HEIGHT}" ]; then
    SYNC_OK=false
  fi
done

if [ "${SYNC_OK}" = true ] && [ -n "${FIRST_HEIGHT}" ]; then
  record_pass "Test 21: Ledger block height synchronized at ${FIRST_HEIGHT} across all 8 peers"
else
  record_fail "Test 21" "Ledger block heights not synchronized across all 8 peers"
fi

echo ""
echo "================================================================================"
echo " Verification Suite Complete for Milestone 6 Credential Revocation & Verification"
echo " Total: ${TOTAL_TESTS} | Passed: ${PASSED_TESTS} | Failed: ${FAILED_TESTS}"
echo "================================================================================"

if [ "${FAILED_TESTS}" -gt 0 ]; then
  echo -e "\e[31m[-] MILESTONE 6 VERIFICATION SUITE FAILED with ${FAILED_TESTS} failures.\e[0m"
  exit 1
else
  echo -e "\e[32m[+] ALL MILESTONE 6 TESTS PASSED SUCCESSFULLY.\e[0m"
  exit 0
fi
