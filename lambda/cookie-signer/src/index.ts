import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { APIGatewayProxyHandler } from 'aws-lambda';
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
  if (!response.SecretString) {
    console.error('Private key not found in Secrets Manager');
    throw new Error('Private key not found in Secrets Manager');
  }

  return response.SecretString;
}

export const handler: APIGatewayProxyHandler = async (event: any) => {
  const domain = DOMAIN;
  const expires = Math.floor(Date.now() / 1000) + 60 * 60;

  console.log('Signing cookie for domain:', domain);

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

  if (!privateKey) {
    console.error('Failed to retrieve private key');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
  const signature = crypto
    .createSign('RSA-SHA1')
    .update(policy)
    .sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/=/g, '_')
    .replace(/\//g, '~');

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET',
  };

  const multiValueHeaders = {
    'Set-Cookie': [
      `CloudFront-Policy=${policyBase64}; Domain=${domain}; Path=/; Secure; HttpOnly`,
      `CloudFront-Signature=${signature}; Domain=${domain}; Path=/; Secure; HttpOnly`,
      `CloudFront-Key-Pair-Id=${KEY_PAIR_ID}; Domain=${domain}; Path=/; Secure; HttpOnly`,
    ],
  };

  return {
    statusCode: 200,
    headers,
    multiValueHeaders,
    body: JSON.stringify({ success: true }),
  };
};
