import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';

/**
 * Writes a single String parameter into SSM under /{projectName}/{stage}/{key}
 * Returns the created parameter for chaining if needed.
 */
export function createSsmStringParam(
  scope: Construct,
  id: string,
  args: { projectName: string; stage: string; key: string; value: string }
): ssm.StringParameter {
  const { projectName, stage, key, value } = args;
  return new ssm.StringParameter(scope, id, {
    parameterName: `/${projectName}/${stage}/${key}`,
    stringValue: value,
  });
}

/**
 * Convenience: write multiple string params at once.
 */
export function createSsmStringParams(
  scope: Construct,
  baseId: string,
  args: { projectName: string; stage: string; entries: Record<string, string> }
): ssm.StringParameter[] {
  const { projectName, stage, entries } = args;
  return Object.entries(entries).map(([key, value]) =>
    new ssm.StringParameter(scope, `${baseId}-${key}`, {
      parameterName: `/${projectName}/${stage}/${key}`,
      stringValue: value,
    })
  );
}
