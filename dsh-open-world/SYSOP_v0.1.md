# Open World 系统规划 · SYSOP v0.1

> 状态：规划 + 实现对照 · 2026-09-09  
> 运行时：**v2.76** · 协议默认 **owip/0.3-draft** · **产品定稿**：[SHELL_PLAN.md](./SHELL_PLAN.md) · **进世界**：[WORLD_PLAN.md](./WORLD_PLAN.md) · **开发者**：[DEVELOPER.md](./DEVELOPER.md)  
> 配套：[OWIP_v0.1.md](./OWIP_v0.1.md) · [CHECKLIST.md](./CHECKLIST.md) · [QUICKSTART.md](./QUICKSTART.md)  
> 一句话定位：**Open World 是 DSH 这台机器上的「系统壳 / 控制台」——不是聊天替代品，也不是第二套 DSH。**  
> A→B→C、联动改革、**进世界 0–4 + peer 至 request-local** 已落地；神经 RRA 大行李后置。

---

## 0. 为什么用「系统」来讲

主人把 Open World 反过来想成 **Linux / Windows 那样的系统**——成立。

| 电脑系统 | Open World / DSH | 我们做什么 |
|----------|------------------|------------|
| 硬件 + 内核 | DSH Harness、会话、LLM、文件、沙箱 | **不造**——只桥接（L1） |
| 驱动 / 守护进程 | task-board、rewind、hindsight、usage、SSH、ventus-* | **装/关/探测**——不重写 |
| 系统调用 | OWIP：`/snapshot` `/action` Bridge SSE | **定契约、可测**（L2 接口） |
| 壳 / 桌面 | Open World 指挥舱：状态 · 动作 · 事件 | **产品核心**（L2 UI） |
| 壁纸 / 特效 | ATI 隐喻、拓扑动画、NEXORA 视觉 | **可选叙事**（L3） |
| 应用软件 | 日常对话、Agent 写代码 | **仍在 DSH 聊天窗**——OW 不抢 |

验收仍是三问（系统任务管理器的三栏）：

1. **现在什么状态？** → 资源 / 健康 / Bridge  
2. **我能做什么？** → 系统调用 + 已探测动作  
3. **刚才发生了什么？** → 事件日志 + 信箱  

---

## 1. 分层（定死，别混）

```
┌─────────────────────────────────────────┐
│  L3  叙事层 · 「壁纸」                    │  ATI / 拓扑 / 化学 · source=metaphor
├─────────────────────────────────────────┤
│  L2  指挥层 · 「壳 + 系统调用」            │  状态/动作/事件 · OWIP · Bridge
├─────────────────────────────────────────┤
│  L1  宿主层 · 「内核 + 驱动」              │  Harness · 各插件原生 API
└─────────────────────────────────────────┘
```

### 禁区（系统规划里写死）

| 禁止 | 原因 |
|------|------|
| 重做 DSH 对话 UI | 那是「应用」，不是壳 |
| 自研 LLM 路由 / 重写 task-board / rewind | 那是「驱动」，已有主人 |
| 把 metaphor 当真实 ML | 壁纸不能当磁盘 |
| 无 registry 无限加 `/action` | 系统调用表要稳定 |
| 整包 ventus / web-ui-all 替换底座 | 会拖垮 boot（Loading plugins） |

### 允许（系统该做的）

| 允许 | 系统类比 |
|------|----------|
| 探测插件 online / offline | 设备管理器 |
| 聚合 snapshot | `/proc` + 任务管理器 |
| Bridge：API 优先 → DOM fallback | syscall wrapper |
| 消息总线 mailbox | 本机 IPC |
| 左栏三页固定 | 任务管理器三栏 |
| 可选 L3 视图，默认折叠 | 主题包 |

---

## 2. 壳 UI 规划（已部分落地）

### 2.1 左栏 = 任务管理器三栏（定稿）

| 页签 | 系统职责 | 内容 |
|------|----------|------|
| **状态** | 资源监视 | health、负载、Bridge 四灯、集成 chips、星域导航 |
| **动作** | 可调用入口 | 插件、集成枢纽、Rewind、IDEA |
| **事件** | 日志 + IPC | 系统事件、社交、消息信箱 |

默认打开 **状态**。页签记忆 localStorage（`dsh-open-world-left-tab`）。

### 2.2 中间 = 桌面主区

| 视图 | 系统类比 | 优先级 |
|------|----------|--------|
| ATI 统一场（默认） | 桌面图标 / 器官图 | P0 主叙事 |
| Monitor JSON | 调试控制台 / `cat /proc` | P0 诚实数据 |
| IDEA Lab | 用户切换 / 沙箱人格 | P1 |
| Neural / Galaxy | 已移除整页壁纸 | — |
| Topology | 卡片导航 | P2，勿抢主路径 |

### 2.3 快捷键

| 键 | 作用 |
|----|------|
| **Ctrl+K** | 命令面板（跑命令 / 切视图） |
| **✦** | 打开系统壳 |
| **返回聊天** | 退出壳，回应用层 |

---

## 3. 驱动目录（插件 = 驱动）

按「系统要不要管它」分类。OW 只 **探测 + 跳转**，不重写。

### 3.1 内核旁路（always_on / 底座）

| 包 | 角色 |
|----|------|
| dsh-base / dsh-web-app | 内核 + 壳宿主 |
| dsh-self | 能力收编 / 器官契约 |
| dsh-deepseek-usage | 用量传感器 |
| deep-whale-day-night | 系统主题（非 OW 主叙事） |

### 3.2 指挥舱强依赖（L2 必须能答三问）

| 包 | 系统角色 | OW 入口 |
|----|----------|---------|
| web-ui-task-board | 任务调度器 | 节点 / 内嵌面板 |
| dsh-rewind-plugin | 检查点 / 回退 | 动作页时间轴 · session.command |
| hindsight | 长期记忆存储 | 集成枢纽 · memory-search |
| dsh-open-world | 系统壳本体 | ✦ |

### 3.3 外设 / 增强（装了就探测，没装就 offline）

| 包 | 系统角色 |
|----|----------|
| better-sidebar | 资源管理器 + 终端（聊天侧） |
| ventus-progress | 子任务进度条（聊天顶栏） |
| ventus-search | 系统搜索（@） |
| live-stats / ssh / git-graph / archify / remote | 监视器 / 远程 / 图谱 |

### 3.4 明确不装进「系统镜像」

- `dsh-ventus-plugins` 整包、`web-ui-all`、皮肤中心 → boot 风险  
- OpenViking 与 Hindsight 同时开 → 记忆驱动冲突  

---

## 4. 系统调用表（OWIP 核心）

稳定表 ≤10 个 core action；扩展走 registry。

| syscall | 作用 | 层 |
|---------|------|-----|
| `GET /snapshot` | 读整机状态 | L2 |
| `GET /messages` | 读信箱 | L2 |
| `GET /stream` | 事件流 | L2 |
| `GET /rewind/timeline` | 检查点时间轴 | L2 |
| `POST /action send-message` | 本机 IPC 广播 | L2 |
| `POST /action mark-read` | 信箱已读 | L2 |
| `POST /action memory-search` | 查记忆驱动 | L2 |
| `POST /action idea-wrap` | 人格包装（扩展） | 扩展 |
| Bridge `session.command` | 回退等官方 API | L1→L2 |
| Bridge DOM fallback | 无 API 时的兼容 | 降级 |

**规划原则**：新能力优先「注册驱动 + 探测」，再「加 syscall」，最后才「改壳 UI」。

---

## 5. 演进路线（按系统成熟度，不按炫技）

### Phase S0 · 系统身份定稿（本规划）

- [x] 左栏三页落地  
- [x] QUICKSTART / 本 SYSOP 文档  
- [ ] OWIP §0 增加「系统隐喻」对照表（短段，不改协议字段）  
- [ ] CHECKLIST 第一节改成「系统边界」用语  
- [ ] README 开篇用「系统壳」一句话  

### Phase S1 · 壳可用（P0）✅ 2026-08-24

目标：开机稳定、三问可答、syscall 可测。

| 项 | 验收 | 状态 |
|----|------|------|
| DSH 能稳定带上 ventus 三件套 | schemastery 进 dependencies；boot 不因缺包退出 | ✅ |
| live.mjs 绿 | snapshot / action / stream / rewind | ✅ 35/35 |
| Rewind 走 session.command | 不再填 `/rewind @seq` 进输入框被 guard | ✅ |
| Bridge 四灯诚实 | BridgeHealthBar + session-api 策略 | ✅ 代码在 |
| 通知空壳 | `notifications.available=false` 不显示入口 | ✅ gated |
| 左栏三页 | 状态 / 动作 / 事件 | ✅ |
| lab.source | ml/dl = metaphor（重启后） | ✅ |

### Phase S2 · 驱动诚实 + Bridge 硬化（P0/P1）✅ 2026-08-24

| 项 | 系统类比 | 状态 |
|----|----------|------|
| 插件节点 online/offline 与 profile deps 同步 | 设备管理器 | ✅ PLUGIN_CATALOG + status/enabled |
| inject / agent-prompt → session API | 正规 syscall | ✅ conversation.send → prompt → DOM |
| 用量卡片读 deepseek-usage | 电量 / 流量传感器 | ✅ ai-engine 详情余额/Token |
| SSE snapshot-delta 吃满，少轮询 | 内核事件通知 | ✅ 主动 fingerprint + 15s 兜底 |
| Bridge 抽成 `bridge/` 模块可测 | libc 分层 | ⏭ 挪到 S3 |

### Phase S3 · 壳模块化（P1）✅ 2026-08-24

| 项 | 说明 | 状态 |
|----|------|------|
| 拆 `client.js` | `client/modules` + `client/client-main.js` + compose | ✅ bridge/shell/constants |
| `bridge/execute.mjs` 可单测 | Node test/bridge.mjs | ✅ |
| Manifest 注册 Host action | `bridge/manifest.mjs` + `dsh.plugin.json` openWorld | ✅ |
| better-sidebar `registerTab` | NEXORA 摘要 Tab（可选） | ✅ |

### Phase S4 · 不碰（除非主人点名）

- 新 ATI 视图、整包主题替换、第二套对话 UI、自研路由  

---

## 6. 文档与代码的分工

| 文件 | 管什么 |
|------|--------|
| **SYSOP（本文）** | 系统定位、分层、驱动目录、阶段路线 |
| **OWIP** | 系统调用契约（字段、端点、版本） |
| **CHECKLIST** | 每次迭代对照的边界与验收勾选 |
| **QUICKSTART** | 主人怎么用这台系统（5 分钟） |
| **README** | 一页入口 + 链接 |

改产品方向 → 先改 **SYSOP**；改接口 → 先改 **OWIP**；改实现 → 再动代码。

---

## 7. 成功标准（系统级）

开机后 30 秒内：

1. 健康度 + 驱动 chips 可读  
2. 至少一个动作能跑通（任务 / 消息 / 回退之一）  
3. 事件页有最近一条真实事件  
4. 水印版本与 `framework.version` 一致  
5. L3 视图有「隐喻」标签，无人误以为真训练  

达不到 → 优先修壳与 syscall，不加壁纸。

---

## 8. 下一步（征求主人确认后执行）

**WORLD_PLAN 阶段 0–4 已齐 · peer 至 `request-local`→`share-snapshot`（v2.75）**。后续仅在主人点名时做：

1. **扩大 `PEER_LOCAL_REQUEST_ALLOWLIST`**（每次 +1 + 单测）；**不**合并 Pair
2. **真实元宇宙世界包素材**：`all-in-all` 已可进诚实占位（v2.76）；装真实包另议
3. **生产神经 RRA M1+**：`rra-proto` pooled/raw 快照与续训（见 `PRODUCTION.md`）；**不进 60% 路径**
4. **S4（默认不做）**：新 ATI 整页主题 / 第二套对话 UI
