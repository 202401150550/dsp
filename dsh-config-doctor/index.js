/**
 * dsh-config-doctor — ARCHIVED.
 * APIs moved to dsh-self (dsp/dsh-self/index.js). Do not install this package.
 */
export const name = 'dsh-config-doctor'
export const inject = []

export async function apply() {
  console.warn(
    '[dsh-config-doctor] archived: doctor/toggle APIs live in dsh-self; uninstall this package from the profile',
  )
}
