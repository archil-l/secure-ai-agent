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
import * as fs from 'fs';
import * as path from 'path';

export const createChatbotInfraStack = (
  scope: Construct,
  id: string,
  props?: cdk.StackProps
) => {
  const stack = new cdk.Stack(scope, id, props);

  const chatFn = new lambda.Function(stack, 'ChatFunction', {
    runtime: lambda.Runtime.NODEJS_22_X,
    code: lambda.Code.fromAsset('lambda/chatbot'),
    handler: 'index.handler',
    logRetention: logs.RetentionDays.ONE_WEEK,
  });

  const api = new apigw.LambdaRestApi(stack, 'ChatApi', {
    handler: chatFn,
    proxy: true,
  });

  const pubKeyPath = path.resolve('public_key.pem');
  const pubKeyBody = fs.readFileSync(pubKeyPath, 'utf8');
  const cfPubKey = new cloudfront.PublicKey(stack, 'ChatCFPublicKey', {
    encodedKey: pubKeyBody,
    comment: 'Public key for signed cookie access',
  });

  const cfKeyGroup = new cloudfront.KeyGroup(stack, 'ChatCFKeyGroup', {
    items: [cfPubKey],
  });

  const distribution = new cloudfront.Distribution(
    stack,
    'ChatCFDistribution',
    {
      defaultBehavior: {
        origin: new origins.HttpOrigin(
          `${api.restApiId}.execute-api.${stack.region}.amazonaws.com`,
          {
            originPath: '/prod',
          }
        ),
        trustedKeyGroups: [cfKeyGroup],
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      },
    }
  );

  const cookieSignerFn = new lambda.Function(stack, 'CookieSignerFunction', {
    runtime: lambda.Runtime.NODEJS_22_X,
    code: lambda.Code.fromAsset('cookie-signer'),
    handler: 'index.handler',
    environment: {
      KEY_PAIR_ID: '<REPLACE_WITH_KEY_PAIR_ID>', // Replace with your actual Key Pair ID
      PRIVATE_KEY_SECRET_NAME: 'cloudfront/private-key', // Name of your secret in Secrets Manager
      DOMAIN: 'yourdomain.com', // Set your domain here or via context/parameter
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

  new cdk.CfnOutput(stack, 'CloudFrontURL', {
    value: `https://${distribution.domainName}`,
  });

  new cdk.CfnOutput(stack, 'CookieSignerURL', {
    value: cookieSignerFn.functionArn,
  });

  return stack;
};
