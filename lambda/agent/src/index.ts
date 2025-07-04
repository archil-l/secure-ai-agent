import { APIGatewayProxyHandler } from 'aws-lambda';
import { headers, validateRequest } from './utils';
import { getBedrockResponse } from './bedrock';

export const handler: APIGatewayProxyHandler = async (event) => {
  const { isValid, response } = validateRequest(event);
  if (!isValid) {
    return {
      statusCode: response?.statusCode ?? 400, // Ensure statusCode is always a number
      headers,
      body: JSON.stringify(response?.body),
    };
  }

  const { conversation } = JSON.parse(event.body || '{}') || {};

  try {
    const modelResponse = await getBedrockResponse(conversation);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ answer: modelResponse }),
    };
  } catch (error: any) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to get response from Bedrock',
        details: error?.message,
      }),
    };
  }
};
