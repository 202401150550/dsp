export const NS = 'conversation-exporter' as const

export const en = {
  'exporter.title': 'Export Conversation',
  'exporter.format': 'Format',
  'exporter.json': 'JSON',
  'exporter.markdown': 'Markdown',
  'exporter.html': 'HTML',
  'exporter.export': 'Export',
  'exporter.downloading': 'Downloading...',
  'exporter.done': 'Export complete',
  'exporter.error': 'Export failed',
  'exporter.selected': 'Selected session will be exported',
} as const

export const zh = {
  'exporter.title': '导出对话',
  'exporter.format': '格式',
  'exporter.json': 'JSON',
  'exporter.markdown': 'Markdown',
  'exporter.html': 'HTML',
  'exporter.export': '导出',
  'exporter.downloading': '下载中...',
  'exporter.done': '导出完成',
  'exporter.error': '导出失败',
  'exporter.selected': '选中的会话将被导出',
} as const

export function t(key: keyof typeof en, params?: Record<string, string | number>): string {
  const dict = zh
  const raw = dict[key] ?? en[key]
  if (!params) return raw
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ''))
}

export type SettingsCardKey = keyof typeof en
