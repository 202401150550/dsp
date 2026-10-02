# Garden View 上桥 —— 园成为控制台第四视图（P1 交付）

> 状态：**已实现** · 2026-10-01 · CLIENT_BUILD 67d9021703（未 commit，HEAD 05301e3；cfbc3e64ac→6b0c5d1d6c 为中间态）
> 定调：承《mcp-open-world-rebuild-20261001.md》§14 前厅后园——控制台是主身，园是门后世界（小的扩充点）。

## 交付内容

**新模块** `client/modules/garden-view.js`：
- 园作为底栏第 4 视图（钩子：hooks.js VIEW_MODES + garden；渲染：app-layout CenterStage view==='garden'）
- canvas 2D 山水园（无 WebGL）：月/舱/灯/塔/门/湖/桥/幡/石/井 十元素 + 风/涟漪/幡舞/流星（大事件）
- 月 = snapshot.core.healthScore（盈亏映体检分）；名牌含白话自释 + 牵连行
- 园径（事件 7 条）读 events 环；信纸 + 人格行（读 snapshot.idea.presets）

**真数据**（只读白名单字段）：core/nodes/taskBoard/memory/rewind/space/events/mailbox/worldPacks/idea/config.worlds

**真动作**（OWIP 核心动作，不新造）：
- 信纸寄出 → `send-message`（to: mailbox，经 C.OW_ACTION_URL，与 chat.js 同通道）
- 问人格 / 对比 → `idea-inject` / `idea-compare`（复用 handleIdeaInject/Compare）
- 湖查一件事 → `memory-search`（复用 handleSearchMemory）
- 请人过桥 → `pair-issue`

**开关与登记**：
- open-world.yml `worlds.garden: true`（设 false 即隐藏；客户端经 snapshot.config.worlds.garden 读取——index.js 全量与 shell 瘦身两处 config 均已透传 worlds）
- capability-registry：dsh-open-world 行 owSurfaces + 'garden'
- client-build-meta MODULE_ORDER + garden-view.js（参与 build hash 与 freshness）

**接线清单**（本轮 11 文件）：garden-view.js(新) / test/garden-view.mjs(新) / hooks.js / app-layout.js / client-main.js / client-build-meta.mjs / index.js / open-world.yml / capability-registry.mjs / styles.js(园 CSS ~40 规则) / package.json(test 链+files)

## 验证

- build:client OK → **CLIENT_BUILD cfbc3e64ac**；node --check OK；get_diagnostics 0 问题
- **14 套件全绿**（原 13 套件 535 断言 0 failed 一套未动全过 + 新第 14 套件 garden-view exit=0）：
  fresh=0 / smoke 228 / bridge 34 / manifest 8 / rrm 62 / fleet 13 / world-state 21 /
  space-auth 26 / space-acl 52 / capability-registry 14 / capability-graph 13 / world-packs 24 /
  action-layers 21 / chat-store 19 / garden-view 0 failed
- 证据：_scratch/v5-build.log · _scratch/v5-garden-tests.log · _scratch/v5-one-{manifest,rrm,fleet}.log
  （pty 今日不稳，大链会中途断，故 manifest/rrm/fleet 以单跑日志为准——环境问题非测试失败）

## 下一步（P2/P3）

- P2 聊天合一：信纸直接挂 chat-store 会话（一套存储两处渲染）
- P3 角色默认：小白首次进=园、主人默认=厅（配置项）
- 上真机 CDP 验收（npm run test:live）由主人重启 DSH Desktop 后进行


## 终态验证（P2/P3 后 · 2026-10-01）

- build:client OK → **CLIENT_BUILD 67d9021703**，node --check exit=0，composed client.js 含多行 GardenView/postChatLetter
- **14 套件全绿（真绿）**：fresh=0 · smoke 228/0 · bridge 34/0 · manifest 8/0 · rrm 62/0 · fleet 13/0 · world-state 21/0 · space-auth 26/0 · space-acl 52/0 · capability-registry 14/0 · capability-graph 13/0 · world-packs 24/0 · action-layers 21/0 · chat-store 19/0 · **garden-view 27/0**（27 条 ✓ 实断言，含 P2 落坞形状与 P3 default_view 门槛）
- 证据：_scratch/v5b-build.log · _scratch/v5b-garden-tests.log（含首跑 2 断言拦截与修复后重跑 27/0 全 ✓ 的完整过程）
- 诚实记录：首版 garden-view.js/测试曾被单行化（假绿），已整文件重写；首跑真断言拦截 2 处测试白名单疏漏（snapshot.plugins 合法字段、#4A5158 园色板），均已修正后复跑全绿
