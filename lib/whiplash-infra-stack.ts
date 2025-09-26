import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';

import { nameFn } from './common/naming';
import { createVpc } from './resources/network/vpc';
import { createEcsCluster } from './resources/compute/cluster';
import { createAlbFargateService } from './resources/services/alb-fargate';
import { createRegionalWebAcl, associateWebAcl } from './resources/security/waf';
import { createAtlasVpcEndpoint } from './resources/network/atlas-endpoint';

interface WhiplashInfraStackProps extends cdk.StackProps {
  stage: string;
  projectName: string;
  config: {
    cpu: number;
    memory: number;
    backendDesiredCount?: number;
    frontendDesiredCount?: number;
  };
}

export class WhiplashInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WhiplashInfraStackProps) {
    super(scope, id, props);

    const { stage, projectName, config } = props;
    const name    = nameFn(projectName, stage);
    const account = cdk.Stack.of(this).account;
    const region  = cdk.Stack.of(this).region;

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Stage', stage);

    // ─────────────────────────────────────────────────────────────────────────────
    // Parameters
    const backendTag = new cdk.CfnParameter(this, 'BackendImageTag', {
      type: 'String', default: '', description: 'ECR tag for backend (e.g. 1.0.0).',
    });
    const frontendTag = new cdk.CfnParameter(this, 'FrontendImageTag', {
      type: 'String', default: '', description: 'ECR tag for frontend (e.g. 0.1.0).',
    });

    // Conditions
    const backendEnabled = new cdk.CfnCondition(this, 'BackendEnabled', {
      expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(backendTag.valueAsString, '')),
    });
    const frontendEnabled = new cdk.CfnCondition(this, 'FrontendEnabled', {
      expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(frontendTag.valueAsString, '')),
    });

    // Desired counts
    const backendDesired = cdk.Token.asNumber(
      cdk.Fn.conditionIf(backendEnabled.logicalId, String(config.backendDesiredCount ?? 1), '0')
    );
    const frontendDesired = cdk.Token.asNumber(
      cdk.Fn.conditionIf(frontendEnabled.logicalId, String(config.frontendDesiredCount ?? 1), '0')
    );

    // Image strings
    const backendImageStr = cdk.Token.asString(
      cdk.Fn.conditionIf(
        backendEnabled.logicalId,
        `${account}.dkr.ecr.${region}.amazonaws.com/${projectName}-${stage}-backend:${backendTag.valueAsString}`,
        'public.ecr.aws/nginx/nginx:alpine'
      )
    );
    const frontendImageStr = cdk.Token.asString(
      cdk.Fn.conditionIf(
        frontendEnabled.logicalId,
        `${account}.dkr.ecr.${region}.amazonaws.com/${projectName}-${stage}-frontend:${frontendTag.valueAsString}`,
        'public.ecr.aws/nginx/nginx:alpine'
      )
    );

    // ─────────────────────────────────────────────────────────────────────────────
    // Network & Cluster
    const vpc     = createVpc(this, name('Vpc'), { maxAzs: 2 });
    const cluster = createEcsCluster(this, name('Cluster'), vpc, name('Cluster'));

    // ─────────────────────────────────────────────────────────────────────────────
    // Backend
    const backend = createAlbFargateService(this, name('BackendService'), {
      cluster,
      cpu: config.cpu,
      memoryLimitMiB: config.memory,
      desiredCount: backendDesired,
      image: ecs.ContainerImage.fromRegistry(backendImageStr),
      containerName: name('backend-container'),
      containerPort: 3000,
      serviceName: name('backend-service'),
      repositoryName: `${projectName}-${stage}-backend`,
      healthCheck: { path: '/api/healthcheck', healthyHttpCodes: '200-399' },
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Frontend
    const frontend = createAlbFargateService(this, name('FrontendService'), {
      cluster,
      cpu: config.cpu,
      memoryLimitMiB: config.memory,
      desiredCount: frontendDesired,
      image: ecs.ContainerImage.fromRegistry(frontendImageStr),
      containerName: name('frontend-container'),
      containerPort: 80,
      serviceName: name('frontend-service'),
      repositoryName: `${projectName}-${stage}-frontend`,
      healthCheck: { path: '/', healthyHttpCodes: '200-399' },
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // WAF (shared)
    const wafAcl = createRegionalWebAcl(this, name('WafAcl'), {
      name: name('web-acl'),
      metricName: `${projectName}_${stage}_wafMetric`,
    });

    associateWebAcl(this, name('BackendWafAssoc'), wafAcl, backend.loadBalancer);
    associateWebAcl(this, name('FrontendWafAssoc'), wafAcl, frontend.loadBalancer);

    // Atlas Private Endpoint
    const atlasServiceNameParam = new cdk.CfnParameter(this, 'AtlasServiceName', {
      type: 'String',
      description: 'Atlas PrivateLink service name from Atlas console',
    });

    createAtlasVpcEndpoint(this, {
      vpc,
      projectName,
      stage,
      atlasServiceName: atlasServiceNameParam.valueAsString,
    });

    // Outputs
    new cdk.CfnOutput(this, name('BackendURL'),  { value: backend.loadBalancer.loadBalancerDnsName });
    new cdk.CfnOutput(this, name('FrontendURL'), { value: frontend.loadBalancer.loadBalancerDnsName });
    new cdk.CfnOutput(this, name('WafWebAclArn'), { value: wafAcl.attrArn });
  }
}
