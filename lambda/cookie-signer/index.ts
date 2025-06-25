import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import crypto from 'crypto';

const KEY_PAIR_ID = process.env.KEY_PAIR_ID as string;
const DOMAIN = process.env.DOMAIN as string;
const PRIVATE_KEY_SECRET_NAME = process.env.PRIVATE_KEY_SECRET_NAME as string;

const secretsClient = new SecretsManagerClient({});

async function getPrivateKey(): Promise<string> {
  const command = new GetSecretValueCommand({
    SecretId: PRIVATE_KEY_SECRET_NAME,
  });
  const response = await secretsClient.send(command);
  if (!response.SecretString)
    throw new Error('Private key not found in Secrets Manager');
  return response.SecretString;
}

export const handler = async (event: any) => {
  const domain = DOMAIN;
  const expires = Math.floor(Date.now() / 1000) + 60 * 60;

  const policy = JSON.stringify({
    Statement: [
      {
        Resource: 'https://*.cloudfront.net/*',
        Condition: {
          DateLessThan: { 'AWS:EpochTime': expires },
        },
      },
    ],
  });

  const policyBase64 = Buffer.from(policy)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/=/g, '_')
    .replace(/\//g, '~');

  const privateKey = await getPrivateKey();
  const signature = crypto
    .createSign('RSA-SHA1')
    .update(policy)
    .sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/=/g, '_')
    .replace(/\//g, '~');

  const headers = {
    'Set-Cookie': [
      `CloudFront-Policy=${policyBase64}; Domain=${domain}; Path=/; Secure; HttpOnly`,
      `CloudFront-Signature=${signature}; Domain=${domain}; Path=/; Secure; HttpOnly`,
      `CloudFront-Key-Pair-Id=${KEY_PAIR_ID}; Domain=${domain}; Path=/; Secure; HttpOnly`,
    ],
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
};
