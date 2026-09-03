/**
 * Community bundle ordering — issue #98 (phase 2): let the user reorder the
 * community bundles of the profile's layer stack, with author-declared
 * before/after rules enforced before anything is written.
 *
 * Official in-box bundles (@deepseek-ai/dsh-base, @deepseek-ai/dsh-web-app,
 * @deepseek-ai/dsh-headless) are fixed: they keep their exact positions in
 * the stack, are never part of a user-supplied order, and are never added,
 * removed or duplicated by a reorder (#98 boundary). The profile's own
 * cordis.patch.yml and --patch overlays are not part of the bundle stack and
 * are never touched here.
 *
 * Read-only helpers — nothing here writes the manifest; no processes, no
 * network. The write side (mergeOrder / applyBundleOrder) lives on the
 * ordering branch.
 */
/** Profile bundles that ship with the dsh host and must stay put (#98). */
export declare const INBOX_BUNDLES: Set<string>;
/** The bundle stack as it appears in the profile manifest. */
export interface BundleStack {
    /** Full ordered list from dsh.profile.bundles. */
    bundles: string[];
    /** The subset that may be reordered (community bundles). */
    community: string[];
}
/** Author-declared ordering constraints of one bundle. */
export interface BundleRule {
    name: string;
    /** This bundle must load after every name in this list. */
    after: string[];
    /** This bundle must load before every name in this list. */
    before: string[];
}
/** A violated before/after rule in the current or proposed order. */
export interface OrderConflict {
    name: string;
    reason: string;
}
/** Read the profile's bundle stack (empty when the manifest is unreadable). */
export declare function readBundleStack(profileDir: string): BundleStack;
/**
 * Read each bundle's declared ordering rules from its package manifest
 * (`dsh.bundle.order.{before,after}` — a list of bundle package names).
 * Unresolvable packages and missing declarations contribute nothing.
 */
export declare function readBundleRules(profileDir: string): BundleRule[];
/**
 * Check a bundle order against the declared before/after rules. Rules naming
 * bundles outside `order` are ignored (a rule for a not-yet-installed bundle
 * must not block the current stack).
 * @returns every violated rule with a readable reason; [] when all hold.
 */
export declare function validateOrder(bundleNames: string[], rules: BundleRule[]): OrderConflict[];
/**
 * Topologically sort the community bundles by their before/after rules AND
 * plugin-to-plugin dependencies — the "auto-fix" counterpart to validateOrder
 * (LOOT-style): the suggested order satisfies every declared rule and puts
 * each bundle after the bundles it depends on. Kahn's algorithm with
 * deterministic tie-breaking (stable input order). Bundles without
 * constraints keep their relative order among the unconstrained ones.
 *
 * `dependencyEdges` expresses "from depends on to" (usually read from each
 * bundle's dependencies/peerDependencies that name another community
 * bundle); the constraint is `to` must load before `from`.
 * @returns the suggested community order, or a cycle report when the
 * constraints cannot be satisfied (references to unlisted bundles ignored).
 */
export declare function suggestOrder(bundleNames: string[], rules: BundleRule[], dependencyEdges?: Array<{
    from: string;
    to: string;
}>): {
    ok: true;
    order: string[];
} | {
    ok: false;
    cycle: string[];
};
