/** Host registration for the Deep Whale builtin theme. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-theme-catalog'
import { MAID_ATELIER_REGISTRATION } from './manifest.ts'

export const inject: string[] = []

/** Publish the manifest and preview bytes while this plugin is composed.
 *  The host theme catalog is optional: the Desktop deployment does not ship
 *  it, and the host half then stays inert without blocking composition. */
export function apply(ctx: Context): void {
  const catalog = ctx.get('themeCatalog')
  if (catalog === undefined) return
  ctx.effect(
    () => catalog.registerBuiltin(MAID_ATELIER_REGISTRATION),
    'ui-skin-maid-atelier: builtin catalog registration',
  )
}
