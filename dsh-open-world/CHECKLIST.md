# Open World 验收清单（CHECKLIST）

> 配套 [SYSOP_v0.1.md](./SYSOP_v0.1.md) · [SHELL_PLAN.md](./SHELL_PLAN.md) · [DEVELOPER.md](./DEVELOPER.md) · [OWIP_v0.1.md](./OWIP_v0.1.md)  
> 最后更新：2026-09-09 · **运行时真源 v2.75 / owip/0.3-draft** · schema **8** · peer request-local · 神经 RRA **脚手架冻结**

---

## 验证命令

```powershell
npm test                 # 离线门禁（含 space-acl · capability-registry）
npm run build:client     # 改 client/ 后必跑
npm run desktop:cdp      # 完全退出 Desktop 后：带 --remote-debugging-port=9333 启动
npm run test:live        # HTTP 常 403 → 自动 CDP；或 npm run test:live-cdp
```

**冷启**：profile 须与 `CLIENT_VER=v2.75` 对齐；改完完全退出 Desktop 再开。

---

## 一、系统边界（别越界）

- [x] Open World 是 **系统壳**（任务管理器 + 桌面），不是聊天应用——不重做 DSH 对话 UI
- [x] L1 = 内核/驱动，只桥接——不自研 LLM 路由、不重写 task-board / rewind
- [x] L2 = 壳 + 系统调用——聚合、动作、消息、回退、Bridge、WM、舰队优先于视觉
- [x] L3 = 壁纸/特效——ATI / 拓扑 / 化学可保留但不能当「真实能力」卖
- [x] 别做成第二套操作系统——功能无限堆叠会投入产出比崩溃
- [x] 左栏固定三页：状态 / 动作 / 事件
- [x] [SHELL_PLAN.md](./SHELL_PLAN.md) 产品定稿 · [DEVELOPER.md](./DEVELOPER.md) 联调一页

## 二、数据诚实（别误导）

- [x] `lab.*` 是隐喻不是实时 ML/DL
- [x] 必须标 `source` — probe / derived / metaphor / config / mailbox
- [x] UI 上 metaphor 显示「隐喻」标签
- [x] derived 可选标「推算」——健康度 / ATI κ·∇L / evolution
- [x] README 与界面说法一致——「输入来自真实状态，视觉为隐喻」
- [x] 假温度/功耗已改为真实 heap/RSS；不宣称神经 RRA 已启用

## 三、架构与代码（别继续堆单体）

- [x] client 已拆 styles/runtime/app-layout/portal/hooks；OpenWorldApp 仅编排
- [x] 版本号统一——package / plugin / framework / CLIENT_VER = **2.75 / v2.75**
- [x] QUICKSTART / SYSOP / DEVELOPER 与真源对齐
- [x] `GET /api/open-world/snapshot?view=shell` 瘦身；UI 默认 shell URL
- [x] `CORE_SHELL_HOST_ACTIONS` 日常 vs 高级（含 `world-enter`）
- [x] CapabilityGraph + 世界地图（任务/回退）+ 节点灰态（[WORLD_PLAN.md](./WORLD_PLAN.md) 阶段 0–2）
- [x] space.enabled=false 时第二屏签发/打开按钮禁用
- [x] 神经 RRA：OW `rra.probe` 默认关；`implemented` / `fullNeuralRra` 保持 false
- [x] `bridge/capability-registry.mjs` + `capability-graph.mjs`；`resolveEmbedGate` 拦离线 embed

## 四、Bridge 与稳定性

- [x] Bridge inject API 优先；Health 标 **API / 降级 / 无** + 实跑 outcome
- [x] Rewind 走 session.command；rewind-open 默认壳内 embed
- [x] settings：无 hint 纯事件；有 hint 才 DOM
- [x] 通知空壳隐藏——`notifications.available=false` 时不渲染
- [x] live / smoke / live-cdp 覆盖 snapshot · shell · coreShell · 信箱

## 五、集成与插件

- [x] 通知中心未启用就不显示入口
- [x] 枢纽 **Space / Pair 双卡划界**（不合并协议）；Pair 离线诚实提示 plugins.yml
- [x] PLUGIN_CATALOG + CapabilityRegistry 与 plugins.yml 对齐；offline 诚实提示
- [x] IDEA 单入口（左栏打开；完整面只在中区）
- [x] Rewind / 舰队：左栏摘要，完整面仅 embed
- [x] 无在线插件时动作空状态引导；事件空提示
- [x] remote-web-ui / hindsight **默认关**（presets）；枢纽不假装已联动

## 六、接口与安全（owip/0.3-draft）

- [x] 非 loopback 需 Bearer；loopback 默认免 token
- [x] Space principal：`loopback-shell` | `second-screen` | `peer`
- [x] 默认签发只读；`peer`：… / `world-state-get` / `request-local`→`share-snapshot`（`PEER_ACTION_ALLOWLIST` + `PEER_LOCAL_REQUEST_ALLOWLIST`）
- [x] 后置世界包：`worldPacks.source=reserved` · `worlds.packs.all-in-all: false` · 禁空壳 embed
- [x] stream `role=` 与主体匹配；非 loopback 弃用长寿命 `?token=` 作唯一 SSE 凭证（须 ticket）
- [x] `POST /space/peer-action` + 审计事件；禁止 peer 调 `space-token-*` / `pair-*` / `idea-inject`
- [x] outbox 可密封；SSE mailbox + snapshot-delta
- [x] Host action registry；进程外裸 HTTP **不承诺**（常 403 → CDP）

## 七、产品与 UX（阶段 B + 壳定稿）

- [x] **30 秒验收**——状态 / 动作 / 事件三问
- [x] WM：fullscreen / split / float / minimized · world-state
- [x] 快捷操作 3 个：新建任务 · 任务看板 · 回退
- [x] 壳顶用法条（可关闭）· 记忆双页签（本地 RRM | Hindsight）
- [x] 用户常看到旧 UI——水印含 `CLIENT_BUILD`；`npm run check:client` 拦未 rebuild
- [x] 冷启：`desktop:cdp` + `test:live`；水印 `OPEN-WORLD v2.75 · <hash>`
- [x] **60% 路径**：世界地图 → 任务/回退 → 返回开放世界
- [ ] 改完仍须完全退出 DSH + 强刷一次（Electron 缓存）——**操作习惯，非代码债**

## 八、开发与流程

- [x] 单测：`npm test`（含 `test/space-acl.mjs` · `test/capability-registry.mjs`）
- [x] 冷启脚本：`npm run desktop:cdp` · `test:live` / `test:live-cdp`
- [ ] DSH Desktop 与 LobsterAI 不要同时跑——task-board ledger 会锁冲突
- [ ] 改 plugins.yml 后要跑 apply 并完全重启 DSH

## 九、明确「不做」清单（L1 禁区）

- ❌ 自研 LLM 路由
- ❌ 重写 task-board / rewind / **dsh-remote-web-ui** 核心
- ❌ 合并 Space 与 Pair 为单一 token 体系
- ❌ 把 metaphor 包装成真实 ML 指标
- ❌ 继续往 L3 堆视图当主迭代
- ❌ 无 registry 地无限加 /action 种类
- ❌ 未点名就上神经 RRA 或「全写」跨机世界
- ❌ 把壳层 RRM `falsify` 宣称为神经 RRA 已实现
- ❌ 在 stub 返回假 attention / 假 KV 冒充已实现
- ❌ 承诺进程外 HTTP 对 Desktop 恒绿

---

## 执行顺序（历史 + 现况）

```
S0–S3   SYSOP 壳可用 / Bridge / 模块化     ✅
A 门槛  冷启 + 三问 + task online + RRM   ✅
B       WM · world-state · ATI 表面 · 舰队 ✅
C       token · 密封 outbox · SSE 第二屏   ✅（v0.2 只读）
壳定稿  SHELL_PLAN · v2.52 · CDP 冷启      ✅
联动改革 WP0–WP4 · ACL + peer MVP · v2.60  ✅（owip/0.3-draft）
进世界  阶段0–2 · 任务+回退世界 · 节点灰态 · v2.71 ✅
peer+1  阶段3 · memory-search · v2.72 ✅
世界包  阶段4 · all-in-all 接口预留默认关 · v2.73 ✅
peer+1  阶段3续 · world-state-get · v2.74 ✅
peer+1  阶段3续 · request-local→share-snapshot · v2.75 ✅
```

改 Client 源码后跑：`npm run build:client`

---

## 版本号对照表（须一致）

| 文件 | 字段 | 应为 |
|------|------|------|
| dsh.plugin.json | version | `"2.75.0"` |
| package.json | version | `"2.75.0"` |
| index.js `buildFramework()` | version | `"2.75"` |
| index.js framework | protocol | `"owip/0.3-draft"`（space 开）或 `"owip/0.1"`（关） |
| snapshot schema | `version` / `snapshotSchema` | `8` |
| client.js `CLIENT_VER` / `CLIENT_BUILD` | — | `'v2.75'` + compose 哈希；源码占位 `dev` |
| 界面水印 | — | `OPEN-WORLD v2.75 · <build>` |
| 大行李 | RRA | `rra-proto` 脚手架冻结；OW `rra.probe` 默认关；`implemented:false` |
