/**
 * Minimal ApiProxy face for task-board on Desktop 2.0.4 (alpha host).
 *
 * Official @deepseek-ai/dsh-host-apiproxy (rc.7) no longer loads against alpha.1
 * packages (missing exports). This service provides only the methods Host
 * ExecutionRunner needs, by wrapping sessionController + host registries.
 */
import { Service } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'

const MESSAGE_TYPES = new Set(['user/message', 'assistant/message'])

function ok(request, value) {
  return {
    rpcId: request.rpcId,
    result: { ok: true, value },
  }
}

function err(request, error) {
  return {
    rpcId: request.rpcId,
    result: { ok: false, error },
  }
}

function fromThrown(request, error) {
  const failure = error?.failure ?? error?.cause?.failure
  if (failure && typeof failure === 'object' && typeof failure.code === 'string') {
    return err(request, {
      code: failure.code,
      message: failure.message || String(error),
      details: failure.details ?? {},
    })
  }
  if (error?.name === 'TypertRemoteFailure' && error.failure) {
    return err(request, {
      code: error.failure.code || 'internal',
      message: error.failure.message || error.message,
      details: error.failure.details ?? {},
    })
  }
  return err(request, {
    code: 'internal',
    message: error instanceof Error ? error.message : String(error),
    details: {},
  })
}

function isAppendSurfaceEvent(event) {
  return event?.surface === undefined || event.surface === 'current' || event.surface === 'append'
}

/** Same message-boundary pagination spirit as legacy apiproxy (simplified). */
function paginate(events, beforeSeq, maxMessages) {
  const window = beforeSeq === undefined ? [...events] : events.filter((event) => event.seq < beforeSeq)
  let count = 0
  let cut = 0
  for (let i = window.length - 1; i >= 0; i -= 1) {
    const event = window[i]
    if (!MESSAGE_TYPES.has(event.type) || !isAppendSurfaceEvent(event)) continue
    count += 1
    let groupStart = event.seq
    if (Array.isArray(event.sourceEventSeqs)) {
      for (const source of event.sourceEventSeqs) {
        if (source < groupStart) groupStart = source
      }
    }
    if (count >= maxMessages) {
      cut = groupStart
      break
    }
  }
  return {
    events: window.filter((event) => event.seq >= cut),
    hasMore: cut > 0,
  }
}

function workspaceView(workspace) {
  return {
    workspaceId: workspace.id,
    title: workspace.title,
    path: workspace.path,
    sessionIds: [...(workspace.sessionIds ?? [])],
  }
}

function createCompatApiProxy(ctx) {
  return {
    sessions: {
      async list(request) {
        try {
          const value = await ctx.sessionController.list(request.payload ?? {}, request.signal)
          return ok(request, value)
        } catch (error) {
          return fromThrown(request, error)
        }
      },

      async create(request) {
        try {
          const value = await ctx.sessionController.create(request.payload ?? {})
          return ok(request, value)
        } catch (error) {
          return fromThrown(request, error)
        }
      },

      async rename(request) {
        try {
          const value = await ctx.sessionController.rename(request.payload ?? {})
          return ok(request, value)
        } catch (error) {
          return fromThrown(request, error)
        }
      },

      async prompt(request) {
        try {
          const payload = request.payload ?? {}
          const text = payload.content?.find?.((part) => part?.type === 'text')?.text
          // Admission is not command execution. Do not forward legacy commands
          // as model prompts or manufacture permission acknowledgements.
          if (typeof text === 'string' && text.trimStart().startsWith('/')) {
            return err(request, {
              code: 'compat/command-unsupported',
              message: 'Legacy slash commands require a verified command API; no prompt was submitted.',
              details: {},
            })
          }
          const value = await ctx.sessionController.prompt({
            ...payload,
            requestId: payload.requestId ?? request.rpcId ?? `compat-${randomUUID()}`,
          })
          return ok(request, value)
        } catch (error) {
          return fromThrown(request, error)
        }
      },

      async history(request) {
        const { sessionId, beforeSeq, maxMessages } = request.payload ?? {}
        try {
          const query = ctx.get('sessionQuery')
          if (query === undefined) {
            return err(request, {
              code: 'internal',
              message: 'session history unavailable: sessionQuery is not mounted',
              details: {},
            })
          }
          const observed = await query.observeSession(sessionId)
          try {
            const page = paginate(observed.events ?? [], beforeSeq, maxMessages ?? 50)
            return ok(request, {
              events: page.events.map((event) => ({ event })),
              hasMore: page.hasMore,
            })
          } finally {
            if (typeof observed?.[Symbol.dispose] === 'function') observed[Symbol.dispose]()
            else if (typeof observed?.dispose === 'function') observed.dispose()
            else if (typeof observed?.close === 'function') await observed.close()
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          if (/not found/i.test(msg) || error?.code === 'SESSION_QUERY_SESSION_NOT_FOUND') {
            return err(request, {
              code: 'session-not-found',
              message: msg,
              details: { sessionId },
            })
          }
          return fromThrown(request, error)
        }
      },
    },

    workspace: {
      async list(request) {
        try {
          const items = ctx.workspaceRegistry.list().map(workspaceView)
          return ok(request, {
            items,
            archivedSessionIds: [...(ctx.workspaceRegistry.archivedSessionIds ?? [])],
          })
        } catch (error) {
          return fromThrown(request, error)
        }
      },
    },

    agentPresets: {
      async list(request) {
        try {
          const presets = ctx.get('agentPresets')
          if (presets === undefined) {
            return ok(request, { presets: [], authorable: false, hasDocument: false })
          }
          const defaultId = presets.defaultId
          const listed = await presets.list()
          return ok(request, {
            presets: listed.map((preset) => ({
              id: preset.id,
              trust: preset.trust,
              isDefault: preset.id === defaultId,
              ...(preset.name === undefined ? {} : { name: preset.name }),
              ...(preset.description === undefined ? {} : { description: preset.description }),
              ...(preset.broken === undefined ? {} : { broken: preset.broken }),
            })),
            authorable: !!presets.authorable,
            hasDocument: false,
          })
        } catch (error) {
          return fromThrown(request, error)
        }
      },
    },
  }
}

export const name = 'dsh-apiproxy-compat'
export const inject = ['sessionController', 'workspaceRegistry']

export const Config = undefined

export default class ApiProxyCompatService extends Service {
  static inject = ['sessionController', 'workspaceRegistry']

  constructor(ctx) {
    super(ctx, 'apiProxy')
    const api = createCompatApiProxy(ctx)
    this.sessions = api.sessions
    this.workspace = api.workspace
    this.agentPresets = api.agentPresets
  }
}

export { createCompatApiProxy }
