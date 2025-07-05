# Secure AI Agent

> **Motivation:** I am integrating an AI agent into my personal webpage, but I do not want to expose sensitive API keys in the frontend. By using WebSocket with signed cookies for authentication, I can securely restrict access to the agent API, ensuring that API keys remain protected and are never exposed to users or other actors in the browser.

## Architecture

```mermaid
sequenceDiagram
    participant User
    participant CookieSigner as Cookie Signer API
    participant WebSocketAPI as WebSocket API Gateway
    participant Authorizer as Lambda Authorizer
    participant Agent as Lambda Agent

    User->>CookieSigner: Request authentication cookie
    CookieSigner-->>User: Set signed cookies (WS-Policy, WS-Signature, WS-Auth-Id)
    User->>WebSocketAPI: Connect to WebSocket (with signed cookies)
    WebSocketAPI->>Authorizer: Validate cookies
    Authorizer-->>WebSocketAPI: Allow/Deny connection
    WebSocketAPI-->>User: WebSocket connection established
    User->>WebSocketAPI: Send message
    WebSocketAPI->>Agent: Invoke Lambda
    Agent->>Bedrock: Request AI response
    Bedrock-->>Agent: AI response
    Agent-->>WebSocketAPI: Response
    WebSocketAPI-->>User: Response via WebSocket
```

This project provisions a secure AWS infrastructure for an AI agent API using AWS CDK (TypeScript). It features WebSocket communication with signed cookie authentication, Lambda-based API endpoints, and automated key management.

## Features

- **AWS CDK Infrastructure**: Deploys Lambda functions, WebSocket API Gateway, REST API Gateway, and Secrets Manager resources.
- **WebSocket Communication**: Real-time bidirectional communication between client and server.
- **Secure Authentication**: Restricts API access using cryptographically signed cookies and a Lambda authorizer.
- **Automated Key Management**: Scripts to generate, rotate, and update RSA public/private keys and manage secrets.
- **Environment-based Configuration**: Uses a `.env` file for domain configuration.
- **Multiple Lambda Functions**: Includes agent, authorizer, and cookie signer Lambda functions for secure operations.

## Getting Started

### Prerequisites

- Node.js & Yarn
- AWS CLI configured with appropriate permissions
- AWS CDK v2

### Setup

1. **Install dependencies:**
   ```bash
   yarn install
   ```
2. **Configure environment:**
   - Copy `.env.example` to `.env` and set your values, or let the scripts manage it.

### Key Management

To generate and manage authentication keys:

```bash
yarn keys:update
```

Or use the scripts directly:

```bash
./keys/generate-and-update-keys.ssh
./keys/verify-websocket-keys.sh
```

This will:

- Generate new RSA private/public key pairs
- Store both keys in AWS Secrets Manager as a JSON object
- Verify the keys are properly stored
- Prompt you to deploy the stack

### Deploy Infrastructure

To build and deploy with the latest environment variables:

```bash
yarn deploy
```

## Scripts

- `yarn build` – Compile TypeScript
- `yarn build:lambda` – Compile Lambda functions in `lambda/agent`, `lambda/cookie-signer`, and `lambda/authorizer`
- `yarn keys:update` – Generate and verify WebSocket authentication keys
- `yarn deploy` – Build and deploy the WebSocketAgentStack with environment variables from `.env`
- `yarn synth` – Synthesize CloudFormation template for WebSocketAgentStack
- `yarn destroy` – Destroy the WebSocketAgentStack

## File Structure

- `stacks/` – CDK stack definitions
  - `web-socket-agent-stack.ts` – WebSocket API with authentication and agent integration
- `lambda/` – Lambda functions
  - `agent/` – Lambda function for the WebSocket agent API
  - `cookie-signer/` – Lambda function for signing authentication cookies
  - `authorizer/` – Lambda function for validating signed cookies
- `keys/` – Key management scripts:
  - `generate-and-update-keys.ssh` – Generate and store RSA keys
  - `verify-websocket-keys.sh` – Verify keys are properly stored
- `bin/` – CDK app entry point (`deploy.ts`)
- `.env` – Environment variables for deployment

## Security

- Private and public keys are never committed; they are stored in AWS Secrets Manager.
- Authentication is handled through cryptographically signed cookies.
- The WebSocket connection is secured with a Lambda authorizer that validates signatures.

## Notes

- Always run `yarn keys:update` before `yarn deploy` when rotating keys.
- Ensure your AWS credentials allow Secrets Manager operations.
- The WebSocket API provides real-time communication with the AI agent.

---

MIT License

## Key Structure in Secrets Manager

The WebSocketAuthKeys secret in AWS Secrets Manager has the following JSON structure:

```json
{
  "privateKey": "-----BEGIN PRIVATE KEY-----\\n...",
  "publicKey": "-----BEGIN PUBLIC KEY-----\\n..."
}
```

This format allows both the cookie signer (which needs the private key) and the authorizer (which needs the public key) to access their required keys from a single secret.
