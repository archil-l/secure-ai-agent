#!/bin/bash

# Script to create a new CloudFront public key, update .env, and prompt for CDK deploy
# Usage: bash ./keys/add-cloudfront-public-key.sh

# Always use the directory of this script for file paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUB_KEY_FILE="$SCRIPT_DIR/public-key.pem"
CONFIG_JSON="$SCRIPT_DIR/public-key-config.json"
KEY_NAME="chatbot-cloudfront-key-$(date +%s)"
CALLER_REF="cf-key-$(date +%s)"

if [ ! -f "$PUB_KEY_FILE" ]; then
  echo "Public key file $PUB_KEY_FILE not found!"
  exit 1
fi

# Read the public key and escape newlines for JSON
ENCODED_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' $PUB_KEY_FILE)

# Create the JSON config file
cat > $CONFIG_JSON <<EOL
{
  "CallerReference": "$CALLER_REF",
  "Name": "$KEY_NAME",
  "EncodedKey": "$ENCODED_KEY",
  "Comment": "CloudFront public key for chatbot"
}
EOL

# Create the CloudFront public key and get the new ID
NEW_PUB_KEY_ID=$(aws cloudfront create-public-key \
  --public-key-config file://$CONFIG_JSON \
  --query 'PublicKey.Id' --output text)

if [ -z "$NEW_PUB_KEY_ID" ]; then
  echo "Failed to create new CloudFront public key."
  rm -f $CONFIG_JSON
  exit 1
fi

# Update .env with the new key ID
if grep -q "^KEY_PAIR_ID=" .env; then
  sed -i '' "s/^KEY_PAIR_ID=.*/KEY_PAIR_ID=$NEW_PUB_KEY_ID/" .env
else
  echo "KEY_PAIR_ID=$NEW_PUB_KEY_ID" >> .env
fi

# Clean up
echo "Cleaning up $CONFIG_JSON..."
rm -f $CONFIG_JSON

echo "New CloudFront public key created: $NEW_PUB_KEY_ID"
echo "Updated .env with new KEY_PAIR_ID."
echo "Now run: cdk deploy to use the new key in your infrastructure."
