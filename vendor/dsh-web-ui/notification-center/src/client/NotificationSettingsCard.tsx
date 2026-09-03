import { createElement, useState, type FC } from 'react'
import { t } from './locales.ts'
import type { NotificationEvent } from '../index.ts'

export interface NotificationSettings {
  enabled: boolean
  maxEntries: number
  soundEnabled: boolean
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  maxEntries: 50,
  soundEnabled: false,
}

interface Props {
  api: {
    list(): Promise<{ notifications: NotificationEvent[]; unreadCount: number }>
    ack(id: string): Promise<{ ok: true }>
    ackAll(): Promise<{ ok: true }>
  }
  namespace: string
}

export const NotificationSettingsCard: FC<Props> = ({ api, namespace }) => {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)

  return createElement('div', { className: 'ns-card' },
    createElement('h3', null, t('notification-center.title')),
    createElement('label', null,
      createElement('input', {
        type: 'checkbox',
        checked: settings.enabled,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSettings(s => ({ ...s, enabled: e.target.checked })),
      }),
      ' Enable notifications'
    ),
    createElement('label', null,
      createElement('input', {
        type: 'checkbox',
        checked: settings.soundEnabled,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSettings(s => ({ ...s, soundEnabled: e.target.checked })),
      }),
      ' Sound alerts'
    ),
    createElement('div', null,
      'Max entries: ',
      createElement('input', {
        type: 'number',
        min: 10,
        max: 200,
        value: settings.maxEntries,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSettings(s => ({ ...s, maxEntries: parseInt(e.target.value) || 50 })),
      })
    )
  )
}
