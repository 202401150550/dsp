// src/index.ts
import { createAssistantMessage } from "@deepseek-ai/dsh-llm";
import { unlink } from "node:fs/promises";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";

// src/locales.ts
var en = {
  "usage.title": "Usage:",
  "usage.noArgs": "  /rewind                       (no args) withdraw the most recent user message",
  "usage.seq": "  /rewind @<seq> chat|both      rewind to the given message (chat = conversation only / both = conversation + files)",
  "usage.blocked": "  Manual /rewind input is intercepted; use the \u21B6 button next to a message",
  "describeTarget.seq": "seq {seq}",
  "describeTarget.index": "message {index}",
  "plan.rewinding": "Rewind to seq {targetSeq}, removing {count} node(s) from the model context (conversation log kept).",
  "plan.affects": "Affects {count} file(s):",
  "plan.restore": "restore {path}",
  "plan.delete": "delete {path}",
  "plan.noChanges": "No restorable changes after the target.",
  "error.invalidTarget": 'Cannot parse target "{raw}" (expected <index> or @<seq>)',
  "failures.suffix": "; {count} file(s) failed to restore: {list}",
  "failures.item": "{path} ({message})",
  "inflight": "A rewind is already running for this session; please wait.",
  "stopFailed": "Could not stop the running agent; rewind cancelled. Please try again.",
  "cancelled": "Rewind cancelled.",
  "failed": "Rewind failed: {error}. The session is unchanged.",
  "restore.count": "restored {count} file(s)",
  "delete.count": "deleted {count} file(s)",
  "skip.count": "skipped {count} link(s)",
  "noRestorable": "; no restorable write-class changes after the target",
  "success": "Withdrawn seq {targetSeq} and everything after it (conversation returned to earlier){restore}.",
  "noUserMessages": "This session has no rewindable user messages yet.",
  "chooseMode": "Rewind to {target}. Choose a mode:\n  /rewind {target} chat  conversation only\n  /rewind {target} both  conversation + file restore",
  "command.description": "Rewind the conversation back to an earlier user message (optionally restoring files)"
};
var zh = {
  "usage.title": "\u7528\u6CD5\uFF1A",
  "usage.noArgs": "  /rewind                       \uFF08\u65E0\u53C2\u6570\uFF09\u64A4\u56DE\u6700\u8FD1\u4E00\u6761\u7528\u6237\u6D88\u606F",
  "usage.seq": "  /rewind @<seq> chat|both      \u56DE\u9000\u5230\u6307\u5B9A\u6D88\u606F\uFF08chat \u4EC5\u5BF9\u8BDD / both \u5BF9\u8BDD+\u6587\u4EF6\uFF09",
  "usage.blocked": "  \u624B\u52A8\u8F93\u5165 /rewind \u4F1A\u88AB\u62E6\u622A\uFF0C\u8BF7\u4F7F\u7528\u6D88\u606F\u65C1\u7684\u300C\u56DE\u9000\u300D\u6309\u94AE",
  "describeTarget.seq": "seq {seq}",
  "describeTarget.index": "\u7B2C {index} \u6761\u6D88\u606F",
  "plan.rewinding": "\u5C06\u56DE\u9000\u5230 seq {targetSeq}\uFF0C\u4ECE\u6A21\u578B\u4E0A\u4E0B\u6587\u79FB\u9664 {count} \u4E2A\u8282\u70B9\uFF08\u5BF9\u8BDD\u65E5\u5FD7\u4FDD\u7559\uFF09\u3002",
  "plan.affects": "\u5C06\u5F71\u54CD {count} \u4E2A\u6587\u4EF6\uFF1A",
  "plan.restore": "\u8FD8\u539F {path}",
  "plan.delete": "\u5220\u9664 {path}",
  "plan.noChanges": "\u76EE\u6807\u4E4B\u540E\u6CA1\u6709\u9700\u8981\u8FD8\u539F\u7684\u53D8\u66F4\u3002",
  "error.invalidTarget": '\u65E0\u6CD5\u89E3\u6790\u76EE\u6807 "{raw}"\uFF08\u5E94\u4E3A <\u5E8F\u53F7> \u6216 @<seq>\uFF09',
  "failures.suffix": "\uFF1B{count} \u4E2A\u6587\u4EF6\u8FD8\u539F\u5931\u8D25\uFF1A{list}",
  "failures.item": "{path}\uFF08{message}\uFF09",
  "inflight": "\u8BE5\u4F1A\u8BDD\u5DF2\u6709\u4E00\u4E2A\u56DE\u9000\u6B63\u5728\u6267\u884C\uFF0C\u8BF7\u7A0D\u5019\u3002",
  "stopFailed": "\u65E0\u6CD5\u505C\u6B62\u8FD0\u884C\u4E2D\u7684 agent\uFF0C\u56DE\u9000\u5DF2\u53D6\u6D88\u3002\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002",
  "cancelled": "\u56DE\u9000\u5DF2\u53D6\u6D88\u3002",
  "failed": "\u56DE\u9000\u5931\u8D25\uFF1A{error}\u3002\u4F1A\u8BDD\u672A\u6539\u53D8\u3002",
  "restore.count": "\u8FD8\u539F {count} \u4E2A\u6587\u4EF6",
  "delete.count": "\u5220\u9664 {count} \u4E2A\u6587\u4EF6",
  "skip.count": "\u8DF3\u8FC7 {count} \u4E2A\u94FE\u63A5",
  "noRestorable": "\uFF1B\u76EE\u6807\u4E4B\u540E\u6CA1\u6709\u53EF\u8FD8\u539F\u7684\u5199\u7C7B\u53D8\u66F4",
  "success": "\u5DF2\u64A4\u56DE seq {targetSeq} \u53CA\u4E4B\u540E\u5185\u5BB9\uFF08\u5BF9\u8BDD\u5DF2\u56DE\u5230\u6B64\u524D\uFF09{restore}\u3002",
  "noUserMessages": "\u5F53\u524D\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u53EF\u56DE\u9000\u7684\u7528\u6237\u6D88\u606F\u3002",
  "chooseMode": "\u5C06\u56DE\u9000\u5230 {target}\u3002\u9009\u62E9\u6A21\u5F0F\uFF1A\n  /rewind {target} chat  \u4EC5\u56DE\u9000\u5BF9\u8BDD\n  /rewind {target} both  \u56DE\u9000\u5BF9\u8BDD\u5E76\u8FD8\u539F\u6587\u4EF6",
  "command.description": "\u5728\u540C\u7A97\u53E3\u5185\u5C06\u5BF9\u8BDD\u56DE\u9000\u5230\u66F4\u65E9\u7684\u7528\u6237\u6D88\u606F\uFF08\u53EF\u540C\u65F6\u8FD8\u539F\u6587\u4EF6\uFF09"
};
var HOST_DICTS = { en, zh };
function translate(lang, key, params = {}) {
  const dict = HOST_DICTS[lang] ?? en;
  let text = dict[key] ?? key;
  for (const [name2, value] of Object.entries(params)) {
    text = text.split(`{${name2}}`).join(String(value));
  }
  return text;
}

// src/rewind.ts
var RewindError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "RewindError";
  }
  code;
};
var CANDIDATE_PREVIEW_CHARS = 80;
var DEFAULT_CANDIDATE_LIMIT = 50;
function markerTurnOf(events) {
  let lastStarted = 0;
  for (const event of events) {
    if (event.type === "turn/start" && event.data.turn > lastStarted) {
      lastStarted = event.data.turn;
    }
  }
  return lastStarted;
}
function isUserMessageEvent(event) {
  return event.type === "user/message";
}
function isHumanUserMessageEvent(event) {
  return isUserMessageEvent(event) && event.data.source.kind === "user";
}
function messagePreview(message) {
  const text = message.content.map((block) => block.type === "text" && typeof block.text === "string" ? block.text : "").join("").replace(/\s+/g, " ").trim();
  return text.length <= CANDIDATE_PREVIEW_CHARS ? text : `${text.slice(0, CANDIDATE_PREVIEW_CHARS - 1)}\u2026`;
}
function parseRewindTarget(raw) {
  const token = raw.trim();
  if (token === "") return void 0;
  if (token.startsWith("@")) {
    const seq = Number(token.slice(1));
    return Number.isSafeInteger(seq) && seq >= 0 ? { kind: "seq", seq } : void 0;
  }
  const index = Number(token);
  return Number.isSafeInteger(index) && index >= 1 ? { kind: "index", index } : void 0;
}
function listRewindCandidates(events, surface, limit = DEFAULT_CANDIDATE_LIMIT) {
  const surfaceIndexes = /* @__PURE__ */ new Map();
  for (let i = 0; i < surface.length; i++) surfaceIndexes.set(surface[i], i);
  const candidates = [];
  for (let i = events.length - 1; i >= 0 && candidates.length < limit; i--) {
    const event = events[i];
    if (!isHumanUserMessageEvent(event)) continue;
    if (!surfaceIndexes.has(event.seq)) continue;
    candidates.push({
      seq: event.seq,
      time: event.time,
      preview: messagePreview(event.data),
      index: candidates.length + 1
    });
  }
  return candidates;
}
var CANDIDATE_LIST_HEADER = "candidates=";
function formatCandidateList(candidates) {
  const lines = [`${CANDIDATE_LIST_HEADER}${candidates.length}`];
  for (const candidate of candidates) {
    lines.push(`${candidate.seq}	${candidate.time}	${candidate.preview}`);
  }
  return lines.join("\n");
}
function planRewind(events, surface, target) {
  let targetSeq;
  if (target.kind === "seq") {
    targetSeq = target.seq;
  } else {
    const candidate = listRewindCandidates(events, surface, target.index)[target.index - 1];
    if (candidate === void 0) {
      throw new RewindError("invalid-index", `rewind index ${target.index} has no candidate`);
    }
    targetSeq = candidate.seq;
  }
  const targetEvent = events.find((event) => event.seq === targetSeq);
  if (targetEvent === void 0) {
    throw new RewindError("not-a-user-message", `no session event at seq ${targetSeq}`);
  }
  if (!isHumanUserMessageEvent(targetEvent)) {
    throw new RewindError(
      "not-a-user-message",
      `session event at seq ${targetSeq} is not a human user message (${targetEvent.type})`
    );
  }
  const targetIndex = surface.indexOf(targetSeq);
  if (targetIndex === -1) {
    throw new RewindError(
      "not-on-surface",
      `user message at seq ${targetSeq} is no longer in the model context (shadowed by compaction)`
    );
  }
  const shadowedSeqs = surface.slice(targetIndex);
  return {
    targetSeq,
    targetIndex,
    shadowedSeqs,
    surfaceStart: shadowedSeqs[0],
    surfaceEnd: shadowedSeqs[shadowedSeqs.length - 1]
  };
}

// src/session-cwd.ts
import { canonicalPath } from "@deepseek-ai/dsh-sandbox";
var PARENT_PATH_SEGMENT = /(?:^|[\\/])\.\.(?:[\\/]|$)/;
function sessionCwd(cwd, requestedPath) {
  if (cwd === void 0 || !PARENT_PATH_SEGMENT.test(cwd) && !PARENT_PATH_SEGMENT.test(requestedPath)) return cwd;
  return canonicalPath(cwd);
}
function execSessionCwd(exec, requestedPath) {
  return sessionCwd(exec.agent?.session.header.cwd, requestedPath);
}

// src/snapshot.ts
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
var DEFAULT_SNAPSHOT_ROOT = join(homedir(), ".dsh", "rewind-snapshots");
var SNAPSHOT_ROOT_ENV = "DSH_REWIND_SNAPSHOT_DIR";
var MAX_ANCHOR_GROUPS = 100;
var defaultProbe = {
  async readText(path) {
    try {
      return await readFile(path, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return void 0;
      throw error;
    }
  },
  isLink: isLinkPath
};
function safeFileId(callId) {
  return callId.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function safeSessionId(sessionId) {
  const safe = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe === ".." || safe === "." ? "session" : safe;
}
async function readEntry(file) {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    if (typeof parsed.path !== "string" || typeof parsed.anchorSeq !== "number") return void 0;
    return {
      callId: String(parsed.callId ?? ""),
      anchorSeq: parsed.anchorSeq,
      path: parsed.path,
      before: typeof parsed.before === "string" ? parsed.before : null,
      time: typeof parsed.time === "number" ? parsed.time : 0
    };
  } catch {
    return void 0;
  }
}
async function isLinkPath(path) {
  try {
    const stat2 = await lstat(path);
    return stat2.isSymbolicLink() || stat2.nlink > 1;
  } catch {
    return false;
  }
}
var SnapshotStore = class _SnapshotStore {
  constructor(root = process.env[SNAPSHOT_ROOT_ENV] ?? DEFAULT_SNAPSHOT_ROOT) {
    this.root = root;
  }
  root;
  /** Debounce window for the per-commit prune (keeps the readdir+sort off the hot path). */
  static PRUNE_INTERVAL_MS = 1e3;
  lastPruneAt = 0;
  /** Absolute path of one session's snapshot directory (id sanitized). */
  sessionDir(sessionId) {
    return join(this.root, safeSessionId(sessionId));
  }
  /** Absolute path of one anchor group directory. */
  anchorDir(sessionId, anchorSeq) {
    return join(this.sessionDir(sessionId), String(anchorSeq));
  }
  /** Commit one before-backup under its turn's anchor group. */
  async recordEntry(sessionId, entry) {
    const dir = this.anchorDir(sessionId, entry.anchorSeq);
    await mkdir(dir, { recursive: true });
    const committed = { ...entry, time: Date.now() };
    await writeFile(join(dir, `${safeFileId(entry.callId)}.json`), JSON.stringify(committed), "utf8");
    const now = Date.now();
    if (now - this.lastPruneAt >= _SnapshotStore.PRUNE_INTERVAL_MS) {
      this.lastPruneAt = now;
      await this.prune(sessionId);
    }
  }
  /**
   * All committed entries anchored at or after `targetSeq`, newest first (for
   * preview ordering). The boundary is inclusive: rewinding to a message also
   * reverts the changes its own turn caused (the rewind cut removes that
   * turn's assistant response and tool calls), so only entries anchored at
   * earlier messages survive.
   */
  async entriesAfter(sessionId, targetSeq) {
    const sessionDir = this.sessionDir(sessionId);
    let names;
    try {
      names = await readdir(sessionDir);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    const entries = [];
    for (const name2 of names) {
      const anchorSeq = Number(name2);
      if (!Number.isSafeInteger(anchorSeq) || anchorSeq < targetSeq) continue;
      const files = await readdir(this.anchorDir(sessionId, anchorSeq)).catch(() => []);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const entry = await readEntry(join(this.anchorDir(sessionId, anchorSeq), file));
        if (entry !== void 0) entries.push(entry);
      }
    }
    return entries.sort((a, b) => b.anchorSeq - a.anchorSeq || b.time - a.time);
  }
  /**
   * Per-path EARLIEST committed entry anchored at or after the target — the
   * single source of truth for both restore and impact preview.
   */
  async earliestEntries(sessionId, targetSeq) {
    const earliest = /* @__PURE__ */ new Map();
    for (const entry of await this.entriesAfter(sessionId, targetSeq)) {
      const current = earliest.get(entry.path);
      if (current === void 0 || entry.anchorSeq < current.anchorSeq || entry.anchorSeq === current.anchorSeq && entry.time < current.time) {
        earliest.set(entry.path, entry);
      }
    }
    return earliest;
  }
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
  async planRestore(sessionId, targetSeq, probe) {
    const actions = [];
    const skipped = [];
    for (const entry of (await this.earliestEntries(sessionId, targetSeq)).values()) {
      try {
        if (await probe.isLink(entry.path)) {
          skipped.push(entry.path);
          continue;
        }
        const current = await probe.readText(entry.path);
        if (entry.before === null) {
          if (current !== void 0) actions.push({ path: entry.path, action: "delete" });
        } else if (current !== entry.before) {
          actions.push({ path: entry.path, action: "restore", before: entry.before });
        }
      } catch (error) {
        if (entry.before === null) {
          actions.push({ path: entry.path, action: "delete" });
        } else {
          actions.push({ path: entry.path, action: "restore", before: entry.before });
        }
      }
    }
    return { actions, skipped };
  }
  /** Per-file restore impact: only actions that would actually change the disk. */
  async impactsAfter(sessionId, targetSeq, probe = defaultProbe) {
    const { actions } = await this.planRestore(sessionId, targetSeq, probe);
    return actions.sort((a, b) => a.path.localeCompare(b.path)).map((action) => ({ path: action.path, action: action.action }));
  }
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
  async restoreAfter(sessionId, targetSeq, deleteFile, probe = defaultProbe) {
    const restored = [];
    const deleted = [];
    const skipped = [];
    const failed = [];
    const { actions, skipped: skippedPaths } = await this.planRestore(sessionId, targetSeq, probe);
    skipped.push(...skippedPaths);
    for (const action of actions) {
      try {
        if (action.action === "delete") {
          try {
            await deleteFile(action.path);
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
            continue;
          }
          deleted.push(action.path);
        } else {
          await mkdir(dirname(action.path), { recursive: true });
          await writeFile(action.path, action.before, "utf8");
          restored.push(action.path);
        }
      } catch (error) {
        failed.push({ path: action.path, message: error instanceof Error ? error.message : String(error) });
      }
    }
    return { restored, deleted, skipped, failed };
  }
  /**
   * Drop the session's oldest anchor groups beyond `keep` (default
   * {@link MAX_ANCHOR_GROUPS}), deleting their whole directories.
   */
  async prune(sessionId, keep = MAX_ANCHOR_GROUPS) {
    const sessionDir = this.sessionDir(sessionId);
    let names;
    try {
      names = await readdir(sessionDir);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    const seqs = names.map(Number).filter((seq) => Number.isSafeInteger(seq)).sort((a, b) => a - b);
    const excess = seqs.length - keep;
    if (excess <= 0) return;
    for (const seq of seqs.slice(0, excess)) {
      await rm(this.anchorDir(sessionId, seq), { recursive: true, force: true });
    }
  }
  /** True when a path exists on disk (used by tests and diagnostics). */
  async exists(path) {
    try {
      await stat(path);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }
  /**
   * All distinct paths ever recorded for a session — the "tracked files"
   * set. Mirrors Claude Code's global `trackedFiles` collection (files stay
   * tracked once a write-class tool touched them), derived from the disk
   * entries so no extra persistence is needed.
   */
  async trackedPaths(sessionId) {
    const paths = /* @__PURE__ */ new Set();
    for (const entry of await this.entriesAfter(sessionId, 0)) {
      paths.add(entry.path);
    }
    return paths;
  }
};
function hashPath(path) {
  return createHash("sha256").update(path).digest("hex").slice(0, 8);
}
async function reconcileTracked(store, sessionId, anchorSeq, tracked, states, probe = defaultProbe) {
  let recorded = 0;
  for (const path of tracked) {
    try {
      if (await probe.isLink(path)) continue;
      const current = await probe.readText(path);
      const state = current ?? null;
      const prev = states.get(path);
      if (prev === void 0 || prev !== state) {
        await store.recordEntry(sessionId, {
          callId: `recheck-${anchorSeq}-${hashPath(path)}`,
          anchorSeq,
          path,
          before: state
        });
        states.set(path, state);
        recorded++;
      }
    } catch {
    }
  }
  return recorded;
}

// src/index.ts
var name = "dsh-rewind";
var inject = ["commands", "tools"];
var TRACKED_TOOLS = /* @__PURE__ */ new Set(["write", "edit", "str_replace_editor"]);
var MUTATING_EDITOR_COMMANDS = /* @__PURE__ */ new Set(["create", "str_replace", "insert"]);
var activeLocale = "en";
function t(key, params) {
  return translate(activeLocale, key, params);
}
function usage() {
  return [
    t("usage.title"),
    t("usage.noArgs"),
    t("usage.seq"),
    t("usage.blocked")
  ].join("\n");
}
function mutationPathOf(exec) {
  const args = exec.arguments;
  if (exec.name === "write" || exec.name === "edit") {
    return typeof args.file_path === "string" ? args.file_path : void 0;
  }
  if (exec.name === "str_replace_editor") {
    if (typeof args.command !== "string" || !MUTATING_EDITOR_COMMANDS.has(args.command)) return void 0;
    return typeof args.path === "string" ? args.path : void 0;
  }
  return void 0;
}
function anchorSeqOf(session, cache) {
  const events = session.events;
  const cached = cache.get(session);
  if (cached !== void 0 && cached.eventsLength === events.length) return cached.anchor;
  let anchor = cached?.anchor;
  for (let i = events.length - 1; i >= (cached?.eventsLength ?? 0); i--) {
    if (events[i].type === "user/message") {
      anchor = events[i].seq;
      break;
    }
  }
  cache.set(session, { anchor, eventsLength: events.length });
  return anchor;
}
async function resolveTarget(fs, path, cwd, signal) {
  try {
    return await fs.resolve(path, {
      ...cwd !== void 0 ? { cwd } : {},
      signal
    });
  } catch {
    return void 0;
  }
}
async function readTextOrUndefined(fs, target, signal) {
  try {
    return await fs.readText(target, signal);
  } catch (error) {
    const code = error?.code;
    if (code === "ENOENT" || code === "FS_NOT_FOUND") return void 0;
    throw error;
  }
}
async function captureBefore(fs, exec, pending) {
  if (!TRACKED_TOOLS.has(exec.name)) return;
  const header = exec.agent?.session.header;
  if (header !== void 0 && (header.origin === "subagent" || (header.delegationDepth ?? 0) > 0)) return;
  const path = mutationPathOf(exec);
  if (path === void 0) return;
  const cwd = execSessionCwd(exec, path);
  const target = await resolveTarget(fs, path, cwd, exec.signal);
  if (target === void 0) return;
  const before = await readTextOrUndefined(fs, target, exec.signal);
  pending.set(`${exec.agent?.id ?? "anon"}:${exec.callId}`, { path: target.displayPath, before });
}
async function commitEntry(store, pending, anchorCache, trackedBySession, exec, result) {
  const key = `${exec.agent?.id ?? "anon"}:${exec.callId}`;
  const capture = pending.get(key);
  if (capture === void 0) return;
  pending.delete(key);
  if (result.isError) return;
  const agent = exec.agent;
  if (agent === void 0) return;
  const anchorSeq = anchorSeqOf(agent.session, anchorCache);
  if (anchorSeq === void 0) return;
  await store.recordEntry(agent.session.id, {
    callId: exec.callId,
    anchorSeq,
    path: capture.path,
    before: capture.before ?? null
  });
  let tracked = trackedBySession.get(agent.session.id);
  if (tracked === void 0) {
    tracked = /* @__PURE__ */ new Set();
    trackedBySession.set(agent.session.id, tracked);
  }
  tracked.add(capture.path);
}
function buildMarker() {
  return createAssistantMessage({
    content: [],
    source: { provider: "dsh-rewind", model: "rewind-marker" }
  });
}
function describeTarget(target) {
  return target.kind === "seq" ? t("describeTarget.seq", { seq: target.seq }) : t("describeTarget.index", { index: target.index });
}
function formatPlan(plan, files) {
  const lines = [
    t("plan.rewinding", { targetSeq: plan.targetSeq, count: plan.shadowedSeqs.length })
  ];
  if (files.length > 0) {
    lines.push(t("plan.affects", { count: files.length }));
    for (const file of files) {
      lines.push(`  ${file.action === "restore" ? t("plan.restore", { path: file.path }) : t("plan.delete", { path: file.path })}`);
    }
  } else {
    lines.push(t("plan.noChanges"));
  }
  lines.push(`impact=${files.length}`);
  for (const file of files) {
    lines.push(`${file.action}:${file.path}`);
  }
  return lines.join("\n");
}
function resolveOrError(events, surface, raw) {
  const target = parseRewindTarget(raw);
  if (target === void 0) {
    throw new RewindError("invalid-index", t("error.invalidTarget", { raw }));
  }
  return planRewind(events, surface, target);
}
function renderFailures(failed) {
  if (failed.length === 0) return "";
  return t("failures.suffix", {
    count: failed.length,
    list: failed.map((f) => t("failures.item", { path: f.path, message: f.message })).join("\u3001")
  });
}
async function resolveObservationTarget(fs, path) {
  try {
    return await fs.resolve(path);
  } catch {
    return void 0;
  }
}
async function syncRestoreObservations(ctx, fs, agent, outcome) {
  if (fs === void 0) return;
  const actor = { agent };
  for (const path of outcome.deleted) {
    const target = await resolveObservationTarget(fs, path);
    if (target === void 0) continue;
    ctx.emit("fs/observed", target, { kind: "absent" }, actor);
  }
  for (const path of outcome.restored) {
    const target = await resolveObservationTarget(fs, path);
    if (target === void 0) continue;
    const info = await fs.stat(target);
    if (info === void 0) continue;
    ctx.emit("fs/observed", target, { kind: "present", version: info.version }, actor);
  }
}
async function waitForAgentIdle(agent, signal, timeoutMs = 15e3) {
  if (signal.aborted) return false;
  let timer;
  let onAbort;
  try {
    await Promise.race([
      agent.whenIdle(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("rewind idle wait timed out")), timeoutMs);
        onAbort = () => reject(new Error("rewind idle wait aborted"));
        signal.addEventListener("abort", onAbort, { once: true });
      })
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer !== void 0) clearTimeout(timer);
    if (onAbort !== void 0) signal.removeEventListener("abort", onAbort);
  }
}
async function executeRewind(ctx, store, fs, invocation, rawTarget, mode, inflight) {
  const { agent } = invocation;
  const sessionId = agent.session.id;
  if (inflight.has(sessionId)) {
    return { kind: "error", text: t("inflight") };
  }
  inflight.add(sessionId);
  try {
    if (agent.status !== "idle") {
      agent.cancel({ kind: "user" });
      const stopped = await waitForAgentIdle(agent, invocation.signal);
      if (!stopped) {
        return { kind: "error", text: t("stopFailed") };
      }
    }
    if (invocation.signal.aborted) {
      return { kind: "error", text: t("cancelled") };
    }
    let plan;
    try {
      plan = resolveOrError(agent.session.events, agent.session.surface.nodes, rawTarget);
    } catch (error) {
      return rewindErrorResult(error);
    }
    const marker = buildMarker();
    let event;
    try {
      event = agent.session.append("assistant/message", { turn: markerTurnOf(agent.session.events), step: 0, message: marker }, {
        surfaceOp: { op: "replace", start: plan.surfaceStart, end: plan.surfaceEnd },
        sourceEventSeqs: [...plan.shadowedSeqs]
      });
    } catch (error) {
      return {
        kind: "error",
        text: t("failed", { error: error instanceof Error ? error.message : String(error) })
      };
    }
    let restore = "";
    if (mode === "both") {
      const outcome = await store.restoreAfter(agent.session.id, plan.targetSeq, (path) => unlink(path));
      await syncRestoreObservations(ctx, fs, agent, outcome);
      const parts = [];
      if (outcome.restored.length > 0) parts.push(t("restore.count", { count: outcome.restored.length }));
      if (outcome.deleted.length > 0) parts.push(t("delete.count", { count: outcome.deleted.length }));
      if (outcome.skipped.length > 0) parts.push(t("skip.count", { count: outcome.skipped.length }));
      restore = parts.length > 0 ? `\uFF1B${parts.join("\u3001")}` : t("noRestorable");
      restore += renderFailures(outcome.failed);
    }
    return {
      kind: "success",
      text: t("success", { targetSeq: plan.targetSeq, restore }),
      sourceEventSeq: event.seq
    };
  } finally {
    inflight.delete(sessionId);
  }
}
function rewindErrorResult(error) {
  if (error instanceof RewindError) {
    const text = {
      "no-user-messages": t("noUserMessages"),
      "invalid-index": error.message,
      "not-a-user-message": error.message,
      "not-on-surface": error.message
    }[error.code];
    return { kind: "error", text };
  }
  throw error;
}
async function handleRewind(ctx, store, fs, invocation, inflight) {
  const session = invocation.agent.session;
  const input = invocation.rawInput.trim();
  if (input === "") {
    const candidates = listRewindCandidates(session.events, session.surface.nodes, 1);
    if (candidates.length === 0) {
      return { kind: "error", text: t("noUserMessages") };
    }
    return executeRewind(ctx, store, fs, invocation, `@${candidates[0].seq}`, "chat", inflight);
  }
  const parts = input.split(/\s+/);
  if (parts[0] === "preview") {
    const target2 = parts[1];
    if (target2 === void 0) return { kind: "error", text: usage() };
    let plan;
    try {
      plan = resolveOrError(session.events, session.surface.nodes, target2);
    } catch (error) {
      return rewindErrorResult(error);
    }
    const impacts = await store.impactsAfter(session.id, plan.targetSeq);
    return { kind: "success", text: formatPlan(plan, impacts) };
  }
  if (parts[0] === "__candidates") {
    const candidates = listRewindCandidates(session.events, session.surface.nodes);
    return { kind: "success", text: formatCandidateList(candidates) };
  }
  const target = parts[0];
  const mode = parts[1];
  if (mode !== void 0 && mode !== "chat" && mode !== "both") {
    return { kind: "error", text: usage() };
  }
  if (mode === void 0) {
    const parsed = parseRewindTarget(target);
    if (parsed === void 0) return { kind: "error", text: usage() };
    return {
      kind: "success",
      text: t("chooseMode", { target: describeTarget(parsed) })
    };
  }
  return executeRewind(ctx, store, fs, invocation, target, mode, inflight);
}
function apply(ctx, config) {
  const store = new SnapshotStore(config?.snapshotDir);
  const pending = /* @__PURE__ */ new Map();
  const anchorCache = /* @__PURE__ */ new WeakMap();
  const inflight = /* @__PURE__ */ new Set();
  const trackedBySession = /* @__PURE__ */ new Map();
  const statesBySession = /* @__PURE__ */ new Map();
  let fsService;
  ctx.inject(["settings"], (settingsCtx) => {
    const section = settingsCtx.settings.get(settingsNamespace("locale"));
    if (section?.preference === "zh" || section?.preference === "en") {
      activeLocale = section.preference;
    }
  });
  ctx.effect(function* () {
    yield ctx.commands.register({
      name: "rewind",
      description: t("command.description"),
      handler: (invocation) => handleRewind(ctx, store, fsService, invocation, inflight)
    });
  }, "dsh-rewind command");
  ctx.on("session/event", (session, event) => {
    if (event.type !== "user/message") return;
    const header = session.header;
    if (header.origin === "subagent" || (header.delegationDepth ?? 0) > 0) return;
    void (async () => {
      try {
        const sessionId = session.id;
        let tracked = trackedBySession.get(sessionId);
        if (tracked === void 0) {
          tracked = await store.trackedPaths(sessionId);
          trackedBySession.set(sessionId, tracked);
        }
        if (tracked.size === 0) return;
        let states = statesBySession.get(sessionId);
        if (states === void 0) {
          states = /* @__PURE__ */ new Map();
          statesBySession.set(sessionId, states);
        }
        await reconcileTracked(store, sessionId, event.seq, tracked, states);
      } catch (error) {
        ctx.logger.warn(`[dsh-rewind] boundary re-check failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();
  }, { global: true });
  ctx.inject(["fs"], (scope) => {
    const fs = scope.fs;
    fsService = fs;
    scope.on("tools/execute", async (exec, next) => {
      try {
        await captureBefore(fs, exec, pending);
      } catch (error) {
        ctx.logger.warn(`[dsh-rewind] before-capture failed for ${exec.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
      return next();
    });
    scope.on("tools/post-execute", async (exec, result, next) => {
      try {
        await commitEntry(store, pending, anchorCache, trackedBySession, exec, result);
      } catch (error) {
        ctx.logger.warn(`[dsh-rewind] checkpoint commit failed for ${exec.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
      return next();
    });
    scope.on("tools/result", (exec) => {
      pending.delete(`${exec.agent?.id ?? "anon"}:${exec.callId}`);
      return void 0;
    });
  });
}
export {
  SnapshotStore,
  apply,
  inject,
  name
};
