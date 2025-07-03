type ValidationResult = {
  isValid: boolean;
  response?: {
    statusCode: number;
    body: any;
  };
};

const DOMAIN = process.env.DOMAIN || '';
const corsOrigin = `https://${DOMAIN}`;

export const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': corsOrigin,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST',
};

export const validateRequest = (event: any): ValidationResult => {
  if (!event?.headers || !event?.headers['X-From-CloudFront']) {
    return {
      isValid: false,
      response: {
        statusCode: 403,
        body: { error: 'Forbidden: Invalid request' },
      },
    };
  }

  if (event?.httpMethod !== 'POST') {
    return {
      isValid: false,
      response: {
        statusCode: 405,
        body: { error: 'Method Not Allowed' },
      },
    };
  }

  if (!event?.body) {
    return {
      isValid: false,
      response: {
        statusCode: 400,
        body: { error: 'Missing request body' },
      },
    };
  }
  const { prompt } = JSON.parse(event?.body) || {};

  if (!prompt) {
    return {
      isValid: false,
      response: {
        statusCode: 400,
        body: { error: 'Missing prompt' },
      },
    };
  }

  return { isValid: true };
};
