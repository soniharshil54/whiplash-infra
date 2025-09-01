import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export function createRegionalWebAcl(scope: Construct, id: string, props: {
  name: string;
  metricName: string;
}) {
  return new wafv2.CfnWebACL(scope, id, {
    name: props.name,
    scope: 'REGIONAL',
    defaultAction: { allow: {} },
    visibilityConfig: {
      cloudWatchMetricsEnabled: true,
      sampledRequestsEnabled: true,
      metricName: props.metricName,
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
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          sampledRequestsEnabled: true,
          metricName: 'AWSCommonRuleSet',
        },
      },
    ],
  });
}

export function associateWebAcl(
  scope: Construct,
  id: string,
  webAcl: wafv2.CfnWebACL,
  alb: elbv2.IApplicationLoadBalancer
) {
  const assoc = new wafv2.CfnWebACLAssociation(scope, id, {
    resourceArn: alb.loadBalancerArn,
    webAclArn: webAcl.attrArn,
  });
  assoc.addDependency(webAcl);
  return assoc;
}
