# 神经 RRA — 大行李契约（未实现）

> 状态：**`implemented: false`**  
> 代码占位：[`bridge/rra-neural.stub.mjs`](./bridge/rra-neural.stub.mjs)  
> 壳层已实现：[`RRM.md`](./RRM.md) · `ow-rrm/0.1`

本文只定**边界与证伪门槛**。不在此交付可训权重、假 KV、假 attention 曲线。

---

## 1. 完整版目标（尖刀）

**Reciprocal-Resolution Attention**：推理/训练时对历史 KV 按时间距离做幂律降分辨率（精确 / 压缩 / 地标），压缩态可读写、可训，且与位置编码（尤其 RoPE）自洽。

壳层 RRM 只解决「世界记忆怎么分层存与展示」；神经 RRA 解决「模型注意力怎么真降分辨率」。

---

## 2. 禁区（写进 stub，测试锁死）

| 禁止 | 原因 |
|------|------|
| 返回随机/手写 attention 权重冒充已实现 | 误导主人与评测 |
| snapshot / UI 把 `neural: true` 打开 | 与壳层证伪字节混淆 |
| 把 `memory.falsify.bytesSaved` 说成神经质量优势 | 那是壳层投影字节比 |
| 在 Desktop Host 热路径偷偷跑「假压缩」 | 破坏 SYSOP 诚实 |

`applyReciprocalResolutionAttention(...)` **必须抛错**，直到真实运行时接入。

---

## 3. 仓库边界（真开时）

| 层 | 位置 | 职责 |
|----|------|------|
| 壳 | `dsh-open-world/` | 只消费 `describeNeuralRra()`；不训练、不持权重 |
| 原型（未来） | 建议 `D:/dsp/rra-proto/`（独立包） | 可训原型 + 字节匹配评测 + 日志 |
| 桥 | stub → 将来换成薄适配器 | `protocol` 从 `rra/0.0-stub` 升到 `rra/0.1-proto` 才允许 `implemented` 讨论 |

**不要**把训练循环塞进 `dsh-open-world/index.js`。

---

## 4. 接口契约（当前 stub 已声明形状）

调用方（未来推理运行时）传入：

```text
ApplyRraInput
  q            — 当前 query 态（不规定具体张量库）
  k_layers     — 分层 KV：exact | compressed | landmark
  positions    — 与 RoPE 对齐的位置元数据
  cfg          — { alpha, tau_tokens 或等价距离, byte_or_token_budget }
  causal       — 必须 true（禁止偷看未来）
```

合法实现应返回：

```text
ApplyRraOutput
  context      — 供后续层使用的上下文态
  meta.tiers   — 各层 token/字节占用
  meta.protocol — 如 rra/0.1-proto
  falsify      — 与「同字节固定窗口」对照的评测钩子（可选）
```

未实现时：抛 `RRA neural path not implemented`。

---

## 5. 开工阶段（证伪优先）

| 阶段 | 交付 | 通过门槛 |
|------|------|----------|
| **L0**（契约） | 契约文档 + stub 形状 + 测试锁 `implemented:false` | ✅ |
| **L1** | `rra-proto` + 字节匹配基线脚本（无训练） | ✅ |
| **L2** | 最小可微压缩读写 + RoPE 位置一致性单测 | ✅ [`../rra-proto`](../rra-proto) `src/rope.mjs` · `src/compress.mjs` |
| **L3** | 短序列过拟合 + 在线因果检查 | ✅ [`../rra-proto`](../rra-proto) `npm run gate:l3` |
| **L4** | 长上下文字节匹配评测 vs 固定窗口 | ✅ [`../rra-proto`](../rra-proto) `npm run gate:l4` |
| **L5** | 薄适配器挂回 OW stub（仍默认关） | ✅ `bridge/rra-adapter.mjs` · `rra.probe` 默认 `false` |
| **L6** | 可持久压缩 KV 银行脚手架 | ✅ `rra-proto` `kv-bank` · [`PRODUCTION.md`](../rra-proto/PRODUCTION.md) |
| **M1** | raw/pooled 快照 + 断点续训 | ✅ `npm run gate:m1` |
| **M2** | 长上下文热读 + 字节对照（≥L4 门禁） | ✅ `npm run gate:m2` |
| **S1** | 冻结骨干适配训练（玩具尺度） | ✅ `npm run gate:s1` |
| **M3** | 严格在线因果 + RoPE 一致 apply 草图 | ✅ `npm run gate:m3`（正式 apply 仍抛错） |
| **M4** | OW 可选 `rra.sketch` 挂载草图（默认关） | ✅ `tryApplyRraSketch` · 仍非完整 RRA |

未显式打开且未完成生产级实现前，禁止在 OW 界面暗示「神经记忆已启用」。L5 探测 ≠ 启用。L6/M4 脚手架 ≠ 完整 RRA。

---

## 6. 与壳层 RRM 的关系

```text
主人可见世界记忆 ──► ow-rrm/0.1（已实现）
模型内部 KV 降分辨率 ──► 神经 RRA（大行李，未实现完整版）
L1–L6/M4 原型 ──► dsp/rra-proto + OW 可选探测/草图适配器
```

二者可共享「距离 → 分辨率」叙事，**数字不可直接等价**。

---

## 7. 下一刀（生产）

仓外 `rra-proto`：**M4 已开**（OW `rra.sketch` 默认关）。玩具对打：`gate:beat`、`gate:beat-eq`、`gate:beat-eq-noslot`（=no-slotMod+imitate；旧名 content）、`gate:true-random-ceiling`、`gate:s1-weight`、`gate:m5-rope`（RoPE→readAt + 权重闭环 + dim32/64/128）；详见 [`PRODUCTION.md`](../rra-proto/PRODUCTION.md)。下一刀是**真解码器权重 / 更大真实 dim**；完成前 `applyReciprocalResolutionAttention` 仍抛错。  
OW 保持 probe-only；sketch ≠ 启用神经记忆。
