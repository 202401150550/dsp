# DSH 工作区整体架构与完整规划（v2.77 口径）

> 范围：`D:\dsp` 全工作区  
> 真源：`dsh-open-world` **v2.77.0** / `owip/0.3-draft` / snapshot schema **8**  
> 配套：`dsh-open-world/SYSOP_v0.1.md` · `CHECKLIST.md` · `SHELL_PLAN.md` · `dsh-self/organs.yml` · `capability-registry.yml`  
> 原则：**先收敛可治理，再加能力；Open World 是壳，不是第二套 Agent；RRA 研究轨后置。**

---

## 0. 接下来首先做什么（本周只干这些）

**先别加新能力。** Phase 0 未完成前，不开 Phase 1+ 新功能。

| # | 动作 | 验收 |
|---|---|---|
| 1 | **分类处理 dirty** | `rra-proto/*` 单独实验提交或 stash；`last-apply.json` 进 `.gitignore` 或标为状态快照；嵌套 Git（better-sidebar / ventus-* / dsh-voice）决定 **真 submodule（补 `.gitmodules`）或 vendor 成普通目录**，禁止半截 gitlink |
| 2 | **根目录一键编排** | 根 `package.json` scripts 至少：`test:open-world`、`gate:rra`、`doctor`、`status`（可再加 `preset:bridge`） |
| 3 | **架构事实源对齐** | 本文 + 六层图替换/补充旧 `dsh-architecture.json` 口径；入口链到 SYSOP / CHECKLIST |
| 4 | **离线门禁再跑绿** | `cd dsh-open-world && npm test`；`cd rra-proto && npm test`；`node dsh-doctor/dsh-doctor.mjs check` |
| 5 | **下一技术闭环立项** | **Rewind × Host `fs.write`**：宿主写文件前打 before-snapshot（见 §0.3 / §5.2）——Phase 0 收尾后的 **第一个 Phase 2 切片** |

### 0.1 Phase 0 可勾选执行清单（仍属规划；勾选后再开工）

> 约定：下列任一条未勾，不算 Phase 0 完成。**未完成前禁止开 Phase 1+ 新能力。**

#### A. Dirty 分轨

- [x] **A1** 列出并分类当前 dirty（命令：`git status -sb`）
  - 桶 1：`rra-proto/**` → 已 `git stash push -m "rra-wip Phase0 isolate" -- rra-proto`（`stash@{0}`）
  - 桶 2：`dsh-desktop-toggle/last-apply.json` → 已进 `.gitignore`
  - 桶 3：嵌套库 → 已写 `.gitmodules`（真 submodule）
  - 桶 4：`.zcode/` → 已进 `.gitignore`
- [x] **A2** `.gitignore` 增加：`dsh-desktop-toggle/last-apply.json`、`.zcode/`
- [x] **A3** 根仓干净到「只剩 submodule 内本地脏（不回写 upstream）+ 已说明的 stash」；不以半截 gitlink 交差

#### B. 根目录编排

- [x] **B1** 根 `package.json` scripts 已落地（含 `check:bootstrap`）
- [x] **B2** `npm run doctor`、`npm run check:bootstrap` 退出码 0（2026-09-09 复跑）
- [x] **B3** `scripts/workspace-status.mjs` + `npm run workspace:status`

#### C. 事实源

- [x] **C1** 本文保持 v2.77 口径
- [x] **C2** `AGENTS.md` 入口指向本文
- [x] **C3** `dsh-architecture.json` meta 已注 `superseded_by: ARCHITECTURE_PLAN.md`

#### D. 门禁绿

- [x] **D1** `npm run test:open-world` 全绿（含 pretest check:client）
- [x] **D2** `npm run gate:rra` 全绿（86 passed；玩具尺度）
- [x] **D3** `npm run doctor` → `ok: true`
- [x] **D4** `npm run check:bootstrap` → `ok: true`

#### E. 下一切片纸面签字

- [x] **E1** §0.3 Rewind×Host 草图已阅；实现范围 = `fs.write` only
- [x] **E2** 用例 H1–H5 已定；**行动**须先写测再改 `host-runtime`（等主人开 `P2_SLICE0_ACTIVE`）

---

### 0.2 嵌套 Git 决议（已落地）

**曾况**：根索引 `mode 160000`（gitlink）但缺 `.gitmodules`。  
**现况（Phase 0）**：根目录已有 `.gitmodules`，四库登记为真 submodule：

| 路径 | remote |
|---|---|
| `dsh-better-sidebar` | `https://github.com/omdsh-dev/DSH-better-sidebar.git` |
| `dsh-ventus-progress` | `https://github.com/mmzm0808/dsh-ventus-progress.git` |
| `dsh-ventus-search` | `https://github.com/mmzm0808/dsh-ventus-search.git` |
| `dsh-voice` | `https://github.com/3274375092/dsh-voice.git` |

子模块工作区内的本地脏文件（`package-lock.json` 等）**不**强行提交上游；根仓只认指针。

**否决**：继续维持「有 gitlink、无 gitmodules」。

---

### 0.3 Rewind × Host 设计草图（纸面 · 未实现）

#### 0.3.1 问题

- Rewind 在 `tools/execute` / `tools/post-execute` 对 **写类工具** 做 before-backup，落盘：  
  `~/.dsh/rewind-snapshots/<sessionId>/<anchorSeq>/<callId>.json`  
  字段形态：`CheckpointEntry{ callId, anchorSeq, path, before, time }`（见 `dsh-rewind-plugin` snapshot 类型）。
- `dsh-self/host-runtime.fsWrite` 走 **Node `fs.writeFileSync`**，不经 DSH 工具调度 → **零备份**。

#### 0.3.2 目标 / 非目标

| 要 | 不要 |
|---|---|
| `fs.write` 覆盖已存在文件前留下可恢复 before | 重写 rewind 内核 / Change Ledger |
| dry-run 的 `impactFsWrite` 声明是否会快照 | 本切片覆盖 `shell.run` / `git.commit` |
| 审计带 `snapshot_id` 或等价 callId | 伪造 DSH tool/call 事件骗 UI |
| 与现有 `/rewind … both` 语义兼容或明确「宿主快照另轨可查」 | 备份失败时静默丢数据却假装成功（须策略二选一，见下） |

#### 0.3.3 推荐实现路径（选型）

**首选路径 C′：宿主写入与 Rewind 同构的 before-backup 文件。**

1. `fsWrite` 在白名单解析成功后、写盘前：  
   - 若文件已存在：读全文 → `before = text`  
   - 若文件不存在：`before = null`（创建语义）  
2. 生成 `callId = host-fs-write-<uuid>`；`anchorSeq` 策略：  
   - **P0**：使用单调本地锚（如 `Date.now()` 或 host-session 步进），快照进  
     `~/.dsh/rewind-snapshots/<hostSessionKey>/<anchorSeq>/<callId>.json`  
   - **P1**（可选增强）：若能从 Desktop 注入当前 chat sessionId + 用户消息 seq，则写入同一会话树，使 UI `/rewind` 能一并还原。  
3. 再执行真正 `writeFileSync`。  
4. `impactFsWrite` 增加：`will_snapshot`、`callId`、`path`、`existed`。  
5. 审计：`kind: host.fs.write` + 上述字段。

**备选路径 B**：若 rewind 包导出稳定的 `commitCheckpointEntry` API，则 host-runtime **直接 import 调用**（少一份格式漂移）。开工时先读 `dsh-rewind-plugin/lib` 是否可被外部包依赖；不可则回退 C′。

**否决路径 A**：伪造 tools/execute 事件——耦合脆、易与审批门打架。

**备份失败策略（须在实现 PR 写死其一）**：

- **S1（推荐）**：备份失败 → **拒绝写入**，返回 `error: snapshot-failed`（宿主写可回退优先于「硬写成功」）。  
- S2：备份失败 → 仍写入但审计 `snapshot: skipped` + 高风险告警（更接近 rewind 插件对工具写的行为，但宿主写更危险，不推荐）。

#### 0.3.4 验收用例（先测后改）

| ID | 步骤 | 期望 |
|---|---|---|
| H1 | dry-run 写已存在文件 | `will_snapshot: true`，磁盘未变 |
| H2 | confirm 写已存在文件 | 快照 JSON 存在；内容 = 旧全文；文件 = 新全文 |
| H3 | confirm 写新文件 | `before: null`；文件已创建 |
| H4 | 人为让快照目录不可写 + S1 | **不写**目标文件；返回明确错误 |
| H5 | 从快照手动还原（或调用 rewind restore API） | 字节回到 before |

#### 0.3.5 涉及文件（行动阶段）

- `dsh-self/host-runtime.mjs` — `fsWrite` / `impactFsWrite`  
- `dsh-self/host-agent.mjs` — 审计字段透出  
- 新建：`dsh-self/host-rewind-bridge.mjs`（格式封装，避免 runtime 膨胀）  
- 测试：`dsh-self/test/host-fs-write-snapshot.mjs`（或等价）  
- 文档：本文 §5.2 勾选完成；`organs.yml` host 相关 atom 备注「可 rewind」

---

## 1. 我们要做成什么样子（目标形态）

### 1.1 一句话

把 `D:\dsp` 收敛成一套 **个人可控、可审计、卡死可救** 的 Agent 运行时：对话在 L0，决策在 L1，能力是可插拔器官（L2），执行与策略是不可热换的脊梁（L3/L3b），记忆与市场受治理（L4）。

### 1.2 用户日常应感受到的「完成态」

```text
冷启 Desktop（bridge 档）
  → 聊天秒回，不因记忆插件/大工具表 5/5 重试
  → ✦ 进 Open World：30 秒答三问（状态 / 动作 / 事件）
  → 世界地图进「任务」或「回退」，干完返回壳
  → 宿主写文件可 dry-run、可确认、可被 Rewind 找回
  → UI 卡死 → 带外 safe-launch / baseline 仍能救
  → 不开 Hindsight / OpenViking / 语音 / 全市场，除非门禁通过
```

### 1.3 六层职责（定死）

| 层 | 名称 | 职责 | 可替换 | 禁区 |
|---|---|---|---|---|
| L0 | 对话壳 | 会话、布局、主题槽、输入输出 | 可演进 | 系统壳做成第二聊天 |
| L1 | 认知层 | 模型、多模态、降级链 | 模型可换 | 无降级；装看见图 |
| L2 | 器官插件 | 体验 / 能力 / 运维 / 执行 / Skill / 外部通道 | 可插拔 | 无限堆料；web-ui-all |
| L3 | 宿主脊梁 | 白名单、参数化、确认、预算、审计、组合校验 | **不可市场热换** | 自由拼 shell；工具输出当指令 |
| L3b | 带外恢复 | doctor / safe-mode / baseline / watchdog | 独立于 UI | 医生只活在卡死进程里 |
| L4 | 记忆与治理 | RRM/Hindsight/OV、Skill、策略、回归 | 数据可治理 | 无来源置信度；升级不回归 |

**Open World** = L2 系统壳/控制台（读 snapshot、写 Host/Bridge actions、进世界、Space/Pair 分界）。  
**rra-proto** = 研究行李：`implemented:false` / `fullNeuralRra:false`，无真实 checkpoint 不进 60% 主路径。

---

## 2. 我核对过的真实现状（不是愿望）

| 项 | 事实 |
|---|---|
| Open World | **v2.77.0**；peer local allowlist 含 `space-token-status`；世界包 opt-in 诚实占位（v2.76）；CHECKLIST 主路径大量已勾 |
| 档位 | `active-preset=bridge`：OW + rewind + task-board + ventus-progress + better-sidebar + live-stats + describe-image + archify + apiproxy-compat + image-input |
| 默认关 | hindsight、openviking、remote/ssh/market、voice、super-injector、skin-center、web-ui-all… |
| dsh-self | iteration **9**：运维/对话大量 fused；`host-agent` 已有 catalog / dry-run / confirm / 预算会话 |
| 记忆防护 | 9077 不通拒开 Hindsight；`patch-anchored-bootstrap` 防孤儿 `hindsight_*` 倾倒工具表（已合入） |
| 最大技术缺口 | **`host-runtime.fsWrite` 直写文件，不进 DSH 写工具 → Rewind 漏快照** |
| 仓库形态缺口 | 嵌套 Git 无 `.gitmodules`；`last-apply.json` 与源码混；根目录无统一 scripts |
| RRA | 玩具门禁可绿，生产 apply 仍应被真实 checkpoint 阻塞 |

---

## 3. 插件融合矩阵（优化方向）

原则来自 `organs.yml`：**atom ≠ 市场包；fused 后下一轮搬进自身并关 provider。**

| 能力 | 当前主人 | 档位建议 | 融合/优化动作 |
|---|---|---|---|
| 系统壳 | dsh-open-world | bridge/full | **守 60%**：状态/动作/事件 + 任务/回退世界；L3 隐喻不抢主路径 |
| 回退 | web-ui-rewind | daily+ | **与宿主写闭环**（§5.2）；OW 只 embed + session.command |
| 任务 | web-ui-task-board | bridge/full | 默认第一世界；不重写内核 |
| 运维/开关/医生 | dsh-self + doctor + toggle | always | 继续收编外来 UI 为设置卡；带外 doctor 永远可跑 |
| 文件拖放/流畅流 | dsh-self fused | always | 保持；勿再装重复包 |
| 用量球 | dsh-self（usage-patch） | always | 空 config 已 harden；面板登录路径保持 |
| 子代理进度 | ventus-progress | daily+ | 卫星探测；嵌套 Git 治理 |
| 右侧工作台 | better-sidebar | daily+ | 卫星；同上 |
| 搜索 | ventus-search | daily 可选 | bridge 可关以减负 |
| 看图 | describe-image + enable-image-input | daily+ | 失败显式报错；OCR 与进上下文分路 |
| 长期记忆 | hindsight | **默认关** | daemon 健康门；通了才 set；勿与 OV 同开 |
| 图谱记忆 | openviking* | **默认关** | 禁进 bootstrapTools |
| Pair 手机 | remote-web-ui | 默认关 | 枢纽诚实 offline；与 Space 协议不合并 |
| SSH | web-ui-ssh | 默认关 | 高确认；失败不拖主聊 |
| 市场 | dsh-market / dshmarket | 默认关 | Phase 3：唯一逛装入口 + 权限 manifest |
| 语音 | dsh-voice | 独立里程碑 | mic-input 放弃 Electron；voice 需 build+sherpa 再开 |
| 观测 | live-stats + self observe | bridge | 统一观测入口，避免重复球 |
| ApiProxy | apiproxy-compat | bridge/full | 探针决定是否可退回官方 |
| ATI/叙事 | ati-core / OW L3 | 可选 | 永不标成真实 ML |
| RRA | rra-proto | 研究 only | OW `rra.probe` 默认关 |
| 外部 IM | openclaw.* | Phase 5 | 外发强制确认；失败自动停用 |

**明确不做的堆料**：`web-ui-all`、皮肤中心整包、ventus 全家桶、无 registry 狂加 `/action`、把 Space+Pair 合成一套 token。

---

## 4. 设备与通道矩阵（默认态 / 权限 / 失败降级）

| 设备/通道 | 角色 | 默认 | 权限级 | 失败时 |
|---|---|---|---|---|
| **DSH Desktop** | 主控 L0+L2 壳 | 开 | 全本机白名单（策略内） | safe-launch；禁与 LobsterAI 双开抢 ledger |
| **Web GUI（同 profile）** | 副壳 | 可选 | 同 Desktop，注意热更新 | 以 Desktop 为准 |
| **better-sidebar 终端** | 聊天侧执行面 | bridge 开 | 仍走审批/沙箱；非宿主旁路 | 关插件即降级 |
| **Open World Space 第二屏** | 观察 + peer 白名单回写 | space 可关 | peer allowlist；禁 space-token/pair/idea-inject | 关 space → 按钮禁用 |
| **Pair（remote-web-ui）** | 手机控 | **关** | 独立协议 | 枢纽显示未启用，不假装在线 |
| **SSH 面板** | 远程机 | **关** | L2+ 确认 | 失败隔离，不堵主聊 |
| **OpenClaw IM/邮件** | 外部器官 | 后置 | 外发强制确认；限频；审计 | 连续失败 **自动停用该通道** |
| **本机 Hindsight :9077** | L4 语义记忆 | **关** | 仅 daemon 通可开 | 不通 → apply 拒开 + bootstrap 剥离工具 |
| **语音（sherpa）** | 输入器官 | **关** | 麦克风 | 未 build 不得进 daily |

---

## 5. 实现轨道（怎么落地，落到文件）

### 5.1 Phase 0 — 基线与编排

1. Dirty 分类提交（见 §0）。  
2. 根 `package.json` 增加 scripts，例如：

```json
"scripts": {
  "test:open-world": "npm --prefix dsh-open-world test",
  "gate:rra": "npm --prefix rra-proto test",
  "doctor": "node dsh-doctor/dsh-doctor.mjs check",
  "status": "node dsh-desktop-toggle/apply.mjs list",
  "preset:bridge": "node dsh-desktop-toggle/apply.mjs preset bridge"
}
```

3. `.gitignore`：`dsh-desktop-toggle/last-apply.json`（或移到 `baselines/` 显式快照）。  
4. 嵌套库：二选一写进本文验收——`.gitmodules` **或** vendor 拷贝并删内嵌 `.git`。

### 5.2 Phase 2 切片 0 — Rewind × Host（**最该补的技术闭环**）

**纸面设计见 §0.3（已定路径 C′ + 失败策略 S1 + 用例 H1–H5）。** 此处保留摘要：

**问题**：`dsh-self/host-runtime.mjs` → `fsWrite` 直接 `fs.writeFileSync`；`dsh-rewind-plugin` 只钩 DSH 写类工具 → 宿主写入不可回退。

**实现摘要**：写盘前写入与 Rewind 同构的 `CheckpointEntry` JSON；备份失败则拒绝写入；dry-run/审计暴露 `will_snapshot` / `callId`。

**不做**：重写 rewind 内核；本切片不含 shell/git；不伪造 tool/call 事件。

### 5.3 Phase 1 — Open World 产品化（守成）

以 CHECKLIST v2.77 为真源：冷启 ≤90s、主路径无 Host/OWIP 术语暴露给用户、关任意可选世界壳仍可用、`check:client` 拦未 rebuild、CDP live 作发布门禁。新动作必须进 `framework.actionLayers` + CapabilityRegistry。

### 5.4 Phase 2 — 宿主信任层（完整）

| 能力 | 落点 | 验收 |
|---|---|---|
| 参数化执行 | host-agent + host-runtime 已有骨架 → 扩 schema | 禁 symlink 逃逸用例 |
| dry-run | 已有 → L2/L3 动作强制先 preview | 影响摘要含路径/网络/配置键 |
| 组合校验 | 扩展 `capability-registry.yml`：`reads/writes/side_effects/reversible/conflicts_with/taint_labels` | 「单步合法、组合越界」被拦 |
| 动态风险 | 按对象敏感度 × 来源 × 在场调整 confirm | 同工具不同确认级可测 |
| 升级回归 | doctor + OW test + 危险拦截用例集 | 升权限不得静默放行 |

### 5.5 Phase 3 — 市场治理

`dshmarket` = 唯一逛装入口；与 `dsh-self` 能力唯一主人打通；禁忌包策略层拒绝；安装列出权限/风险/回滚。

### 5.6 Phase 4 — 记忆 / Skill / 模型

记忆分型 + 来源/置信度；Hindsight/OV 健康门（已部分落地）；模型矩阵含延迟/成本/降级；看图失败显式错误。

### 5.7 Phase 5 — 外部通道

OpenClaw 每通道授权表；外发 L2 确认；webhook 签名；失败熔断器官。

### 5.8 Phase 6 — RRA

维持冻结；真实 checkpoint 前禁止生产文案；OW 仅 probe-only。

---

## 6. 前景与突破点（该往哪打）

| 方向 | 为什么值得 | 前提 |
|---|---|---|
| **可证明执行** | 个人 Agent 差异化不在「更多插件」，在「写了能回退、越界能拦、失败能归因」 | Rewind×Host + 组合校验 |
| **系统壳体验** | 60% 用户 5 分钟只用壳三问 + 两世界，心智成本低于插件丛林 | 守 v2.77 主路径，克制 L3 |
| **带外自愈** | Desktop 必卡；doctor/baseline 是存活率 | L3b 永不塞进卡死 UI |
| **受治理市场** | 生态要扩展但不能再踩全家桶 | Phase 3 manifest+签名 |
| **诚实记忆** | 长期记忆是生产力也是超时炸弹 | 健康门 + 置信度，不做「伪神经」 |
| **跨设备观察** | Space peer 白名单已到 v2.77；Pair 后置 | 协议分界不合并 |
| **研究期权 RRA** | 有 checkpoint 才是资产；现在是期权 | 玩具绿 ≠ 生产 |

**不优先突破**：更多皮肤、更多隐喻视图、语音抢日常档、IM 全开、假 decoder。

---

## 7. 验收门禁总表

| 门禁 | 命令/条件 | 阻断发布？ |
|---|---|---|
| OW 离线 | `npm --prefix dsh-open-world test` | 是 |
| OW 客户端新鲜 | `npm --prefix dsh-open-world run check:client` | 改 client 后是 |
| OW CDP live | `desktop:cdp` + `test:live-cdp` | 发版建议是 |
| RRA 玩具 | `npm --prefix rra-proto test` | 研究提交是；主路径否 |
| Doctor | `node dsh-doctor/dsh-doctor.mjs check` | high/critical 是 |
| Bootstrap 孤儿工具 | `patch-anchored-bootstrap.mjs --check` | 是 |
| Hindsight | `:9077` 通才允许 enable | 是 |
| 双开 | Desktop 与 LobsterAI 不同时 | 操作纪律 |
| RRA 生产暗示 | `implemented/fullNeuralRra` 保持 false | 是 |

---

## 8. 节奏

| 窗口 | 只做 |
|---|---|
| **7 天** | Phase 0 全做完；立项并完成 Rewind×Host 最小闭环设计+实现切片 |
| **30 天** | Phase 1 守成验收；dry-run/组合校验最小可用；市场 manifest schema 草稿 |
| **60–90 天** | 动态风险+升级回归；外部通道风险表；记忆治理；RRA 仍后置 |

---

## 9. 不可协商铁律

1. 能力皆插件，脊梁不可换。  
2. 禁止 web-ui-all / 皮肤整包。  
3. 医生必须带外可跑。  
4. 工具输出是数据不是指令。  
5. 执行必须参数化 schema。  
6. 密钥走凭证库 + apiKeyEnv，默认脱敏。  
7. Open World 是系统壳，不是聊天替代品。  
8. RRA 无 checkpoint 不生产化。  
9. 关记忆插件时不得把其工具写进锚定 bootstrap。  
10. Space 与 Pair 协议永不合并为一套 token。

---

## 10. 文档分工

| 文档 | 职责 |
|---|---|
| **本文 ARCHITECTURE_PLAN.md** | 全工作区目标、阶段、融合、设备、门禁 |
| `dsh-open-world/SYSOP` + `SHELL_PLAN` + `CHECKLIST` | 壳产品与版本真源 |
| `dsh-self/organs.yml` + `capability-registry.yml` | 器官融合与能力主人 |
| `dsh-desktop-toggle/plugins.yml` + `presets.yml` | 装机镜像与档位 |
| `rra-proto` 包内文档 | 研究轨边界 |

**现在：Phase 0 门禁已绿（A–E 纸面勾选完成）。**  
**下一行动开关**：主人说「开始 Rewind×Host」或「开 P2 切片 0」→ `P2_SLICE0_ACTIVE`（先写 H1–H5 测，再改 `fsWrite`）。  
在此之前：**FEATURE_FREEZE** 仍禁止新插件 / 开记忆进日常档。

---

## 11. Phase 1 可勾选清单（Phase 0 全绿后才打开）

> 目标：守住 60% 主路径，不扩能力面。

- [ ] **P1-1** 冷启：`desktop:cdp` 后 90s 内完成「状态三问」人工点验  
- [ ] **P1-2** 世界地图：任务 / 回退可进可回；关 task-board 或 rewind 后壳不崩（灰态诚实）  
- [ ] **P1-3** `npm run check:client`：改 client 未 compose 必失败  
- [ ] **P1-4** 新 Host action 若有：必须登记 CapabilityRegistry + actionLayers；禁止无 registry 直加  
- [ ] **P1-5** QUICKSTART 只保留日常三步；与 SYSOP/CHECKLIST 版本号一致（2.77）  
- [ ] **P1-6**（发版）`test:live-cdp` 至少一条 snapshot/shell/coreShell 绿  

---

## 12. Phase 2 可勾选清单（信任层；切片 0 优先）

### 12.1 切片 0 — Rewind × Host（见 §0.3）

- [ ] **P2-0a** 落地 `host-rewind-bridge.mjs` + 改 `fsWrite`（S1 拒写）  
- [ ] **P2-0b** 用例 H1–H5 自动化绿  
- [ ] **P2-0c** `organs.yml` / 宿主文档注明「宿主写可快照」  

### 12.2 切片 1 — 组合校验最小闭环

- [ ] **P2-1a** `capability-registry.yml`（或并行 schema）为至少 3 个高风险能力补：  
  `reads` / `writes` / `side_effects` / `reversible` / `conflicts_with` / `taint_labels`  
- [ ] **P2-1b** host-agent 增加 `plan.validate`：输入多步 tool 列表，输出 allow/deny + 原因  
- [ ] **P2-1c** 固定用例：单步 `fs.write` 合法 + 组合「写后立刻 shell 危险模式」被拒  

### 12.3 切片 2 — dry-run 强制面

- [ ] **P2-2a** 所有 `confirm:true` 工具：UI/chat 路径必须先 `dsh_host_preview`（已有则补测）  
- [ ] **P2-2b** 影响摘要统一字段：`paths[]` / `network` / `config_keys[]` / `snapshot`  

---

## 13. Phase 3 纸面 — 插件权限 manifest 最小 schema（未实现）

每个可安装包（市场或 link）声明一份 `dsh.capability.json`（名称可改，字段先定）：

```json
{
  "id": "web-ui-task-board",
  "bucket": "capability",
  "owner_capability": "task-board",
  "risk": "medium",
  "reads": ["session.tasks"],
  "writes": ["session.tasks"],
  "side_effects": ["ui.mount"],
  "reversible": true,
  "conflicts_with": [],
  "taint_labels": [],
  "requires_confirm_above": "L1",
  "default_presets": ["bridge", "full"],
  "forbidden_with": ["web-ui-all"]
}
```

验收（行动阶段）：`dsh-self` apply/inspect 读到第二份抢同一 `owner_capability` → 拒绝或降级只读卡；`web-ui-all` / skin-center 在策略层直接 forbidden（已有则补自动测）。

---

## 14. 行动开关与冻结声明

| 状态 | 含义 |
|---|---|
| **PLAN_LOCKED** | 规划纸面冻结期（已完成） |
| **PHASE0_DONE** | 根 scripts / gitignore / gitmodules / 门禁复跑绿（当前） |
| **P2_SLICE0_ACTIVE** | 允许改 `dsh-self` 宿主写快照（未开） |
| **FEATURE_FREEZE** | 未开 P2 切片前：禁止新插件、禁止开 Hindsight/语音/市场进日常档 |

当前默认：**PHASE0_DONE** + **FEATURE_FREEZE**（等主人开 Rewind×Host / P2 切片 0）。
