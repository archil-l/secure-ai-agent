// Main entry point for the agent lambda - WebSocket handler
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { getBedrockResponse } from './bedrock';
import { Message } from '@aws-sdk/client-bedrock-runtime';

// Define WebSocket event with proper types
interface WebSocketEvent extends APIGatewayProxyEvent {
  requestContext: APIGatewayProxyEvent['requestContext'] & {
    connectionId: string;
    routeKey: string;
    domainName: string;
    stage: string;
    authorizer?: {
      userId: string;
    };
  };
}

// Store active connections for broadcasting
const connections: { [connectionId: string]: { userId: string } } = {};

// Create a function to send messages to WebSocket clients
const sendMessageToClient = async (
  connectionId: string,
  domainName: string,
  stage: string,
  message: string
): Promise<void> => {
  const client = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify({ message })),
      })
    );
  } catch (error: any) {
    if (error.statusCode === 410) {
      // Connection is stale, remove it
      console.log(`Connection ${connectionId} is stale, removing`);
      delete connections[connectionId];
    } else {
      console.error(`Error sending message to ${connectionId}:`, error);
    }
  }
};

// Handle WebSocket events
export const handler = async (
  event: WebSocketEvent
): Promise<APIGatewayProxyResult> => {
  const { requestContext } = event;
  const connectionId = requestContext.connectionId;
  const routeKey = requestContext.routeKey;
  const domainName = requestContext.domainName;
  const stage = requestContext.stage;

  console.log(`Route: ${routeKey}, ConnectionId: ${connectionId}`);

  // Handle different WebSocket route keys
  switch (routeKey) {
    case '$connect':
      // Connection is already authorized by the authorizer
      const userId = requestContext.authorizer?.userId;
      if (userId) {
        connections[connectionId] = { userId };
        console.log(`Connected: ${userId}, ConnectionId: ${connectionId}`);
      }
      return { statusCode: 200, body: 'Connected' };

    case '$disconnect':
      // Remove connection from the connections object
      if (connectionId && connections[connectionId]) {
        console.log(
          `Disconnected: ${connections[connectionId].userId}, ConnectionId: ${connectionId}`
        );
        delete connections[connectionId];
      }
      return { statusCode: 200, body: 'Disconnected' };

    case 'sendMessage':
      try {
        // Parse the message from the client
        const body = JSON.parse(event.body || '{}');
        const { conversation } = body;

        if (!conversation) {
          await sendMessageToClient(
            connectionId,
            domainName,
            stage,
            JSON.stringify({ error: 'Missing conversation in request' })
          );
          return { statusCode: 400, body: 'Missing conversation' };
        }

        // Get response from Bedrock
        const modelResponse = await getBedrockResponse(
          conversation as Message[]
        );

        // Send the response back to the client
        await sendMessageToClient(
          connectionId,
          domainName,
          stage,
          JSON.stringify({ answer: modelResponse })
        );

        return { statusCode: 200, body: 'Message processed' };
      } catch (error: any) {
        console.error('Error processing message:', error);

        // Send error back to client
        await sendMessageToClient(
          connectionId,
          domainName,
          stage,
          JSON.stringify({
            error: 'Failed to process message',
            details: error?.message,
          })
        );

        return { statusCode: 500, body: 'Error processing message' };
      }

    default:
      // Handle unknown route
      console.warn(`Unknown route: ${routeKey}`);
      return { statusCode: 400, body: `Unknown route: ${routeKey}` };
  }
};
