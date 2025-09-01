import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export interface AlbFargateOptions {
  cluster: ecs.Cluster;
  cpu: number;
  memoryLimitMiB: number;
  desiredCount: number;
  image: ecs.ContainerImage;
  containerName: string;
  containerPort: number;
  serviceName: string;
  repositoryName: string; // ECR repo to grant pull
  healthCheck: { path: string; healthyHttpCodes: string };
  publicLoadBalancer?: boolean;
  healthCheckGraceSec?: number;
}

export function createAlbFargateService(
  scope: Construct,
  id: string,
  opts: AlbFargateOptions
): ecsPatterns.ApplicationLoadBalancedFargateService {
  const svc = new ecsPatterns.ApplicationLoadBalancedFargateService(scope, id, {
    cluster: opts.cluster,
    cpu: opts.cpu,
    memoryLimitMiB: opts.memoryLimitMiB,
    publicLoadBalancer: opts.publicLoadBalancer ?? true,
    desiredCount: opts.desiredCount,
    taskImageOptions: {
      image: opts.image,
      containerName: opts.containerName,
      containerPort: opts.containerPort,
    },
    serviceName: opts.serviceName,
    circuitBreaker: { rollback: true },
    healthCheckGracePeriod: cdk.Duration.seconds(opts.healthCheckGraceSec ?? 30),
  });

  // Tight health checks
  svc.targetGroup.configureHealthCheck({
    path: opts.healthCheck.path,
    healthyHttpCodes: opts.healthCheck.healthyHttpCodes,
    interval: cdk.Duration.seconds(10),
    timeout: cdk.Duration.seconds(5),
    healthyThresholdCount: 2,
    unhealthyThresholdCount: 2,
  });

  // Allow task to pull from ECR
  svc.taskDefinition.executionRole!.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
  );
  const repo = ecr.Repository.fromRepositoryName(scope, `${id}RepoImport`, opts.repositoryName);
  repo.grantPull(svc.taskDefinition.executionRole!);

  return svc;
}
