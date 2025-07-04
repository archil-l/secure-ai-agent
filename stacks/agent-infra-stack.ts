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

const KEY_PAIR_ID = process.env.KEY_PAIR_ID || '';
const DOMAIN = process.env.DOMAIN || 'archil.io';

export const createAgentInfraStack = (
  scope: Construct,
  id: string,
  props?: cdk.StackProps
) => {
  const stack = new cdk.Stack(scope, id, props);

  // Create the Lambda function for the AI agent
  const agentFn = new lambda.Function(stack, 'AgentFunction', {
    runtime: lambda.Runtime.NODEJS_22_X,
    code: lambda.Code.fromAsset('lambda/agent/dist'), // Using transpiled JS
    handler: 'index.handler',
    timeout: cdk.Duration.seconds(15),
    logRetention: logs.RetentionDays.ONE_WEEK,
    environment: {
      DOMAIN,
    },
  });

  agentFn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'], // Optionally restrict to specific model ARN
    })
  );

  const api = new apigw.LambdaRestApi(stack, 'AgentApi', {
    handler: agentFn,
    proxy: true,
    description: 'API for the secure AI agent',
  });

  // Create CloudFront distribution for the API

  const cfPubKey = cloudfront.PublicKey.fromPublicKeyId(
    stack,
    'AgentCFPublicKey',
    KEY_PAIR_ID
  );

  const cfKeyGroup = new cloudfront.KeyGroup(stack, 'AgentCFKeyGroup', {
    items: [cfPubKey],
  });

  const agentApiHeader = 'X-From-CloudFront';
  const agentApiHeaderValue = 'true';

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

  // Create the Lambda function for signing cookies

  const PRIVATE_KEY_SECRET_NAME = 'cloudfront/private-key'; // Name of the secret in Secrets Manager

  const cookieSignerFn = new lambda.Function(stack, 'CookieSignerFunction', {
    runtime: lambda.Runtime.NODEJS_22_X,
    code: lambda.Code.fromAsset('lambda/cookie-signer/dist'),
    handler: 'index.handler',
    environment: {
      KEY_PAIR_ID,
      PRIVATE_KEY_SECRET_NAME,
      AGENT_DOMAIN: distribution.domainName,
      DOMAIN,
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

  // Using same CloudFront distribution with a new behavior for signing cookies

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
