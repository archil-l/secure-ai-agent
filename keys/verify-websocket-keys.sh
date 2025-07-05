#!/bin/bash

# Script to verify WebSocket authentication keys are properly stored in AWS Secrets Manager
# Usage: bash ./keys/verify-websocket-keys.sh

# Always use the directory of this script for file paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRET_NAME="WebSocketAuthKeys"

echo "Verifying WebSocket authentication keys in AWS Secrets Manager..."

# Check if the secret exists
aws secretsmanager describe-secret --secret-id "$SECRET_NAME" > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Secret '$SECRET_NAME' exists in AWS Secrets Manager."
  
  # Get the secret value to verify it contains both keys
  SECRET_VALUE=$(aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --query 'SecretString' --output text)
  
  if echo "$SECRET_VALUE" | grep -q "privateKey" && echo "$SECRET_VALUE" | grep -q "publicKey"; then
    echo "✅ Secret contains both private and public keys."
    echo "WebSocket authentication keys are properly configured."
  else
    echo "❌ Secret does not contain both private and public keys."
    echo "Please run 'yarn keys:update' to generate and store the keys properly."
  fi
else
  echo "❌ Secret '$SECRET_NAME' does not exist in AWS Secrets Manager."
  echo "Please run 'yarn keys:update' to generate and store the keys."
fi
