import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { nameFn } from './common/naming';
import { createS3BucketRetain } from './resources/storage/s3BucketRetain';
import { createS3BucketPrivate } from './resources/storage/s3BucketPrivate';

interface StorageStackProps extends cdk.StackProps {
  stage: string;
  projectName: string;
}

export class StorageStack extends cdk.Stack {
  public readonly appBucket;
  public readonly privateBucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { stage, projectName } = props;

    cdk.Tags.of(this).add('project', projectName);
    cdk.Tags.of(this).add('stack', stage);
    cdk.Tags.of(this).add('baseProject', projectName);
    
    const name    = nameFn(projectName, stage);

    this.appBucket = createS3BucketRetain(this, `${projectName}-${stage}-AssetsBucket`, {
      bucketName: name('assets-bucket'),
    });

    this.privateBucket = createS3BucketPrivate(this, `${projectName}-${stage}-PrivateBucket`, {
      bucketName: name('private-bucket'),
    });

    new cdk.CfnOutput(this, 'AssetsS3BucketName', {
      value: this.appBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'PrivateS3BucketName', {
      value: this.privateBucket.bucketName,
    });
  }
}
