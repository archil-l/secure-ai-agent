// CDK v2 - WebSocket API with Lambda Authorizer using WebSocket Signed Cookies
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';

const DOMAIN = process.env.DOMAIN || 'archil.io';

export const createWebSocketAuthStack = (
  scope: Construct,
  id: string,
  props?: cdk.StackProps
): cdk.Stack => {
  // Create the stack
  const stack = new cdk.Stack(scope, id, props);

  // Get the key pair secret
  const keyPairSecret = secretsmanager.Secret.fromSecretNameV2(
    stack,
    'KeyPairSecret',
    'WebSocketAuthKeys'
  );

  // Authorizer Lambda (validates signed cookies)
  const authorizerFn = new lambda.Function(stack, 'AuthorizerFn', {
    runtime: lambda.Runtime.NODEJS_22_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda/authorizer/dist'),
    environment: {
      SECRET_NAME: 'WebSocketAuthKeys',
    },
  });

  // Grant read permissions to the authorizer function
  keyPairSecret.grantRead(authorizerFn);

  // Agent Lambda function for WebSocket
  const agentFn = new lambda.Function(stack, 'AgentHandler', {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/agent/dist')),
    environment: {
      // Add any environment variables needed by the agent
      NODE_ENV: 'production',
      DOMAIN,
    },
    timeout: cdk.Duration.seconds(30),
    memorySize: 256,
  });

  // Add Bedrock permissions to the agent function
  agentFn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'], // Optionally restrict to specific model ARN
    })
  );

  // WebSocket API
  const wsApi = new apigatewayv2.CfnApi(stack, 'WebSocketAPI', {
    name: 'SecureWebSocketAPI',
    protocolType: 'WEBSOCKET',
    routeSelectionExpression: '$request.body.action',
  });

  // Authorizer for WebSocket
  const lambdaAuth = new apigatewayv2.CfnAuthorizer(
    stack,
    'WebSocketAuthorizer',
    {
      apiId: wsApi.ref,
      authorizerType: 'REQUEST',
      name: 'WebSocketLambdaAuth',
      identitySource: ['$request.header.cookie'],
      authorizerUri: `arn:aws:apigateway:${stack.region}:lambda:path/2015-03-31/functions/${authorizerFn.functionArn}/invocations`,
    }
  );

  // Permissions for API Gateway to invoke Lambda
  authorizerFn.addPermission('APIGatewayInvokeAuth', {
    principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    action: 'lambda:InvokeFunction',
    sourceArn: `arn:aws:execute-api:${stack.region}:${stack.account}:${wsApi.ref}/*/*/*`,
  });

  agentFn.addPermission('APIGatewayInvokeAgent', {
    principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    action: 'lambda:InvokeFunction',
    sourceArn: `arn:aws:execute-api:${stack.region}:${stack.account}:${wsApi.ref}/*/*/*`,
  });

  // Add permissions for the agent to manage WebSocket connections
  agentFn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${stack.region}:${stack.account}:${wsApi.ref}/*`,
      ],
    })
  );

  // Integration for all WebSocket routes
  const agentIntegration = new apigatewayv2.CfnIntegration(
    stack,
    'AgentIntegration',
    {
      apiId: wsApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${stack.region}:lambda:path/2015-03-31/functions/${agentFn.functionArn}/invocations`,
    }
  );

  // Create the connect route with authorization
  const connectRoute = new apigatewayv2.CfnRoute(stack, 'ConnectRoute', {
    apiId: wsApi.ref,
    routeKey: '$connect',
    authorizationType: 'CUSTOM',
    authorizerId: lambdaAuth.ref,
    target: `integrations/${agentIntegration.ref}`,
  });

  // Create the disconnect route
  const disconnectRoute = new apigatewayv2.CfnRoute(stack, 'DisconnectRoute', {
    apiId: wsApi.ref,
    routeKey: '$disconnect',
    authorizationType: 'NONE',
    target: `integrations/${agentIntegration.ref}`,
  });

  // Create the sendMessage route
  const sendMessageRoute = new apigatewayv2.CfnRoute(
    stack,
    'SendMessageRoute',
    {
      apiId: wsApi.ref,
      routeKey: 'sendMessage',
      authorizationType: 'NONE', // Already authenticated on connect
      target: `integrations/${agentIntegration.ref}`,
    }
  );

  // Deployment + stage
  const deployment = new apigatewayv2.CfnDeployment(stack, 'Deployment', {
    apiId: wsApi.ref,
  });

  // Create the stage
  const stage = new apigatewayv2.CfnStage(stack, 'Stage', {
    apiId: wsApi.ref,
    stageName: 'dev',
    deploymentId: deployment.ref,
    autoDeploy: true,
  });

  // Output the WebSocket URL
  const wsApiDomain = `${wsApi.ref}.execute-api.${stack.region}.amazonaws.com`;
  const wsApiUrl = `wss://${wsApiDomain}/dev`;

  new cdk.CfnOutput(stack, 'WebSocketURL', {
    value: wsApiUrl,
    description: 'URL of the WebSocket API',
  });

  // Create the Lambda function for signing cookies
  const SECRET_NAME = 'WebSocketAuthKeys'; // Using the same secret name as the authorizer

  const cookieSignerFn = new lambda.Function(stack, 'CookieSignerFunction', {
    runtime: lambda.Runtime.NODEJS_22_X,
    code: lambda.Code.fromAsset('lambda/cookie-signer/dist'),
    handler: 'index.handler',
    environment: {
      SECRET_NAME,
      DOMAIN,
      AGENT_DOMAIN: wsApiDomain, // Use the WebSocket API domain
    },
  });

  // Grant Lambda permission to read the secret
  cookieSignerFn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [
        `arn:aws:secretsmanager:${stack.region}:${stack.account}:secret:${SECRET_NAME}*`,
      ],
    })
  );

  const cookieSignerApi = new apigw.LambdaRestApi(stack, 'CookieSignerApi', {
    handler: cookieSignerFn,
    proxy: true,
  });

  new cdk.CfnOutput(stack, 'CookieSignerURL', {
    value: `https://${cookieSignerApi.restApiId}.execute-api.${stack.region}.amazonaws.com/prod/`,
    description: 'URL of the Cookie Signer API',
  });

  // Return the stack
  return stack;
};
