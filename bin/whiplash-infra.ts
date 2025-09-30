#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WhiplashInfraStack } from '../lib/whiplash-infra-stack';
import { getRequiredEnvVar } from '../lib/common';

const app = new cdk.App();

const deployEnv = app.node.tryGetContext('stage') as 'dev' | 'staging' | 'prod';
console.log('deployEnv from getContext stage', deployEnv);
console.log('process.env.PROJECT', process.env.PROJECT);
console.log('process.env.VERSION', process.env.VERSION); 

if (!['dev', 'staging', 'prod'].includes(deployEnv)) {
  throw new Error('DEPLOY_ENV must be one of: dev, staging, prod');
}

const projectName = getRequiredEnvVar('PROJECT');
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
