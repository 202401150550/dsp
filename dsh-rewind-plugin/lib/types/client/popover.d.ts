/**
 * The rewind mode-selection popover (plain DOM, no React). Step two of the
 * interaction: the target is already fixed (the clicked message); the popover
 * offers the two modes. Choosing "both" first fetches the impact list through
 * the `/rewind preview @seq both` command and shows it before confirming.
 *
 * Keyboard: ↑/↓ move focus across the step's ACTION buttons only (the two
 * modes, or the confirm button on the impact step), Enter activates the
 * focused button (native), Esc is the keyboard twin of the ghost back/cancel
 * buttons — cancel on the modes step, back on the impact step; the ghosts are
 * never in the arrow cycle. The listener runs in the document capture phase
 * so the keys are stolen from the composer while the popover is open.
 *
 * @module dsh-rewind/client/popover
 */
import type { SessionFace } from '@deepseek-ai/dsh-client-runtime/client';
import type { CommandNode } from '@deepseek-ai/dsh-client-runtime/client';
import type { RewindKey } from './locales.ts';
type Translate = (key: RewindKey, params?: Record<string, unknown>) => string;
export interface PopoverOptions {
    readonly session: SessionFace;
    readonly seq: number;
    readonly time: number;
    readonly preview: string;
    /** The button that opened the popover (outside-click ignore target). */
    readonly anchor: HTMLElement;
    readonly t: Translate;
    /**
     * Execute one rewind in the given mode. The popover closes itself first;
     * the callback owns the command + composer-refill lifecycle (see
     * runRewindAndFill in index.ts).
     */
    readonly onRewind: (mode: 'chat' | 'both') => void;
}
/** Close the current popover, if any. */
export declare function closePopover(): void;
/**
 * Seqs of the command nodes currently matching `match`. Sample BEFORE issuing
 * a new command of the same shape so the subsequent wait can exclude them: a
 * repeated preview/rewind of the same target must not settle on the previous
 * command's stale outcome (e.g. an older preview that found file changes,
 * after those changes were already restored).
 */
export declare function knownCommandSeqs(session: SessionFace, match: (node: CommandNode) => boolean): Set<number>;
/**
 * Resolve the outcome of the newest matching rewind command by watching the
 * session snapshot (command/run + command/done land as one CommandNode).
 * @returns the outcome text-bearing node, or null on timeout.
 */
export declare function waitForCommand(session: SessionFace, match: (node: CommandNode) => boolean, timeoutMs?: number): Promise<{
    kind: 'success' | 'error';
    text?: string;
} | null>;
/** Open the mode-selection popover anchored near the given button. */
export declare function openPopover(opts: PopoverOptions): void;
export {};
