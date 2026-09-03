/**
 * Session-cwd resolution for snapshot tracking reads, mirroring the fs tools'
 * own rule (`@deepseek-ai/dsh-tool-fs/session-cwd.ts`): relative paths
 * resolve against the calling agent's session workspace
 * (`exec.agent.session.header.cwd`), not the server's launch dir.
 *
 * Pure functions: the only runtime dependency is `canonicalPath`, applied
 * when either the cwd or the requested path contains a parent traversal so a
 * symlinked cwd's filesystem identity stays observable — identical to the
 * tool boundary behavior.
 *
 * @module dsh-rewind/session-cwd
 */
import type { ToolExecution } from '@deepseek-ai/dsh-tools';
/**
 * The session workspace cwd to resolve `requestedPath` against, or undefined
 * when no session cwd applies (the filesystem backend then uses its own
 * default base).
 * @param cwd - the session's `header.cwd`, if any.
 * @param requestedPath - the path the provider will resolve.
 * @returns the cwd, canonicalized when traversal could expose a symlink.
 */
export declare function sessionCwd(cwd: string | undefined, requestedPath: string): string | undefined;
/**
 * Session cwd for one tool execution (same rule as the fs tools).
 * @param exec - the tool-execution context; only its optional `agent` is read.
 * @param requestedPath - the path the provider will resolve.
 */
export declare function execSessionCwd(exec: ToolExecution, requestedPath: string): string | undefined;
