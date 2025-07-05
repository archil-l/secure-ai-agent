#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { createWebSocketAuthStack } from '../stacks/web-socket-agent-stack';

const app = new cdk.App();
createWebSocketAuthStack(app, 'WebSocketAgentStack');
