import type { Context } from '@deepseek-ai/cordis'

export const name = 'notification-center'

/** Events published by the host to the notification bus. */
export interface NotificationEvent {
  id: string
  kind: 'info' | 'success' | 'warning' | 'error'
  title: string
  body: string
  ts: number
  source?: string
}

/** Host-side notification registry. */
export interface NotificationRegistry {
  notifications: NotificationEvent[]
  unreadCount: number
}

/** Apply the host half. */
export function apply(ctx: Context): void {
  // Host will register HTTP routes for notifications via ctx.apiProxy
  // System prompt announcement is optional — the plugin works without it.
}
