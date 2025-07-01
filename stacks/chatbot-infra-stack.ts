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
const DOMAIN = process.env.DOMAIN || '';

export const createChatbotInfraStack = (
  scope: Construct,
  id: string,
  props?: cdk.StackProps
) => {
  const stack = new cdk.Stack(scope, id, props);

  const chatFn = new lambda.Function(stack, 'ChatFunction', {
    runtime: lambda.Runtime.NODEJS_22_X,
    code: lambda.Code.fromAsset('lambda/chatbot/dist'), // Use transpiled JS
    handler: 'index.handler',
    logRetention: logs.RetentionDays.ONE_WEEK,
  });

  const api = new apigw.LambdaRestApi(stack, 'ChatApi', {
    handler: chatFn,
    proxy: true,
  });

  // Reference existing CloudFront public key by ID
  const cfPubKey = cloudfront.PublicKey.fromPublicKeyId(
    stack,
    'ChatCFPublicKey',
    KEY_PAIR_ID
  );

  const cfKeyGroup = new cloudfront.KeyGroup(stack, 'ChatCFKeyGroup', {
    items: [cfPubKey],
  });

  const distribution = new cloudfront.Distribution(
    stack,
    'ChatCFDistribution',
    {
      defaultBehavior: {
        origin: new origins.HttpOrigin(
          `${api.restApiId}.execute-api.${stack.region}.amazonaws.com`
        ),
        trustedKeyGroups: [cfKeyGroup], // Require signed cookies for API access
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      },
    }
  );

  const cookieSignerFn = new lambda.Function(stack, 'CookieSignerFunction', {
    runtime: lambda.Runtime.NODEJS_22_X,
    code: lambda.Code.fromAsset('lambda/cookie-signer/dist'), // Use transpiled JS
    handler: 'index.handler',
    environment: {
      KEY_PAIR_ID,
      PRIVATE_KEY_SECRET_NAME: 'cloudfront/private-key', // Name of your secret in Secrets Manager
      DOMAIN,
    },
  });

  // Grant Lambda permission to read the secret
  cookieSignerFn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [
        `arn:aws:secretsmanager:${stack.region}:${stack.account}:secret:cloudfront/private-key*`,
      ],
    })
  );

  const cookieSignerApi = new apigw.LambdaRestApi(stack, 'CookieSignerApi', {
    handler: cookieSignerFn,
    proxy: true,
    deployOptions: {
      stageName: 'prod',
    },
  });

  // Add a behavior to CloudFront for /sign-cookie
  distribution.addBehavior(
    '/sign-cookie',
    new origins.HttpOrigin(
      `${cookieSignerApi.restApiId}.execute-api.${stack.region}.amazonaws.com`
    ),
    {
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
    }
  );

  new cdk.CfnOutput(stack, 'CloudFrontURL', {
    value: `https://${distribution.domainName}`,
  });

  new cdk.CfnOutput(stack, 'CookieSignerURL', {
    value: cookieSignerFn.functionArn,
  });

  return stack;
};
