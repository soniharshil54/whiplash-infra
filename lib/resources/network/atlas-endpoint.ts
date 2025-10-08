// lib/resources/network/atlas-endpoint.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

interface AtlasEndpointProps {
  vpc: ec2.IVpc;
  allowedClientSgs?: ec2.ISecurityGroup[];
  subnets?: ec2.SubnetSelection;
  ssmParamNameForService: string;
  nameFn: (s: string) => string;
  projectName: string;
  stage: string;
}

interface AtlasEndpointResult {
  atlasVpcEndpointId?: string;
  atlasVpcEndpointDns?: string;
  enableAtlasEndpointParam: cdk.CfnParameter;
}

export function createAtlasVpcEndpoint(
  scope: Construct, 
  id: string, 
  props: AtlasEndpointProps
): AtlasEndpointResult {
  const {
    vpc,
    allowedClientSgs = [],
    subnets = { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    ssmParamNameForService,
    nameFn,
  } = props;

  const name = nameFn;

  // Create CFN parameter to control endpoint creation
  const enableAtlasEndpointParam = new cdk.CfnParameter(scope, name('EnableAtlasEndpoint'), {
    type: 'String',
    default: 'false',
    allowedValues: ['true', 'false'],
    description: 'Set to true to create MongoDB Atlas VPC Endpoint',
  });
  enableAtlasEndpointParam.overrideLogicalId('EnableAtlasEndpoint');

  // Create condition based on parameter
  const createEndpointCondition = new cdk.CfnCondition(scope, name('CreateAtlasEndpointCondition'), {
    expression: cdk.Fn.conditionEquals(enableAtlasEndpointParam.valueAsString, 'true'),
  });

  // Use valueForStringParameter instead of valueFromLookup to get CloudFormation reference
  // This way it resolves at deploy time, not synth time
  const atlasServiceNameParam = ssm.StringParameter.valueForStringParameter(
    scope,
    ssmParamNameForService
  );

  // Get the subnets
  const selectedSubnets = vpc.selectSubnets(subnets);

  // Create Security Group using L1 construct with condition
  const endpointSg = new ec2.CfnSecurityGroup(scope, name('AtlasEndpointSg'), {
    vpcId: vpc.vpcId,
    groupDescription: 'SG for MongoDB Atlas PrivateLink interface endpoint',
    securityGroupIngress: [
      {
        ipProtocol: 'tcp',
        fromPort: 1024,
        toPort: 65535,
        cidrIp: vpc.vpcCidrBlock,
        description: 'VPC to Atlas PL',
      },
      ...allowedClientSgs.map(sg => ({
        ipProtocol: 'tcp',
        fromPort: 1024,
        toPort: 65535,
        sourceSecurityGroupId: sg.securityGroupId,
        description: 'App to Atlas PL',
      })),
    ],
  });
  endpointSg.cfnOptions.condition = createEndpointCondition;

  // Create VPC Endpoint using L1 construct with condition
  const vpce = new ec2.CfnVPCEndpoint(scope, name('AtlasEndpoint'), {
    vpcId: vpc.vpcId,
    serviceName: atlasServiceNameParam,
    vpcEndpointType: 'Interface',
    subnetIds: selectedSubnets.subnetIds,
    securityGroupIds: [endpointSg.attrGroupId],
    privateDnsEnabled: false,
  });
  vpce.cfnOptions.condition = createEndpointCondition;

    // Return conditional values for endpoint ID and DNS
    const atlasVpcEndpointId = cdk.Fn.conditionIf(
      createEndpointCondition.logicalId,
      vpce.ref,
      cdk.Aws.NO_VALUE
    ).toString();

    // Use attrDnsEntries directly - it's already a resolvable
    const atlasVpcEndpointDns = cdk.Fn.conditionIf(
      createEndpointCondition.logicalId,
      vpce.attrDnsEntries,
      cdk.Aws.NO_VALUE
    ).toString();

  return { 
    atlasVpcEndpointId,
    atlasVpcEndpointDns,
    enableAtlasEndpointParam
  };
}
