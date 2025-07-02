import { APIGatewayProxyHandler } from 'aws-lambda';

const DOMAIN = process.env.DOMAIN || '';

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const corsOrigin = `https://${DOMAIN}`;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST',
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: 'Hello from your new Agent!' }),
  };
};
