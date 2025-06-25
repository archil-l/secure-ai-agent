# CloudFront Signed Cookies Setup

This project uses AWS CloudFront signed cookies for secure access. Follow these steps to generate and configure your key pair:

## 1. Generate an RSA Key Pair Locally

Open your terminal and run:

```sh
# Generate a 2048-bit private key
openssl genrsa -out private_key.pem 2048

# Extract the public key in PEM format
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

- `private_key.pem`: Keep this file secure. Use it for signing cookies.
- `public_key.pem`: This will be uploaded to CloudFront and referenced in your CDK stack.

## 2. Upload the Public Key to CloudFront

1. Go to the AWS Console → CloudFront → Public keys.
2. Click **Create public key**.
3. Paste the contents of `public_key.pem` or upload the file.
4. Give it a name and comment.
5. After creation, note the **Key Pair ID** assigned by AWS.

## 3. Store Your Private Key in AWS Secrets Manager

- Store the contents of your `private_key.pem` in AWS Secrets Manager (e.g., as a secret named `cloudfront/private-key`).
- Grant your Lambda function permission to access this secret.
- Set the secret name as an environment variable in your Lambda (e.g., `PRIVATE_KEY_SECRET_NAME`).

## 4. Update Your Lambda Code to Use Secrets Manager

Your Lambda should fetch the private key from Secrets Manager at runtime. Example (Node.js):

```js
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient();
const secretName = process.env.PRIVATE_KEY_SECRET_NAME;

async function getPrivateKey() {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return response.SecretString;
}
```

## 5. Update Your Project

- Place `public_key.pem` in your project root.
- In your CDK code, replace `<REPLACE_WITH_KEY_PAIR_ID>` with the Key Pair ID from AWS.

```typescript
environment: {
  KEY_PAIR_ID: 'KXXXXXXXXXXXXXX',
},
```

---

Keep your private key safe and never commit it to version control. Use AWS Secrets Manager for secure access.
