import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';

interface WhiplashInfraStackProps extends cdk.StackProps {
  stage: string;
  projectName: string;
  config: any;
}

// Helper: auto-prefix with project + stage
function makeResourceNamer(project: string, stage: string) {
  return (base: string) => `${project}-${stage}-${base}`;
}

export class WhiplashInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WhiplashInfraStackProps) {
    super(scope, id, props);

    const { stage, projectName, config } = props;
    const name = makeResourceNamer(projectName, stage);

    // ✅ Apply global tags to all resources in this stack
    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Stage', stage);

    // VPC
    const vpc = new ec2.Vpc(this, name('Vpc'), { maxAzs: 2 });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, name('Cluster'), {
      vpc,
      clusterName: name('Cluster'),
    });

    // ECR Repos
    const backendRepo = new ecr.Repository(this, name('BackendRepo'), {
      repositoryName: name('backend'),
    });

    const frontendRepo = new ecr.Repository(this, name('FrontendRepo'), {
      repositoryName: name('frontend'),
    });

    // Backend Service
    const backendService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      name('BackendService'),
      {
        cluster,
        cpu: config.cpu,
        desiredCount: config.backendDesiredCount,
        memoryLimitMiB: config.memory,
        publicLoadBalancer: true,
        taskImageOptions: {
          image: ecs.ContainerImage.fromEcrRepository(backendRepo, 'latest'),
          containerName: name('backend-container'),
          containerPort: 3000,
        },
        serviceName: name('backend-service'),
      }
    );

    // Frontend Service
    const frontendService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      name('FrontendService'),
      {
        cluster,
        cpu: config.cpu,
        desiredCount: config.frontendDesiredCount,
        memoryLimitMiB: config.memory,
        publicLoadBalancer: true,
        taskImageOptions: {
          image: ecs.ContainerImage.fromEcrRepository(frontendRepo, 'latest'),
          containerName: name('frontend-container'),
          containerPort: 80,
        },
        serviceName: name('frontend-service'),
      }
    );

    // Outputs
    new cdk.CfnOutput(this, name('BackendURL'), {
      value: backendService.loadBalancer.loadBalancerDnsName,
    });

    new cdk.CfnOutput(this, name('FrontendURL'), {
      value: frontendService.loadBalancer.loadBalancerDnsName,
    });
  }
}
