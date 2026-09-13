#!/usr/bin/env bash
set -e

cd /home/viswa_r07/blockchain-identity/fabric-samples/test-network
export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=/home/viswa_r07/blockchain-identity/fabric-samples/config

source scripts/envVar.sh
setGlobals 1

echo "========================================================="
echo "STEP 1: PRE-INVOKE QUERY (Querying GetAllAssets on mychannel)"
echo "========================================================="
QUERY_RESULT=$(peer chaincode query -C mychannel -n basic -c '{"Args":["GetAllAssets"]}')
echo "Pre-invoke Query Result: $QUERY_RESULT"

echo ""
echo "========================================================="
echo "STEP 2: CHAINCODE INVOKE (Invoking InitLedger)"
echo "========================================================="
peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile "$ORDERER_CA" \
  -C mychannel \
  -n basic \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles "$PEER0_ORG1_CA" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "$PEER0_ORG2_CA" \
  -c '{"function":"InitLedger","Args":[]}'

# Allow a moment for consensus and block commitment
sleep 3

echo ""
echo "========================================================="
echo "STEP 3: POST-INVOKE QUERY (Querying GetAllAssets on mychannel)"
echo "========================================================="
POST_QUERY=$(peer chaincode query -C mychannel -n basic -c '{"Args":["GetAllAssets"]}')
echo "Post-invoke Query Result (all assets):"
echo "$POST_QUERY" | jq .

echo ""
echo "========================================================="
echo "STEP 4: SPECIFIC ASSET QUERY (ReadAsset for asset1)"
echo "========================================================="
ASSET1=$(peer chaincode query -C mychannel -n basic -c '{"Args":["ReadAsset","asset1"]}')
echo "Asset1 Details:"
echo "$ASSET1" | jq .

echo ""
echo "========================================================="
echo "STEP 5: SECOND INVOKE (Create a new custom test asset)"
echo "========================================================="
peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile "$ORDERER_CA" \
  -C mychannel \
  -n basic \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles "$PEER0_ORG1_CA" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "$PEER0_ORG2_CA" \
  -c '{"function":"CreateAsset","Args":["asset7","violet","15","GovIdentity","450"]}'

sleep 3

echo ""
echo "========================================================="
echo "STEP 6: POST-CREATE QUERY (Verify newly created asset7)"
echo "========================================================="
ASSET7=$(peer chaincode query -C mychannel -n basic -c '{"Args":["ReadAsset","asset7"]}')
echo "Newly Created Asset7:"
echo "$ASSET7" | jq .

echo ""
echo ">>> ALL QUERY AND INVOKE VALIDATIONS COMPLETED SUCCESSFULLY! <<<"
