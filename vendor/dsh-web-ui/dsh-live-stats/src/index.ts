import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from 'schemastery'
import type {} from '@deepseek-ai/dsh-session-projection'
import { resolveEstimatorConfig } from './estimator.ts'
import type { EstimatorConfig } from './estimator.ts'
import { createLiveTokenUsageProjectionDefinition } from './projection.ts'
import { mountOnce } from './mount-once.ts'

/** Services required by the host projection plugin. */
export const inject = ['sessionProjections']

/**
 * Settings namespace of the live-stats capability — the section the web
 * settings surface edits. Spelled here rather than imported so the browser
 * half can spell the same value without depending on a Host package.
 */
export const LIVE_STATS_SETTINGS_NAMESPACE = settingsNamespace('live-stats')

/** Plugin configuration for provider-independent token estimation. */
export interface Config extends EstimatorConfig {
  /** Master switch for the plugin (browser half + host projection). */
  enabled?: boolean
}

/** Runtime schema for {@link Config}. */
export const Config: z<Config> = z.object({
  charsPerToken: z.number().min(0.01).default(4),
  blockOverhead: z.number().step(1).min(0).default(4),
  roleOverhead: z.number().step(1).min(0).default(4),
  enabled: z.boolean().default(true),
})

/**
 * Register the replayable live-token projection.
 *
 * The projection definition freezes its estimator spec into the fold's
 * closure at construction, so a settings edit takes effect by re-registering
 * the definition against the authoritative source. `sessionProjections.register`
 * returns the exact disposer, letting us drop the stale fold and fold the
 * session log afresh with the new parameters — the live-estimate row simply
 * re-derives without a restart.
 * @param ctx - host plugin context carrying sessionProjections.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export const apply = mountOnce('@linxin666/dsh-live-stats', applyImpl)

function applyImpl(ctx: Context, config: Config = {}): void {
  // The authoritative estimation source: the settings scope once the web
  // settings surface serves the namespace, the composition entry otherwise
  // (installSettingsSection swaps it on attach and detach).
  let current: () => Config = () => config ?? {}
  let disposeProjection: (() => void) | undefined

  const rebuild = (): void => {
    if ((current().enabled ?? true) === false) {
      if (disposeProjection !== undefined) {
        disposeProjection()
        disposeProjection = undefined
      }
      return
    }
    const source = current()
    // Validate the new spec BEFORE tearing down the old projection: a bad
    // hand-edit (Infinity slips the schema's min gate) must not take the
    // live estimate down with it.
    let spec: ReturnType<typeof resolveEstimatorConfig>
    try {
      spec = resolveEstimatorConfig({
        ...(source.charsPerToken === undefined ? {} : { charsPerToken: source.charsPerToken }),
        ...(source.blockOverhead === undefined ? {} : { blockOverhead: source.blockOverhead }),
        ...(source.roleOverhead === undefined ? {} : { roleOverhead: source.roleOverhead }),
      })
    } catch (error) {
      console.error('[dsh-live-stats] invalid estimator spec, keeping the previous projection:', error)
      return
    }
    if (disposeProjection !== undefined) {
      disposeProjection()
      disposeProjection = undefined
    }
    disposeProjection = ctx.sessionProjections.register(createLiveTokenUsageProjectionDefinition(spec))
  }

  installSettingsSection(ctx, LIVE_STATS_SETTINGS_NAMESPACE, Config, config ?? {}, {
    setSource: (source) => { current = source },
    onChange: rebuild,
  })
  rebuild()
}

export { createLiveTokenUsageProjectionDefinition } from './projection.ts'
export { resolveEstimatorConfig } from './estimator.ts'
export type { EstimatorConfig, EstimatorSpec } from './estimator.ts'
