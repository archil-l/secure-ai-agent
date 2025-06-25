import crypto from 'crypto';

// Load private key and domain from environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const DOMAIN = process.env.DOMAIN as string;

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

  const signature = crypto
    .createSign('RSA-SHA1')
    .update(policy)
    .sign(PRIVATE_KEY, 'base64')
    .replace(/\+/g, '-')
    .replace(/=/g, '_')
    .replace(/\//g, '~');

  const headers = {
    'Set-Cookie': [
      `CloudFront-Policy=${policyBase64}; Domain=${domain}; Path=/; Secure; HttpOnly`,
      `CloudFront-Signature=${signature}; Domain=${domain}; Path=/; Secure; HttpOnly`,
      `CloudFront-Key-Pair-Id=${process.env.KEY_PAIR_ID}; Domain=${domain}; Path=/; Secure; HttpOnly`,
    ],
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
};
