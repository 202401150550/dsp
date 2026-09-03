import type { ClientContext, SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { AnalyzerPanel } from './AnalyzerPanel.tsx'
import { NS, en, zh, t } from './locales.ts'
import type { WorkspaceAnalysis } from '../index.ts'

interface AnalyzerHttpApi {
  analyze(workspacePath?: string): Promise<WorkspaceAnalysis>
}

const api: AnalyzerHttpApi = {
  analyze: (workspacePath?) => fetch('/api/workspace-analyzer/analyze' + (workspacePath ? '?path=' + encodeURIComponent(workspacePath) : ''), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspacePath }),
  }).then(r => r.json()),
}

export const inject = ['slots', 'locale', 'connection', 'settingsScope', 'remote']

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: never }
  }

}

export function apply(ctx: ClientContext & { settingsScope: SettingsScope<SettingsScopeSpec<unknown>> }): void {
  const container = document.createElement('div')
  container.dataset.pluginCss = 'workspace-analyzer'
  document.body.appendChild(container)
  const root = createRoot(container)

  root.render(createElement(AnalyzerPanel, { api }))

  ctx.effect(() => () => {
    root.unmount()
    container.remove()
  })
}
