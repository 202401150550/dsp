/**
 * Pure computation of the chat rows a rewind hides from the rendered
 * transcript. Extracted from the client plugin (`src/client/index.ts`) so the
 * multi-rewind cut logic stays unit-testable without a DOM.
 *
 * @module dsh-rewind/client/hidden
 */
import type { ChatConversationViewNode, CommandNode } from '@deepseek-ai/dsh-client-runtime/client';
/** Minimal chat snapshot reader the hiding logic needs. */
export interface HiddenChat {
    readonly order: readonly string[];
    readonly nodes: {
        get(key: string): ChatConversationViewNode | undefined;
    };
}
/**
 * Extract the rewind target seq from a `/rewind` command's structured `args`
 * (e.g. `@5 chat`, `preview @5 both`). Locale-independent — never parses the
 * host's human outcome copy.
 */
export declare function targetSeqOfArgs(args: string | null | undefined): number | undefined;
/**
 * True when a `/rewind` command node is an EXECUTED rewind for `seq` — the
 * admission form the popover drives (`@<seq> chat` / `both`) that settled
 * with a marker-carrying success outcome. The composer refill waits for
 * exactly this node after the user confirms, so a history-loaded command can
 * never trigger a fill.
 */
export declare function isExecutedRewindCommand(node: CommandNode, seq: number): boolean;
/**
 * Whether a preview outcome reports tracked file changes — the availability
 * of the "rewind conversation and code" option (Claude Code hides the
 * code-restore options when the checkpoint has no tracked changes).
 *
 * Reads ONLY the machine-readable `impact=<n>` trailer the host appends to
 * preview text. Older host output without the trailer is treated as having no
 * changes (never guesses from human copy). Unknown/absent text degrades to
 * always-show so a working option is never hidden on a failed probe.
 */
export declare function hasFileImpact(text: string | undefined): boolean;
/**
 * True when a `/rewind` command node is the internal candidate-list probe
 * (`/rewind __candidates`) the popupSelect runs to fetch the FULL candidate
 * list from the host. Like previews, its flow node never surfaces in the
 * transcript — it only feeds the popup — so it is hidden in every state.
 */
export declare function isCandidateCommand(command: CommandNode): boolean;
/**
 * Anchor seqs that must be hidden from the rendered transcript so the user
 * sees the conversation as the agent sees it: every impact-preview flow node
 * (pending, succeeded, or errored — it only exists to feed the popover) and
 * every SUCCESSFUL executed `/rewind` command row, plus every message
 * withdrawn by a rewind — the target message itself, everything after it, and
 * the (empty, unrendered) marker.
 *
 * Each executed rewind cuts ONE span `[target, marker]`: the target message
 * and everything after it, up to the marker appended at rewind time. Spans are
 * kept SEPARATE (never collapsed to a single `[min target, max marker]`)
 * because a later rewind to a LATER point leaves a visible gap of new traffic
 * between the earlier marker and the later target — collapsing the spans would
 * hide that still-on-surface gap. Endpoints come from the command nodes:
 * `sourceEventSeq` is the marker's log seq, and the outcome text carries the
 * target seq.
 */
export declare function hiddenSeqsOf(snap: HiddenChat): Set<number>;
