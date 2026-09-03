/**
 * dsh-rewind client half: the `/rewind` command decoration, the
 * parameterized-input guard, the locale registration, and the session-scoped
 * portal bridge that renders the per-message ↶ rewind button (see
 * `portals.tsx` for the button itself).
 *
 * The button is NOT injected by hand into the DOM anymore: the plugin
 * registers a bridge into the harness's `conversation.session.header.actions`
 * list slot, and that bridge portals a React button into every user message's
 * IconActions row — the same rendering family as the copy button (a React
 * child of the actions row), without touching any harness source. The
 * registration is typed structurally (see `SlotsLike` in portals.tsx), so the
 * plugin never imports conversation UI types and survives harness version
 * drift.
 *
 * The text-driven flow is the harness's STANDARD command decoration
 * (`ctx.commandUi.decorate`): a bare `/rewind` — picked from the slash-menu
 * completion, or typed in full and Entered — opens the harness's own
 * popupSelect shell (search, ↑↓/Enter, Esc) listing the rewind candidates
 * instead of executing the command. Picking one continues the SAME flow as
 * the ↶ button: the mode popover, both-impact confirmation, execution, row
 * hiding and the composer refill (`runRewindAndFill`). The parameterized
 * forms (`/rewind @<seq> chat|both`, `/rewind preview …`) stay internal
 * channels the ↶ button and the popover drive through `session.command`; a
 * hand-typed parameterized line is stopped with a hint.
 *
 * @module dsh-rewind/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export declare const name = "dsh-rewind";
export declare const inject: string[];
/**
 * Client plugin body: command decoration + parameterized guard + locale + the
 * portal bridge.
 * @param ctx - client root context carrying `slots`, `sessions`, `locale` and `commandUi`.
 */
export declare function apply(ctx: ClientContext): void;
