import type { Context } from '@deepseek-ai/cordis'

export const name = 'conversation-exporter'

/** Export format options. */
export type ExportFormat = 'json' | 'markdown' | 'html'

/** A single export job. */
export interface ExportJob {
  id: string
  sessionId: string
  format: ExportFormat
  ts: number
  status: 'pending' | 'done' | 'error'
  result?: string
  error?: string
}

/** Apply the host half. */
export function apply(ctx: Context): void {
  // Host will register HTTP routes for export functionality
}
