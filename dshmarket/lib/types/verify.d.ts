/**
 * Post-install activation verification (P0-2): what "installed" actually
 * means for a package in a dsh profile.
 *
 * Two sources of truth, in strict order of authority:
 *
 * 1. The LOADER INVENTORY (observed): whatever the loader is running right
 *    now is live, full stop. A plain library with no `dsh` field can be
 *    loaded by name from someone else's bundle patch — the official
 *    dsh-base patch loads `@deepseek-ai/dsh-tools`, which has no `dsh`
 *    field at all — so no manifest check may overrule it (#135).
 * 2. The profile manifest (inferred): `<profile>/package.json` →
 *    `dsh.profile.bundles`, what the dsh CLI reconciled. This predicts what
 *    the NEXT boot will load, and is the only evidence available for a
 *    package that is not currently running.
 *
 * State taxonomy (IMPROVEMENT-PLAN P0-2):
 *   live    – running in the current composition (hot mount or loader entry)
 *   restart – installed and will activate on the next boot, but not live now
 *   inert   – installed but not a profile-layer plugin (plain dependency, or
 *             client-only — the market shim-mounts those at boot)
 *   broken  – would fail to load: listed as a bundle without a dsh surface,
 *             or a declared entry artifact that is missing
 *   missing – not present in node_modules
 */
export type ActivationState = 'live' | 'restart' | 'inert' | 'broken' | 'missing' | 'disabled';
export interface ActivationResult {
    state: ActivationState;
    /** Bilingual, user-facing explanations (zh / en joined with " / "). */
    reasons: string[];
    /** True when the package is in the profile's `dsh.profile.bundles`. */
    bundle: boolean;
    /** True when the package is live in the running composition. */
    hot: boolean;
}
/**
 * Verify the activation state of one installed package.
 * @param live - names live in the current composition; defaults to the
 * market's hot-mount table (injectable for tests).
 */
export declare function verifyActivation(profile: string, name: string, live?: ReadonlySet<string>, explicitDir?: string, isDisabled?: boolean): ActivationResult;
