import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';

interface WhiplashInfraStackProps extends cdk.StackProps {
  stage: string;
  projectName: string;
  config: {
    cpu: number;
    memory: number;
    backendDesiredCount?: number;   // when enabled
    frontendDesiredCount?: number;  // when enabled
  };
}

const nameFn = (project: string, stage: string) => (base: string) => `${project}-${stage}-${base}`;

export class WhiplashInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WhiplashInfraStackProps) {
    super(scope, id, props);

    const { stage, projectName, config } = props;
    const name    = nameFn(projectName, stage);
    const account = cdk.Stack.of(this).account;
    const region  = cdk.Stack.of(this).region;

    console.log(`🔧 Synth: stage=${stage}, project=${projectName}, acct=${account}, region=${region}`);
    console.log(`🔧 Config: ${JSON.stringify(config)}`);

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Stage', stage);

    // ─────────────────────────────────────────────────────────────────────────────
    // Parameters (persist); empty string = "not set yet"
    const backendTag = new cdk.CfnParameter(this, 'BackendImageTag', {
      type: 'String', default: '', description: 'ECR tag for backend (e.g. 1.0.0).',
    });
    const frontendTag = new cdk.CfnParameter(this, 'FrontendImageTag', {
      type: 'String', default: '', description: 'ECR tag for frontend (e.g. 0.1.0).',
    });

    // Conditions (deploy-time)
    const backendEnabled = new cdk.CfnCondition(this, 'BackendEnabled', {
      expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(backendTag.valueAsString, '')),
    });
    const frontendEnabled = new cdk.CfnCondition(this, 'FrontendEnabled', {
      expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(frontendTag.valueAsString, '')),
    });

    // Desired counts (enabled → config, else → 0)
    const backendDesired = cdk.Token.asNumber(
      cdk.Fn.conditionIf(backendEnabled.logicalId, String(config.backendDesiredCount ?? 1), '0')
    );
    const frontendDesired = cdk.Token.asNumber(
      cdk.Fn.conditionIf(frontendEnabled.logicalId, String(config.frontendDesiredCount ?? 1), '0')
    );

    // Image strings (enabled → real ECR image, else → harmless placeholder)
    const backendImageStr = cdk.Token.asString(
      cdk.Fn.conditionIf(
        backendEnabled.logicalId,
        `${account}.dkr.ecr.${region}.amazonaws.com/${projectName}-backend:${backendTag.valueAsString}`,
        'public.ecr.aws/nginx/nginx:alpine'
      )
    );
    const frontendImageStr = cdk.Token.asString(
      cdk.Fn.conditionIf(
        frontendEnabled.logicalId,
        `${account}.dkr.ecr.${region}.amazonaws.com/${projectName}-frontend:${frontendTag.valueAsString}`,
        'public.ecr.aws/nginx/nginx:alpine'
      )
    );

    // ─────────────────────────────────────────────────────────────────────────────
    // Network & Cluster
    const vpc = new ec2.Vpc(this, name('Vpc'), { maxAzs: 2 });
    const cluster = new ecs.Cluster(this, name('Cluster'), { vpc, clusterName: name('Cluster') });

    // ─────────────────────────────────────────────────────────────────────────────
    // Backend Service (always synthesized; behavior controlled by params)
    const backend = new ecsPatterns.ApplicationLoadBalancedFargateService(this, name('BackendService'), {
      cluster,
      cpu: config.cpu,
      memoryLimitMiB: config.memory,
      publicLoadBalancer: true,
      desiredCount: backendDesired,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry(backendImageStr),
        containerName: name('backend-container'),
        containerPort: 3000,
      },
      serviceName: name('backend-service'),
      // ✅ Deployment Circuit Breaker: auto rollback on failed deployments
      circuitBreaker: { rollback: true },
      healthCheckGracePeriod: cdk.Duration.seconds(30),
    });

    // tighten ALB health checks so failures are detected quickly
    backend.targetGroup.configureHealthCheck({
      path: '/api/healthcheck',
      healthyHttpCodes: '200-399',
      interval: cdk.Duration.seconds(10),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 2,
    });

    // Ensure the execution role can pull from ECR
    backend.taskDefinition.executionRole!.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
    );
    // Least-privilege: grant repo pull explicitly (same-account)
    const backendRepo = ecr.Repository.fromRepositoryName(this, 'BackendRepoImport', `${projectName}-backend`);
    backendRepo.grantPull(backend.taskDefinition.executionRole!);

    // ─────────────────────────────────────────────────────────────────────────────
    // Frontend Service (always synthesized; behavior controlled by params)
    const frontend = new ecsPatterns.ApplicationLoadBalancedFargateService(this, name('FrontendService'), {
      cluster,
      cpu: config.cpu,
      memoryLimitMiB: config.memory,
      publicLoadBalancer: true,
      desiredCount: frontendDesired,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry(frontendImageStr),
        containerName: name('frontend-container'),
        containerPort: 80,
      },
      serviceName: name('frontend-service'),
      circuitBreaker: { rollback: true },
      healthCheckGracePeriod: cdk.Duration.seconds(30),
    });

    frontend.targetGroup.configureHealthCheck({
      path: "/",   // ✅ just check index.html
      healthyHttpCodes: "200-399",
      interval: cdk.Duration.seconds(10),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 2,
    });

    frontend.taskDefinition.executionRole!.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
    );
    const frontendRepo = ecr.Repository.fromRepositoryName(this, 'FrontendRepoImport', `${projectName}-frontend`);
    frontendRepo.grantPull(frontend.taskDefinition.executionRole!);

    // Outputs
    new cdk.CfnOutput(this, name('BackendURL'),  { value: backend.loadBalancer.loadBalancerDnsName });
    new cdk.CfnOutput(this, name('FrontendURL'), { value: frontend.loadBalancer.loadBalancerDnsName });
  }
}
