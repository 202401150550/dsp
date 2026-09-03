export const NS = 'workspace-analyzer' as const

export const en = {
  'analyzer.title': 'Workspace Analyzer',
  'analyzer.analyze': 'Analyze',
  'analyzer.total_lines': 'Total Lines',
  'analyzer.total_files': 'Total Files',
  'analyzer.by_language': 'By Language',
  'analyzer.by_directory': 'By Directory',
  'analyzer.top_files': 'Top Files',
  'analyzer.tech_stack': 'Detected Tech Stack',
  'analyzer.generating': 'Analyzing...',
  'analyzer.no_data': 'No analysis data yet. Click Analyze to scan the workspace.',
} as const

export const zh = {
  'analyzer.title': '工作区分析',
  'analyzer.analyze': '分析',
  'analyzer.total_lines': '总行数',
  'analyzer.total_files': '总文件数',
  'analyzer.by_language': '按语言统计',
  'analyzer.by_directory': '按目录统计',
  'analyzer.top_files': 'Top 文件',
  'analyzer.tech_stack': '检测到技术栈',
  'analyzer.generating': '分析中...',
  'analyzer.no_data': '暂无分析数据，点击"分析"扫描工作区。',
} as const

export function t(key: keyof typeof en, params?: Record<string, string | number>): string {
  const dict = zh
  const raw = dict[key] ?? en[key]
  if (!params) return raw
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ''))
}
