# Chatbot CloudFront Secure

This project provisions a secure AWS infrastructure for a chatbot API using AWS CDK (TypeScript). It features CloudFront signed cookies, Lambda-based API endpoints, and automated key management.

## Features

- **AWS CDK Infrastructure**: Deploys Lambda, API Gateway, CloudFront, and Secrets Manager resources.
- **CloudFront Signed Cookies**: Restricts API access using signed cookies and CloudFront Key Groups.
- **Automated Key Management**: Scripts to generate, rotate, and update CloudFront public/private keys and manage secrets.
- **Environment-based Configuration**: Uses a `.env` file for key IDs and domain configuration.

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

To generate and rotate CloudFront keys and update AWS Secrets Manager:

```bash
yarn keys:update
```

This will:

- Generate new private/public key pairs
- Store the private key in AWS Secrets Manager
- Create a new CloudFront public key and update `.env` with its ID
- Prompt you to deploy the stack

### Deploy Infrastructure

To build and deploy with the latest environment variables:

```bash
yarn deploy
```

## Scripts

- `yarn build` – Compile TypeScript
- `yarn build:lambda` – Compile Lambda functions
- `yarn keys:update` – Generate and rotate CloudFront keys
- `yarn deploy` – Build and deploy with environment variables from `.env`

## File Structure

- `stacks/` – CDK stack definitions
- `lambda/` – Lambda function source code
- `keys/` – Key management scripts and generated keys
- `.env` – Environment variables for deployment

## Security

- Private keys are never committed; they are stored in AWS Secrets Manager.
- CloudFront public keys are managed via AWS CLI and referenced by ID.

## Notes

- Always run `yarn keys:update` before `yarn deploy` when rotating keys.
- Ensure your AWS credentials allow CloudFront and Secrets Manager operations.

---

MIT License
