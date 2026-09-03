import { createElement, useState, type FC } from 'react'
import type { ExportFormat } from '../index.ts'
import { t } from './locales.ts'

interface Props {
  api: {
    export(sessionId: string, format: ExportFormat): Promise<{ ok: true; content: string; filename: string }>
    formats(): Promise<ExportFormat[]>
  }
}

export const ExportPanel: FC<Props> = ({ api }) => {
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [filename, setFilename] = useState('')

  const handleExport = async () => {
    setStatus('loading')
    try {
      const res = await api.export('current', format)
      setFilename(res.filename)
      setStatus('done')
      const ext = format === 'json' ? 'json' : format === 'html' ? 'html' : 'md'
      const blob = new Blob([res.content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename + '.' + ext
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setStatus('error')
    }
  }

  return createElement('div', { className: 'ce-root' },
    createElement('h3', null, t('exporter.title')),
    createElement('div', { className: 'ce-row' },
      createElement('label', null, t('exporter.format') + ': '),
      createElement('select', {
        value: format,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setFormat(e.target.value as ExportFormat),
      },
        createElement('option', { value: 'json' }, t('exporter.json')),
        createElement('option', { value: 'markdown' }, t('exporter.markdown')),
        createElement('option', { value: 'html' }, t('exporter.html')),
      )
    ),
    createElement('p', { className: 'ce-hint' }, t('exporter.selected')),
    createElement('button', {
      className: 'ce-btn',
      onClick: handleExport,
      disabled: status === 'loading',
    }, status === 'loading' ? t('exporter.downloading') : t('exporter.export')),
    status === 'done' && createElement('p', { className: 'ce-status ce-done' },
      t('exporter.done') + ' — ' + filename
    ),
    status === 'error' && createElement('p', { className: 'ce-status ce-error' }, t('exporter.error'))
  )
}
