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
echo " Starting Hardened Verification Suite for ${CC_NAME}"
echo "================================================================================"

RUN_ID=$(date +%s)
TEST_DID="did:example:citizen${RUN_ID}"
TEST_HASH=$(echo -n "commitment_${RUN_ID}" | sha256sum | awk '{print $1}')

TEST_DID_ABAC="did:example:citizen_unauth_${RUN_ID}"
TEST_HASH_ABAC=$(echo -n "commitment_abac_${RUN_ID}" | sha256sum | awk '{print $1}')

TEST_DID_2OF4="did:example:citizen_2of4_${RUN_ID}"
TEST_HASH_2OF4=$(echo -n "commitment_2of4_${RUN_ID}" | sha256sum | awk '{print $1}')

TEST_DID_3OF4="did:example:citizen_3of4_${RUN_ID}"
TEST_HASH_3OF4=$(echo -n "commitment_3of4_${RUN_ID}" | sha256sum | awk '{print $1}')

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

echo ""
echo "--- TEST 1: Positive Identity Registration (GovMSP Admin with 3-Org Endorsement) ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051

REG_OUTPUT=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"RegisterIdentity\",\"Args\":[\"${TEST_DID}\",\"${TEST_HASH}\"]}" \
  --waitForEvent 2>&1 || true)

echo "${REG_OUTPUT}"
if echo "${REG_OUTPUT}" | grep -q "Chaincode invoke successful. result: status:200"; then
  record_pass "Test 1: Successfully registered ${TEST_DID} by GovMSP with 3 org endorsements"
else
  record_fail "Test 1" "Failed to register identity"
fi

sleep 2

echo ""
echo "--- TEST 2: Query Identity (ReadIdentity) across All 4 Orgs ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
QUERY_GOV=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadIdentity\",\"Args\":[\"${TEST_DID}\"]}" 2>&1 || true)
echo "GovMSP Query Result: ${QUERY_GOV}"

set_peer_env "university.example.com" "UniversityMSP" "peer0.university.example.com" 8051
QUERY_UNI=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadIdentity\",\"Args\":[\"${TEST_DID}\"]}" 2>&1 || true)
echo "UniversityMSP Query Result: ${QUERY_UNI}"

set_peer_env "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
QUERY_BANK=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadIdentity\",\"Args\":[\"${TEST_DID}\"]}" 2>&1 || true)
echo "BankMSP Query Result: ${QUERY_BANK}"

set_peer_env "employer.example.com" "EmployerMSP" "peer0.employer.example.com" 10051
QUERY_EMP=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadIdentity\",\"Args\":[\"${TEST_DID}\"]}" 2>&1 || true)
echo "EmployerMSP Query Result: ${QUERY_EMP}"

if echo "${QUERY_GOV}" | grep -q "${TEST_HASH}" && \
   echo "${QUERY_UNI}" | grep -q "${TEST_HASH}" && \
   echo "${QUERY_BANK}" | grep -q "${TEST_HASH}" && \
   echo "${QUERY_EMP}" | grep -q "${TEST_HASH}"; then
  record_pass "Test 2: Consistent ReadIdentity across Gov, University, Bank, Employer peers"
else
  record_fail "Test 2" "Inconsistent or failed query across organizations"
fi

echo ""
echo "--- TEST 3: IdentityExists Function ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
EXISTS_TRUE=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"IdentityExists\",\"Args\":[\"${TEST_DID}\"]}" 2>&1 || true)
EXISTS_FALSE=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"IdentityExists\",\"Args\":[\"did:example:nonexistent999\"]}" 2>&1 || true)

if [ "${EXISTS_TRUE}" = "true" ] && [ "${EXISTS_FALSE}" = "false" ]; then
  record_pass "Test 3: IdentityExists correctly returns true for existing and false for nonexistent"
else
  record_fail "Test 3" "IdentityExists returned unexpected result: true=${EXISTS_TRUE}, false=${EXISTS_FALSE}"
fi

echo ""
echo "--- TEST 4: Negative Test - Duplicate Registration Rejection ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
DUP_OUTPUT=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"RegisterIdentity\",\"Args\":[\"${TEST_DID}\",\"${TEST_HASH}\"]}" \
  --waitForEvent 2>&1 || true)

echo "${DUP_OUTPUT}"
if echo "${DUP_OUTPUT}" | grep -qi "already exists"; then
  record_pass "Test 4: Duplicate identity registration correctly rejected"
else
  record_fail "Test 4" "Duplicate registration was not rejected with expected error"
fi

echo ""
echo "--- TEST 5: Negative Test - Application ABAC (BankMSP Unauthorized Registration Rejection) ---"
set_peer_env "bank.example.com" "BankMSP" "peer0.bank.example.com" 9051
UNAUTH_OUTPUT=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"RegisterIdentity\",\"Args\":[\"${TEST_DID_ABAC}\",\"${TEST_HASH_ABAC}\"]}" \
  --waitForEvent 2>&1 || true)

echo "${UNAUTH_OUTPUT}"
if echo "${UNAUTH_OUTPUT}" | grep -qiE "restricted to GovMSP|not authorized"; then
  record_pass "Test 5: Application ABAC successfully rejected non-Gov registration (strictly restricted to GovMSP)"
else
  record_fail "Test 5" "Non-Gov registration was not blocked by application ABAC"
fi

echo ""
echo "--- TEST 6: Direct Endorsement Policy Negative Test (2-of-4 Rejection vs 3-of-4 Acceptance) ---"
echo "Policy: OutOf(3, 'GovMSP.peer', 'UniversityMSP.peer', 'BankMSP.peer', 'EmployerMSP.peer')"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051

echo "Submitting invocation with only 2 distinct organizational endorsements (GovMSP + UniversityMSP)..."
ENDORSE_2OF4_OUTPUT=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  -c "{\"function\":\"RegisterIdentity\",\"Args\":[\"${TEST_DID_2OF4}\",\"${TEST_HASH_2OF4}\"]}" \
  --waitForEvent 2>&1 || true)

echo "${ENDORSE_2OF4_OUTPUT}"

# Check world state to verify 2-of-4 transaction was NOT committed to state database
EXISTS_2OF4=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"IdentityExists\",\"Args\":[\"${TEST_DID_2OF4}\"]}" 2>&1 || true)

echo "Submitting invocation with 3 distinct organizational endorsements (GovMSP + UniversityMSP + BankMSP)..."
ENDORSE_3OF4_OUTPUT=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"RegisterIdentity\",\"Args\":[\"${TEST_DID_3OF4}\",\"${TEST_HASH_3OF4}\"]}" \
  --waitForEvent 2>&1 || true)

echo "${ENDORSE_3OF4_OUTPUT}"

EXISTS_3OF4=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"IdentityExists\",\"Args\":[\"${TEST_DID_3OF4}\"]}" 2>&1 || true)

if echo "${ENDORSE_2OF4_OUTPUT}" | grep -q "ENDORSEMENT_POLICY_FAILURE" && \
   [ "${EXISTS_2OF4}" = "false" ] && \
   echo "${ENDORSE_3OF4_OUTPUT}" | grep -q "Chaincode invoke successful. result: status:200" && \
   [ "${EXISTS_3OF4}" = "true" ]; then
  record_pass "Test 6: Endorsement policy enforced: 2-of-4 rejected with ENDORSEMENT_POLICY_FAILURE (uncommitted), 3-of-4 accepted (committed)"
else
  record_fail "Test 6" "Endorsement policy test did not match expected 2-of-4 failure and 3-of-4 success"
fi

echo ""
echo "--- TEST 7: State Transition - UpdateIdentityStatus (ACTIVE -> SUSPENDED) ---"
set_peer_env "gov.identity.example.com" "GovMSP" "peer0.gov.identity.example.com" 7051
SUSPEND_OUTPUT=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"UpdateIdentityStatus\",\"Args\":[\"${TEST_DID}\",\"SUSPENDED\"]}" \
  --waitForEvent 2>&1 || true)

echo "${SUSPEND_OUTPUT}"
sleep 2
QUERY_SUSPENDED=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadIdentity\",\"Args\":[\"${TEST_DID}\"]}" 2>&1 || true)
echo "Query after suspension: ${QUERY_SUSPENDED}"

if echo "${QUERY_SUSPENDED}" | grep -q '"status":"SUSPENDED"'; then
  record_pass "Test 7: Identity status successfully updated to SUSPENDED"
else
  record_fail "Test 7" "Status was not updated to SUSPENDED"
fi

echo ""
echo "--- TEST 8: State Transition - UpdateIdentityStatus (SUSPENDED -> REVOKED) ---"
REVOKE_OUTPUT=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"UpdateIdentityStatus\",\"Args\":[\"${TEST_DID}\",\"REVOKED\"]}" \
  --waitForEvent 2>&1 || true)

echo "${REVOKE_OUTPUT}"
sleep 2
QUERY_REVOKED=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"ReadIdentity\",\"Args\":[\"${TEST_DID}\"]}" 2>&1 || true)
echo "Query after revocation: ${QUERY_REVOKED}"

if echo "${QUERY_REVOKED}" | grep -q '"status":"REVOKED"'; then
  record_pass "Test 8: Identity status successfully updated to REVOKED"
else
  record_fail "Test 8" "Status was not updated to REVOKED"
fi

echo ""
echo "--- TEST 9: Negative Test - Terminal Revocation Enforcement (REVOKED -> ACTIVE Rejection) ---"
TERMINAL_OUTPUT=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer1.gov.identity.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C "${CHANNEL_NAME}" \
  -n "${CC_NAME}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${GOV_CA}" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "${UNI_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${BANK_CA}" \
  -c "{\"function\":\"UpdateIdentityStatus\",\"Args\":[\"${TEST_DID}\",\"ACTIVE\"]}" \
  --waitForEvent 2>&1 || true)

echo "${TERMINAL_OUTPUT}"
if echo "${TERMINAL_OUTPUT}" | grep -qi "terminal"; then
  record_pass "Test 9: Terminal revocation correctly prevents reactivation"
else
  record_fail "Test 9" "Terminal revocation check failed to reject reactivation"
fi

echo ""
echo "--- TEST 10: Audit Trail - GetIdentityHistory ---"
HISTORY_OUTPUT=$(peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c "{\"function\":\"GetIdentityHistory\",\"Args\":[\"${TEST_DID}\"]}" 2>&1 || true)
echo "History query output: ${HISTORY_OUTPUT}"

if echo "${HISTORY_OUTPUT}" | grep -q "ACTIVE" && \
   echo "${HISTORY_OUTPUT}" | grep -q "SUSPENDED" && \
   echo "${HISTORY_OUTPUT}" | grep -q "REVOKED"; then
  record_pass "Test 10: GetIdentityHistory captured complete lifecycle progression (ACTIVE -> SUSPENDED -> REVOKED)"
else
  record_fail "Test 10" "Identity history incomplete or missing states"
fi

echo ""
echo "--- TEST 11: Zero Raw PII & Approved Schema Audit across ALL 8 CouchDB Instances ---"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "${SCRIPT_DIR}/audit_couchdb.py"
AUDIT_EXIT=$?

if [ "${AUDIT_EXIT}" -eq 0 ]; then
  record_pass "Test 11: Zero Raw PII and strict approved-fields schema confirmed across all 8 CouchDB nodes"
else
  record_fail "Test 11" "CouchDB multi-instance audit failed"
fi

echo ""
echo "================================================================================"
echo " Identity Registry Hardened Verification Summary"
echo " Total Tests:  ${TOTAL_TESTS}"
echo " Pass:         ${PASSED_TESTS}"
echo " Fail:         ${FAILED_TESTS}"
echo "================================================================================"

if [ "${FAILED_TESTS}" -eq 0 ]; then
  echo -e "\e[32m>>> ALL MILESTONE 4 HARDENED VERIFICATION TESTS PASSED! <<<\e[0m"
  exit 0
else
  echo -e "\e[31m>>> SOME TESTS FAILED! <<<\e[0m"
  exit 1
fi
