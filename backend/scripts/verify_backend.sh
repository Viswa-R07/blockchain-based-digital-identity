#!/bin/bash
set -euo pipefail

BACKEND_DIR="/home/viswa_r07/blockchain-identity/backend"
CC_SCRIPTS="/home/viswa_r07/blockchain-identity/chaincode/identity-registry/scripts"
NET_SCRIPTS="/home/viswa_r07/blockchain-identity/network"

echo "================================================================================"
echo " Starting Milestone 8 Backend & End-to-End Verification Suite"
echo "================================================================================"

cd "${BACKEND_DIR}"

echo ""
echo "--- STEP 1: Building Backend (TypeScript Compilation) ---"
npm run build
echo "Build succeeded."

echo ""
echo "--- STEP 2: Running Backend Unit Tests (Mocked Fabric Gateway & Storage) ---"
npm run test:unit
echo "Unit tests passed."

echo ""
echo "--- STEP 3: Running Backend Integration Tests (Live Fabric Network) ---"
npm run test:integration
echo "Integration tests passed."

echo ""
echo "--- STEP 4: Running 8-Node CouchDB Privacy & Schema Audit ---"
python3 "${CC_SCRIPTS}/audit_couchdb.py"
echo "CouchDB audit passed."

echo ""
echo "--- STEP 5: Running Milestone 8 Off-Chain Storage Privacy Audit ---"
python3 "${BACKEND_DIR}/scripts/audit_storage_privacy.py"
echo "Off-chain storage privacy audit passed."

echo ""
echo "--- STEP 6: Running Milestone 4 Regression Suite ---"
"${CC_SCRIPTS}/verify_identity_registry.sh"
echo "Milestone 4 regression passed."

echo ""
echo "--- STEP 7: Running Milestone 5 Regression Suite ---"
"${CC_SCRIPTS}/verify_credential_registry.sh"
echo "Milestone 5 regression passed."

echo ""
echo "--- STEP 8: Running Milestone 6 Regression Suite ---"
"${CC_SCRIPTS}/verify_credential_revocation.sh"
echo "Milestone 6 regression passed."

echo ""
echo "--- STEP 9: Running Network Health Verification ---"
"${NET_SCRIPTS}/verify_network.sh"
echo "Network health verification passed."

echo ""
echo "================================================================================"
echo " ALL MILESTONE 8 VERIFICATION AND REGRESSION SUITES PASSED SUCCESSFULLY!"
echo "================================================================================"
