import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import { nameFn } from './common/naming';
import { createVpc } from './resources/network/vpc';
import { createEcsCluster } from './resources/compute/cluster';
import { createRegionalWebAcl, associateWebAcl } from './resources/security/waf';
// import { createAtlasVpcEndpoint } from './resources/network/atlas-endpoint';
import { createEcrRepository } from './resources/storage/ecrRepository';
import { createSsmStringParams } from './resources/storage/ssmParameter'; 
import { createS3Bucket } from './resources/storage/s3bucket';
import { createPrivateNamespace } from './resources/network/cloudMap';
import { createDistributionWithParams } from './resources/network/cloudfront';

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
    // Network & Cluster
    const vpc     = createVpc(this, name('Vpc'), { maxAzs: 2 });

    // Cloud Map Private DNS namespace (one per VPC/env)
    const namespaceFqdn = `${projectName}-${stage}.local`;
    const ns = createPrivateNamespace(this, name('cloudmap-ns'), {
      vpc,
      name: namespaceFqdn,
    });

    const cluster = createEcsCluster(this, name('Cluster'), vpc, name('Cluster'));

    // ─────────────────────────────────────────────────────────────────────────────
    // WAF (shared)
    const wafAcl = createRegionalWebAcl(this, name('WafAcl'), {
      name: name('web-acl'),
      metricName: `${projectName}_${stage}_wafMetric`,
    });

    // somewhere in your stack
    const backendRepo = createEcrRepository(this, 'BackendRepo', {
      repoName: `${projectName}-${stage}-backend`,
    });
    const frontendRepo = createEcrRepository(this, 'FrontendRepo', {
      repoName: `${projectName}-${stage}-frontend`,
    });

    // s3 bucket for file storage
    const s3Bucket = createS3Bucket(this, name('AppBucket'), {
      bucketName: `${projectName}-${stage}-bucket`,
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SSM parameters needed by app stacks
    const privateSel = vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS });

    const { dist, backendAlbDns, frontendAlbDns } = createDistributionWithParams(
      this,
      name('CfDist'),
      { comment: `${projectName}-${stage} CloudFront (params)` }
    );

    createSsmStringParams(this, name('SsmInfraExports'), {
      projectName,
      stage,
      entries: {
        vpcId: vpc.vpcId,
        privateSubnetIds: privateSel.subnetIds.join(','),
        privateSubnetRouteTableIds: privateSel.subnets.map(s => s.routeTable.routeTableId).join(','),
        clusterName: cluster.clusterName,
        backendEcrRepoName: backendRepo.repositoryName,
        frontendEcrRepoName: frontendRepo.repositoryName,
        accountId: account,
        region: region,
        s3BucketName: s3Bucket.bucketName,
        cloudMapNamespaceId: ns.namespaceId,
        cloudMapNamespaceName: namespaceFqdn,
        cloudMapNamespaceArn: ns.namespaceArn,
        cloudFrontDistributionId: dist.distributionId,
        cloudFrontDomainName: dist.distributionDomainName,
        // atlasServiceName is written by Pulumi; app stacks can read it directly if needed
      },
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Outputs
    new cdk.CfnOutput(this, name('AccountId'),          { value: account });
    new cdk.CfnOutput(this, name('Region'),             { value: region });
    new cdk.CfnOutput(this, name('VpcId'),              { value: vpc.vpcId });
    new cdk.CfnOutput(this, name('PrivateSubnetIds'),   { value: privateSel.subnetIds.join(',') });
    new cdk.CfnOutput(this, name('ClusterName'),        { value: cluster.clusterName });
    new cdk.CfnOutput(this, name('BackendEcrRepoUri'),  { value: backendRepo.repositoryUri });
    new cdk.CfnOutput(this, name('FrontendEcrRepoUri'), { value: frontendRepo.repositoryUri });
    new cdk.CfnOutput(this, name('WafWebAclArn'),       { value: wafAcl.attrArn });
    new cdk.CfnOutput(this, name('S3BucketName'),       { value: s3Bucket.bucketName });
    new cdk.CfnOutput(this, name('CloudMapNamespaceId'),   { value: ns.namespaceId });
    new cdk.CfnOutput(this, name('CloudMapNamespaceName'), { value: namespaceFqdn });
    new cdk.CfnOutput(this, name('CloudFrontDistributionId'), { value: dist.distributionId });
    new cdk.CfnOutput(this, name('CloudFrontDomainName'),     { value: dist.distributionDomainName });
    new cdk.CfnOutput(this, name('BackendAlbDnsParamName'),   { value: backendAlbDns.logicalId });
    new cdk.CfnOutput(this, name('FrontendAlbDnsParamName'),  { value: frontendAlbDns.logicalId });
  }
}
