/**
 * dsh-rewind portal half: the per-user-message ↶ rewind button, rendered as a
 * React portal inside the message's `MessageIconActions` row.
 *
 * Why portals (aligned with the copy button's own rendering): the copy button
 * is a React child of the actions row, painted in the same commit as the
 * bubble. A pure-DOM `appendChild` (the earlier approach) lands one microtask
 * later and re-runs a full-transcript scan on EVERY mutation, which can push
 * the paint of a newly sent bubble — the "occasional hiccup before the bubble
 * shows". Portals let React own the button lifecycle (mount/unmount with the
 * row, no orphaned buttons, no manual re-attach after harness re-renders),
 * and the target collection is coalesced (one refresh per mutation batch) and
 * diffed (no setState churn when nothing changed).
 *
 * Mount point: the plugin registers a session-scoped bridge into the harness's
 * `conversation.session.header.actions` list slot. The bridge renders NO
 * header UI — it only portals buttons into the user rows of the session the
 * harness mounts it for. That slot is the harness-native way to get a
 * per-session React mount without touching any source; the registration is
 * typed structurally (see `SlotsLike`) so the plugin never imports the
 * conversation UI package's types and survives its version drift.
 *
 * @module dsh-rewind/client/portals
 */
import { type ReactNode } from 'react';
import type { SessionFace } from '@deepseek-ai/dsh-client-runtime/client';
import type { RewindKey } from './locales.ts';
type Translate = (key: RewindKey, params?: Record<string, unknown>) => string;
/** Capabilities the session-scoped bridge receives from the plugin apply(). */
export interface RewindBridgeDeps {
    readonly sessionOf: (sessionId: string) => SessionFace | undefined;
    readonly currentSessionId: () => string | undefined;
    readonly t: Translate;
    readonly subscribeLocale: (cb: () => void) => () => void;
}
/** Structural face of the runtime slot service (see the module doc). */
export interface SlotsLike {
    inject(key: string, install: () => () => void): () => void;
    register(entry: {
        readonly name: string;
        readonly id: string;
        readonly order: number;
    }, component: (props: {
        readonly sessionId: string;
    }) => ReactNode): () => void;
}
/**
 * Fill the dsh composer with `text` (React-controlled textarea: use the
 * native setter so the value change is seen, then dispatch an input event).
 * Best-effort — no composer match means the fill is skipped. Used by
 * `runRewindAndFill` to put the withdrawn target message back into the
 * composer after a rewind.
 */
export declare function fillComposer(text: string): boolean;
/**
 * Execute one rewind from the popover and, when it settles successfully,
 * put the withdrawn target message's text back into the composer so the
 * user can edit and re-send.
 *
 * THE COMPOSER FILL IS EVENT-DRIVEN: it runs only when THIS page performed
 * the rewind (the user clicked confirm moments ago). It must NEVER scan
 * loaded history for rewind commands: a session window opens with only
 * the tail page and grows via loadOlder, so a "command already in the
 * snapshot" cannot be told apart from "command executed in this page" —
 * the old baseline heuristic refilled withdrawn text into the composer
 * after switching sessions or restarting dsh.
 */
export declare function runRewindAndFill(session: SessionFace, seq: number, mode: 'chat' | 'both', currentSessionId: () => string | undefined): Promise<void>;
interface RewindPortalsProps extends RewindBridgeDeps {
    readonly sessionId: string;
}
/**
 * Session-scoped portal bridge: renders the ↶ button of every user message
 * row of the session the harness mounts it for. The refresh is coalesced
 * (one pass per mutation batch via queueMicrotask) and diffed (setState is
 * skipped when the target set is unchanged), so the plugin never runs a
 * synchronous full-transcript scan inside a commit microtask.
 */
export declare function RewindPortals({ sessionId, sessionOf, currentSessionId, t, subscribeLocale }: RewindPortalsProps): ReactNode;
/**
 * Build the slot-entry component for the plugin apply(): a tiny bridge that
 * injects the apply-time capabilities (session resolution, locale, rewind
 * runner) into the module-level `RewindPortals`.
 */
export declare function createRewindBridge(deps: RewindBridgeDeps): (props: {
    readonly sessionId: string;
}) => ReactNode;
export {};
