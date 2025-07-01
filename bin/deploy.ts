#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { createAgentInfraStack } from '../stacks/agent-infra-stack';

const app = new cdk.App();
createAgentInfraStack(app, 'AgentInfraStack');
