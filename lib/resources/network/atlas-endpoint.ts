import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { nameFn } from '../../common/naming';

interface AtlasEndpointProps {
  vpc: ec2.Vpc;
  projectName: string;
  stage: string;
  atlasServiceName: string; // from Atlas console when you enable PrivateLink
}

export function createAtlasVpcEndpoint(scope: Construct, props: AtlasEndpointProps) {
  const { vpc, projectName, stage, atlasServiceName } = props;
  const name = nameFn(projectName, stage);

  // SG for the endpoint ENIs
  const endpointSg = new ec2.SecurityGroup(scope, name('AtlasEndpointSg'), {
    vpc,
    description: 'SG for MongoDB Atlas PrivateLink endpoint',
    allowAllOutbound: true,
  });

  // allow ECS tasks inside VPC CIDR to reach 27017
  endpointSg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(27017));

  // create interface VPC endpoint
  const atlasEndpoint = new ec2.InterfaceVpcEndpoint(scope, name('AtlasEndpoint'), {
    vpc,
    service: new ec2.InterfaceVpcEndpointService(atlasServiceName, 27017),
    subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    securityGroups: [endpointSg],
  });

  // push endpoint id into SSM
  new ssm.StringParameter(scope, name('AtlasEndpointIdParam'), {
    parameterName: `/${projectName}/${stage}/atlasVpcEndpointId`,
    stringValue: atlasEndpoint.vpcEndpointId,
  });

  // also push DNS names (useful for Pulumi/ECS)
  new ssm.StringParameter(scope, name('AtlasEndpointDnsParam'), {
    parameterName: `/${projectName}/${stage}/atlasVpcEndpointDns`,
    stringValue: atlasEndpoint.vpcEndpointDnsEntries.join(','),
  });

  return atlasEndpoint;
}
