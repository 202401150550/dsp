# Open World Interface Protocol (OWIP) v0.1

> 状态：草案 · 2026-08-23  
> 适用范围：`dsh-open-world` Host（`index.js`）+ Client Bridge（`client.js`）  
> 原则：**L2 指挥层接口化 · L1 只桥接 Harness · L3 隐喻可标注可折叠**

---

## 0. 设计立场

> 产品级「系统」定位见 [SYSOP_v0.1.md](./SYSOP_v0.1.md)。OWIP 只管 **系统调用契约**；SYSOP 管壳、驱动目录与演进路线。

### 三层模型（验收分层 · 系统隐喻）

| 层 | 系统类比 | 内容 | 协议要求 |
|----|----------|------|----------|
| **L1 宿主** | 内核 + 驱动 | DSH Harness、Cordis、各插件原生 API | OWIP **不重复实现**；Bridge 优先调官方 API |
| **L2 指挥** | 壳 + 系统调用 | 聚合、动作、消息、回退、集成 | OWIP **核心**；必须稳定、可测、可自动化 |
| **L3 叙事** | 壁纸 / 特效 | NEXORA / ATI / 拓扑 / 化学视觉 | OWIP 允许存在，但字段必须带 `source: "metaphor"` |

### 30 秒验收（产品级，写入 README）

打开 Open World 后，用户（或脚本）在 30 秒内应能回答：

| 问题 | 读哪里 |
|------|--------|
| **现在什么状态？** | `snapshot.core` + `snapshot.integrations` |
| **我能做什么？** | `snapshot.nodes[].action`（每节点 ≥1 个 **已探测可用** 的动作） |
| **刚才发生了什么？** | `snapshot.events` + `snapshot.mailbox.messages` |

自动化等价：

```bash
curl -s http://127.0.0.1:<port>/api/open-world/snapshot | jq '.core,.integrations,.nodes[].action,.events[0:3]'
curl -s http://127.0.0.1:<port>/api/open-world/messages | jq '.messages[0:5]'
```

### 接口的六种价值

1. **解耦** — Client 可重写，契约不变  
2. **可组合** — Mailbox / Stream 作插件间公共神经系统  
3. **可观测** — 一次 GET 替代多个面板  
4. **可自动化** — curl / Agent / cron 同为操作者  
5. **可演进** — Action 注册表 + Plugin Manifest 扩展  
6. **可测试** — Bridge 收成 API adapter 后，Host/Bridge 可无浏览器单测  

---

## 1. 基本约定

### 1.1 Base URL

所有端点挂载于 DSH Web Server：

```text
/api/open-world
```

### 1.2 安全

| 规则 | v0.1 | **v0.2-draft（v2.12+）** | **v0.3-draft（v2.60+ · 已实现）** |
|------|------|--------------------------|-----------------------------------|
| 访问范围 | **仅 loopback** | loopback 默认免 token；非 loopback 需 `Authorization: Bearer` 或 `?token=` | 同左；**主体（principal）+ ACL** |
| 令牌 | — | `~/.dsh/open-world/space-token.json`；`space-token-issue` / `rotate` / `revoke` | 令牌带 **`role`**：默认 `second-screen`；显式 `peer` 才可写 |
| TTL | — | `space.token_ttl_hours`（默认 168h） | 同左 |
| 第二屏 | — | `GET /space/view` · `GET /space/second-screen` · stream `?role=second-screen` | 同左；EventSource 须 **短时 SSE ticket**（`POST /space/sse-ticket`），禁止仅靠长寿命 `?token=` |
| 回写 | — | （产品标只读，实现曾可打全量 `/action`） | **observer 禁止写**；`peer` 仅白名单（`PEER_ACTION_ALLOWLIST`，含 `request-local`→`PEER_LOCAL_REQUEST_ALLOWLIST`）；统一口 `POST /space/peer-action` |
| outbox | 明文 | 可选 AES-256-GCM 密封（`space.seal_outbox`） | 同左 |
| Pair | — | OW 可代理 pair 状态 | **不合并协议**：Pair 仍属 `dsh-remote-web-ui`；Space peer ≠ Pair |

#### 1.2.1 owip/0.3-draft · 主体与 ACL

| role | 谁 | 可做什么 |
|------|----|----------|
| `loopback-shell` | 本机 Desktop 壳（同源） | 全量 OW API |
| `second-screen` | LAN 第二屏（默认签发） | 只读：`GET /space/*`、stream `role=second-screen`、换 SSE ticket |
| `peer` | 显式「可回写（受限）」令牌 | 观察 + 白名单：`send-message`、`mark-read`、`memory-search`、`world-state-get`、`request-local`；**禁止** `space-token-*` / `pair-*` / `idea-inject` / `rrm-session-*` |

```text
POST /api/open-world/space/sse-ticket   → { ticket, expiresInSec, role }
GET  /api/open-world/stream?ticket=…&role=second-screen
POST /api/open-world/space/peer-action  → { action: "send-message"|"mark-read"|"memory-search"|"world-state-get"|"request-local", localAction?: "share-snapshot"|"space-token-status"|"notification-ack-all", … }
```

实现真源：`bridge/space-acl.mjs` · `bridge/space-auth.mjs`（`SPACE_PROTOCOL = owip/0.3-draft`）。

### 1.3 版本字段

Snapshot 内（space 启用时）：

```json
{
  "framework": { "version": "2.60", "protocol": "owip/0.3-draft", "snapshotSchema": 8 },
  "product": "NEXORA",
  "version": 8,
  "space": { "enabled": true, "hasToken": true, "sync": true },
  "fleet": { "counts": {}, "processes": [] }
}
```

- `framework.version` — Open World 实现版本（与 `CLIENT_VER` / package 主版本对齐）  
- `framework.protocol` — **OWIP 协议版本**：`owip/0.1` · `owip/0.2-draft`（历史）· **`owip/0.3-draft`（当前，含 ACL）**  
- `framework.snapshotSchema` / `version` — snapshot schema 整数修订（破坏性变更时 +1；当前 **8**）  
- `framework.actionLayers` — Host HTTP vs Bridge Client 分层摘要（见 `bridge/action-layers.mjs`）

### 1.4 数据来源标注 `source`

凡可能误导用户的字段，必须（v2.6 起）标注数据来源：

| 值 | 含义 | 示例 |
|----|------|------|
| `probe` | 直接探测 Harness / 插件 / 文件系统 | `nodes[].metric`、`integrations.rewind` |
| `derived` | 由 probe 数据公式计算，非原始读数 | `core.healthScore`、`ati.gradientNorm` |
| `metaphor` | 视觉/叙事用，不声称真实 ML/DL | `lab.ml.loss` 动画、`lab.topology` 轮换 |
| `config` | 来自 `open-world.yml` | `config.messaging` |
| `mailbox` | 持久化信箱 | `mailbox.messages` |

UI 规则（v2.6）：

- `metaphor` → 显示 **「隐喻」** 标签，默认折叠进「ATI 实验室」子页，**不隐藏**（保留第一印象钩子）  
- `derived` → 可选显示「推算」  
- `probe` → 无额外标签  

---

## 2. Snapshot Schema

### 2.1 `GET /api/open-world/snapshot`

返回世界当前态。v0.1 保留现有字段；v2.6 增加 `_meta.source` 或分块 `source`（见 2.3）。

#### 顶层结构

```typescript
interface Snapshot {
  ok: true
  product: 'NEXORA'
  version: number                    // schema revision
  capturedAt: string                 // ISO8601
  uptimeSec: number

  config: WorldConfig
  framework: FrameworkInfo
  core: CoreStatus                   // source: derived
  load: LoadMetrics                  // source: probe
  integrations: IntegrationsSummary  // source: probe
  hub: IntegrationsHub               // source: probe
  plugins: PluginProbe[]             // source: probe
  nodes: OrganNode[]                 // source: probe + derived
  synapses: SynapseEdge[]
  neuralLayers: NeuralLayer[]
  taskBoard: TaskBoardMetrics        // source: probe
  rewind: RewindStats                // source: probe
  hindsight: HindsightStatus         // source: probe
  idea: IdeaLabState                 // source: config + probe
  lab: AtiLabBundle                  // source: metaphor (v2.6 整包标注)
  ati: AtiMetrics                    // source: derived
  social: SocialLayer                // source: probe + derived
  mailbox: MailboxSummary            // source: mailbox
  sessions: SessionMetrics           // source: probe
  events: WorldEvent[]               // source: derived (in-memory ring)
}
```

#### `core` — 回答「现在什么状态？」

```typescript
interface CoreStatus {
  healthScore: number      // 0–100, derived from nodes
  sessionCount: number
  activeSessionId?: string
  activeCwd?: string
}
```

#### `nodes[]` — 回答「我能做什么？」

```typescript
interface OrganNode {
  id: string               // e.g. 'ai-engine', 'storage'
  label: string
  metric: number           // 0–100
  status: 'online' | 'busy' | 'idle' | 'warn' | 'offline'
  role: string
  hint: string
  dynamic: boolean
  action?: BridgeAction    // 客户端 Bridge 动作描述（见 §4.2）
}
```

**v2.6 要求：** 每个 `nodes[]` 在对应插件/能力 **available** 时必须有 `action`；不可用时 `status: 'offline'` 且 `action` 可省略。

#### `integrations` — 快速健康扫描

```typescript
interface IntegrationsSummary {
  taskBoard: boolean
  rewind: boolean
  hindsight: boolean
  hindsightDaemon: boolean
  pair: PairStatus
  notifications: { available: boolean; unreadCount: number }
  archifyCount: number
}
```

**v2.6 规则：** `notifications.available === false` 时，Client **不得**渲染通知操作入口（消灭空壳）。

#### `lab` — ATI 实验室（隐喻包）

```typescript
interface AtiLabBundle {
  topology: object   // source: metaphor
  ml: object         // source: metaphor
  dl: object         // source: metaphor — 语料可来自 probe，热力图为 metaphor
  chemistry: object  // source: metaphor
  evolution: object  // source: derived + metaphor 混合；v2.6 需拆分标注
}
```

v0.1 诚实声明：`lab.*` 输入信号来自 sessions / task-board / plugins / hindsight，**视觉与曲线为叙事隐喻，不是实时训练**。

#### `events[]` + `mailbox` — 回答「刚才发生了什么？」

```typescript
interface WorldEvent {
  id: string
  kind: string
  title: string
  detail: string
  ts: number
}

interface MailboxMessage {
  id: string
  ts: number
  direction: 'in' | 'out'
  from: string
  to: string
  toLabel?: string
  body: string
  kind: string
  read: boolean
  payload?: object
}
```

### 2.2 其他读端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/integrations` | 仅 `hub` 块 |
| GET | `/messages?unread=1` | 信箱列表 |
| GET | `/rewind/timeline` | Rewind 时间轴 |
| GET | `/memory/search?q=` | Hindsight 检索 |
| GET | `/events` | 内存事件环 |
| GET | `/archify/:name` | 嵌入 HTML 架构图 |

### 2.3 v2.6 Snapshot 增量（计划，v0.1 先定义）

`GET /api/open-world/snapshot?since=<capturedAt>` 或 SSE `snapshot-delta` 事件（§5）。

---

## 3. Core Actions（Host · ≤10）

Host 侧统一入口：

```http
POST /api/open-world/action
Content-Type: application/json

{ "action": "<name>", ...params }
```

### 3.1 核心十项

| # | action | 用途 | 层级 | 现状 |
|---|--------|------|------|------|
| 1 | `send-message` | 写信箱 / 广播 / 外发 / 跨机 | L2 | ✅ `index.js` |
| 2 | `mark-read` | 标记信箱已读 | L2 | ✅ |
| 3 | `share-snapshot` | 拓扑快照分享 + outbox | L2 | ✅ |
| 4 | `memory-search` | Hindsight 检索 | L2 | ✅ |
| 5 | `pair-issue` | 远程 Web UI 配对 | L2 | ✅ |
| 6 | `pair-stop` | 停止配对 | L2 | ✅ |
| 7 | `notification-ack-all` | 通知中心全部已读 | L2 | ✅（插件需启用） |
| 8 | `notification-publish` | 发布通知 | L2 | ✅ |
| 9 | `idea-inject` | IDEA 人格包装 + 可选写信箱 | L2 | ✅ |
| 10 | `idea-compare` | 多人格对比写信箱 | L2 | ✅ |

### 3.2 扩展 action（非 core，v0.1 保留但不计入十项）

| action | 说明 |
|--------|------|
| `idea-wrap` | 仅包装不投递 |

### 3.3 请求 / 响应约定

**成功：**

```json
{ "ok": true, ...actionSpecific }
```

**失败：**

```json
{ "ok": false, "error": "empty-body" | "messaging-disabled" | "unknown-action" | ... }
```

**`send-message` 参数：**

```typescript
{
  action: 'send-message'
  to: 'broadcast' | 'sessions' | 'agent' | 'clipboard' | 'external' | 'remote' | string
  body: string
  kind?: string
  attachSnapshot?: boolean
  attachMemory?: boolean
}
```

### 3.4 Action Registry（已实现）

Core ≤10；扩展动作（含 `idea-*`、`space-token-*`、`world-state-*`）走 `ACTION_REGISTRY`。未知 action → `unknown-action`。

**分层（v2.21）**：Host 动作只走 `POST /api/open-world/action`；Bridge 动作只走 Client `bridgeExecute`（调 DSH）。`idea-inject` 是跨层：Host 包装 → Bridge `inject-message` 投递。真源：`bridge/action-layers.mjs`。

```typescript
// Host 内部形态（已落地）
interface ActionRegistration {
  name: string
  layer: 'L2'
  handler: (ctx, params) => Promise<ActionResult>
  availability?: (snapshot) => boolean
}
```

现有 `if (action === '...')` 链 **迁移为** registry + core 十项冻结。

---

## 4. Bridge Actions（Client · DSH 操作）

Bridge 动作 **不在** `/api/open-world/action` 内执行，而是由 Client 调用 DSH 原生能力。  
v0.1 文档化现有行为；v2.6 目标：**API 优先 · DOM fallback · 自检**。

### 4.1 BridgeAction 描述符（snapshot 内 `nodes[].action`）

```typescript
interface BridgeAction {
  type: string
  label: string
  pluginId?: string | null
  panel?: string
  selector?: string
  settingsHint?: string
}
```

固定映射见 `index.js` → `NODE_ACTIONS`（11 个器官节点）。

### 4.2 Bridge `type` 枚举（Client `runBridge`）

| type | 目标 | 实现方式 | v2.6 目标 |
|------|------|----------|-----------|
| `close` | 关闭 Open World | Client UI | — |
| `composer` | 聚焦对话 | DOM | `session.focus` API |
| `monitor` | JSON 视图 | Client UI | — |
| `embed` | 内嵌面板 | Client UI | — |
| `panel` | 打开侧栏插件 | DOM + `dsh-panel-activate` | 官方 panel API |
| `settings` | 打开设置 | DOM | settings route API |
| `task-create` | 创建任务 | `/api/task-board/action` | ✅ 已是 API |
| `task-run` | 运行任务 | `/api/task-board/action` | ✅ |
| `agent-prompt` | 填入输入框 | DOM | `session.prompt` API |
| `inject-message` | 注入对话 | **API 优先** `conversation.send`；DOM 仅降级 | 仍保留 DOM fallback |
| `remote` | 远程 Web UI | DOM + event | pair API |
| `session-focus` | 切换会话 | DOM | `session.select` API |
| `rewind-panel` | 切 Rewind 视图 | Client UI | — |
| `rewind-open` | 打开 /rewind | DOM | rewind plugin API |
| `rewind-exec` | 执行回退 | **session.command API**；DOM 仅降级 | ✅ |
| `idea-panel` | IDEA Lab 视图 | Client UI | — |

> **现状债：** settings / panel / remote / session-focus 等仍可能走 DOM；缩面是持续项，不要在文档里再写成「纯计划」。

### 4.3 Bridge 自检（已实现 · Client 侧）

无独立 `GET /bridge/self-test` HTTP 端点；Client `BridgeHealthBar` 探测 `inject-message` / `rewind-exec` / `task-run` / `settings` 的 strategy（`session-api` | `api` | `dom` | `unavailable`）。

原计划响应形态仍可参考：

```http
GET /api/open-world/bridge/self-test   # 未挂路由；能力见 BridgeHealthBar
```

```json
{
  "ok": true,
  "checks": [
    { "id": "textarea", "method": "dom", "ok": true },
    { "id": "task-board", "method": "api", "ok": true },
    { "id": "rewind", "method": "api", "ok": false, "hint": "plugin offline" }
  ]
}
```

### 4.4 可测试性（主人补充的第 6 点）

v2.6 抽取：

```javascript
// bridge/execute.js — 无 React、无浏览器可测
export async function execute(action, deps) {
  if (action.type === 'rewind-exec') return deps.rewind.exec(action)
  if (action.type === 'task-run') return deps.taskBoard.run(action.taskId)
  // ...
}
```

---

## 5. Stream Events

### 5.1 `GET /api/open-world/stream`（SSE）

**v0.1 已有：**

| event `type` | 数据 | 触发 |
|--------------|------|------|
| `hello` | mailbox 统计 | 连接时 |
| `mailbox` | `{ unread, total, ... }` | 信箱变更 |

**已落地（含 v2.6+ / 0.2-draft）：**

| event `type` | 数据 |
|--------------|------|
| `snapshot-delta` | `{ changed: string[] }` fingerprint 字段变更提示 |
| `second-screen` | compact 第二屏视图（`?role=second-screen` 且 `space.sync`） |
| `pulse` | Client `POST /pulse` 上报后下一 snapshot 消费（非独立 SSE 类型） |

> 单条 `WorldEvent` 推送仍可后续加；当前靠 delta + 客户端 refresh。

### 5.2 `POST /api/open-world/pulse`

Client 上报 UI 突触动画：

```json
{ "edges": ["storage->core", "ai-engine->task-board"] }
```

---

## 6. Plugin Manifest Extension

v0.1 **规范**；v2.6 **实现读取**。

### 6.1 `dsh.plugin.json` 扩展块

```json
{
  "name": "dsh-example",
  "openWorld": {
    "organ": {
      "nodeId": "network",
      "title": "Example Network Tool",
      "probe": "exampleOnline",
      "metric": { "from": "probe", "key": "connectionCount" }
    },
    "actions": [
      {
        "id": "example.open",
        "label": "打开 Example",
        "bridge": { "type": "panel", "panel": "example" },
        "availability": { "pluginInstalled": true }
      }
    ],
    "subscribe": {
      "mailboxKinds": ["broadcast"],
      "kinds": ["plugin-online"]
    }
  }
}
```

### 6.2 字段说明

| 字段 | 说明 |
|------|------|
| `organ.nodeId` | 挂载到 11 器官之一，或 `dynamic: true` 新增节点 |
| `probe` | Host 探测函数名（v2.6 注册表） |
| `actions[]` | 声明 Bridge 或 Host action |
| `subscribe.mailboxKinds` | 未来：插件 worker 消费信箱（v0.2+） |

### 6.3 与 `plugins.yml` 关系

- `plugins.yml` — 是否 **启用**  
- `dsh.plugin.json` → `openWorld` — 启用后 **如何显示、如何操作**  
- v2.6：Host `PLUGIN_CATALOG` 硬编码 **收敛为** manifest 驱动 + catalog fallback  

---

## 7. 配置文件 `open-world.yml`

### 7.1 v0.1 有效字段

| 字段 | 解析 | 备注 |
|------|------|------|
| `default_view` | ⚠️ 部分 | 需完善 parser |
| `merge_synapses` | ✅ | |
| `dynamic_plugins` | ✅ | |
| `synapses[]` | ✅ | |
| `messaging.*` | ✅ | |
| `integrations.*` | ✅ | v2.12 已解析 |
| `idea.enabled` | ✅ | v2.12 已解析 |
| `rrm.*` / `space.*` | ✅ | 见 `open-world.yml` |

### 7.2 v2.6 目标 schema

```yaml
default_view: ati
messaging:
  enabled: true
integrations:
  pair: true
  notifications: true   # false 时 UI 隐藏通知入口
  hindsight_port: 9077
idea:
  enabled: true
views:
  metaphor:
    enabled: true       # ATI 实验室折叠页
    defaultExpanded: false
bridge:
  preferApi: true
  domFallback: true
```

---

## 8. 与现有代码映射

### 8.1 Host `index.js`

| OWIP 概念 | 现有符号 | v2.6 动作 |
|-----------|----------|-----------|
| Snapshot 聚合 | `buildSnapshot()` | 加 `source` 标注；拆 `lab` metadata |
| Core actions | `/action` handler 链 | 抽 `actionRegistry` |
| Events | `pushEvent()`, `events[]` | 可选持久化 |
| Mailbox | `loadMailbox`, `sendMailboxMessage` | 不变 |
| Integrations | `buildIntegrationsHub()` | `notifications.available` 驱动 UI |
| Rewind timeline | `buildRewindTimeline()` | 不变 |
| IDEA | `buildIdeaLab`, `wrapIdeaPrompt` | 不变 |
| Lab 隐喻 | `buildTopologyLab` 等 | 返回 `{ ..., _source: 'metaphor' }` |
| Plugin 探测 | `PLUGIN_CATALOG`, `probePlugins` | 读 manifest |
| Config | `parseOpenWorldConfig` | 支持 integrations/idea/views |

### 8.2 Client `client.js`

| OWIP 概念 | 现有符号 | v2.6 动作 |
|-----------|----------|-----------|
| Bridge | `runBridge()` | 抽 `bridge/execute.js` |
| 30s 验收 UI | 分散在各 Panel | 首屏 Core 区 + 隐喻折叠 |
| 轮询 | `POLL_MS = 2500` | 减频 + 依赖 SSE delta |
| 版本 | `CLIENT_VER` | 与 `framework.protocol` 对齐 |
| ATI 视图 | `AtiCortex`, presets | 加「隐喻」标签 |
| Command palette | `cmdItems` | 不变 |

### 8.3 文件清单

```text
dsh-open-world/
  index.js          Host — OWIP 服务端
  client.js         Client — Bridge + UI（v2.7 拆包）
  open-world.yml    用户可覆盖配置
  idea-presets.json IDEA 静态预设
  OWIP_v0.1.md      本文档
  README.md         含 30 秒验收
```

---

## 9. 迁移路径 v2.5 → v2.6

### Phase 0 — 文档（当前）

- [x] OWIP v0.1 草案  
- [ ] README 写入 30 秒验收 + L1/L2/L3 说明  

### Phase 1 — 诚实与稳定（v2.6.0）

1. 统一版本号 + `framework.protocol: "owip/0.1"`  
2. `lab` / `ati` 加 `source`；UI 「隐喻」标签 + 实验室折叠  
3. `parseOpenWorldConfig` 支持 `integrations` / `idea`  
4. `notifications.available === false` 隐藏通知 UI  
5. Bridge 自检端点（只读探测）  

### Phase 2 — 闭环（v2.6.x）

6. `rewind-exec` → API 优先一键回退  
7. `inject-message` → session.prompt API  
8. Host action registry 重构（行为不变）  
9. 基础 API 测试（snapshot / send-message / idea-inject）  

### Phase 3 — 扩展（v2.7）

10. Plugin manifest `openWorld` 读取  
11. SSE snapshot-delta  
12. Client 拆模块（bridge / panels / views）  

### 不做（L1 禁区）

- ❌ 自研 LLM 路由  
- ❌ 重写 task-board / rewind 核心  
- ❌ 把 metaphor 包装成真实 ML 指标  

---

## 10. 核心决策记录（与主人对齐）

| 决策 | 立场 |
|------|------|
| L2 是产品核心 | ✅ 消息 / 回退 / Bridge 优先于视觉 |
| ATI 不完全关闭 | ✅ 隐喻标签页 + 默认折叠 |
| 先协议后代码 | ✅ 本文档批准后再动 v2.6 |
| Bridge 可测性 | ✅ 抽 execute 层，API 优先 |
| Core actions ≤10 | ✅ 扩展 action 走 registry，不膨胀 core |

---

## 附录 A：错误码

| error | HTTP | 说明 |
|-------|------|------|
| `forbidden` | 403 | 非 loopback，或 token 无效 |
| `token-required` | 401 | 非 loopback 且未提供 Bearer / query token |
| `method-not-allowed` | 405 | |
| `not-found` | 404 | |
| `unknown-action` | 400 | |
| `empty-body` | 400 | |
| `messaging-disabled` | 400 | |
| `broadcast-disabled` | 400 | |
| `idea-disabled` | 400 | |
| `unknown-preset` | 400 | |

---

## 附录 B：修订历史

| 版本 | 日期 | 说明 |
|------|------|------|
| owip/0.3-draft | 2026-09-09 | Space ACL · principal roles · peer 白名单回写 · SSE ticket；实现版 v2.60 |
| owip/0.2-draft | 2026-09-03 | 空间层：Bearer / 密封 outbox / 第二屏 SSE+view；实现版 v2.12 |
| owip/0.1 | 2026-08-23 | 首版草案；对齐 v2.5 实现与 v2.6 迁移 |
