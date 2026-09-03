export const NS = 'notification-center' as const

export const en = {
  'notification-center.title': 'Notifications',
  'notification-center.badge': '{{count}} new',
  'notification-center.clear-all': 'Clear all',
  'notification-center.empty': 'No notifications',
  'notification-center.info': 'Info',
  'notification-center.success': 'Success',
  'notification-center.warning': 'Warning',
  'notification-center.error': 'Error',
  'notification-center.timestamp': '{{time}}',
} as const

export const zh = {
  'notification-center.title': '通知中心',
  'notification-center.badge': '{{count}} 条新消息',
  'notification-center.clear-all': '清空全部',
  'notification-center.empty': '暂无通知',
  'notification-center.info': '提示',
  'notification-center.success': '成功',
  'notification-center.warning': '警告',
  'notification-center.error': '错误',
  'notification-center.timestamp': '{{time}}',
} as const

export function t(key: keyof typeof en, params?: Record<string, string | number>): string {
  const dict = zh
  const raw = dict[key] ?? en[key]
  if (!params) return raw
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ''))
}

export type SettingsCardKey = keyof typeof en
