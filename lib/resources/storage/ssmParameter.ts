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

/**
 * Create ssm parameters with app types (backend, frontend))
 */
export function createSsmStringParamsV2(
  scope: Construct,
  baseId: string,
  args: { projectName: string; stage: string; entries: Array<{ key: string; value: string; appType?: "frontend" | "backend" }> }
): ssm.StringParameter[] {
  const { projectName, stage, entries } = args;
  return entries.map(({ key, value, appType }) => {
    const idSuffix = appType ? `${baseId}-${appType}-${key}` : `${baseId}-${key}`;
    const path = appType ? `/${projectName}/${stage}/${appType}/${key}` : `/${projectName}/${stage}/${key}`;
    return new ssm.StringParameter(scope, idSuffix, {
      parameterName: path,
      stringValue: value,
    });
  });
}
