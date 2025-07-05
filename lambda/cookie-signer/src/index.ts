import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { APIGatewayProxyHandler } from 'aws-lambda';
import crypto from 'crypto';

const AGENT_DOMAIN = process.env.AGENT_DOMAIN as string;
const DOMAIN = process.env.DOMAIN as string;
const SECRET_NAME = process.env.SECRET_NAME as string;

const secretsClient = new SecretsManagerClient({});

async function getPrivateKey(): Promise<string> {
  const command = new GetSecretValueCommand({
    SecretId: SECRET_NAME,
  });
  const response = await secretsClient.send(command);
  if (!response.SecretString) {
    console.error('Private key not found in Secrets Manager');
    throw new Error('Private key not found in Secrets Manager');
  }

  return response.SecretString;
}

export const handler: APIGatewayProxyHandler = async (event: any) => {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60;

  const policy = JSON.stringify({
    Statement: [
      {
        Resource: `wss://${AGENT_DOMAIN}/dev*`,
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

  const corsOrigin = `https://${DOMAIN}`;
  const headers = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET',
  };

  // Updated cookie names to reflect WebSocket authentication
  const multiValueHeaders = {
    'Set-Cookie': [
      `WS-Policy=${policyBase64}; Domain=${AGENT_DOMAIN}; Path=/; SameSite=None; Secure; HttpOnly`,
      `WS-Signature=${signature}; Domain=${AGENT_DOMAIN}; Path=/; SameSite=None; Secure; HttpOnly`,
      `WS-Auth-Id=WEBSOCKET-AUTH; Domain=${AGENT_DOMAIN}; Path=/; SameSite=None; Secure; HttpOnly`,
    ],
  };

  return {
    statusCode: 200,
    headers,
    multiValueHeaders,
    body: JSON.stringify({ success: true }),
  };
};
