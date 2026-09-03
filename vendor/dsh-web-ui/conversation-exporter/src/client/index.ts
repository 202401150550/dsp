import type { ClientContext, SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { ExportPanel } from './ExportPanel.tsx'
import { NS, en, zh, t } from './locales.ts'
import type { ExportFormat } from '../index.ts'

interface ExportHttpApi {
  export(sessionId: string, format: ExportFormat): Promise<{ ok: true; content: string; filename: string }>
  formats(): Promise<ExportFormat[]>
}

const api: ExportHttpApi = {
  export: (sessionId, format) => fetch('/api/conversation-exporter/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, format }),
  }).then(r => r.json()),
  formats: () => fetch('/api/conversation-exporter/formats').then(r => r.json()),
}

export const inject = ['slots', 'locale', 'connection', 'settingsScope', 'remote']

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: never }
  }

}

export function apply(ctx: ClientContext & { settingsScope: SettingsScope<SettingsScopeSpec<unknown>> }): void {
  const container = document.createElement('div')
  container.dataset.pluginCss = 'conversation-exporter'
  document.body.appendChild(container)
  const root = createRoot(container)

  root.render(createElement(ExportPanel, { api }))

  ctx.effect(() => () => {
    root.unmount()
    container.remove()
  })
}
