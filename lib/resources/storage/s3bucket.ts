import { Bucket, BucketProps } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface S3BucketProps extends BucketProps {
  // Add custom props if needed
  bucketName: string;
}

export function createS3Bucket(scope: Construct, id: string, props: S3BucketProps): Bucket {
  return new Bucket(scope, id, {
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,  
  });
}
