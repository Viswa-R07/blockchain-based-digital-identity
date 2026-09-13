#!/bin/bash
set -euo pipefail

export PATH=/home/viswa_r07/blockchain-identity/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=/home/viswa_r07/blockchain-identity/fabric-samples/config

CC_NAME="identity-registry"
CC_VERSION="1.0"
CC_SRC_PATH="/home/viswa_r07/blockchain-identity/chaincode/identity-registry"
PKG_DIR="/home/viswa_r07/blockchain-identity/network/channel-artifacts/chaincode"
mkdir -p "${PKG_DIR}"

echo "========================================================="
echo " Compiling TypeScript & Packaging ${CC_NAME}_${CC_VERSION}"
echo "========================================================="

cd "${CC_SRC_PATH}"

echo "Step 1: Installing dependencies..."
npm install

echo "Step 2: Building TypeScript..."
npm run build

echo "Step 3: Running Unit Tests..."
npm test

echo "Step 4: Packaging Chaincode via peer lifecycle..."
peer lifecycle chaincode package "${PKG_DIR}/${CC_NAME}_${CC_VERSION}.tar.gz" \
  --path "${CC_SRC_PATH}" \
  --lang node \
  --label "${CC_NAME}_${CC_VERSION}"

echo "Package created successfully: ${PKG_DIR}/${CC_NAME}_${CC_VERSION}.tar.gz"
ls -lh "${PKG_DIR}/${CC_NAME}_${CC_VERSION}.tar.gz"
