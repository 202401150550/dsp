import { createElement, useState, type FC } from 'react'
import type { WorkspaceAnalysis } from '../index.ts'
import { t } from './locales.ts'

interface Props {
  api: { analyze(workspacePath?: string): Promise<WorkspaceAnalysis> }
}

export const AnalyzerPanel: FC<Props> = ({ api }) => {
  const [analysis, setAnalysis] = useState<WorkspaceAnalysis | null>(null)
  const [loading, setLoading] = useState(false)

  const handleAnalyze = async () => {
    setLoading(true)
    try {
      const result = await api.analyze()
      setAnalysis(result)
    } finally {
      setLoading(false)
    }
  }

  return createElement('div', { className: 'wa-root' },
    createElement('h3', null, t('analyzer.title')),
    createElement('button', {
      className: 'wa-btn',
      onClick: handleAnalyze,
      disabled: loading,
    }, loading ? t('analyzer.generating') : t('analyzer.analyze')),
    !analysis && !loading && createElement('p', { className: 'wa-hint' }, t('analyzer.no_data')),
    analysis && createElement('div', { className: 'wa-results' },
      createElement('div', { className: 'wa-summary' },
        createElement('span', null, t('analyzer.total_lines') + ': ' + analysis.totalLines.toLocaleString()),
        createElement('span', null, t('analyzer.total_files') + ': ' + analysis.totalFiles.toLocaleString()),
      ),
      createElement('div', { className: 'wa-section' },
        createElement('h4', null, t('analyzer.by_language')),
        createElement('table', { className: 'wa-table' },
          createElement('thead', null,
            createElement('tr', null,
              createElement('th', null, 'Language'),
              createElement('th', null, 'Lines'),
              createElement('th', null, 'Files'),
            )
          ),
          createElement('tbody', null,
            ...Object.entries(analysis.byLanguage)
              .sort(([, a], [, b]) => b.lines - a.lines)
              .map(([lang, data]) =>
                createElement('tr', null,
                  createElement('td', null, lang),
                  createElement('td', null, data.lines.toLocaleString()),
                  createElement('td', null, data.files),
                )
              )
          )
        )
      ),
      analysis.techStack.length > 0 && createElement('div', { className: 'wa-section' },
        createElement('h4', null, t('analyzer.tech_stack')),
        createElement('div', { className: 'wa-tags' },
          ...analysis.techStack.map((tag: string) =>
            createElement('span', { key: tag, className: 'wa-tag' }, tag)
          )
        )
      ),
    )
  )
}
