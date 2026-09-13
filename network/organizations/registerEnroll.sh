#!/usr/bin/env bash
set -e

NETWORK_ROOT="/home/viswa_r07/blockchain-identity/network"
export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH

function createNodeOUConfig() {
  local MSP_DIR=$1
  local CA_CERT=$2

  cat <<EOF > "${MSP_DIR}/config.yaml"
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/${CA_CERT}
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/${CA_CERT}
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/${CA_CERT}
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/${CA_CERT}
    OrganizationalUnitIdentifier: orderer
EOF
}

function enrollOrg() {
  local ORG=$1
  local DOMAIN=$2
  local PORT=$3
  local CA_NAME="ca-${ORG}"
  local CA_CERT_FILE="${NETWORK_ROOT}/organizations/fabric-ca/${ORG}/ca-cert.pem"
  local ORG_MSP="${NETWORK_ROOT}/organizations/peerOrganizations/${DOMAIN}/msp"

  echo "=========================================================="
  echo "Enrolling CA Admin & Generating MSP for ${ORG} (${DOMAIN})"
  echo "=========================================================="

  mkdir -p "${NETWORK_ROOT}/organizations/peerOrganizations/${DOMAIN}"

  export FABRIC_CA_CLIENT_HOME="${NETWORK_ROOT}/organizations/peerOrganizations/${DOMAIN}"

  # Wait for CA to be responsive
  echo "Waiting for ${CA_NAME} on port ${PORT}..."
  local COUNT=0
  until curl -s --cacert "${CA_CERT_FILE}" "https://localhost:${PORT}/cainfo" > /dev/null 2>&1 || [ $COUNT -eq 30 ]; do
    sleep 1
    COUNT=$((COUNT + 1))
  done

  # Enroll CA bootstrap admin
  fabric-ca-client enroll \
    -u "https://admin:adminpw@localhost:${PORT}" \
    --caname "${CA_NAME}" \
    --tls.certfiles "${CA_CERT_FILE}"

  # Copy CA cert to Org MSP cacerts
  mkdir -p "${ORG_MSP}/cacerts" "${ORG_MSP}/tlscacerts"
  cp "${NETWORK_ROOT}/organizations/fabric-ca/${ORG}/ca-cert.pem" "${ORG_MSP}/cacerts/ca.${DOMAIN}-cert.pem"
  cp "${NETWORK_ROOT}/organizations/fabric-ca/${ORG}/ca-cert.pem" "${ORG_MSP}/tlscacerts/tlsca.${DOMAIN}-cert.pem"

  createNodeOUConfig "${ORG_MSP}" "ca.${DOMAIN}-cert.pem"

  # Register Peers
  for P in 0 1; do
    echo "Registering & Enrolling peer${P}.${DOMAIN}..."
    fabric-ca-client register \
      --caname "${CA_NAME}" \
      --id.name "peer${P}" \
      --id.secret "peer${P}pw" \
      --id.type peer \
      --tls.certfiles "${CA_CERT_FILE}"

    local PEER_DIR="${NETWORK_ROOT}/organizations/peerOrganizations/${DOMAIN}/peers/peer${P}.${DOMAIN}"
    mkdir -p "${PEER_DIR}"

    # Enroll peer identity MSP
    fabric-ca-client enroll \
      -u "https://peer${P}:peer${P}pw@localhost:${PORT}" \
      --caname "${CA_NAME}" \
      -M "${PEER_DIR}/msp" \
      --tls.certfiles "${CA_CERT_FILE}"

    cp "${ORG_MSP}/config.yaml" "${PEER_DIR}/msp/config.yaml"

    # Enroll peer TLS cert
    fabric-ca-client enroll \
      -u "https://peer${P}:peer${P}pw@localhost:${PORT}" \
      --caname "${CA_NAME}" \
      -M "${PEER_DIR}/tls" \
      --enrollment.profile tls \
      --csr.hosts "peer${P}.${DOMAIN},localhost,127.0.0.1" \
      --tls.certfiles "${CA_CERT_FILE}"

    cp "${PEER_DIR}/tls/tlscacerts/"* "${PEER_DIR}/tls/ca.crt"
    cp "${PEER_DIR}/tls/signcerts/"* "${PEER_DIR}/tls/server.crt"
    cp "${PEER_DIR}/tls/keystore/"* "${PEER_DIR}/tls/server.key"
  done

  # Register Org Admin
  echo "Registering & Enrolling Admin@${DOMAIN}..."
  fabric-ca-client register \
    --caname "${CA_NAME}" \
    --id.name "${ORG}admin" \
    --id.secret "${ORG}adminpw" \
    --id.type admin \
    --tls.certfiles "${CA_CERT_FILE}"

  local ADMIN_DIR="${NETWORK_ROOT}/organizations/peerOrganizations/${DOMAIN}/users/Admin@${DOMAIN}"
  mkdir -p "${ADMIN_DIR}"
  fabric-ca-client enroll \
    -u "https://${ORG}admin:${ORG}adminpw@localhost:${PORT}" \
    --caname "${CA_NAME}" \
    -M "${ADMIN_DIR}/msp" \
    --tls.certfiles "${CA_CERT_FILE}"

  cp "${ORG_MSP}/config.yaml" "${ADMIN_DIR}/msp/config.yaml"

  # Register Application Gateway Client Identity
  echo "Registering & Enrolling gateway@${DOMAIN}..."
  fabric-ca-client register \
    --caname "${CA_NAME}" \
    --id.name "${ORG}gateway" \
    --id.secret "${ORG}gatewaypw" \
    --id.type client \
    --tls.certfiles "${CA_CERT_FILE}"

  local USER_DIR="${NETWORK_ROOT}/organizations/peerOrganizations/${DOMAIN}/users/User1@${DOMAIN}"
  mkdir -p "${USER_DIR}"
  fabric-ca-client enroll \
    -u "https://${ORG}gateway:${ORG}gatewaypw@localhost:${PORT}" \
    --caname "${CA_NAME}" \
    -M "${USER_DIR}/msp" \
    --tls.certfiles "${CA_CERT_FILE}"

  cp "${ORG_MSP}/config.yaml" "${USER_DIR}/msp/config.yaml"
}

function enrollOrdererNode() {
  local ORDERER_NAME=$1
  local ORG=$2
  local DOMAIN=$3
  local PORT=$4
  local CA_NAME="ca-${ORG}"
  local CA_CERT_FILE="${NETWORK_ROOT}/organizations/fabric-ca/${ORG}/ca-cert.pem"
  local ORDERER_HOME="${NETWORK_ROOT}/organizations/ordererOrganizations/${DOMAIN}/orderers/${ORDERER_NAME}.${DOMAIN}"
  local ORDERER_MSP="${NETWORK_ROOT}/organizations/ordererOrganizations/${DOMAIN}/msp"

  echo "=========================================================="
  echo "Enrolling Orderer ${ORDERER_NAME}.${DOMAIN} via ${CA_NAME}"
  echo "=========================================================="

  mkdir -p "${ORDERER_HOME}" "${ORDERER_MSP}/cacerts" "${ORDERER_MSP}/tlscacerts"

  export FABRIC_CA_CLIENT_HOME="${NETWORK_ROOT}/organizations/peerOrganizations/${DOMAIN}"

  # Register orderer
  fabric-ca-client register \
    --caname "${CA_NAME}" \
    --id.name "${ORDERER_NAME}" \
    --id.secret "${ORDERER_NAME}pw" \
    --id.type orderer \
    --tls.certfiles "${CA_CERT_FILE}"

  # Enroll orderer MSP
  fabric-ca-client enroll \
    -u "https://${ORDERER_NAME}:${ORDERER_NAME}pw@localhost:${PORT}" \
    --caname "${CA_NAME}" \
    -M "${ORDERER_HOME}/msp" \
    --tls.certfiles "${CA_CERT_FILE}"

  # Enroll orderer TLS cert
  fabric-ca-client enroll \
    -u "https://${ORDERER_NAME}:${ORDERER_NAME}pw@localhost:${PORT}" \
    --caname "${CA_NAME}" \
    -M "${ORDERER_HOME}/tls" \
    --enrollment.profile tls \
    --csr.hosts "${ORDERER_NAME}.${DOMAIN},localhost,127.0.0.1" \
    --tls.certfiles "${CA_CERT_FILE}"

  cp "${ORDERER_HOME}/tls/tlscacerts/"* "${ORDERER_HOME}/tls/ca.crt"
  cp "${ORDERER_HOME}/tls/signcerts/"* "${ORDERER_HOME}/tls/server.crt"
  cp "${ORDERER_HOME}/tls/keystore/"* "${ORDERER_HOME}/tls/server.key"

  # Copy CA cert to Orderer Org MSP
  cp "${NETWORK_ROOT}/organizations/fabric-ca/${ORG}/ca-cert.pem" "${ORDERER_MSP}/cacerts/ca.${DOMAIN}-cert.pem"
  cp "${NETWORK_ROOT}/organizations/fabric-ca/${ORG}/ca-cert.pem" "${ORDERER_MSP}/tlscacerts/tlsca.${DOMAIN}-cert.pem"
  createNodeOUConfig "${ORDERER_MSP}" "ca.${DOMAIN}-cert.pem"
  cp "${ORDERER_MSP}/config.yaml" "${ORDERER_HOME}/msp/config.yaml"
}

# 1. Enroll Peer Organizations
enrollOrg "gov" "gov.identity.example.com" 7054
enrollOrg "university" "university.example.com" 8054
enrollOrg "bank" "bank.example.com" 9054
enrollOrg "employer" "employer.example.com" 10054

# 2. Enroll 3 Decentralized Raft Orderers across Gov, University, and Bank
enrollOrdererNode "orderer1" "gov" "gov.identity.example.com" 7054
enrollOrdererNode "orderer2" "university" "university.example.com" 8054
enrollOrdererNode "orderer3" "bank" "bank.example.com" 9054

echo ">>> ALL MSP AND TLS CRYPTO MATERIAL SUCCESSFULLY GENERATED <<<"
