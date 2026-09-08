# 开放世界 · 主人 5 分钟速查

> Open World 是 DSH 上的 **系统壳**（像任务管理器 + 桌面），不是聊天替代品。  
> 日常对话在 DSH 主界面；壳里只做三件事：**状态 · 动作 · 事件**。  
> 完整规划：[SYSOP_v0.1.md](./SYSOP_v0.1.md) · 验收：[CHECKLIST.md](./CHECKLIST.md)

## 0. 打开前（10 秒）

1. `plugins.yml` 里 `dsh-open-world: enabled: true`
2. 跑过 `dsh-desktop-toggle/apply.mjs`（若你用 profile 链接）
3. **完全退出 DSH → 重开 → Ctrl+Shift+R**
4. 侧栏底部或输入框旁点 **✦**，水印应为 `OPEN-WORLD v2.51`（须与 `framework.version` 一致）

---

## 1. 左栏三页

| 页签 | 看什么 | 常做什么 |
|------|--------|----------|
| **状态** | 健康度、负载、Bridge 芯片、舰队摘要、RRM | 判断「现在稳不稳」 |
| **动作** | 插件、集成、Rewind、IDEA | 点按钮开 task-board / 回退 / 注入 |
| **事件** | 系统事件、社交、消息信箱 | 看「刚才发生了什么」 |

**30 秒验收**：状态页看 health + Bridge → 动作页点一个插件 → 事件页看最新一条。

---

## 2. 中间主视图（按任务选）

| 快捷键 / 操作 | 视图 | 用途 |
|---------------|------|------|
| 默认 | **ATI 统一场** | 点节点 → 壳内应用表面 / 右侧详情 |
| **Ctrl+K** | 命令面板 | 切视图、选节点、开 IDEA |
| 底部视图钮 | Monitor | 看真实 JSON snapshot |
| 底部视图钮 | IDEA Lab | 人格对比 / 前缀注入（不是真换 Agent） |
| 带 **隐喻** 标签 | ATI 实验室子页 | 动画叙事，**不是**真实 ML 训练 |

窗口模式：fullscreen / split / float / minimized（存 `world-state`）。

**日常三步**：左栏看状态 → 动作页点插件/回退，或点中间节点 → 事件页看发生了什么。IDEA / 调试 JSON 在底栏；不必一次全点开。

---

## 3. 和你已开插件的对照

| 插件 | 在 Open World 里怎么用 |
|------|------------------------|
| **task-board** | 点「任务看板」节点 → 壳内表面；创建/运行走 Host API |
| **dsh-rewind-plugin** | 壳内「回退时间轴」；或「聊天里 /rewind」（`preferChat`） |
| **hindsight** | 集成枢纽「搜 Hindsight」；MemoryBrief「搜归档」是本地 RRM，不是同一条路 |
| **dsh-deepseek-usage** | 点「AI 引擎」节点看今日 Token |
| **web-ui-live-stats** | 「实时状态」节点 |
| **ventus-progress** | 舰队面板看子代理 stages；聊天顶栏也有进度条 |
| **better-sidebar** | 聊天区右上角面板（不在 OW 内） |
| **ventus-search** | 输入框 `@` 搜索（不在 OW 内） |
| **archify** | 集成枢纽 → 嵌入架构图 HTML |

---

## 4. Bridge 芯片（状态页）

芯片优先看**实跑 outcome**，其次探针。汇总形如 `nAPI · n降级 · n无`。

| 芯片 | 含义 | 不亮 / 警告时 |
|------|------|----------------|
| 注入 | session `conversation.send` 等 | 先回聊天；仍失败见 toast |
| 回退 | `session.command` / 壳内时间轴 | 用消息旁 ↶；或「聊天里 /rewind」 |
| 任务 | Host `/api/task-board/action` | 查 task-board 是否 online |
| 设置 | 默认关壳 + 广播事件；有 hint 才 DOM | 手动点 DSH 设置 |
| 会话 | `session.open` / `setCurrent` 等 | 勿依赖 DOM 点会话条 |

↻ 可重新检测。`·DOM` / `·陈` / `·败` 是实跑诚实标记。

---

## 5. 三条常用流程

### A. 发广播消息

1. 左栏 **事件** → 消息总线  
2. 写内容 → 发送  
3. 事件页应出现新条目  

### B. 创建并跑任务

1. 中间点 **任务看板** 节点 → 壳内表面  
2. 或 Ctrl+K 搜 task  
3. 表面里创建 / 运行（无嵌入时不会假点 DOM）  

### C. 回退到某锚点

1. 左栏 **动作** → 回退时间轴，或壳内「壳内时间轴」  
2. 点锚点「回退到此」；需要官方斜杠菜单再用「聊天里 /rewind」  
3. **不要**手打 `/rewind @123 both`（会被插件拦截）  

---

## 6. 易踩坑

- 改 `plugins.yml` 后必须 **apply + 完全重启 DSH**
- 改 client 后跑 `npm run build:client`，再**完全退出** Desktop（热刷常仍是旧包）
- ATI 实验室 loss/拓扑 = **隐喻**；健康度 / 插件 online / RRM = **真实或推算**
- 神经 RRA：`rra.probe` 只探测原型，**不等于**已启用；`memory.neural` 恒 false
- DSH 与 LobsterAI **不要同时跑**（task-board 锁冲突）
- `open-world.yml` 里 `space.enabled: false` 时第二屏签发按钮会禁用——属预期

---

## 7. 开发自测

```powershell
cd D:\dsp\dsh-open-world
npm test                 # smoke + bridge + … 
npm run build:client     # 改 client/ 后必跑
npm run test:live        # 需 DSH Desktop；HTTP 403 时自动 CDP（需 --remote-debugging-port=9333）
npm run test:live-cdp    # 直接 CDP 冷启验收
npm run test:live-rra    # RRA 真机；外网 403 时自动 CDP
```

更多协议见 [OWIP_v0.1.md](./OWIP_v0.1.md)；神经契约见 [RRA_NEURAL.md](./RRA_NEURAL.md)；**联调 / action 表**见 [DEVELOPER.md](./DEVELOPER.md)。
