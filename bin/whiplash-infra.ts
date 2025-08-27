#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WhiplashInfraStack } from '../lib/whiplash-infra-stack';

const app = new cdk.App();

const projectName = 'whiplash';
const stage = app.node.tryGetContext('stage') || 'dev';
const config = app.node.tryGetContext(stage); // { cpu, memory, backendDesiredCount, frontendDesiredCount }
if (!config) throw new Error(`No config found for stage: ${stage}`);

new WhiplashInfraStack(app, stage, {
  stackName: `${projectName}-${stage}`, // Option A: short id, explicit stackName
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  stage,
  projectName,
  config,
});
