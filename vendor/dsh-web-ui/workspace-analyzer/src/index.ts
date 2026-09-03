import type { Context } from '@deepseek-ai/cordis'

export const name = 'workspace-analyzer'

/** File extension to language mapping. */
export const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript (React)', '.js': 'JavaScript',
  '.jsx': 'JavaScript (React)', '.py': 'Python', '.java': 'Java',
  '.kt': 'Kotlin', '.go': 'Go', '.rs': 'Rust', '.c': 'C', '.cpp': 'C++',
  '.cs': 'C#', '.rb': 'Ruby', '.swift': 'Swift', '.css': 'CSS',
  '.scss': 'SCSS', '.less': 'Less', '.html': 'HTML', '.md': 'Markdown',
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML',
  '.xml': 'XML', '.sql': 'SQL', '.sh': 'Shell', '.bat': 'Batch',
  '.ps1': 'PowerShell', '.vue': 'Vue', '.svelte': 'Svelte',
  '.graphql': 'GraphQL', '.proto': 'Protocol Buffers',
}

/** Analysis result for the current workspace. */
export interface WorkspaceAnalysis {
  totalLines: number
  totalFiles: number
  byLanguage: Record<string, { lines: number; files: number }>
  byDirectory: Record<string, { lines: number; files: number }>
  topFiles: Array<{ path: string; lines: number }>
  techStack: string[]
  generatedAt: number
}

/** Apply the host half. */
export function apply(ctx: Context): void {
  // Host will register HTTP routes for analysis functionality
}
