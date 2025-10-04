import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

export interface CfWithParamsProps {
  comment: string;
  // If your ALBs are HTTPS listeners, set protocolPolicy to HTTPS_ONLY below.
}

export function createDistributionWithParams(scope: Construct, id: string, props: CfWithParamsProps) {
  // CloudFormation parameters (owned by this core stack)
  const backendAlbDns = new cdk.CfnParameter(scope, `BackendAlbDns`, {
    type: 'String',
    default: 'notready.invalid',           // harmless default; update later via --parameters
    description: 'Backend ALB DNS name for /api* origin (e.g. abc.elb.amazonaws.com)',
  });
  backendAlbDns.overrideLogicalId('BackendAlbDns');

  const frontendAlbDns = new cdk.CfnParameter(scope, `FrontendAlbDns`, {
    type: 'String',
    default: 'notready.invalid',           // harmless default; update later via --parameters
    description: 'Frontend ALB DNS name for default origin (e.g. xyz.elb.amazonaws.com)',
  });
  frontendAlbDns.overrideLogicalId('FrontendAlbDns');

  // Origins (tokens from parameters are fine)
  const backendOrigin = new origins.HttpOrigin(backendAlbDns.valueAsString, {
    protocolPolicy: cf.OriginProtocolPolicy.HTTP_ONLY,
    originSslProtocols: [cf.OriginSslPolicy.TLS_V1_2],
    readTimeout: cdk.Duration.seconds(30),
    keepaliveTimeout: cdk.Duration.seconds(30),
  });

  const frontendOrigin = new origins.HttpOrigin(frontendAlbDns.valueAsString, {
    protocolPolicy: cf.OriginProtocolPolicy.HTTP_ONLY,
    originSslProtocols: [cf.OriginSslPolicy.TLS_V1_2],
    readTimeout: cdk.Duration.seconds(30),
    keepaliveTimeout: cdk.Duration.seconds(30),
  });

  const dist = new cf.Distribution(scope, id, {
    comment: props.comment,
    defaultBehavior: {
      origin: frontendOrigin,
      viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED,
      originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      compress: true,
    },
    additionalBehaviors: {
      '/api*': {
        origin: backendOrigin,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cf.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cf.AllowedMethods.ALLOW_ALL,
        cachedMethods: cf.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      },
    },
    priceClass: cf.PriceClass.PRICE_CLASS_100,
    enableIpv6: true,
    httpVersion: cf.HttpVersion.HTTP2_AND_3,
  });

  return { dist, backendAlbDns, frontendAlbDns };
}
