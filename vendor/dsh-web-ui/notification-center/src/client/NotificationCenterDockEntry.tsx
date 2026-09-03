import { createElement, useState, useEffect, type FC } from 'react'
import type { NotificationEvent } from '../index.ts'
import { t } from './locales.ts'

interface Props {
  api: {
    list(): Promise<{ notifications: NotificationEvent[]; unreadCount: number }>
    ack(id: string): Promise<{ ok: true }>
    ackAll(): Promise<{ ok: true }>
  }
}

export const NotificationCenterDockEntry: FC<Props> = ({ api }) => {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  const refresh = async () => {
    try {
      const data = await api.list()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch { /* silent */ }
  }

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 3000)
    return () => clearInterval(timer)
  }, [])

  const handleClearAll = async () => {
    await api.ackAll()
    setUnreadCount(0)
    setNotifications([])
  }

  return createElement('div', { className: 'nc-root' },
    createElement('button', {
      className: 'nc-bell',
      onClick: () => setOpen(!open),
      'aria-label': t('notification-center.title'),
      title: t('notification-center.title'),
    },
      '\u{1F514}',
      unreadCount > 0 && createElement('span', { className: 'nc-badge' }, unreadCount)
    ),
    open && createElement('div', { className: 'nc-panel' },
      createElement('div', { className: 'nc-panel-header' },
        createElement('span', null, t('notification-center.title')),
        unreadCount > 0 && createElement('button', {
          className: 'nc-clear-btn',
          onClick: handleClearAll,
        }, t('notification-center.clear-all'))
      ),
      notifications.length === 0
        ? createElement('div', { className: 'nc-empty' }, t('notification-center.empty'))
        : createElement('div', { className: 'nc-list' },
            ...notifications.map(n =>
              createElement('div', {
                key: n.id,
                className: `nc-item nc-item-${n.kind}`,
              },
                createElement('span', { className: 'nc-kind' }, t(`notification-center.${n.kind}`)),
                createElement('div', { className: 'nc-content' },
                  createElement('strong', null, n.title),
                  createElement('p', null, n.body)
                ),
                createElement('span', { className: 'nc-time' },
                  new Date(n.ts).toLocaleTimeString('zh-CN')
                )
              )
            )
          )
    )
  )
}
