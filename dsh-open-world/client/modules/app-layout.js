// Open World · app-layout（左栏 / 中区 / 右栏，从 client-main 抽出）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/app-layout',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const C = require('dsh-open-world/constants')
    const Shell = require('dsh-open-world/shell')
    const Idea = require('dsh-open-world/idea')
    const Hubs = require('dsh-open-world/hubs')
    const AtiView = require('dsh-open-world/ati-view')
    const Chrome = require('dsh-open-world/chrome')
    const Runtime = require('dsh-open-world/runtime')

    const { NODE_ZH, NODE_LAYOUT, EVENT_COLORS, QUICK_ACTIONS } = C
    const {
      BridgeHealthBar, ShellGuide, ActionsEmptyState, EventsEmptyState, MemoryHub, StatusSummaryChips, LeftSidebarTabs,
      SocialPanel, IntegrationsPanel, pluginAction, socialChannelAction,
      tierBadge, FleetPanel, sourceTag,
    } = Shell
    const { IdeaLabWorkspace } = Idea
    const { MessageHub, IntegrationsHub, RewindTimelinePanel } = Hubs
    const { Sparkline, ArchifyEmbed, AtiCortex, ResourceDonut } = AtiView
    const {
      iconSvg, Panel, ViewportWrap, renderEmbedSurface, enterActionLabel, NodeDetailCard,
    } = Chrome
    const { taskProgress } = Runtime

    function LeftRail({
      leftTab, onLeftTab,
      snapshot, plugins, hist, health, healthCirc, loadRows, nodes,
      bridgeHealth, setBridgeHealth, checkBridgeCapabilities,
      runBridge, setEmbed, setToast,
      hub, handleEmbedArchify,
      events, social,
      mailbox, handleSendMessage, handleMarkRead, handleShareSnapshot,
      handleInjectAgent, handleSearchMemory,
    }) {
      return React.createElement('div', { className: 'ow-side ow-side-left' },
                    React.createElement(ShellGuide, null),
                    React.createElement(LeftSidebarTabs, { tab: leftTab, onTab: onLeftTab }),
                    leftTab === 'status' && React.createElement(React.Fragment, null,
                      React.createElement(Panel, { titleZh: '现在怎样', titleEn: 'STATUS', icon: 'diagnosis' },
                        React.createElement('div', { className: 'ow-health-wrap' },
                          React.createElement('div', { className: 'ow-health-ring' },
                            React.createElement('svg', { viewBox: '0 0 120 120' },
                              React.createElement('defs', null,
                                React.createElement('linearGradient', { id: 'owHealthGrad', x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
                                  React.createElement('stop', { offset: '0%', stopColor: '#bfe38e' }),
                                  React.createElement('stop', { offset: '100%', stopColor: '#5eead4' }),
                                ),
                              ),
                              React.createElement('circle', { cx: 60, cy: 60, r: 48, fill: 'none', stroke: 'rgba(94,234,212,.1)', strokeWidth: 3 }),
                              React.createElement('circle', {
                                cx: 60, cy: 60, r: 48, fill: 'none', stroke: 'url(#owHealthGrad)', strokeWidth: 3,
                                strokeLinecap: 'round', strokeDasharray: `${healthCirc} ${2 * Math.PI * 48}`,
                              }),
                            ),
                            React.createElement('div', { className: 'ow-health-center' },
                              React.createElement('span', { className: 'ow-health-val' }, health),
                              React.createElement('span', { className: 'ow-health-unit' }, '/ 100'),
                            ),
                          ),
                        ),
                        React.createElement('div', { className: 'ow-health-label' },
                          React.createElement('div', { className: 'ow-health-label-main' },
                            '整体健康度',
                            sourceTag((snapshot && snapshot.core && snapshot.core.healthScoreSource) || 'derived'),
                          ),
                          React.createElement('div', { className: 'ow-health-label-sub' }, 'HEALTH SCORE'),
                        ),
                        React.createElement(Sparkline, { values: hist.health, color: '#5eead4', height: 36 }),
                        React.createElement(StatusSummaryChips, { snapshot, plugins }),
                        React.createElement(BridgeHealthBar, {
                          health: bridgeHealth,
                          onRefresh: () => {
                            const results = checkBridgeCapabilities()
                            setBridgeHealth(results)
                          },
                        }),
                      ),
                      React.createElement(Panel, { titleZh: '进行中', titleEn: 'RUNNING', icon: 'network' },
                        React.createElement(FleetPanel, {
                          fleet: snapshot && snapshot.fleet,
                          onAction: runBridge,
                          compact: true,
                        }),
                        React.createElement('button', {
                          type: 'button',
                          className: 'ow-neural-btn',
                          style: { marginTop: 8 },
                          onClick: () => setEmbed('fleet'),
                        }, '展开列表'),
                      ),
                      React.createElement(Panel, { titleZh: '实时负载', titleEn: 'REAL-TIME LOAD', icon: 'diagnosis', last: true },
                        loadRows.map((row) => React.createElement('div', { key: row.key, className: 'ow-load-item' },
                          React.createElement('span', { className: 'ow-load-label' }, row.key),
                          React.createElement(Sparkline, { values: row.hist, color: row.color }),
                          React.createElement('span', { className: 'ow-load-val' }, row.val),
                        )),
                      ),
                    ),
                    leftTab === 'actions' && React.createElement(React.Fragment, null,
                      React.createElement(ActionsEmptyState, {
                        plugins,
                        onIdea: () => runBridge({ type: 'idea-panel' }),
                        onTasks: () => runBridge({ type: 'task-board', label: '任务看板' }),
                        onRewind: () => runBridge({ type: 'embed', panel: 'rewind', label: '回退时间轴' }),
                      }),
                      React.createElement(Panel, { titleZh: '扩展', titleEn: 'EXTENSIONS', icon: 'config' },
                        React.createElement(IntegrationsPanel, {
                          plugins,
                          onActivate: (p) => runBridge(pluginAction(p)),
                          onOffline: (p) => setToast(p.howToEnable || p.hint || `${p.title} 未在线`),
                        }),
                      ),
                      React.createElement(Panel, { titleZh: '更多', titleEn: 'MORE', icon: 'network' },
                        React.createElement(IntegrationsHub, {
                          hub,
                          space: snapshot && snapshot.space,
                          onAction: runBridge,
                          onEmbedArchify: handleEmbedArchify,
                          onToast: setToast,
                        }),
                      ),
                      React.createElement(Panel, { titleZh: '对话回退', titleEn: 'REWIND', icon: 'backup' },
                        React.createElement(RewindTimelinePanel, {
                          rewind: snapshot && snapshot.rewind,
                          plugins,
                          onAction: runBridge,
                          onToast: setToast,
                          compact: true,
                        }),
                      ),
                      React.createElement(Panel, { titleZh: '说话风格', titleEn: 'PERSONA', icon: 'config', last: true },
                        React.createElement('div', { className: 'ow-hub', style: { fontSize: 11, color: '#94a3b8', lineHeight: 1.55 } },
                          React.createElement('div', null, '加一段人格前缀，再发到官方聊天里试一句。'),
                          React.createElement('div', { style: { marginTop: 4, color: '#64748b' } },
                            '不会真的换掉 Agent；完整面板只在中间打开一次。'),
                          React.createElement('button', {
                            type: 'button',
                            className: 'ow-neural-btn',
                            style: { marginTop: 10 },
                            onClick: () => runBridge({ type: 'idea-panel' }),
                          }, '打开风格面板'),
                        ),
                      ),
                    ),
                    leftTab === 'events' && React.createElement(React.Fragment, null,
                      React.createElement(Panel, { titleZh: '记忆', titleEn: 'MEMORY', icon: 'backup' },
                        React.createElement(MemoryHub, {
                          memory: snapshot && snapshot.memory,
                          onToast: setToast,
                          onSearchMemory: handleSearchMemory,
                        }),
                      ),
                      React.createElement(Panel, { titleZh: '系统事件', titleEn: 'EVENTS', icon: 'diagnosis' },
                        React.createElement(EventsEmptyState, { events }),
                        React.createElement('div', { className: 'ow-event-list' },
                          events.slice(0, 10).map((ev, i) => React.createElement('div', { key: ev.id, className: 'ow-event-item' },
                            React.createElement('span', { className: `ow-event-dot ${EVENT_COLORS[i % EVENT_COLORS.length]}` }),
                            tierBadge(ev.tier),
                            React.createElement('span', { className: 'ow-event-text', title: ev.detail || ev.title }, ev.title),
                            React.createElement('span', { className: 'ow-event-time' },
                              new Date(ev.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                            ),
                          )),
                        ),
                      ),
                      React.createElement('details', { className: 'ow-adv-fold', style: { margin: '0 0 8px' } },
                        React.createElement('summary', {
                          style: { fontSize: 11, color: '#7c8ea6', cursor: 'pointer', padding: '6px 0' },
                        }, '高级 · 社交层'),
                        React.createElement(Panel, { titleZh: '社交层', titleEn: 'SOCIAL', icon: 'network' },
                          React.createElement(SocialPanel, {
                            social,
                            onChannel: (id) => runBridge(socialChannelAction(id)),
                            onSession: (p) => runBridge({ type: 'session-focus', sessionId: p.id, label: '切换会话' }),
                          }),
                        ),
                      ),
                      React.createElement(Panel, { titleZh: '消息总线', titleEn: 'MESSAGES', icon: 'network', last: true },
                        React.createElement(MessageHub, {
                          mailbox: mailbox || (snapshot && snapshot.mailbox),
                          hub,
                          onSend: handleSendMessage,
                          onRead: handleMarkRead,
                          onShare: handleShareSnapshot,
                          onInjectAgent: handleInjectAgent,
                          onSearchMemory: handleSearchMemory,
                        }),
                      ),
                    ),
                  )
    }

    function CenterStage({
      view, setView,
      idea, handleIdeaInject, handleIdeaCompare, runBridge,
      viewport, nodes, synapses, ati, selected, setSelected, tick,
      atiPreset, onAtiPresetChange, pulseBoost, lab,
      archifyEmbed, setArchifyEmbed,
      detailOpen, setDetailOpen, selectedNode, selectedAction, activateSelectedAction,
      events, usage, embed, setEmbed, tasks, snapshot, plugins, hub, setToast, taskState,
    }) {
      return React.createElement('div', { className: 'ow-center' },
                    view === 'idea' && React.createElement(IdeaLabWorkspace, {
                      idea,
                      compact: false,
                      onInject: handleIdeaInject,
                      onCompare: handleIdeaCompare,
                      onAction: runBridge,
                    }),
                    view === 'ati' && React.createElement(React.Fragment, null,
                      React.createElement(ViewportWrap, {
                        vp: viewport.vp,
                        onWheel: viewport.onWheel,
                        onBgPointerDown: viewport.onBgPointerDown,
                        onBgPointerMove: viewport.onBgPointerMove,
                        onBgPointerUp: viewport.onBgPointerUp,
                        showBg: false,
                      },
                        React.createElement(AtiCortex, {
                          nodes, synapses, ati, selected, onSelect: setSelected, tick,
                          onActivate: runBridge, preset: atiPreset, onPresetChange: onAtiPresetChange, pulseBoost, lab,
                        }),
                      ),
                      archifyEmbed && React.createElement(ArchifyEmbed, {
                        url: archifyEmbed.url,
                        title: archifyEmbed.title,
                        onClose: () => setArchifyEmbed(null),
                      }),
                      detailOpen && selectedNode && React.createElement(NodeDetailCard, {
                        node: selectedNode, synapses, events, usage, onAction: runBridge, onClose: () => setDetailOpen(false),
                        onOfflineHint: (msg) => setToast(msg),
                      }),
                      embed && renderEmbedSurface(embed, {
                        tasks, snapshot, plugins, hub, memory: snapshot && snapshot.memory, setEmbed, runBridge,
                      }),
                      selectedNode && React.createElement('div', { className: 'ow-orbit-hint' },
                        React.createElement('span', null, `ATI · ${NODE_ZH[selectedNode.id] || selectedNode.label} · ${selectedNode.metric}%`),
                        selectedAction && React.createElement('div', { className: 'ow-action-bar' },
                          React.createElement('button', { type: 'button', onClick: activateSelectedAction },
                            selectedNode.status === 'offline' && selectedNode.howToEnable
                              ? '如何启用'
                              : enterActionLabel(selectedAction, selectedNode)),
                          React.createElement('button', { type: 'button', className: 'sec', onClick: () => setView('monitor') }, 'JSON'),
                        ),
                      ),
                    ),
                    view === 'monitor' && React.createElement('div', { className: 'ow-monitor' },
                      React.createElement('pre', null, JSON.stringify({ snapshot, taskState }, null, 2)),
                    ),
                    view === 'topology' && React.createElement('div', { className: 'ow-topo' },
                      nodes.map((n) => React.createElement('div', {
                        key: n.id, className: 'ow-topo-card', onClick: () => setSelected(n.id),
                        onDoubleClick: () => {
                          if (n.status === 'offline' && n.howToEnable) setToast(n.howToEnable)
                          else if (n.action) runBridge(n.action)
                        },
                        style: { outline: selected === n.id ? '1px solid #5eead4' : 'none' },
                      },
                        React.createElement('strong', { style: { color: '#e6f1ff' } }, NODE_ZH[n.id] || n.label),
                        React.createElement('div', { style: { fontSize: 11, color: '#7c8ea6', marginTop: 4 } }, NODE_LAYOUT[n.id] && NODE_LAYOUT[n.id].en),
                        React.createElement('div', { style: { fontSize: 12, color: '#5eead4', marginTop: 6 } }, `${n.metric}% · ${n.status}`),
                      )),
                    ),
                  )
    }

    function RightRail({ nodes, tasks, runBridge }) {
      return React.createElement('div', { className: 'ow-side ow-side-right' },
                    React.createElement(Panel, { titleZh: '资源分布', titleEn: 'RESOURCE DISTRIBUTION', icon: 'galaxy' },
                      React.createElement(ResourceDonut, { nodes }),
                    ),
                    React.createElement(Panel, { titleZh: '任务队列', titleEn: 'TASK QUEUE', more: '更多 ›' },
                      React.createElement('div', { className: 'ow-task-list' },
                        tasks.length === 0
                          ? React.createElement('div', { style: { fontSize: 12, color: '#7c8ea6' } }, '暂无任务 · task-board 离线')
                          : tasks.slice(0, 5).map((t, i) => {
                            const pct = taskProgress(t)
                            const running = t.running || t.status === 'running'
                            return React.createElement('div', {
                              key: t.id, className: 'ow-task-item ow-clickable',
                              onClick: () => runBridge({ type: 'task-run', taskId: t.id }),
                              title: '点击运行任务',
                            },
                              React.createElement('div', { className: 'ow-task-head' },
                                tierBadge(t.tier),
                                React.createElement('span', { className: 'ow-task-name' }, t.title),
                                React.createElement('span', { className: `ow-task-status ${running ? 'running' : 'pending'}` },
                                  running ? '进行中' : '等待中'),
                                React.createElement('span', { className: 'ow-task-pct' }, `${pct}%`),
                              ),
                              React.createElement('div', { className: 'ow-task-bar' },
                                React.createElement('div', {
                                  className: `ow-task-fill ${running ? (i % 2 ? 'gold' : 'cyan') : 'dim'}`,
                                  style: { width: `${pct}%` },
                                }),
                              ),
                            )
                          }),
                      ),
                    ),
                    React.createElement(Panel, { titleZh: '快捷操作', titleEn: 'QUICK ACTIONS', icon: 'config', last: true },
                      React.createElement('div', { className: 'ow-actions' },
                        QUICK_ACTIONS.map((a) => React.createElement('button', {
                          key: a.label, type: 'button', className: 'ow-action-btn',
                          onClick: () => runBridge(a.action),
                        },
                          iconSvg(a.icon),
                          React.createElement('span', { className: 'ow-action-label' }, a.label),
                        )),
                      ),
                    ),
                  )
    }

    module.exports = { LeftRail, CenterStage, RightRail }
    return module.exports
  },
})
