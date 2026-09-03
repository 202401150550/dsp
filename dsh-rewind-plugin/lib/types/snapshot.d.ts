/**
 * Checkpoint store — the Claude Code style file-rewind backing for dsh-rewind.
 *
 * Claude Code's checkpointing (see README) works like this: it creates a
 * BACKUP of a file BEFORE every tracked modification, groups those backups by
 * the user message they belong to (a "checkpoint"), and rewinding to a
 * checkpoint restores every backup recorded at or after it — modified files
 * are written back to their pre-edit content, files created after the target
 * are deleted. This module is the same design, persisted on disk:
 *
 * - `tools/execute` captures the BEFORE state of each tracked write/edit call
 *   (or "created" when the file did not exist) — the capture happens at the
 *   around-dispatch stage, so an approval `ask` short-circuit cannot skip it
 *   and a denied call never records.
 * - The entry is committed to disk at `tools/post-execute` under the turn's
 *   anchor seq: `<root>/<sessionId>/<anchorSeq>/<callId>.json`, carrying the
 *   path and the before content (`before: null` = the file was created).
 * - Because entries live on disk under the dsh data directory, they survive a
 *   host restart, are bounded (the newest 100 anchor groups per session are
 *   kept), and restores read/write the real file system with plain `node:fs`
 *   — independent of the fs service.
 *
 * Restore semantics (identical to Claude Code): for every path with entries
 * anchored at or after the target message, apply the EARLIEST entry — write
 * the before content back, or delete the file when that entry recorded a
 * creation. Symlinked and hard-linked paths are skipped and reported, never
 * written through.
 *
 * @module dsh-rewind/snapshot
 */
/** Default store root: the dsh data directory. */
export declare const DEFAULT_SNAPSHOT_ROOT: string;
/** Environment variable overriding the store root (tests, exotic homes). */
export declare const SNAPSHOT_ROOT_ENV = "DSH_REWIND_SNAPSHOT_DIR";
/** Number of newest anchor groups (user messages) kept per session. */
export declare const MAX_ANCHOR_GROUPS = 100;
/** One committed before-backup, keyed by tool call. */
export interface CheckpointEntry {
    readonly callId: string;
    /** Seq of the user message anchoring the turn in which the change happened. */
    readonly anchorSeq: number;
    /** Resolved display path (absolute) of the tracked file. */
    readonly path: string;
    /** Full content before the change; null when the file was created. */
    readonly before: string | null;
    /** Epoch ms the entry was committed (stable ordering within a group). */
    readonly time: number;
}
/** Per-file restore impact preview (`/rewind preview @seq both`). */
export interface FileImpact {
    readonly path: string;
    /** `restore` = write the before content back; `delete` = remove the file. */
    readonly action: 'restore' | 'delete';
}
/** Outcome of one restore pass. */
export interface RestoreOutcome {
    readonly restored: readonly string[];
    readonly deleted: readonly string[];
    /** Symlinked or hard-linked paths left untouched. */
    readonly skipped: readonly string[];
    readonly failed: readonly {
        path: string;
        message: string;
    }[];
}
/** Deletes one file by its real path (node:fs, bypassing the fs service). */
export type DeleteFile = (path: string) => Promise<void>;
/**
 * Current-on-disk state probe used by restore planning. Injected so the plan
 * logic runs against a fake FS in tests; the production default reads the
 * real file system with plain `node:fs` (see {@link defaultProbe}).
 */
export interface DiskProbe {
    /**
     * Full text of the file, or undefined when the file does not exist.
     * Any thrown error is treated as a probe failure: restore planning then
     * conservatively treats the file as DIFFERING from its record (a restore
     * still attempts the write / a delete still attempts the unlink), so an
     * unreadable file is never silently skipped.
     */
    readText(path: string): Promise<string | undefined>;
    /** True when the path is a symlink or a hard link (never planned/restored). */
    isLink(path: string): Promise<boolean>;
}
/** One restore action the planner derived from record + disk reconciliation. */
export type PlannedAction = {
    readonly path: string;
    readonly action: 'restore';
    readonly before: string;
} | {
    readonly path: string;
    readonly action: 'delete';
};
/** Production probe: real reads via node:fs, links detected by lstat + nlink. */
export declare const defaultProbe: DiskProbe;
/**
 * On-disk checkpoint store. Every write goes straight through `node:fs`, so a
 * restore reliably lands on the real file system.
 */
export declare class SnapshotStore {
    readonly root: string;
    /** Debounce window for the per-commit prune (keeps the readdir+sort off the hot path). */
    private static readonly PRUNE_INTERVAL_MS;
    private lastPruneAt;
    constructor(root?: string);
    /** Absolute path of one session's snapshot directory (id sanitized). */
    sessionDir(sessionId: string): string;
    /** Absolute path of one anchor group directory. */
    anchorDir(sessionId: string, anchorSeq: number): string;
    /** Commit one before-backup under its turn's anchor group. */
    recordEntry(sessionId: string, entry: Omit<CheckpointEntry, 'time'>): Promise<void>;
    /**
     * All committed entries anchored at or after `targetSeq`, newest first (for
     * preview ordering). The boundary is inclusive: rewinding to a message also
     * reverts the changes its own turn caused (the rewind cut removes that
     * turn's assistant response and tool calls), so only entries anchored at
     * earlier messages survive.
     */
    entriesAfter(sessionId: string, targetSeq: number): Promise<CheckpointEntry[]>;
    /**
     * Per-path EARLIEST committed entry anchored at or after the target — the
     * single source of truth for both restore and impact preview.
     */
    private earliestEntries;
    /**
     * The single source of truth for BOTH the impact preview and the restore
     * pass: reconcile the earliest recorded entry per path (at/after the
     * target) against the CURRENT on-disk state, and plan only the actions
     * that would actually change the disk. This is the Claude Code model —
     * `fileHistoryGetDiffStats` / `applySnapshot` both compare against the
     * live filesystem (`checkOriginFileChanged`) and count only real
     * differences, so a rewind whose target state already matches the disk is
     * a no-op with zero impact.
     *
     * - `before === null` (the file did not exist at the target) plans a
     *   `delete` ONLY when the file currently exists; an already-absent file
     *   is a no-op — this kills the "ghost impact" of replaying an entry a
     *   previous rewind already consumed.
     * - `before === 'X'` plans a `restore` ONLY when the current content
     *   differs from X (or the file is missing); identical content is a no-op
     *   — this keeps repeated rewinds idempotent.
     * - Symlinked / hard-linked paths are never planned (they are reported as
     *   skipped by the restore pass, never written through).
     * - A probe failure (e.g. a permission error reading the file) plans the
     *   action conservatively as if the file differed, so an unreadable file
     *   is never silently dropped from the restore.
     *
     * @param sessionId - session whose snapshot store to plan against.
     * @param targetSeq - rewind target; entries anchored at/after it apply.
     * @param probe - current-disk state probe (defaults to the real FS).
     * @returns the planned actions plus the link paths that were skipped.
     */
    private planRestore;
    /** Per-file restore impact: only actions that would actually change the disk. */
    impactsAfter(sessionId: string, targetSeq: number, probe?: DiskProbe): Promise<FileImpact[]>;
    /**
     * Restore the workspace to the target message's checkpoint: execute exactly
     * the actions {@link planRestore} derived from the record + current disk
     * reconciliation — write the before content back, or delete the file when
     * it was created after the target and still exists. Symlinked and
     * hard-linked paths are skipped (reported, never written through); a
     * restored file's parent directory is created when it was deleted after
     * the backup; a delete whose file is ALREADY absent is a silent no-op (not
     * a failure — the target state is already reached). Failures are per-file
     * and never abort the pass.
     */
    restoreAfter(sessionId: string, targetSeq: number, deleteFile: DeleteFile, probe?: DiskProbe): Promise<RestoreOutcome>;
    /**
     * Drop the session's oldest anchor groups beyond `keep` (default
     * {@link MAX_ANCHOR_GROUPS}), deleting their whole directories.
     */
    prune(sessionId: string, keep?: number): Promise<void>;
    /** True when a path exists on disk (used by tests and diagnostics). */
    exists(path: string): Promise<boolean>;
    /**
     * All distinct paths ever recorded for a session — the "tracked files"
     * set. Mirrors Claude Code's global `trackedFiles` collection (files stay
     * tracked once a write-class tool touched them), derived from the disk
     * entries so no extra persistence is needed.
     */
    trackedPaths(sessionId: string): Promise<Set<string>>;
}
/**
 * Re-check every tracked file at a user-message boundary and record the
 * current on-disk state for any file whose state changed since it was last
 * seen — Claude Code's `fileHistoryMakeSnapshot` re-stats every tracked file
 * at each user message and snapshots the new state (changed files get a new
 * backup version, deleted files a null marker). Here the "new version" is a
 * plain before-backup entry anchored at the boundary message, so an EXTERNAL
 * edit or deletion (never seen by the write-class tool capture) enters the
 * record and can be restored by a later rewind.
 *
 * Semantics: the recorded `before` is the file's state at the boundary —
 * the state the boundary message's turn starts from, exactly like the
 * tool-captured entries. An entry is written only when the state differs
 * from the last-seen state (`states`); the FIRST sighting of a path always
 * records (a restart leaves `states` empty, so the first boundary after a
 * restart unconditionally records the current state — redundant but correct,
 * mirroring Claude's resume-then-re-stat behavior).
 *
 * Symlinked / hard-linked paths are never re-checked (restores skip them).
 * A probe failure skips the file with a warning-level no-op; it never
 * aborts the boundary pass.
 *
 * @param store - the session's snapshot store.
 * @param sessionId - session whose tracked files to re-check.
 * @param anchorSeq - the boundary user-message seq (entry anchor).
 * @param tracked - the session's tracked path set (read-only here).
 * @param states - per-path last-seen state (path → content, null = absent).
 * @param probe - current-disk state probe (defaults to the real FS).
 * @returns the number of entries recorded.
 */
export declare function reconcileTracked(store: SnapshotStore, sessionId: string, anchorSeq: number, tracked: ReadonlySet<string>, states: Map<string, string | null>, probe?: DiskProbe): Promise<number>;
