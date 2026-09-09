// Open World · 共享常量（Client 子模块）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/constants',
  factory: () => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    exports.SNAPSHOT_URL = '/api/open-world/snapshot?view=shell'
    exports.SNAPSHOT_FULL_URL = '/api/open-world/snapshot'
    exports.TASK_BOARD_URL = '/api/task-board/state'
    exports.POLL_MS = 2500
    exports.CLIENT_VER = 'v2.72'
    /** compose 时写入内容哈希；源码里占位为 dev */
    exports.CLIENT_BUILD = 'dev'
    exports.CLIENT_BUILT_AT = ''
    exports.ACTION_URL = '/api/task-board/action'
    exports.PULSE_URL = '/api/open-world/pulse'
    exports.OW_ACTION_URL = '/api/open-world/action'
    exports.MESSAGES_URL = '/api/open-world/messages'
    exports.STREAM_URL = '/api/open-world/stream'
    exports.SPACE_VIEW_URL = '/api/open-world/space/view'
    exports.SPACE_SECOND_SCREEN_URL = '/api/open-world/space/second-screen'
    exports.MEMORY_URL = '/api/open-world/memory'
    exports.MEMORY_SEARCH_URL = '/api/open-world/memory/search'
    exports.MEMORY_ARCHIVES_URL = '/api/open-world/memory/archives'
    exports.MEMORY_COMPARE_URL = '/api/open-world/memory/compare'
    exports.INTEGRATIONS_URL = '/api/open-world/integrations'
    exports.WORLD_STATE_URL = '/api/open-world/world-state'
    exports.DEEPSEEK_USAGE_URL = '/api/deepseek-usage/state'
    exports.NEURAL_LAYOUT_KEY = 'dsh-open-world-neural-layout'
    exports.ATI_PRESET_KEY = 'dsh-open-world-ati-preset'
    exports.LEFT_TAB_KEY = 'dsh-open-world-left-tab'
    /** Shell WM: fullscreen | split | float | minimized */
    exports.WM_MODE_KEY = 'dsh-open-world-wm-mode'
    exports.WM_LAST_MODE_KEY = 'dsh-open-world-wm-last'
    exports.WM_MODES = ['fullscreen', 'split', 'float', 'minimized']
    /** 壳内应用表面（ATI 节点进入） */
    exports.APP_SURFACES = {
      'task-board': { title: '任务看板', titleEn: 'TASK BOARD' },
      rewind: { title: '回退时间轴', titleEn: 'REWIND' },
      market: { title: '插件市场', titleEn: 'MARKET' },
      memory: { title: '长期记忆', titleEn: 'HINDSIGHT' },
      ssh: { title: 'SSH 远程', titleEn: 'SSH' },
      remote: { title: '移动端远程', titleEn: 'REMOTE' },
      analytics: { title: '工作区分析', titleEn: 'ANALYTICS' },
      monitor: { title: '系统监视', titleEn: 'MONITOR' },
      fleet: { title: '进程舰队', titleEn: 'FLEET' },
      sidebar: { title: '侧栏开放世界', titleEn: 'SIDEBAR' },
    }

    exports.ATI_PRESETS = [
      { id: 'ati-unified', label: '统一场', sub: 'UNIFIED FIELD', group: 'ATI' },
      { id: 'manifold-torus', label: '环面', sub: 'TORUS · g=1', group: '拓扑' },
      { id: 'manifold-mobius', label: '莫比乌斯', sub: 'MÖBIUS · 不可定向', group: '拓扑' },
      { id: 'manifold-klein', label: '克莱因瓶', sub: 'KLEIN · 4D', group: '拓扑' },
      { id: 'poincare-disk', label: '庞加莱圆盘', sub: 'POINCARÉ · 双曲', group: '拓扑' },
      { id: 'ml-gradient', label: '机器学习', sub: 'GRADIENT · LOSS', group: 'ML' },
      { id: 'deep-attention', label: '深度学习', sub: 'ATTENTION · TRANSFORMER', group: 'DL' },
      { id: 'molecular-graph', label: '分子图', sub: 'MOLECULAR GRAPH', group: '化学' },
      { id: 'periodic-lattice', label: '元素周期', sub: 'PERIODIC LATTICE', group: '化学' },
      { id: 'ati-evolution', label: 'ATI 演化', sub: 'EMERGENCE', group: 'ATI' },
      { id: 'aci-loop', label: 'ACI 循环', sub: 'THINK LOOP', group: 'ACI' },
    ]

    exports.ACI_PHASES = [
      { id: 'plan', zh: '规划', en: 'PLAN', color: '#5eead4' },
      { id: 'execute', zh: '执行', en: 'EXECUTE', color: '#f5d67a' },
      { id: 'evaluate', zh: '评估', en: 'EVALUATE', color: '#a78bfa' },
      { id: 'adjust', zh: '调整', en: 'ADJUST', color: '#f472b6' },
    ]

    exports.ATI_STAGES_FALLBACK = [
      { id: 'seed', zh: '拓扑胚' },
      { id: 'ml', zh: '机器学习' },
      { id: 'dl', zh: '深度学习' },
      { id: 'chem', zh: '化学计算' },
      { id: 'ati', zh: 'ATI 涌现' },
    ]

    exports.DL_STACK = [
      { id: 'user-hub', label: 'TOKENIZER', zh: '词元化' },
      { id: 'network', label: 'EMBEDDING', zh: '嵌入层' },
      { id: 'ai-engine', label: 'ATTENTION', zh: '多头注意力' },
      { id: 'analytics', label: 'FFN', zh: '前馈网络' },
      { id: 'task-board', label: 'OPTIMIZER', zh: '梯度优化' },
      { id: 'core', label: 'ATI HEAD', zh: '输出头' },
    ]

    exports.NODE_ZH = {
      core: '核心系统',
      'ai-engine': 'AI 引擎',
      'task-board': '任务队列',
      storage: '存储中心',
      network: '网络服务',
      security: '安全防护',
      analytics: '数据分析',
      'user-hub': '用户中心',
      runtime: '设备管理',
      memory: '长期记忆',
      'session-active': '当前会话',
    }

    exports.NODE_LAYOUT = {
      core: { orbit: 0, angle: 0, en: 'CORE SYSTEM', color: '#ffffff' },
      analytics: { orbit: 4, angle: -70, en: 'DATA ANALYTICS', color: '#bfe38e' },
      'ai-engine': { orbit: 3, angle: 20, en: 'AI ENGINE', color: '#f5d67a' },
      security: { orbit: 3, angle: 95, en: 'SECURITY', color: '#5eead4' },
      network: { orbit: 4, angle: 145, en: 'NETWORK', color: '#bfe38e' },
      storage: { orbit: 4, angle: 215, en: 'STORAGE', color: '#7ab8f5' },
      'user-hub': { orbit: 3.5, angle: 250, en: 'USER HUB', color: '#f4a261' },
      'task-board': { orbit: 3, angle: -130, en: 'TASK QUEUE', color: '#38bdf8' },
      runtime: { orbit: 3.5, angle: 170, en: 'RUNTIME', color: '#7c8ea6' },
      memory: { orbit: 2.5, angle: -40, en: 'MEMORY BANK', color: '#a78bfa' },
    }

    exports.EVENT_COLORS = ['green', 'gold', 'cyan', 'orange', 'purple']
    exports.LOAD_COLORS = ['#5eead4', '#bfe38e', '#f5d67a', '#7ab8f5']

    exports.QUICK_ACTIONS = [
      { icon: 'plus', label: '新建任务', action: { type: 'task-create', title: '开放世界 · 新任务' } },
      { icon: 'backup', label: '任务看板', action: { type: 'embed', label: '任务看板', panel: 'task-board' } },
      { icon: 'diagnosis', label: '回退', action: { type: 'embed', label: '回退时间轴', panel: 'rewind' } },
    ]

    /** 壳顶用法条：关闭后写入 localStorage */
    exports.SHELL_GUIDE_KEY = 'dsh-open-world-shell-guide-dismissed'

    return module.exports
  },
})
