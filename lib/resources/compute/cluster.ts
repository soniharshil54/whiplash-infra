import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export function createEcsCluster(scope: Construct, id: string, vpc: ec2.Vpc, clusterName: string) {
  return new ecs.Cluster(scope, id, { vpc, clusterName });
}
