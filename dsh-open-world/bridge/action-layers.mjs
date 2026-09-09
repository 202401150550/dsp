/**
 * Host HTTP action vs Client Bridge action 分层（诚实边界）。
 * Host：POST /api/open-world/action → Host 进程内 registry
 * Bridge：Client bridgeExecute → 调 DSH session/DOM（不经 OW Host）
 */

export const SNAPSHOT_SCHEMA_VERSION = 8

/** schema 升版原因（给人看，不进协议硬字段） */
export const SNAPSHOT_SCHEMA_NOTES = {
  8: 'memory.active · healthScoreSource · ati.source · 去掉 neural/galaxy/manifold3d 视图 · RRM compare 四组 · rrm-session 覆盖',
  7: 'space · fleet · world-state · rrm 三通道初版',
}

/** Host registry 动作（HTTP）——完整表 */
export const HOST_ACTION_IDS = Object.freeze([
  'send-message',
  'mark-read',
  'memory-search',
  'share-snapshot',
  'pair-issue',
  'pair-stop',
  'notification-ack-all',
  'notification-publish',
  'idea-wrap',
  'idea-inject',
  'idea-compare',
  'world-state-save',
  'world-state-get',
  'world-enter',
  'world-leave',
  'request-local',
  'space-token-status',
  'space-token-issue',
  'space-token-revoke',
  'rrm-session-apply',
  'rrm-session-clear',
])

/** 壳日常推荐（对外文档 / UI 置顶）；其余视为高级 */
export const CORE_SHELL_HOST_ACTIONS = Object.freeze([
  'send-message',
  'idea-inject',
  'memory-search',
  'world-state-save',
  'world-state-get',
  'world-enter',
  'space-token-issue',
  'space-token-status',
])

/** Bridge Client 动作（不经 Host /action） */
export const BRIDGE_ACTION_TYPES = Object.freeze([
  'inject-message',
  'agent-prompt',
  'rewind-exec',
  'rewind-open',
  'task-run',
  'task-create',
  'session-focus',
  'settings',
  'panel',
  'remote',
  'embed',
  'enter-app',
  'enter-world',
  'idea-panel',
  'monitor',
  'composer',
  'close',
])

export function classifyAction(name) {
  const id = String(name || '').trim()
  if (!id) return { layer: 'unknown', id: '' }
  if (HOST_ACTION_IDS.includes(id)) {
    return { layer: 'host', id, path: 'POST /api/open-world/action' }
  }
  if (BRIDGE_ACTION_TYPES.includes(id)) {
    return { layer: 'bridge', id, path: 'Client bridgeExecute → DSH' }
  }
  return { layer: 'unknown', id }
}

export function actionLayersSummary() {
  return {
    host: {
      transport: 'POST /api/open-world/action',
      note: 'OW Host 进程内 registry；含 idea-inject 包装、信箱、space-token、world-state',
      actions: [...HOST_ACTION_IDS],
      coreShell: [...CORE_SHELL_HOST_ACTIONS],
      advanced: HOST_ACTION_IDS.filter((id) => !CORE_SHELL_HOST_ACTIONS.includes(id)),
    },
    bridge: {
      transport: 'Client bridgeExecute',
      note: '调 DSH session / task-board / DOM；不经 OW Host HTTP',
      actions: [...BRIDGE_ACTION_TYPES],
    },
    ideaInjectPath: 'Host idea-inject（包装）→ Bridge inject-message（投递到官方聊天）',
    productNote: 'DSH 系统壳：日常只强调 coreShell；其余为高级',
  }
}
