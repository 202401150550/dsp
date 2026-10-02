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
    exports.CLIENT_VER = 'v2.78'
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
    // ── 聊天坞（像微信一样发消息/发文件；消息落本地文件） ──
    exports.CHAT_THREADS_URL = '/api/open-world/chat/threads'
    exports.CHAT_MESSAGES_URL = '/api/open-world/chat/messages'
    exports.CHAT_POST_URL = '/api/open-world/chat/post'
    exports.CHAT_UPLOAD_URL = '/api/open-world/chat/upload'
    exports.CHAT_READ_URL = '/api/open-world/chat/read'
    exports.CHAT_FILE_URL = '/api/open-world/chat/file'
    exports.CHAT_VIEW_URL = '/api/open-world/chat/view'
    /** 入口归纳：日常组常驻；实验组在简单模式下折叠（不删除，保留能力） */
    exports.UI_MODE_KEY = 'dsh-open-world-ui-mode'
    exports.DAILY_SURFACES = ['chat', 'task-board', 'rewind', 'sidebar']
    exports.LAB_SURFACES = ['market', 'memory', 'ssh', 'remote', 'analytics', 'monitor', 'fleet']
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
      chat: { title: '聊天坞', titleEn: 'CHAT' },
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
      { id: 'plan', zh: '规划', en: 'PLAN', color: '#E7B24B' },
      { id: 'execute', zh: '执行', en: 'EXECUTE', color: '#F0C674' },
      { id: 'evaluate', zh: '评估', en: 'EVALUATE', color: '#64D2FF' },
      { id: 'adjust', zh: '调整', en: 'ADJUST', color: '#FF9F0A' },
    ]

    exports.LOAD_COLORS = ['#E7B24B', '#30D158', '#F0C674', '#64D2FF']
    exports.LOAD_COLORS = ['#E7B24B', '#30D158', '#F0C674', '#64D2FF']

    exports.QUICK_ACTIONS = [
      { icon: 'chat', label: '聊天', action: { type: 'embed', label: '聊天坞', panel: 'chat' } },
      { icon: 'plus', label: '新建任务', action: { type: 'task-create', title: '开放世界 · 新任务' } },
      { icon: 'backup', label: '任务看板', action: { type: 'embed', label: '任务看板', panel: 'task-board' } },
      { icon: 'diagnosis', label: '回退', action: { type: 'embed', label: '回退时间轴', panel: 'rewind' } },
    ]


    /** 550C 终端皮肤（借 dsh-550c-boot 的琥珀 CRT 语言）：窗口角标 / 扫描线 / 点线小节 / 等宽字
     *  聊天坞与消息总线共用这一套，避免两套视觉各说各话。 */
    exports.OW_SKIN_550C = [
      '.ow550c{--am:#E7B24B;--am-b:#ffc043;--am-d:#8a5e10;--am-fade:rgba(232,160,32,.35);--tx:#F2F2F4;--tx-dim:#6B6B72;--tx-faint:#4a3f28;--bg:#0A0A0C;--bg-panel:#0A0A0C;--bg-win:#0d0a06;--red:#e05030;--red-b:#ff7050;--grn:#b8c840;--cyn:#64D2FF;font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace;font-size:11.5px;line-height:1.55;color:var(--tx)}',
      '.ow550c *{box-sizing:border-box}',
      '.ow550c .win{position:relative;display:flex;flex-direction:column;background:var(--bg-panel);border:1px solid var(--am-d);box-shadow:inset 0 0 30px rgba(232,160,32,.03)}',
      '.ow550c .win:before,.ow550c .win:after{content:"";position:absolute;width:8px;height:8px;border-color:var(--am);z-index:5;pointer-events:none}',
      '.ow550c .win:before{top:-1px;left:-1px;border-top:2px solid;border-left:2px solid}',
      '.ow550c .win:after{bottom:-1px;right:-1px;border-bottom:2px solid;border-right:2px solid}',
      '.ow550c .whead{display:flex;align-items:center;gap:8px;padding:4px 8px;background:linear-gradient(180deg,#161006,#0A0A0C);border-bottom:1px solid var(--am-d);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--am)}',
      '.ow550c .whead .tag{margin-left:auto;color:var(--tx-faint);font-size:9px;letter-spacing:.1em;text-transform:none}',
      '.ow550c .led{width:6px;height:6px;border-radius:50%;background:var(--grn);box-shadow:0 0 6px var(--grn);animation:owpulse 1.2s infinite;flex:none}',
      '.ow550c .led.red{background:var(--red);box-shadow:0 0 6px var(--red)}',
      '.ow550c .led.amber{background:var(--am-b);box-shadow:0 0 6px var(--am-b)}',
      '@keyframes owpulse{0%,100%{opacity:1}50%{opacity:.25}}',
      '.ow550c .sect{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--am-d);padding:6px 0 3px;border-bottom:1px dotted var(--am-fade);margin-bottom:3px}',
      '.ow550c .body{flex:1;overflow:auto;padding:6px 8px;min-height:0;scrollbar-width:thin;scrollbar-color:rgba(232,160,32,.3) transparent}',
      '.ow550c .body::-webkit-scrollbar{width:5px;height:5px}',
      '.ow550c .body::-webkit-scrollbar-thumb{background:rgba(232,160,32,.25)}',
      '.ow550c .dt{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;padding:1px 0;font-variant-numeric:tabular-nums;font-size:10.5px}',
      '.ow550c .dt .k{color:var(--tx-faint);letter-spacing:.05em}',
      '.ow550c .dt .v{color:var(--tx);text-align:right}',
      '.ow550c .ok{color:var(--grn)}.ow550c .warn{color:var(--am-b)}.ow550c .bad{color:var(--red)}.ow550c .dim{color:var(--tx-dim)}.ow550c .faint{color:var(--tx-faint)}',
      '.ow550c .ln{white-space:pre-wrap;word-break:break-word;font-size:11.5px;color:var(--tx)}',
      '.ow550c .ln.sys{color:var(--am)}.ow550c .ln.inf{color:var(--tx-dim)}.ow550c .ln.ok{color:var(--grn)}',
      '.ow550c .ln.warn{color:var(--am-b)}.ow550c .ln.bad{color:var(--red)}.ow550c .ln.cmd{color:#fff;font-weight:500}',
      '.ow550c .inp{width:100%;background:#040302;border:1px solid var(--am-d);color:var(--tx);font:inherit;font-size:11px;padding:5px 8px}',
      '.ow550c .inp:focus{outline:none;border-color:var(--am);box-shadow:0 0 12px rgba(232,160,32,.14)}',
      '.ow550c select.inp{cursor:pointer}',
      '.ow550c textarea.inp{line-height:1.5;resize:vertical;min-height:52px}',
      '.ow550c .btn{padding:4px 12px;background:linear-gradient(180deg,#1a1208,#0A0A0C);border:1px solid var(--am-d);color:var(--am);font:inherit;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:all .15s;white-space:nowrap}',
      '.ow550c .btn:hover{background:rgba(232,160,32,.15);border-color:var(--am);color:var(--am-b);box-shadow:0 0 14px rgba(232,160,32,.22)}',
      '.ow550c .btn.primary{background:linear-gradient(180deg,#3a2408,#1a1005);border-color:var(--am);color:var(--am-b)}',
      '.ow550c .btn.primary:hover{background:rgba(232,160,32,.25);box-shadow:0 0 18px rgba(232,160,32,.42)}',
      '.ow550c .btn[disabled]{opacity:.4;cursor:not-allowed;box-shadow:none}',
      '.ow550c .chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--am-d);background:#0A0A0C;color:var(--tx-dim);padding:2px 8px;font-size:9.5px;letter-spacing:.06em;cursor:pointer;text-decoration:none}',
      '.ow550c .chip:hover{color:var(--am-b);border-color:var(--am)}',
      '.ow550c .chip.on{background:#1a1208;border-color:var(--am);color:var(--am-b)}',
      '.ow550c .badge{background:var(--am-b);color:#1a1208;border-radius:999px;font-size:9px;padding:0 5px;font-weight:700}',
      '.ow550c .trow{padding:5px 7px;cursor:pointer;border-left:2px solid transparent}',
      '.ow550c .trow:hover{background:rgba(232,160,32,.05)}',
      '.ow550c .trow.on{border-left-color:var(--am);background:rgba(232,160,32,.08)}',
      '.ow550c .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ow550c .scan{position:relative}',
      '.ow550c .scan:after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(to bottom,rgba(232,160,32,.04) 0,rgba(232,160,32,.04) 1px,transparent 1px,transparent 3px);z-index:6}',
      '.ow550c .meter{height:8px;background:#0A0A0C;border:1px solid var(--am-d);position:relative;overflow:hidden}',
      '.ow550c .meter i{display:block;height:100%;background:linear-gradient(90deg,var(--am-d),var(--am-b));box-shadow:0 0 8px var(--am-fade)}',
      '.ow550c .alert{height:2px;background:repeating-linear-gradient(90deg,var(--red) 0 10px,transparent 10px 20px);animation:owalertmove 1s linear infinite}',
      '@keyframes owalertmove{from{background-position:0 0}to{background-position:20px 0}}',
    ].join('')

    /** DSH 指挥舱皮肤（Open World 自有语言，取自 styles.js 的 --ow-* 令牌）：
     *  金 #ffc043 / 琥珀 #E7B24B / 青 #64D2FF / 绿 #b8c840 于近黑底，
     *  双语微标签、菱形信号点、标尺发丝线、四角切口、网格底 —— 与 550C 的琥珀 CRT 区分开。 */
    exports.OW_SKIN_DSH = [
      '.owd{--tx:#F2F2F4;--tx2:#A3A3A8;--tx3:#6B6B72;--hair:rgba(255,255,255,.08);--hair2:rgba(255,255,255,.16);--acc:#E7B24B;--accSoft:rgba(231,178,75,.14);--blue:#64D2FF;--grn:#30D158;--red:#FF453A;--panel:rgba(255,255,255,.035);--elev:rgba(255,255,255,.06);',
      'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI Variable Text","Segoe UI","Microsoft YaHei UI",system-ui,sans-serif;font-size:13px;line-height:1.6;color:var(--tx);-webkit-font-smoothing:antialiased}',
      '.owd *{box-sizing:border-box}',
      '.owd .panel{position:relative;border:1px solid var(--hair);border-radius:14px;background:var(--panel);backdrop-filter:blur(24px) saturate(140%);overflow:hidden}',
      '.owd .head{display:flex;align-items:center;gap:9px;padding:11px 14px;border-bottom:1px solid var(--hair)}',
      '.owd .zh{font-size:13.5px;font-weight:590;letter-spacing:-.01em;color:var(--tx)}',
      '.owd .en{font-family:ui-monospace,"SF Mono",Consolas,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--tx3);font-weight:500}',
      '.owd .sig{width:7px;height:7px;border-radius:50%;background:var(--grn);flex:none}',
      '.owd .sig.red{background:var(--red)}',
      '.owd .ruler{height:1px;background:var(--hair)}',
      '.owd .tag{margin-left:auto;font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--tx3);white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.owd .sect{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:560;letter-spacing:.02em;color:var(--tx2);padding:14px 2px 7px}',
      '.owd .sect:after{content:"";flex:1;height:1px;background:var(--hair)}',
      '.owd .body{flex:1;overflow:auto;min-height:0;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.16) transparent}',
      '.owd .body::-webkit-scrollbar{width:8px;height:8px}',
      '.owd .body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:8px}',
      '.owd .card{border:1px solid var(--hair);border-radius:12px;background:rgba(255,255,255,.028);padding:9px 12px;margin-bottom:7px}',
      '.owd .card.me{border-left:2px solid var(--acc)}',
      '.owd .card.ag{border-left:2px solid var(--blue)}',
      '.owd .card.sys{border-left:2px solid var(--tx3);background:rgba(255,255,255,.015)}',
      '.owd .card:hover{border-color:var(--hair2)}',
      '.owd .meta{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--tx2);display:flex;gap:9px;align-items:center;flex-wrap:wrap;font-variant-numeric:tabular-nums}',
      '.owd .ln{font-size:13px;line-height:1.62;color:var(--tx);white-space:pre-wrap;word-break:break-word;padding-top:3px}',
      '.owd .muted{color:var(--tx3)}',
      '.owd .ok{color:var(--grn)}.owd .warn{color:var(--acc)}.owd .bad{color:var(--red)}.owd .info{color:var(--blue)}.owd .dim{color:var(--tx2)}.owd .faint{color:var(--tx3)}',
      '.owd .chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--hair);background:var(--elev);color:var(--tx2);padding:4px 11px;border-radius:999px;font-size:12px;cursor:pointer;user-select:none;transition:background .18s ease,border-color .18s ease,color .18s ease}',
      '.owd .chip:hover{background:rgba(255,255,255,.1);color:var(--tx);border-color:var(--hair2)}',
      '.owd .chip.on{background:var(--accSoft);border-color:rgba(231,178,75,.5);color:#F5D9A0;font-weight:560}',
      '.owd .chip.att{border-style:solid}',
      '.owd .chip.info.on{background:rgba(100,210,255,.16);border-color:rgba(100,210,255,.5);color:#CFEFFF}',
      '.owd .inp{background:rgba(0,0,0,.35);border:1px solid var(--hair);border-radius:10px;color:var(--tx);font:inherit;font-size:13px;padding:8px 11px;width:100%}',
      '.owd .inp:focus{outline:none;border-color:var(--hair2);box-shadow:0 0 0 3px rgba(231,178,75,.14)}',
      '.owd textarea.inp{line-height:1.6;resize:vertical;min-height:58px}',
      '.owd select.inp{cursor:pointer}',
      '.owd .btn{border:1px solid var(--hair);border-radius:9px;background:var(--elev);color:var(--tx);padding:6px 14px;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .18s ease,border-color .18s ease,transform .18s ease}',
      '.owd .btn:hover{background:rgba(255,255,255,.1);border-color:var(--hair2)}',
      '.owd .btn:active{transform:scale(.985)}',
      '.owd .btn.primary{background:var(--acc);border-color:transparent;color:#161006;font-weight:600}',
      '.owd .btn.primary:hover{background:#F0C674}',
      '.owd .btn[disabled]{opacity:.35;cursor:not-allowed}',
      '.owd .row{padding:9px 10px;border-radius:10px;cursor:pointer}',
      '.owd .row:hover{background:rgba(255,255,255,.055)}',
      '.owd .row.on{background:var(--accSoft)}',
      '.owd .row .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.owd .badge{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;padding:1px 7px;border-radius:999px;background:rgba(255,255,255,.1);color:var(--tx);flex:none}',
      '.owd .badge.cyn{background:rgba(100,210,255,.18);color:#CFEFFF}',
      '.owd .meter{height:5px;border-radius:999px;background:rgba(255,255,255,.09);overflow:hidden;margin-top:5px}',
      '.owd .meter i{display:block;height:100%;border-radius:999px;background:var(--acc)}',
      '.owd .foot{display:flex;align-items:center;gap:8px;padding:9px 14px;border-top:1px solid var(--hair);font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--tx3)}',
      '.owd .divider{height:1px;background:var(--hair);margin:9px 0}',
    ].join('')

    /** 皮肤选择：默认「精修版」Apple-like；OW_SKIN_550C 仅作怀旧可选 */
    exports.OW_SKIN_ACTIVE = exports.OW_SKIN_DSH

    /** 壳顶用法条：关闭后写入 localStorage */
    exports.SHELL_GUIDE_KEY = 'dsh-open-world-shell-guide-dismissed'

    /** 客户端节点中文名（与服务端 index.js NODE_ZH 同步） */
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

    /** 客户端节点布局（orbit/angle）与语义色（v2 色板） */
    exports.NODE_LAYOUT = {
      core: { orbit: 0, angle: 0, en: 'CORE SYSTEM', color: '#F2F2F4' },
      analytics: { orbit: 4, angle: -70, en: 'DATA ANALYTICS', color: '#64D2FF' },
      'ai-engine': { orbit: 3, angle: 20, en: 'AI ENGINE', color: '#F0C674' },
      security: { orbit: 3, angle: 95, en: 'SECURITY', color: '#E7B24B' },
      network: { orbit: 4, angle: 145, en: 'NETWORK', color: '#30D158' },
      storage: { orbit: 4, angle: 215, en: 'STORAGE', color: '#F0C674' },
      'user-hub': { orbit: 3.5, angle: 250, en: 'USER HUB', color: '#FF9F0A' },
      'task-board': { orbit: 3, angle: -130, en: 'TASK QUEUE', color: '#30D158' },
      runtime: { orbit: 3.5, angle: 170, en: 'RUNTIME', color: '#6B6B72' },
      memory: { orbit: 2.5, angle: -40, en: 'MEMORY BANK', color: '#64D2FF' },
    }

    /** 事件圆点类名（对应 styles.js .ow-event-dot.*） */
    exports.EVENT_COLORS = ['green', 'gold', 'cyan', 'orange', 'purple']

    return module.exports
  },
})
