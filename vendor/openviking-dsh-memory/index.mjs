import { OpenVikingClient } from "./client.mjs";
import { resolveConfig } from "./config.mjs";
import { injectStartupProfile } from "./lifecycle.mjs";
import { OpenVikingRuntime } from "./runtime.mjs";
import { registerOpenVikingTools } from "./tools.mjs";
import { guardVikingUri } from "./uri-guard.mjs";

export const name = "openviking-memory";
/**
 * Host-plane safe inject list.
 * Official package required `sessions` + `tools` up front; on DSH Desktop host
 * plane that stalls plugin loading (Loading plugins…). Match Hindsight: only
 * wait for `agents`, then attach tools with deferred `ctx.inject`.
 */
export const inject = ["agents"];

export function apply(ctx, input = {}) {
  const config = resolveConfig(input);
  const client = new OpenVikingClient(config);
  const runtime = new OpenVikingRuntime(client, config, ctx.logger);
  ctx.provide("openvikingMemory", runtime);
  ctx.effect(
    () => () => runtime.disposeAll(),
    "openvikingMemory.disposeAll()",
  );

  ctx.inject(["tools"], (toolCtx) => {
    registerOpenVikingTools(toolCtx, client, runtime);
  });

  ctx.on("agent/session-start", ({ agent }) => {
    agent.ctx.effect(
      () => () => runtime.dispose(agent.session),
      "openvikingMemory.disposeSession()",
    );
    // Never block session start on OpenViking HTTP / embedding.
    void injectStartupProfile(agent, runtime).catch((error) => {
      try {
        ctx.logger?.warn?.(
          `[openviking-memory] startup profile skipped: ${error instanceof Error ? error.message : String(error)}`,
        );
      } catch {
        /* ignore */
      }
    });
  });

  // prepend: downstream waterfall listeners run first, so this plugin sees
  // the final claimed batch and appends after every other contributor.
  ctx.on("agent/pre-step", async ({ agent, messages, signal }, next) => {
    const decision = await next();
    if (decision.kind !== "enter" || signal.aborted) return decision;
    try {
      const profile = await runtime.profileMessage(agent);
      if (signal.aborted) return decision;
      const recall = await runtime.recallMessage(agent, decision.messages);
      if (signal.aborted) return decision;
      const additions = [profile, recall].filter(Boolean);
      return additions.length > 0
        ? { kind: "enter", messages: [...decision.messages, ...additions] }
        : decision;
    } catch (error) {
      try {
        ctx.logger?.warn?.(
          `[openviking-memory] pre-step soft-fail: ${error instanceof Error ? error.message : String(error)}`,
        );
      } catch {
        /* ignore */
      }
      return decision;
    }
  }, { prepend: true });

  ctx.on("session/event", (session, event) => {
    try {
      runtime.capture(session, event);
      runtime.maybeCommit(session, event);
    } catch {
      /* soft-fail: never break the session bus */
    }
  });

  ctx.on("session/flush", async session => {
    try {
      await runtime.flush(session);
    } catch {
      /* soft-fail */
    }
  });

  ctx.on("tools/pre-execute", guardVikingUri);
}
