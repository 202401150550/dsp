import type { ClientContext, SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { NotificationCenterDockEntry } from './NotificationCenterDockEntry.tsx'
import { NotificationSettingsCard, type NotificationSettings } from './NotificationSettingsCard.tsx'
import { NS, en, zh, t } from './locales.ts'
import type { NotificationEvent } from '../index.ts'

interface NotificationHttpApi {
  list(): Promise<{ notifications: NotificationEvent[]; unreadCount: number }>
  publish(event: NotificationEvent): Promise<{ ok: true }>
  ack(id: string): Promise<{ ok: true }>
  ackAll(): Promise<{ ok: true }>
}

const api: NotificationHttpApi = {
  list: () => fetch('/api/notification-center/list').then(r => r.json()),
  publish: (event) => fetch('/api/notification-center/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  }).then(r => r.json()),
  ack: (id) => fetch('/api/notification-center/ack/' + encodeURIComponent(id), { method: 'POST' }).then(r => r.json()),
  ackAll: () => fetch('/api/notification-center/ack-all', { method: 'POST' }).then(r => r.json()),
}

const NS_NOTIFICATION = 'notification-center'

export const inject = ['slots', 'locale', 'connection', 'settingsScope', 'remote']

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: never }
  }
}

export function apply(ctx: ClientContext & { settingsScope: SettingsScope<SettingsScopeSpec<NotificationSettings>> }): void {
  const container = document.createElement('div')
  container.dataset.pluginCss = 'notification-center'
  document.body.appendChild(container)
  const root = createRoot(container)

  root.render(createElement(NotificationSettingsCard, {
    api,
    namespace: NS_NOTIFICATION,
  }))

  ctx.effect(() => () => {
    root.unmount()
    container.remove()
  })
}
