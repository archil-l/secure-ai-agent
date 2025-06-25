# Using AWS Secrets Manager for CloudFront Private Key

You can securely store your CloudFront private key in AWS Secrets Manager and retrieve it in your Lambda function for signing cookies. This is recommended for production environments.

## 1. Store the Private Key in AWS Secrets Manager

1. Go to the AWS Console → Secrets Manager → Store a new secret.
2. Select "Other type of secret".
3. Paste the contents of your `private_key.pem` as the value (you may use a key like `privateKey`).
4. Name your secret (e.g., `cloudfront/private-key`).
5. Save the ARN or name of the secret.

## 2. Grant Lambda Permission to Access the Secret

In your CDK stack, add a policy to your Lambda function:

```typescript
cookieSignerFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['secretsmanager:GetSecretValue'],
    resources: [
      'arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:cloudfront/private-key*',
    ],
  })
);
```

Replace `REGION` and `ACCOUNT_ID` with your values.

## 3. Retrieve the Private Key in Lambda

Install the AWS SDK v3 in your Lambda package if not already present:

```sh
npm install @aws-sdk/client-secrets-manager
```

Example code to fetch the private key:

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

Set the secret name as an environment variable in your Lambda:

```typescript
environment: {
  KEY_PAIR_ID: 'KXXXXXXXXXXXXXX',
  PRIVATE_KEY_SECRET_NAME: 'cloudfront/private-key',
},
```

---

Never store your private key in your code or repository. Use Secrets Manager for secure access.
