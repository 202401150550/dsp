# DSH 工作区整体架构与完整规划

> 日期：2026-09-09  
> 范围：`D:\dsp` 全工作区（LobsterAI/DSH 桌面宿主、OpenClaw 外部通道、DSH 插件生态、Open World 系统壳、RRA 原型）  
> 依据文件：`package.json`、`dsh-architecture.json`、`万物即是插件.md`、`dsh-open-world/*`、`rra-proto/*`  
> 验证：`dsh-open-world` 已跑 `npm test`，离线门禁通过。

---

## 1. 总结论

这个工作区不是一个普通应用，也不是单个插件仓库。它正在形成一套 **个人可控行动型助手运行时**：

```text
用户 / 外部 IM
   │
   ▼
L0 对话壳：LobsterAI / DSH Desktop / Web 会话
   │
   ▼
L1 认知层：模型供应商与降级链（文本 / 多模态 / 本地工具结果）
   │
   ▼
L2 器官插件层：体验 / 能力 / 运维 / 执行 / 领域 Skill / 外部通道
   │
   ▼
L3 宿主脊梁：白名单、参数化执行、确认分级、预算熔断、审计、组合校验
   │
   ├─ L3b 带外恢复：doctor / safe-mode / baseline / watchdog
   │
   ▼
L4 记忆与治理：RRM/Hindsight/OpenViking 边界、Skill 沉淀、策略强制、回归
```

**Open World 的正确定位是系统壳 / 控制台**：状态、动作、事件、进世界、跨机观察/受限回写。它不是聊天替代品，也不是第二套 Agent。

**rra-proto 的正确定位是研究型大行李**：脚手架已冻结，`implemented:false` / `fullNeuralRra:false`；没有真实解码器 checkpoint 前，不进入 60% 主路径，不宣称生产神经记忆。

---

## 2. 当前架构现状

### 2.1 已有底座

1. 根 `package.json`：LobsterAI / DSH 桌面宿主，Electron 主入口 `dist-electron/main.js`，Node 要求 `>=24.15.0 <25`。
2. `openclaw.plugins`：钉钉、飞书、QQ、Discord、企业微信、微信、网易系通道、邮件等外部连接器。
3. `dsh`：DSH runtime 版本 `0.1.1-rc.1`，按 mac/win 分发 runtime 包。
4. `dsh-architecture.json`：已有本地 GUI + API Gateway + Agent Runtime + 多模型 Provider + 本地工具/存储的高层图。
5. `万物即是插件.md`：概念总纲，核心公式是「模型编排 + 器官插件 + 宿主脊梁 + 外部插件 + 基线/记忆 + 策略/审计」。
6. `dsh-open-world`：系统壳实现，当前 `v2.75.0`，协议 `owip/0.3-draft`，具备 snapshot/action/space/acl/capability-registry/capability-graph/world-packs/action-layers 等门禁。
7. `rra-proto`：神经 RRA 原型，当前 `0.10.0`，玩具尺度门禁已绿，生产 apply 仍被真实 checkpoint 阻塞。

### 2.2 已验证状态

`dsh-open-world` 的 `npm test` 已通过，覆盖 smoke、bridge、manifest、rrm、fleet、world-state、space-auth、space-acl、capability-registry、capability-graph、world-packs、action-layers 等套件；结论：Open World 当前是工作区里最成熟、最应被当作「系统壳事实标准」的组件。

### 2.3 主要缺口与风险

1. **架构事实源分散**：`dsh-architecture.json` 偏旧，只覆盖 Desktop + Gateway + Runtime + 多模型；没有覆盖 Open World 系统壳、插件治理、外部通道、记忆/RRA 边界。
2. **工作区有未提交改动**：`rra-proto` 多个 bench/src 文件被修改；`dsh-desktop-toggle/last-apply.json` 变更；`dsh-ventus-progress/search` 子模块有改动；`.zcode/` 未跟踪。规划落地前必须先固化基线。
3. **根目录缺少统一编排**：根 `package.json` 没有 workspaces/scripts，插件各自为战，测试、构建、发布缺少一键门禁。
4. **插件治理仍需强制化**：文档里已有铁律，但需要继续落到 manifest 权限、组合校验、dry-run、动态风险、升级回归。
5. **外部通道风险高**：IM/邮件通道属于外部器官，必须默认带授权边界、限频、审计、失败停用，不能拖垮主聊。
6. **RRA 必须保持诚实边界**：玩具门禁绿 ≠ 生产神经 RRA；禁止 UI/文案暗示已启用。

---

## 3. 目标架构

### 3.1 六层职责

| 层 | 名称 | 职责 | 可替换性 | 禁区 |
|---|---|---|---|---|
| L0 | 对话壳 | 会话、布局、设置、输入输出、主题槽位 | 可演进 | 不把系统壳做成第二套聊天 |
| L1 | 认知层 | 语言、规划、写作、多模态、工具选择建议 | 模型可换 | 无降级链；图像失败装看见 |
| L2 | 器官插件层 | 体验、能力、运维、执行、Skill、外部通道 | 可插拔 | 插件无限堆料；web-ui-all/皮肤整包 |
| L3 | 宿主脊梁 | 参数化执行、确认、预算、熔断、审计、组合校验 | 不可被市场热替换 | 模型自由拼 shell；工具输出当指令 |
| L3b | 带外恢复 | doctor、safe-mode、baseline、watchdog | 独立于主 UI | 医生只活在卡死进程里 |
| L4 | 记忆与治理 | RRM/Hindsight/OpenViking、Skill、策略、回归 | 数据可治理 | 记忆无来源/置信度；升级不回归 |

### 3.2 Open World 在目标架构中的位置

```text
Open World = L2 的系统壳 / 控制台
  读：snapshot?view=shell
  写：Host core actions + Bridge actions
  进世界：CapabilityGraph 选默认世界（当前 tasks 第一）
  跨机：Space（观察 + peer 白名单回写）与 Pair（手机控，独立）分离
```

Open World 主路径只回答三问：现在什么状态、我能做什么、刚才发生了什么。其他能力必须 registry 化、可探测、可关闭、可审计。

### 3.3 外部通道在目标架构中的位置

OpenClaw/IM/邮件插件是外部器官，不是脊梁。每个通道必须满足：

```text
授权边界 + 限频 + 数据最小化 + 可关闭 + 可审计 + 失败降级 + token 撤销/轮换 + webhook 签名校验
```

外部 API 连续失败时，自动停用该器官，不允许拖垮本地主聊和宿主执行。

---

## 4. 完整规划

### Phase 0：基线固化与架构事实源统一（最先做）

**目标**：把分散文档收成一份可执行的架构基线，并清理当前工作区风险。

任务：
1. 提交本规划文档，作为后续变更入口。
2. 将现有未提交改动分类：RRA 实验改动、toggle 应用产物、ventus 子模块改动、`.zcode` 计划稿；分别提交或隔离，禁止混入架构基线。
3. 根目录增加统一编排入口：`pnpm`/`npm` scripts 或 `Makefile`/PowerShell 脚本，至少支持 `test:open-world`、`gate:rra`、`doctor`、`status`。
4. 更新架构图：以本文六层为准，替换/补充 `dsh-architecture.json/html` 的旧口径。
5. 建立 `ARCHITECTURE.md` + `PLAN.md` 分工：前者讲结构，后者讲阶段；Open World/RRA 细节仍留在各自包内。

验收：
1. 新架构文档可一键找到。
2. `git status` 不再混入未说明改动。
3. 根目录能跑至少一条聚合测试命令。

---

### Phase 1：Open World 系统壳产品化收敛

**目标**：继续把 Open World 做成 60% 用户 5 分钟可用的系统壳。

任务：
1. 保持 `v2.75` 主路径：状态 / 动作 / 事件 / 进世界。
2. 默认第一世界维持任务看板；第二世界回退；其余世界必须走 CapabilityRegistry + feature flag。
3. 所有新动作先进 `framework.actionLayers` 分层，coreShell 只保留日常动作，高级动作折叠。
4. 继续硬化 CDP live：`desktop:cdp`、`test:live-cdp`、`test:live-rra-cdp` 作为发布前门禁。
5. 文档同步：`QUICKSTART` 只写日常三步；`DEVELOPER` 只写对接/联调；`SYSOP` 管定位；`OWIP` 管协议。

验收：
1. 冷启到世界内首个成功动作 ≤ 90s。
2. 主路径无 Host/OWIP/principal 术语。
3. 关闭任意可选世界后，壳仍完整可用。

---

### Phase 2：宿主脊梁与信任层

**目标**：让系统从「会调工具」升级为「可验证地执行」。

任务：
1. 参数化执行骨架：目录白名单、命令白名单、参数 schema、路径规范化、禁 symlink 逃逸。
2. dry-run 影响摘要：L2/L3 动作执行前说明触碰路径、网络、配置键、失败点。
3. 组合校验器：插件 manifest 增加 `reads/writes/side_effects/reversible/conflicts_with/taint_labels`；执行前校验整份计划。
4. 动态风险分级：按操作类型、对象敏感度、任务来源、用户是否在场、数据污点调整确认级。
5. 审计与归因：每次执行记录 trace、时延、成本、错误码；失败必须带归因候选。
6. 升级回归集：插件升版、宿主升级、策略变更后跑核心能力与危险拦截用例。

验收：
1. 至少一条「单步合法、组合越界」被计划校验器拦住。
2. 至少一个 L2/L3 动作先 dry-run 再执行。
3. 超 `max_steps` 或无进展自动熔断并进入只读。
4. 插件升版多要权限时，回归集失败或要求确认，不静默放行。

---

### Phase 3：插件治理与市场秩序

**目标**：插件可装、可关、可审、可退，不再靠自觉。

任务：
1. 插件分桶落入 manifest：experience / capability / ops / execution / cognition / external。
2. `dshmarket` 作为唯一逛装入口；重复入口降级或关闭。
3. 市场包准入：权限声明、签名、隔离、冒烟、风险表。
4. UI 挂载规范：设置卡三槽 / `shell.overlay`；禁止 body 直挂挤侧栏；外来包由 `dsh-self` 收编。
5. 默认禁用：`web-ui-all`、皮肤中心整包、重复观测入口、空壳通知类插件。

验收：
1. 违规 profile 在策略层被拒绝或降级 safe-mode。
2. 同一能力只有一个主入口。
3. 市场安装一个包后，能列出其权限、风险、回滚方式。

---

### Phase 4：记忆、Skill 与模型治理

**目标**：记忆可治理，Skill 可复用，模型能力边界诚实。

任务：
1. 记忆分型：会话、事件、任务、长期事实、Skill 沉淀分开存。
2. 每条记忆/Skill 带：内容、来源、置信度、创建时间、最后验证、可删除。
3. Hindsight/OpenViking 不默认同开；daemon 不通时不得进入 bootstrapTools。
4. 模型能力矩阵：文本、多模态、工具、成本、延迟、失败降级链。
5. 图像理解失败必须显式报错；OCR 路径与图像进上下文路径分开。

验收：
1. 记忆可检索、可废弃、可审计。
2. 自动沉淀 Skill 至少一次成功验证后才复用。
3. 模型切换时按 inputModalities 校验，禁止纯文本模型假装读图。

---

### Phase 5：外部通道与合规边界

**目标**：把 IM/邮件/外部 API 纳入外部器官治理，而不是无限放大权限面。

任务：
1. 为每个 OpenClaw 通道补授权边界表和风险表。
2. 默认先内后外：能用本机/DSH 器官就不动微信级权限。
3. 外发消息强制 L2 确认；群发/公开发布更高确认或禁止。
4. webhook/回调校验签名；token 支持撤销与轮换。
5. 外部 API 连续失败自动停用该器官并告警。

验收：
1. 任意外发动作都有审计记录。
2. 任一通道失败不会阻塞本地主聊。
3. 第三方 ToS 风险在接入前写入风险表。

---

### Phase 6：RRA 研究轨（保持后置）

**目标**：保留研究通道，但不污染主产品路径。

任务：
1. 维持 `rra-proto` 冻结：无真实 checkpoint，不新增玩具门禁、不扫超参、不做假 decoder。
2. OW 仅 probe-only；`rra.sketch` / `compress_weights` 默认关，且不等于启用神经记忆。
3. 若未来获得真实解码器 checkpoint，再开 Phase R1：权重包校验、真实 apply、因果/预算/回归门禁。
4. 所有 UI/文档继续禁止 `memory.neural=true` 暗示。

验收：
1. `implemented:false` / `fullNeuralRra:false` 保持。
2. `applyReciprocalResolutionAttention` 在无 checkpoint 时仍抛错。
3. 任何 RRA 文案都区分玩具尺度、合成任务、真实模型。

---

## 5. 优先级与节奏

### 未来 7 天

1. 固化基线：提交本规划，分类处理未提交改动。
2. 根目录增加聚合测试/状态脚本。
3. 更新架构图与文档入口，统一到六层模型。
4. 跑 Open World 全量离线测试 + 一次 CDP live 验收。

### 未来 30 天

1. 完成 Phase 1 Open World 产品化收敛。
2. 落 Phase 2 的 dry-run + 组合校验最小闭环。
3. 市场/插件权限 manifest 最小schema。
4. 建立升级回归集雏形。

### 未来 60–90 天

1. 完成宿主信任层：动态风险、失败归因、升级回归。
2. 外部通道风险表与确认门全覆盖。
3. 记忆/Skill 治理闭环。
4. RRA 只在拿到真实 checkpoint 后进入下一阶段。

---

## 6. 不可协商铁律

1. 能力皆插件，脊梁不可换。
2. 禁止 `web-ui-all`、皮肤中心整包、一次 link 全部皮肤。
3. 医生必须带外可跑，不能只活在卡死 UI 里。
4. 工具输出是不可信数据，不得当成可执行指令。
5. 执行必须参数化 schema，禁止模型自由拼 shell。
6. 密钥优先凭证库 + `apiKeyEnv`，日志/对话默认脱敏。
7. Open World 是系统壳，不是聊天替代品，不是第二套 Agent。
8. RRA 无 checkpoint 不生产化，玩具结果不冒充真实模型结论。

---

## 7. 立即可执行的下一步

建议下一步直接进入 **Phase 0**：

```text
1. 提交本规划文档。
2. 分类提交/隔离当前 dirty changes。
3. 增加根目录聚合脚本。
4. 更新架构图入口。
5. 跑一次 Open World npm test + CDP live。
```

完成后再开 Phase 1/2，不要在基线未固化时继续加新能力。
