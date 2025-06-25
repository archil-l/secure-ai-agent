#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { createChatbotInfraStack } from '../stacks/chatbot-infra-stack';

const app = new cdk.App();
createChatbotInfraStack(app, 'ChatbotInfraStack');
