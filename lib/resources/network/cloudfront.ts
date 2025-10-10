import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

export interface CfWithParamsProps {
  comment: string;
  webAclArn?: string;
}

export function createDistributionWithParams(scope: Construct, id: string, props: CfWithParamsProps) {
  // ── Stable CFN parameters (ALB DNS) ───────────────────────────────────────────
  const backendAlbDns = new cdk.CfnParameter(scope, 'backendAlbDns', {
    type: 'String',
    default: 'notready.invalid',
    description: 'Backend ALB DNS name for /api* origin (e.g. abc.elb.amazonaws.com)',
  });
  backendAlbDns.overrideLogicalId('backendAlbDns');

  const frontendAlbDns = new cdk.CfnParameter(scope, 'frontendAlbDns', {
    type: 'String',
    default: 'notready.invalid',
    description: 'Frontend ALB DNS name for default origin (e.g. xyz.elb.amazonaws.com)',
  });
  frontendAlbDns.overrideLogicalId('frontendAlbDns');

  // ── Explicit protocol selectors per origin (HTTP/HTTPS) ───────────────────────
  const frontendAlbProtocol = new cdk.CfnParameter(scope, 'frontendAlbProtocol', {
    type: 'String',
    allowedValues: ['HTTP', 'HTTPS'],
    default: 'HTTP',
    description: 'Protocol CloudFront uses to connect to the FRONTEND origin.',
  });
  frontendAlbProtocol.overrideLogicalId('frontendAlbProtocol');

  const backendAlbProtocol = new cdk.CfnParameter(scope, 'backendAlbProtocol', {
    type: 'String',
    allowedValues: ['HTTP', 'HTTPS'],
    default: 'HTTP',
    description: 'Protocol CloudFront uses to connect to the BACKEND origin.',
  });
  backendAlbProtocol.overrideLogicalId('backendAlbProtocol');

  // ── Custom domains + ACM cert (us-east-1) ─────────────────────────────────────
  const enableCustom = new cdk.CfnParameter(scope, 'EnableCustomDomains', {
    type: 'String',
    allowedValues: ['true', 'false'],
    default: 'false',
    description: 'Set to true to attach custom domain aliases + ACM cert to CloudFront.',
  });
  enableCustom.overrideLogicalId('EnableCustomDomains');

  const customDomainsCsv = new cdk.CfnParameter(scope, 'CustomDomainsCsv', {
    type: 'String',
    default: '',
    description: 'Comma-separated custom domains (e.g. app.example.com,www.example.com).',
  });
  customDomainsCsv.overrideLogicalId('CustomDomainsCsv');

  const acmCertArnUsEast1 = new cdk.CfnParameter(scope, 'AcmCertificateArnUsEast1', {
    type: 'String',
    default: '',
    description: 'ACM certificate ARN in us-east-1 covering all custom domains.',
  });
  acmCertArnUsEast1.overrideLogicalId('AcmCertificateArnUsEast1');

  // ── Conditions to choose origin protocol per origin ───────────────────────────
  const isFrontendHttps = new cdk.CfnCondition(scope, 'IsFrontendHttps', {
    expression: cdk.Fn.conditionEquals(frontendAlbProtocol.valueAsString, 'HTTPS'),
  });
  const isBackendHttps = new cdk.CfnCondition(scope, 'IsBackendHttps', {
    expression: cdk.Fn.conditionEquals(backendAlbProtocol.valueAsString, 'HTTPS'),
  });

  // ── Origins (seed with HTTP_ONLY; override via L1) ────────────────────────────
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

  // ── Distribution (L2) ────────────────────────────────────────────────────────
  const dist = new cf.Distribution(scope, id, {
    comment: props.comment,
    webAclId: props.webAclArn,
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

  // ── L1 overrides (Origins + Aliases/Cert) ─────────────────────────────────────
  const cfnDist = dist.node.defaultChild as cf.CfnDistribution;

  // NOTE: Origins order is deterministic:
  // 0 => frontendOrigin (default)
  // 1 => backendOrigin  (/api*)
  // OriginProtocolPolicy must be under CustomOriginConfig
  cfnDist.addPropertyOverride(
    'DistributionConfig.Origins.0.CustomOriginConfig.OriginProtocolPolicy',
    cdk.Fn.conditionIf(isFrontendHttps.logicalId, 'https-only', 'http-only')
  );
  cfnDist.addPropertyOverride(
    'DistributionConfig.Origins.1.CustomOriginConfig.OriginProtocolPolicy',
    cdk.Fn.conditionIf(isBackendHttps.logicalId, 'https-only', 'http-only')
  );

  const useAliasesCond = new cdk.CfnCondition(scope, 'UseAliases', {
    expression: cdk.Fn.conditionEquals(enableCustom.valueAsString, 'true'),
  });

  cfnDist.addPropertyOverride(
    'DistributionConfig.Aliases',
    cdk.Fn.conditionIf(
      useAliasesCond.logicalId,
      cdk.Fn.split(',', customDomainsCsv.valueAsString),
      cdk.Aws.NO_VALUE
    )
  );

  cfnDist.addPropertyOverride(
    'DistributionConfig.ViewerCertificate',
    cdk.Fn.conditionIf(
      useAliasesCond.logicalId,
      {
        AcmCertificateArn: acmCertArnUsEast1.valueAsString,
        SslSupportMethod: 'sni-only',
        MinimumProtocolVersion: 'TLSv1.2_2021',
      },
      { CloudFrontDefaultCertificate: true }
    )
  );

  return {
    dist,
    backendAlbDns,
    frontendAlbDns,
    enableCustom,
    customDomainsCsv,
    acmCertArnUsEast1,
    frontendAlbProtocol,
    backendAlbProtocol,
  };
}
