// lib/cloudfront-waf-stack.ts

import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

interface CloudFrontWafStackProps extends cdk.StackProps {
  projectName: string;
  stage: string;
}

export class CloudFrontWafStack extends cdk.Stack {
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: CloudFrontWafStackProps) {
    super(scope, id, {
      ...props,
      env: { ...props.env, region: 'us-east-1' },
    });

    const { projectName, stage } = props;

    cdk.Tags.of(this).add('project', projectName);
    cdk.Tags.of(this).add('stack', stage);
    cdk.Tags.of(this).add('baseProject', projectName);

    const webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      name: `${projectName}-${stage}-cf-waf`,
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
        metricName: `${projectName}${stage}CfWaf`,
      },
      rules: [
        {
          name: 'AWSCommonRuleSet',
          priority: 0,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
              ruleActionOverrides: [
                {
                  name: 'SizeRestrictions_BODY',
                  actionToUse: { allow: {} }
                }
              ]
            }
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            sampledRequestsEnabled: true,
            metricName: 'CommonRuleSet',
          },
        },
      ],
    });

    this.webAclArn = webAcl.attrArn;

    new cdk.CfnOutput(this, 'WafArn', { 
      value: this.webAclArn,
      description: 'CloudFront WAF ARN (us-east-1)',
    });

  }
}