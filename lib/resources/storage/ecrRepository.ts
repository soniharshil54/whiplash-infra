import { Construct } from 'constructs';
import { Repository, RepositoryProps } from 'aws-cdk-lib/aws-ecr';

export interface EcrRepositoryProps extends RepositoryProps {
  repoName: string;
}

export function createEcrRepository(scope: Construct, id: string, props: EcrRepositoryProps): Repository {
  return new Repository(scope, id, {
    repositoryName: props.repoName,
    ...props,
  });
}
