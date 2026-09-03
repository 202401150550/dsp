import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const name = 'dsh-enable-image-input-pkg';
export const PACKAGE_NAME = 'dsh-enable-image-input-pkg';

export function resolveSkillRoot(profileBaseUrl) {
  if (!profileBaseUrl) {
    throw new Error('dsh-enable-image-input-pkg: missing DSH profile baseUrl for package resolution');
  }
  let manifestPath;
  try {
    manifestPath = createRequire(profileBaseUrl).resolve(`${PACKAGE_NAME}/package.json`);
  } catch (error) {
    throw new Error(
      `dsh-enable-image-input-pkg: cannot resolve ${PACKAGE_NAME}/package.json from the DSH profile`,
      { cause: error },
    );
  }
  return join(dirname(manifestPath), 'skills');
}
