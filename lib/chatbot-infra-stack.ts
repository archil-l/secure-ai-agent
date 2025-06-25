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

export class ChatbotInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const chatFn = new lambda.Function(this, 'ChatFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda/chatbot'),
      handler: 'index.handler',
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const api = new apigw.LambdaRestApi(this, 'ChatApi', {
      handler: chatFn,
      proxy: true,
    });

    // Remove Node.js-specific __dirname usage for CDK context
    const pubKeyPath = path.resolve('public_key.pem');
    const pubKeyBody = fs.readFileSync(pubKeyPath, 'utf8');
    const cfPubKey = new cloudfront.PublicKey(this, 'ChatCFPublicKey', {
      encodedKey: pubKeyBody,
      comment: 'Public key for signed cookie access',
    });

    const cfKeyGroup = new cloudfront.KeyGroup(this, 'ChatCFKeyGroup', {
      items: [cfPubKey],
    });

    const distribution = new cloudfront.Distribution(
      this,
      'ChatCFDistribution',
      {
        defaultBehavior: {
          origin: new origins.HttpOrigin(
            `${api.restApiId}.execute-api.${this.region}.amazonaws.com`,
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

    const cookieSignerFn = new lambda.Function(this, 'CookieSignerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('cookie-signer'),
      handler: 'index.handler',
      environment: {
        KEY_PAIR_ID: '<REPLACE_WITH_KEY_PAIR_ID>',
      },
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.domainName}`,
    });

    new cdk.CfnOutput(this, 'CookieSignerURL', {
      value: cookieSignerFn.functionArn,
    });
  }
}
