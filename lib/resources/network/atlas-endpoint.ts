// lib/resources/network/atlas-endpoint.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

interface AtlasEndpointProps {
  vpc: ec2.IVpc;
  // optionally pass in the list of SGs that should be allowed to talk to Atlas
  allowedClientSgs?: ec2.ISecurityGroup[];
  subnets?: ec2.SubnetSelection;
  ssmParamNameForService?: string; // `/${project}/${stage}/atlasServiceName`
  nameFn: (s: string) => string;
  projectName: string;
  stage: string;
}

export function createAtlasVpcEndpoint(scope: Construct, id: string, props: AtlasEndpointProps) {
  const {
    vpc,
    allowedClientSgs = [],
    subnets = { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    ssmParamNameForService,
    nameFn,
  } = props;

  const name = nameFn;

  // 1) Read Atlas service name that Pulumi wrote
  const atlasServiceName = ssm.StringParameter.valueFromLookup(scope, ssmParamNameForService as string);

  // 2) SG on the endpoint ENIs
  const endpointSg = new ec2.SecurityGroup(scope, name('AtlasEndpointSg'), {
    vpc,
    description: 'SG for MongoDB Atlas PrivateLink interface endpoint',
    allowAllOutbound: true,
  });

  // Allow all VPC traffic -> endpoint on ALL TCP (Atlas can use 1024–65535)
  endpointSg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcpRange(1024, 65535), 'VPC to Atlas PL');
  
  // Also allow specific security groups if provided
  for (const sg of allowedClientSgs) {
    endpointSg.addIngressRule(ec2.Peer.securityGroupId(sg.securityGroupId), ec2.Port.tcpRange(1024, 65535), 'App to Atlas PL');
  }

  // 3) Create interface endpoint to Atlas service
  const vpce = new ec2.InterfaceVpcEndpoint(scope, name('AtlasEndpoint'), {
    vpc,
    service: new ec2.InterfaceVpcEndpointService(atlasServiceName, /* port is determined by service */),
    subnets,
    securityGroups: [endpointSg],
    // privateDnsEnabled must remain false for third-party services unless provider says otherwise
    privateDnsEnabled: false,
  });

  const atlasVpcEndpointId  = vpce.vpcEndpointId;
  const atlasVpcEndpointDns = cdk.Fn.join(',', vpce.vpcEndpointDnsEntries);
  return { vpce, endpointSg, atlasVpcEndpointId, atlasVpcEndpointDns };
}
