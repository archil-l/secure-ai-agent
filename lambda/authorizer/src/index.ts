import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from 'aws-lambda';
import crypto from 'crypto';

const secretsClient = new SecretsManagerClient({});
const secretName = process.env.SECRET_NAME!;

export const handler = async (
  event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || '';
  const cookieMap = Object.fromEntries(
    cookieHeader.split(';').map((c) => c.trim().split('=')) as [
      string,
      string
    ][]
  );

  const {
    'WS-Policy': policy,
    'WS-Signature': signature,
    'WS-Auth-Id': authId,
  } = cookieMap;

  if (!policy || !signature || !authId) {
    console.error('Missing signed cookies');
    return generatePolicy('user', 'Deny', event.methodArn);
  }

  try {
    const { SecretString = '{}' } = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    const { publicKey } = JSON.parse(SecretString);

    const decodedPolicy = Buffer.from(
      policy.replace(/-/g, '+').replace(/_/g, '=').replace(/~/g, '/'),
      'base64'
    ).toString();

    const verifier = crypto.createVerify('RSA-SHA1');
    verifier.update(decodedPolicy);

    const valid = verifier.verify(
      publicKey,
      signature.replace(/-/g, '+').replace(/_/g, '=').replace(/~/g, '/'),
      'base64'
    );

    if (!valid) {
      console.error('Invalid signature');
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    return generatePolicy(authId, 'Allow', event.methodArn, {
      userId: authId,
    });
  } catch (error) {
    console.error('Error validating signature:', error);
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

/**
 * Helper function to generate an IAM policy
 */
const generatePolicy = (
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, any>
): APIGatewayAuthorizerResult => {
  const policyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource,
      },
    ],
  };

  const response: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument,
    ...(context && { context }),
  };

  return response;
};
