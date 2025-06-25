#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ChatbotInfraStack } from '../lib/chatbot-infra-stack';

const app = new cdk.App();
new ChatbotInfraStack(app, 'ChatbotInfraStack');