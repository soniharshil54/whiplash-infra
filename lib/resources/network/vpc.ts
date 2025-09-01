import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export function createVpc(scope: Construct, id: string, props?: { maxAzs?: number }): ec2.Vpc {
  return new ec2.Vpc(scope, id, { maxAzs: props?.maxAzs ?? 2 });
}
