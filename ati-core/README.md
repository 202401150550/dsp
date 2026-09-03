# ati-core

**ATI 分层架构 · 第一层：纯数学框架**

所有上层（拓扑抽象、算子、接口、ACI 组件）都依赖这一层。本包**不依赖任何神经网络或业务代码**，可独立单元测试。

---

## 分层架构总览

```
┌───────────────────────────────────────────────────────┐
│  ACI 上层：规划 / 记忆 / 自我反馈 / 冲突约束           │
│  （复用下方全部能力）                                   │
├───────────────────────────────────────────────────────┤
│  接口层：OpenRouter 风格 API / 流式 / 可观测日志        │
├───────────────────────────────────────────────────────┤
│  算子层：NN 节点 / 逻辑节点 / 工具节点 / 记忆节点       │
│  （统一输入输出协议，挂载在拓扑节点上）                  │
├───────────────────────────────────────────────────────┤
│  拓扑抽象层：节点-边-超边通用图，静态 + 动态            │
│  （只管"谁连谁"，不管节点内部算什么）                    │
├───────────────────────────────────────────────────────┤
│  ★ 数学框架层（本包）：线性代数 / 图论拓扑 / 优化 / 概率 │
│    纯数学对象，无业务依赖                                │
└───────────────────────────────────────────────────────┘
```

---

## 当前实现（v0.6）

### `ati-core/linalg` — 线性代数

| 类 | 能力 |
|---|------|
| `Vec` | 加减、缩放、点积、L-p 范数、归一化 |
| `Mat` | 转置、矩阵乘、行列式（LU 分解）、逆（高斯-约当）、迹、Frobenius 范数 |

### `ati-core/topology` — 拓扑图论（v0.2 强化）

| 类/方法 | 说明 |
|---------|------|
| `Graph` | 通用有向/无向图 |
| **节点类型系统** | `sensor / logic / nn / tool / memory / actuator / custom`，类型校验 + 按类查询 |
| `.addNode(id, {type, ...})` | 增节点（带类型） |
| `.nodesByType(type)` | 查询某类型的所有节点 |
| **边类型兼容矩阵** | `DEFAULT_EDGE_COMPAT` 控制哪些节点类型可以连边，可自定义覆盖 |
| `.addEdge(from, to, data)` | 增边（自动校验类型兼容性） |
| **rewire(from, oldTo, newTo)** | 改一条边的目标（ACI 结构搜索核心操作），失败自动回滚 |
| **事件流** | 每次 add/remove/rewire 记录一条结构变更事件，可注入回调监听 |
| **拓扑校验器** | `validate()` 返回 `{ok, errors[], warnings[]}`：环限制、节点上限、孤立节点、类型兼容 |
| **快照 / 回滚** | `snapshot()` 保存当前结构，`restore(snap)` 完整恢复 |
| **stats()** | 节点数、边数、密度、类型分布、环状态、连通分量数 |
| `.addHyperedge(id, members, data)` | **超边**：一条边连接多个节点 |
| `.adjacencyMatrix()` | 邻接矩阵 → `Mat` |
| `.laplacianMatrix(normalized?)` | 拉普拉斯矩阵（普通/归一化） |
| `.connectedComponents()` | 连通分量 |
| `.hasCycle()` | 环检测（有向三色 DFS / 无向并查集） |
| `.topologicalSort()` | DAG 拓扑排序（有向图） |
| `.subgraph(ids)` | 子图抽取 |
| `.serialize()/.deserialize()` | JSON 序列化/反序列化（含配置项） |
| `.mergeEdges(other)` | 动态合并外部图 |

**构造参数：**

```js
new Graph({
  directed: false,          // 有向/无向
  maxNodes: Infinity,       // 节点上限（防爆炸）
  allowCycles: true,        // 是否允许环
  edgeCompat: {...},        // 自定义边兼容矩阵
  onEvent: (ev) => {...},   // 结构变更回调
})
```

### `ati-core/optimize` — 优化

| 函数 | 说明 |
|------|------|
| `numericalGradient(f, x, eps)` | 中心差分数值梯度 |
| `gradientDescent(f, x0, opts)` | 动量梯度下降 |
| `makeScalar / scalarAdd / scalarMul / scalarBackward` | 极简反向传播 tape（教学用） |

### `ati-core/stats` — 概率统计

| 函数 | 说明 |
|------|------|
| `entropy(p, base)` | Shannon 熵 |
| `klDivergence(p, q, base)` | KL 散度 |
| `jsDivergence(p, q, base)` | JS 散度（对称、有界） |
| `softmax(logits, temperature)` | softmax（带温度） |
| `sampleNormal(mu, sigma)` | Box-Muller 正态采样 |
| `mean / variance / std` | 基础统计量 |

### `ati-core/operators` — 算子层（v0.3 新增）

统一协议：所有算子实现 `async forward(input, ctx) → output`

| 算子 | 对应节点类型 | 说明 |
|------|:---:|------|
| `SensorOperator` | `sensor` | `config.source: () => any` — 从外部拉取数据 |
| `LogicOperator` | `logic` | `config.condition` 条件判断 + 可选 `transform`，返回 `{branch, value}` 路由信息 |
| `NnOperator` | `nn` | `config.model: async (input) => output` — 注入推理函数（后续接真模型） |
| `ToolOperator` | `tool` | `config.execute` 外部工具调用 + 超时保护 |
| `MemoryOperator` | `memory` | `mode: read/write/read-write` + 动态 key 函数 |
| `ActuatorOperator` | `actuator` | `config.actuate` 执行动作 |

**注册表：**

```js
import { registerOperator, createOperator } from 'ati-core/operators'
registerOperator('my-type', MyCustomOp)
const op = createOperator('my-type', { ... })
```

### `ati-core/executor` — 图执行器（v0.3 新增）

```js
import { GraphExecutor } from 'ati-core/executor'

const executor = new GraphExecutor(graph, operatorsMap)
const { output, trace } = await executor.run(input)
```

- 按拓扑序遍历，把上游输出作为下游输入
- 多上游汇聚时自动打包成数组
- `trace()` 返回每个节点的输入/输出/耗时/错误
- `runTo(input, nodeId)` 部分推理（只跑到某个节点）
- 内置共享 `memory` Map 供 MemoryOperator 使用
- 构造时校验：参与边的节点必须有算子

### `ati-core/social` — 社交拓扑层 / 元宇宙原型（v0.4 新增）

每个人 = `person` 节点，边 = 对话通道，超边/房间节点 = 群聊。

```js
import { SocialNetwork } from 'ati-core/social'

const sn = new SocialNetwork({ onEvent: (ev) => console.log(ev.kind, ev.detail) })

// 身份
sn.join('alice', { displayName: 'Alice' })
sn.join('bob')
sn.join('ati', { displayName: 'ATI Core', isBot: true })

// 连接（好友关系）
sn.connect('alice', 'bob')

// 房间（群聊）
sn.createRoom('general', 'General', ['alice', 'bob', 'ati'])

// 私信
sn.sendMessage('alice', 'bob', 'hello')
sn.inbox('bob')          // [{ from:'alice', body:'hello', seq:1, ... }]
sn.unreadCount('bob')    // 1
sn.markRead('bob')       // 全部已读

// 群聊广播
sn.sendToRoom('alice', 'general', 'meeting at 3')

// 好友的好友推荐
sn.suggestions('alice')  // ['ati'] 如果 bob→ati

// 社交距离
sn.degreesOfSeparation('alice', 'ati')  // 通过几层人脉

// 在场状态
sn.setPresence('alice', 'offline')
sn.isOnline('alice')

// 底层图（可视化用）
const g = sn.topology()  // Graph 实例，可导出 adjacency/laplacian
```

| 方法 | 说明 |
|------|------|
| `join(userId, {displayName, isBot})` | 加入网络 |
| `leave(userId)` | 离开（自动清理房间成员） |
| `connect/disconnect(a, b)` | 建立/断开好友连接 |
| `connections(userId)` | 直接好友列表 |
| `suggestions(userId)` | 二度人脉推荐 |
| `createRoom(id, name, members)` | 创建群聊房间 |
| `joinRoom/leaveRoom(roomId, userId)` | 加入/退出房间 |
| `sendMessage(from, to, body)` | 私信（要求已连接） |
| `sendToRoom(from, roomId, body)` | 群聊广播（不要求互连） |
| `inbox(userId)` / `unreadCount` / `markRead` | 收件箱管理 |
| `setPresence/isOnline` | 在线状态 |
| `degreesOfSeparation(a, b)` | 六度分隔理论计算 |
| `socialStats()` | 用户数/在线数/bot数/房间数/密度 |
| `topology()` | 导出底层 `Graph`（供可视化） |
| `serialize()/deserialize()` | 持久化 |

### `ati-core/server` — HTTP/SSE 接口层（v0.5 新增）

零外部依赖（只用 `node:http`），把 SocialNetwork 暴露为 REST API + SSE 实时推送。

```js
import { SocialNetwork, AtiServer } from 'ati-core'

const sn = new SocialNetwork()
const server = new AtiServer(sn, { port: 7300 })
await server.start()
// → http://127.0.0.1:7300
```

#### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/join` | 加入网络 `{userId, displayName?, isBot?}` |
| DELETE | `/user/:id` | 离开网络 |
| GET | `/users` | 用户列表 |
| POST | `/presence` | 设置在线状态 `{userId, status}` |
| POST | `/connect` | 建立连接 `{userA, userB}` |
| POST | `/disconnect` | 断开连接 |
| GET | `/connections/:id` | 好友列表 |
| POST | `/rooms` | 创建房间 `{roomId, name?, members[]}` |
| GET | `/rooms/:id/members` | 房间成员 |
| POST | `/rooms/:id/join` | 加入房间 `{userId}` |
| POST | `/rooms/:id/leave` | 退出房间 |
| POST | `/message` | 发消息 `{from, to?, room?, body}` |
| GET | `/inbox/:id` | 收件箱（`?unread=1` 只看未读） |
| POST | `/inbox/:id/read` | 标记已读 `{seqs?}` |
| GET | `/stats` | 社交统计 |
| GET | `/distance/:a/:b` | 六度分隔计算 |
| GET | `/suggestions/:id` | 好友推荐 |
| GET | `/topology` | 图结构导出（给可视化用） |
| GET | `/export` | 完整状态序列化 |

#### SSE 实时流

```
GET /stream/:userId
```

浏览器用 `EventSource` 连接，实时收到：
- `hello` — 连接确认
- `message` — 收到新私信
- `connected` / `disconnected` — 好友关系变化
- `room-created` / `room-joined` — 房间动态
- `presence-changed` — 在线状态变化
- `user-joined` / `user-left` — 用户进出

```js
const es = new EventSource('http://127.0.0.1:7300/stream/alice')
es.onmessage = (ev) => {
  const data = JSON.parse(ev.data)
  console.log(data.type, data)
}
```

### `ati-core/memory` — 记忆系统（v0.6 新增）

| 方法 | 层 | 说明 |
|------|:--:|------|
| `remember(key, value)` | 短时 | 会话内存储，LRU 淘汰 |
| `recall(key)` | 短时 | 读取（自动计数读取次数） |
| `memorize(key, value)` | 长时 | 持久化到 JSON 文件，带版本号 |
| `recollect(key)` | 长时 | 跨会话读取 |
| `recallPattern(pattern)` | 长时 | 模糊检索（key 或 value 包含 pattern） |
| `promote(key)` | 升级 | 把短时记忆提升为长时 |

### `ati-core/planner` — 工作流规划器（v0.6 新增）

```js
const planner = new Planner({ memory })
planner.registerCapability('my-op', 'nn', new NnOperator({ model }))

const entry = await planner.executePlan('描述目标', {
  nodes: [{ id, type, capability? }],
  edges: [{ from, to }],
}, input)
// → { planId, output, trace, score, graph }
```

- **蓝图驱动**：声明式 JSON 定义拓扑，自动生成 Graph + Operators
- **能力注册表**：`registerCapability(id, type, operator)` 复用已注册算子
- **自动评分**：无错误 + 有输出 = 高分（0~1）
- **最佳模式提取**：`bestPatterns(minScore)` 返回历史高分拓扑供复用

### `ati-core/feedback` — 自我反馈 + 拓扑微调（v0.6 新增）

```js
const fb = new FeedbackLoop({ learningRate: 0.1 })

// 每次执行后记录结果
fb.record({ planId, graph, score }) // → { adjustments[] }

// 边信任度（指数移动平均：好→提升，差→降低）
fb.edgeScore('a', 'b')     // 0.0 ~ 1.0
fb.weakestEdges(3)          // 最弱的 N 条边 → rewire 候选

// 基于反馈自动剪枝低信任边
const { graph: adjusted, actions } = fb.adjustTopology(originalGraph)

// 学习趋势
fb.trend() // 'improving' | 'declining' | 'stable'
```

### `ati-core/conflict` — 冲突仲裁（v0.6 新增）

```js
const cr = new ConflictResolver()
cr.addGoal('task-a', { priority: 7, resources: ['cpu', 'net'] })
cr.addGoal('task-b', { priority: 5, resources: ['cpu'] })

cr.detectConflicts() // [{ resource:'cpu', contenders:[...] }]
cr.hasConflicts()    // true
cr.resolve()         // { approved:['task-a'], deferred:[{goalId:'task-b', blockedBy:[...]}] }
```

高优先级先占资源；同级 FIFO；被阻塞的目标进入 `deferred`。

### `ati-core/aci` — ACI 编排器（顶层入口，v0.6 新增）

```js
import { AtiOrchestrator } from 'ati-core'

const aci = new AtiOrchestrator({ persistPath: './ati-memory.json' })

// 注册能力
aci.registerCapability('sense', 'sensor', new SensorOperator({ source }))
aci.registerCapability('reason', 'nn', new NnOperator({ model }))
aci.registerCapability('act', 'actuator', new ActuatorOperator({ actuate }))

// 完整思考循环
const result = await aci.think(
  'goal-id',
  '目标描述',
  { nodes: [...], edges: [...] },
  input,
)
// → {
//   status: 'completed' | 'failed' | 'deferred',
//   output, trace, score,
//   feedbackAdjustments,     // 本次反馈调整了哪些边的权重
//   suggestedTopologyActions,// 建议的拓扑修改
//   pastSimilarPlans,        // 记忆中找到的类似历史
//   trend,                   // 学习趋势
// }

// 自我认知摘要
aci.selfModel()
// → { cycles, plansExecuted, averageScore, trend,
//     strongestEdges, weakestEdges,
//     memoryStats, conflictStats }
```

---

## 运行测试

```bash
cd ati-core
node --test test/*.test.js
```

当前 **145 tests / 0 failures** ✅（含 21 个 HTTP/SSE 集成 + 20 个 ACI 闭环测试）

---

## 下一步计划（按分层顺序）

1. ~~数学框架核心~~ ✅
2. ~~拓扑抽象层强化（类型系统 + 动态结构 + 校验器 + 事件流）~~ ✅
3. ~~算子层 + 图执行器（NN/逻辑/工具/记忆统一协议，混合计算跑通）~~ ✅
4. ~~社交拓扑层（元宇宙原型：person 节点 + 房间 + 消息路由 + 社交距离）~~ ✅
5. ~~接口层（REST + SSE 实时推送，零外部依赖 HTTP 服务）~~ ✅
6. ~~ACI 上层（规划器 + 长短时记忆 + 自我反馈拓扑微调 + 冲突仲裁）~~ ✅

**全部六层已实现。** 下一步方向：
- 把 NnOperator 接入真实 LLM（DeepSeek / OpenAI）
- 把 SocialNetwork 的 bot 节点挂上 AtiOrchestrator，让 AI 真正参与社交对话
- 在 dsh-open-world 里可视化 ACI 的 think() 循环
