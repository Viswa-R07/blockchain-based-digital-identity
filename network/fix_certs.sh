#!/bin/bash
set -euo pipefail

BASE="/home/viswa_r07/blockchain-identity/network/organizations"

# Orderers
cp "${BASE}/ordererOrganizations/gov.identity.example.com/msp/cacerts/ca.gov.identity.example.com-cert.pem" \
   "${BASE}/ordererOrganizations/gov.identity.example.com/orderers/orderer1.gov.identity.example.com/msp/cacerts/"

cp "${BASE}/ordererOrganizations/university.example.com/msp/cacerts/ca.university.example.com-cert.pem" \
   "${BASE}/ordererOrganizations/university.example.com/orderers/orderer2.university.example.com/msp/cacerts/"

cp "${BASE}/ordererOrganizations/bank.example.com/msp/cacerts/ca.bank.example.com-cert.pem" \
   "${BASE}/ordererOrganizations/bank.example.com/orderers/orderer3.bank.example.com/msp/cacerts/"

# Peers and users
for org in gov.identity.example.com university.example.com bank.example.com employer.example.com; do
  CA_CERT="${BASE}/peerOrganizations/${org}/msp/cacerts/ca.${org}-cert.pem"
  for p in peer0 peer1; do
    P_DIR="${BASE}/peerOrganizations/${org}/peers/${p}.${org}/msp/cacerts"
    mkdir -p "${P_DIR}"
    cp "${CA_CERT}" "${P_DIR}/"
  done
  for u in Admin User1; do
    U_DIR="${BASE}/peerOrganizations/${org}/users/${u}@${org}/msp/cacerts"
    if [ -d "${U_DIR}" ]; then
      cp "${CA_CERT}" "${U_DIR}/"
    fi
  done
done

echo "Node MSP CA certificates synced successfully."
