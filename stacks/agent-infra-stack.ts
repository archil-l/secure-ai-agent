import * as cdk from 'aws-cdk-lib';
import {
  aws_lambda as lambda,
  aws_apigateway as apigw,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_iam as iam,
  aws_logs as logs,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Load KEY_PAIR_ID and DOMAIN from environment variables, fallback to defaults if not set
const KEY_PAIR_ID = process.env.KEY_PAIR_ID || '';

export const createAgentInfraStack = (
  scope: Construct,
  id: string,
  props?: cdk.StackProps
) => {
  const stack = new cdk.Stack(scope, id, props);

  const agentFn = new lambda.Function(stack, 'AgentFunction', {
    runtime: lambda.Runtime.NODEJS_22_X,
    code: lambda.Code.fromAsset('lambda/agent/dist'), // Use transpiled JS
    handler: 'index.handler',
    logRetention: logs.RetentionDays.ONE_WEEK,
  });

  const agentApiHeader = 'X-From-CloudFront';
  const agentApiHeaderValue = 'true';

  const api = new apigw.LambdaRestApi(stack, 'AgentApi', {
    handler: agentFn,
    proxy: true,
    description: 'API for the secure AI agent',
  });

  // Reference existing CloudFront public key by ID
  const cfPubKey = cloudfront.PublicKey.fromPublicKeyId(
    stack,
    'AgentCFPublicKey',
    KEY_PAIR_ID
  );

  const cfKeyGroup = new cloudfront.KeyGroup(stack, 'AgentCFKeyGroup', {
    items: [cfPubKey],
  });

  const distribution = new cloudfront.Distribution(
    stack,
    'AgentCFDistribution',
    {
      defaultBehavior: {
        origin: new origins.HttpOrigin(
          `${api.restApiId}.execute-api.${stack.region}.amazonaws.com`, // Use the API Gateway stage
          {
            originPath: '/prod',
            customHeaders: {
              [agentApiHeader]: agentApiHeaderValue,
            },
          }
        ),
        trustedKeyGroups: [cfKeyGroup], // Require signed cookies for API access
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    }
  );

  const PRIVATE_KEY_SECRET_NAME = 'cloudfront/private-key'; // Name of your secret in Secrets Manager

  const cookieSignerFn = new lambda.Function(stack, 'CookieSignerFunction', {
    runtime: lambda.Runtime.NODEJS_22_X,
    code: lambda.Code.fromAsset('lambda/cookie-signer/dist'),
    handler: 'index.handler',
    environment: {
      KEY_PAIR_ID,
      PRIVATE_KEY_SECRET_NAME,
      DOMAIN: distribution.domainName,
    },
  });

  // Grant Lambda permission to read the secret
  cookieSignerFn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [
        `arn:aws:secretsmanager:${stack.region}:${stack.account}:secret:${PRIVATE_KEY_SECRET_NAME}*`,
      ],
    })
  );

  const cookieSignerApi = new apigw.LambdaRestApi(stack, 'CookieSignerApi', {
    handler: cookieSignerFn,
    proxy: true,
  });

  // Add a behavior to CloudFront for /sign-cookie
  distribution.addBehavior(
    '/sign-cookie',
    new origins.HttpOrigin(
      `${cookieSignerApi.restApiId}.execute-api.${stack.region}.amazonaws.com`,
      {
        originPath: '/prod',
      }
    ),
    {
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      originRequestPolicy:
        cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    }
  );

  new cdk.CfnOutput(stack, 'CloudFrontURL', {
    value: `https://${distribution.domainName}`,
  });

  return stack;
};
