#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CoreInfraStack } from '../lib/core-infra-stack';
import { CloudFrontWafStack } from '../lib/cloudfront-waf-stack'
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

const account = process.env.CDK_DEFAULT_ACCOUNT;

// WAF stack (tiny, us-east-1 only)
const wafStack = new CloudFrontWafStack(app, `${projectName}-${stage}-waf`, {
  projectName,
  stage,
  env: { account, region: 'us-east-1' },
});

const infraStack = new CoreInfraStack(app, `${projectName}-${stage}`, {
  crossRegionReferences: true,
  stackName: `${projectName}-${stage}`, // Option A: short id, explicit stackName
  env: { account, region: process.env.CDK_DEFAULT_REGION },
  stage,
  webAclArn: wafStack.webAclArn,
  projectName,
  config,
});

infraStack.addDependency(wafStack);