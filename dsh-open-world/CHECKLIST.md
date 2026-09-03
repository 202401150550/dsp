# Open World 验收清单（CHECKLIST）

> 配套 [SYSOP_v0.1.md](./SYSOP_v0.1.md) · [OWIP_v0.1.md](./OWIP_v0.1.md) · 每次迭代前对照  
> 最后更新：2026-09-03 · **运行时真源 v2.46 / owip/0.2-draft** · schema **8** · 神经 RRA **L6/M2 热读脚手架（OW 适配器默认关）**

---

## 验证命令

```powershell
npm test                 # smoke + bridge + manifest + rrm + fleet + world-state + space + action-layers
npm run test:live        # 需 DSH Desktop 已启动
npm run build:client     # 改 client/ 后必跑
```

---

## 一、系统边界（别越界）

- [x] Open World 是 **系统壳**（任务管理器 + 桌面），不是聊天应用——不重做 DSH 对话 UI
- [x] L1 = 内核/驱动，只桥接——不自研 LLM 路由、不重写 task-board / rewind
- [x] L2 = 壳 + 系统调用——聚合、动作、消息、回退、Bridge、WM、舰队优先于视觉
- [x] L3 = 壁纸/特效——ATI / 拓扑 / 化学可保留但不能当「真实能力」卖；**3D 流形 / 神经网络 / 星系整页已移除**
- [x] 别做成第二套操作系统——功能无限堆叠会投入产出比崩溃
- [x] 左栏固定三页：状态 / 动作 / 事件（任务管理器三栏）
- [x] 系统规划文档 SYSOP_v0.1

## 二、数据诚实（别误导）

- [x] `lab.*` 是隐喻不是实时 ML/DL——loss 曲线/注意力/拓扑轮换多为公式+动画
- [x] 必须标 `source` — probe / derived / metaphor / config / mailbox
- [x] UI 上 metaphor 显示「隐喻」标签
- [x] derived 可选标「推算」——健康度 / ATI κ·∇L / evolution
- [x] README 与界面说法一致——「输入来自真实状态，视觉为隐喻」

## 三、架构与代码（别继续堆单体）

- [x] client 已拆 styles/runtime/app-layout/portal/hooks；OpenWorldApp 仅编排
- [x] 版本号统一——package / plugin / framework / CLIENT_VER = **2.46 / v2.46**
- [x] QUICKSTART 水印/Bridge/回退说明与真源对齐
- [x] space.enabled=false 时第二屏签发/打开按钮禁用
- [x] 神经 RRA 大行李 L0–L4——契约 / 基线 / RoPE / 因果 / 长上下文对照
- [x] 神经 RRA 大行李 L5——OW 薄适配器 `rra.probe` 默认关（探测 ≠ 启用）
- [x] 神经 RRA 大行李 L6——`rra-proto` kv-bank 训/存/载脚手架（完整 apply 仍关）
- [x] 神经 RRA M1——raw/pooled 快照 + `trainFromBank` 断点续训
- [x] 神经 RRA M2——`hotRead` + 长上下文字节对照（`gate:m2`）

## 四、Bridge 与稳定性

- [x] Bridge 靠 DOM scraping 极脆——inject 已 API 优先；探测含 prompt/send；Health 标 **API / 降级 / 无**；session-focus 多路 API
- [x] Rewind 走 session.command——不再 DOM 填 `/rewind @seq`
- [x] Bridge 自检——BridgeHealthBar + session-api 策略；`summarizeBridgeSurface` + 实跑 outcome（settings/panel/remote）
- [x] settings：**无 hint 纯事件**；有 `settingsHint`/`forceDom` 才 DOM
- [x] rewind-open：**默认壳内 embed**；`preferChat` → session.prompt → DOM
- [x] panel：无 selector 时只广播事件
- [x] 任务创建/运行无 embed 时**不点**任务看板 DOM——诚实 toast
- [x] 通知空壳隐藏——`notifications.available=false` 时不渲染
- [x] live / smoke API 测试覆盖 snapshot / action / stream 等

## 五、集成与插件

- [x] 通知中心未启用就不显示入口
- [x] integrations.* / idea.enabled / rrm.* / space.* 在 yml 可解析
- [x] PLUGIN_CATALOG 与 plugins.yml 对齐；offline 诚实提示
- [x] IDEA Lab 是前缀注入不是真换 Agent 预设——按钮「注入消息（前缀）」/「真换 Agent 预设」+ 诚实说明
- [x] Rewind 未安装时时间轴明确提示（howToEnable + 复制说明，勿空白）

## 六、接口与安全（阶段 C）

- [x] 非 loopback 需 Bearer（或 `?token=`）；loopback 默认免 token
- [x] 第二屏：`/space/view` · `/space/second-screen` · stream `role=second-screen`
- [x] outbox 可密封（AES-256-GCM，`space.seal_outbox`）
- [x] 第二屏 token TTL 可选 + 一键吊销/轮换 UI（集成枢纽）
- [x] SSE：mailbox + snapshot-delta；第二屏可推 compact 视图
- [x] Host action registry——Core ≤10，扩展走 registry
- [x] 第三方插件声明式注册（manifest → mergePluginResults）

## 七、产品与 UX（阶段 B）

- [x] **30 秒验收**——状态 / 动作 / 事件三问（门槛曾过）
- [x] WM：fullscreen / split / float / minimized
- [x] 世界存档 `~/.dsh/open-world/world-state.json`
- [x] ATI 节点可进壳内应用表面（含 fleet）
- [x] 进程舰队：session + task-board + ventus（stages / 可用性诚实 · 子代理只读）
- [x] 用户常看到旧 UI——水印含 `CLIENT_BUILD`；Host `framework.clientBuild` 与界面不一致时出过期横幅；`npm run check:client` / pretest 拦未 rebuild
- [ ] 改完仍须完全退出 DSH + 强刷一次（Electron 缓存）；水印须为 `v2.46 · <hash>`

## 八、开发与流程

- [x] 单测：`npm test`（smoke / bridge / manifest / rrm / fleet / world-state / space）
- [x] 不要主动 git commit——除非明确要求
- [ ] DSH Desktop 与 LobsterAI 不要同时跑——task-board ledger 会锁冲突
- [ ] 改 plugins.yml 后要跑 apply 并完全重启 DSH

## 九、明确「不做」清单（L1 禁区）

- ❌ 自研 LLM 路由
- ❌ 重写 task-board / rewind 核心
- ❌ 把 metaphor 包装成真实 ML 指标
- ❌ 继续往 L3 堆视图当主迭代
- ❌ 无 registry 地无限加 /action 种类
- ❌ 未点名就上神经 RRA 或真跨机双向世界
- ❌ 把壳层 RRM `falsify` 宣称为神经 RRA 已实现
- ❌ 在 stub 返回假 attention / 假 KV 冒充已实现
---

## 执行顺序（历史 + 现况）

```
S0–S3   SYSOP 壳可用 / Bridge / 模块化     ✅
A 门槛  冷启 + 三问 + task online + RRM   ✅
B       WM · world-state · ATI 表面 · 舰队 ✅
C       token · 密封 outbox · SSE 第二屏   ✅（只读观察）
```

改 Client 源码后跑：`npm run build:client`

---

## 版本号对照表（须一致）

| 文件 | 字段 | 应为 |
|------|------|------|
| dsh.plugin.json | version | `"2.46.0"` |
| package.json | version | `"2.46.0"` |
| index.js `buildFramework()` | version | `"2.46"` |
| index.js framework | protocol | `"owip/0.2-draft"`（space 开）或 `"owip/0.1"`（关） |
| snapshot schema | `version` / `snapshotSchema` | `8` |
| client.js `CLIENT_VER` / `CLIENT_BUILD` | — | `'v2.46'` + compose 哈希；源码占位 `dev` |
| 界面水印 | — | `OPEN-WORLD v2.46 · <build>` |
| 大行李 | RRA L6/M2 | `rra-proto@0.8` 热读+长上下文；OW `rra.probe` 默认关；`implemented:false` |
