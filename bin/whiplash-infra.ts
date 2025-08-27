#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WhiplashInfraStack } from '../lib/whiplash-infra-stack';

const app = new cdk.App();

// Project name
const projectName = 'whiplash';

// Stage (default = dev)
const stage = app.node.tryGetContext('stage') || 'dev';
const config = app.node.tryGetContext(stage);

if (!config) {
  throw new Error(`No config found for stage: ${stage}`);
}

new WhiplashInfraStack(app, stage, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  stage,
  projectName,
  config,
  stackName: `${projectName}-${stage}`,
});
