/**
 * Host-side localization for dsh-rewind's `/rewind` command output and command
 * description.
 *
 * Architecture (matches the dsh ecosystem): the HOST half of a dual-face
 * plugin has no locale service — only the browser client carries one. The host
 * therefore renders its command-adjacent copy from a durable user preference
 * (`ctx.settings` → `locale.preference`, registered by dsh-client-locale),
 * defaulting to English — the ecosystem's neutral default language (the harness
 * `FALLBACK_LOCALE` and the language dsh's own host commands use, e.g.
 * dsh-plan-mode). See packages/client/locale in deepseek-harness.
 *
 * The client half (`src/client/locales.ts`) owns all interactive UI copy via
 * `ctx.locale` + `t()`; the host's human text is a machine channel the client
 * renders through machine tokens (`impact=<n>`, `args` @seq), never by parsing
 * host prose.
 *
 * English is the key-set source of truth; zh is checked complete against it.
 *
 * @module dsh-rewind/locales
 */
/** Host-side supported locale ids, mirroring the harness's shipped locales. */
export type HostLocaleId = 'zh' | 'en';
/** English dictionary — the key-set source of truth (neutral default). */
export declare const en: {
    'usage.title': string;
    'usage.noArgs': string;
    'usage.seq': string;
    'usage.blocked': string;
    'describeTarget.seq': string;
    'describeTarget.index': string;
    'plan.rewinding': string;
    'plan.affects': string;
    'plan.restore': string;
    'plan.delete': string;
    'plan.noChanges': string;
    'error.invalidTarget': string;
    'failures.suffix': string;
    'failures.item': string;
    inflight: string;
    stopFailed: string;
    cancelled: string;
    failed: string;
    'restore.count': string;
    'delete.count': string;
    'skip.count': string;
    noRestorable: string;
    success: string;
    noUserMessages: string;
    chooseMode: string;
    'command.description': string;
};
/** The host rewind dictionary key union. */
export type HostKey = keyof typeof en;
/** Chinese dictionary, checked complete against the en key set. */
export declare const zh: Record<HostKey, string>;
/** The host dictionaries keyed by locale id. */
export declare const HOST_DICTS: Record<HostLocaleId, Record<HostKey, string>>;
/**
 * Render one dictionary key with `{name}` template interpolation. Unknown
 * params are ignored; a missing key falls back to the raw key so a dictionary
 * gap is visible instead of blank.
 * @param lang - the active locale.
 * @param key - the dictionary key.
 * @param params - `{name}` substitution values.
 */
export declare function translate(lang: HostLocaleId, key: HostKey, params?: Record<string, string | number>): string;
