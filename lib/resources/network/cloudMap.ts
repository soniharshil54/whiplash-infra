// lib/resources/network/cloudmap.ts
import * as sd from 'aws-cdk-lib/aws-servicediscovery';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export function createPrivateNamespace(scope: Construct, id: string, props: {
  vpc: ec2.IVpc;
  name: string;      // e.g. `${projectName}-${stage}.local`
}) {
  const ns = new sd.PrivateDnsNamespace(scope, id, {
    name: props.name,
    vpc: props.vpc,
  });
  return ns;
}
