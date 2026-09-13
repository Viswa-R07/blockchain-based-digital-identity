#!/bin/bash
set -euo pipefail

export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH
NET=/home/viswa_r07/blockchain-identity/network

echo "=== Joining orderer1 (GovMSP) to identity-channel ==="
osnadmin channel join --channelID identity-channel \
  --config-block "${NET}/channel-artifacts/identity-channel.block" \
  -o localhost:7053 \
  --ca-file "${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/ca.crt" \
  --client-cert "${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/server.crt" \
  --client-key "${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/server.key"

echo "=== Joining orderer2 (UniversityMSP) to identity-channel ==="
osnadmin channel join --channelID identity-channel \
  --config-block "${NET}/channel-artifacts/identity-channel.block" \
  -o localhost:8053 \
  --ca-file "${NET}/organizations/ordererOrganizations/university.example.com/orderers/orderer2.university.example.com/tls/ca.crt" \
  --client-cert "${NET}/organizations/ordererOrganizations/university.example.com/orderers/orderer2.university.example.com/tls/server.crt" \
  --client-key "${NET}/organizations/ordererOrganizations/university.example.com/orderers/orderer2.university.example.com/tls/server.key"

echo "=== Joining orderer3 (BankMSP) to identity-channel ==="
osnadmin channel join --channelID identity-channel \
  --config-block "${NET}/channel-artifacts/identity-channel.block" \
  -o localhost:9053 \
  --ca-file "${NET}/organizations/ordererOrganizations/bank.example.com/orderers/orderer3.bank.example.com/tls/ca.crt" \
  --client-cert "${NET}/organizations/ordererOrganizations/bank.example.com/orderers/orderer3.bank.example.com/tls/server.crt" \
  --client-key "${NET}/organizations/ordererOrganizations/bank.example.com/orderers/orderer3.bank.example.com/tls/server.key"

echo "=== Checking channel list on orderers ==="
osnadmin channel list -o localhost:7053 \
  --ca-file "${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/ca.crt" \
  --client-cert "${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/server.crt" \
  --client-key "${NET}/organizations/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/tls/server.key"

echo "All 3 orderers successfully joined identity-channel!"
