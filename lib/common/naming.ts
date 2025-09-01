export const nameFn = (project: string, stage: string) => (base: string) =>
  `${project}-${stage}-${base}`;
