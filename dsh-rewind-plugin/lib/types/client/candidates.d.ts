/**
 * Pure candidate computation for the `/rewind` command decoration: which user
 * messages the harness's popupSelect shell offers, withdrawn-row exclusion,
 * preview truncation, and the mapping to popupSelect rows. The listing is a
 * pure function of the session chat snapshot (`rewindCandidatesOf`) so it
 * stays unit-testable in a node environment. Surface user/steering messages
 * only, withdrawn (hidden) rows excluded, newest first — the top row is the
 * default highlight, i.e. the most recent message and the most common rewind
 * target.
 *
 * @module dsh-rewind/client/candidates
 */
import type { SelectOption } from '@deepseek-ai/dsh-client-ui-commands/client';
import type { RewindKey } from './locales.ts';
type Translate = (key: RewindKey, params?: Record<string, unknown>) => string;
/** Preview length cap for candidate rows (matches the host's candidate list). */
export declare const PREVIEW_CHARS = 80;
/**
 * Default cap on how many user messages the rewind picker lists (newest kept).
 *
 * A fixed 10 made long sessions look "incomplete" (only the newest 10 shown).
 * 50 keeps the picker scrollable/searchable via the popupSelect shell while
 * covering far longer sessions; callers can still pass an explicit `limit`.
 */
export declare const DEFAULT_CANDIDATE_LIMIT = 50;
/** One selectable rewind target. */
export interface RewindCandidate {
    /** Absolute log seq of the `user/message` event. */
    readonly seq: number;
    /** Unix epoch ms of the event. */
    readonly time: number;
    /** Truncated plain-text preview of the message content. */
    readonly preview: string;
}
/** A chat snapshot subset the candidate listing reads (structural). */
export interface CandidateChat {
    readonly order: readonly string[];
    readonly nodes: {
        get(key: string): CandidateUserNode | undefined;
    };
}
/** A user/steering row subset; only fields the listing reads are real. */
export interface CandidateUserNode {
    readonly kind: string;
    readonly anchorSeq?: number;
    readonly data: {
        readonly seq: number;
        readonly time: number;
        readonly content: readonly {
            type: string;
            text?: unknown;
        }[];
    };
}
/** Join the text blocks of a user message into one plain preview. */
export declare function messagePreviewOf(message: {
    readonly content: readonly {
        type: string;
        text?: unknown;
    }[];
}): string;
/** Format a candidate row's clock time (`HH:MM`), matching the host format. */
export declare function formatCandidateTime(time: number): string;
/**
 * List the selectable rewind candidates of a session chat snapshot: user and
 * steering rows still on the surface (not hidden by a previous rewind), the
 * newest `limit` kept, newest first — the top row is the default highlight,
 * i.e. the most recent message and the most common rewind target.
 * @param snap - the session chat snapshot.
 * @param hidden - anchor seqs withdrawn by rewinds (from `hiddenSeqsOf`).
 * @param limit - maximum number of candidates to return.
 */
export declare function rewindCandidatesOf(snap: CandidateChat, hidden: ReadonlySet<number>, limit?: number): RewindCandidate[];
/** The candidates of a live chat snapshot, withdrawn rows already excluded. */
export declare function rewindCandidatesOfChat(snap: CandidateChat): RewindCandidate[];
/**
 * Map the candidates to popupSelect rows: the message preview as the row
 * label (left) and the clock time as the detail (right) — the shell's native
 * label/detail flex layout, with no recency numbers.
 */
export declare function rewindOptionsOf(snap: CandidateChat, t: Translate): SelectOption[];
/** Resolve one candidate by log seq (the mode popover's re-entry after a pick). */
export declare function candidateBySeq(snap: CandidateChat, seq: number): RewindCandidate | undefined;
/**
 * Parse the host's candidate-list encoding (see `formatCandidateList` in
 * src/rewind.ts) into typed candidates. Malformed lines are skipped; a
 * missing/zero header yields an empty list.
 */
export declare function rewindCandidatesFromHostText(text: string): RewindCandidate[];
/**
 * Map typed candidates to popupSelect rows (the host-derived path). The
 * popupSelect sources its options from the FULL host surface via the
 * `__candidates` channel instead of the windowed chat snapshot.
 */
export declare function rewindOptionsFromCandidates(candidates: readonly RewindCandidate[], t: Translate): SelectOption[];
/**
 * Parse the host's candidate-list encoding (see `formatCandidateList` in
 * src/rewind.ts) into popupSelect rows.
 */
export declare function rewindOptionsFromHostText(text: string, t: Translate): SelectOption[];
export {};
