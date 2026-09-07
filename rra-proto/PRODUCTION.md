# 生产神经 RRA · L6 起（仓外）

> 状态：**L6 / M4** · `implemented: false` · `fullNeuralRra: false`  
> OW 仍 **probe-only**（可选 `rra.sketch`，默认关），禁止 `memory.neural=true`。

## 目标

可训、可持久的压缩 KV 银行，最终支撑因果在线的 Reciprocal-Resolution Attention。  
本阶段只交付**可证伪脚手架**，不宣称生产完成。

## 里程碑

| 编号 | 内容 | 状态 |
|------|------|------|
| **L6 / M0** | `kv-bank`：训 → 存 → 载 roundtrip | ✅ |
| **M1** | 存 raw/pooled 快照，银行内可继续训 | ✅ |
| **M2** | 长上下文字节匹配 ≥ L4 且压缩码可热读 | ✅ |
| **S1** | 论文 6.2 冻结骨干适配：学习式压缩器 + 元数据嵌入/logit 偏置 + 逐层门控 + 低秩读出，教师-学生隐藏态匹配，三支配对 + 六支对照 + 三账本 + 因果检查 | ✅（玩具尺度） |
| **M3** | 严格在线因果（逐词元≡分块预填充、注毒/乱序必拒）+ 与 RoPE 读一致的 `applyRraSketch` | ✅（正式 `applyReciprocalResolutionAttention` 仍抛错） |
| **M4** | OW 可选挂载 `tryApplyRraSketch`（`rra.sketch` 默认 false） | ✅（仍非完整神经 RRA） |
| **S1-W** | S1 适配器权重训→存→载→评闭环 | ✅（玩具尺度；`gate:s1-weight`） |
| **S1-B** | S1 权重条目 → `applyRraSketch`（pooled 桥） | ✅（玩具；非 RoPE 互通；`gate:s1-sketch-bridge`） |
| **M5-R** | RoPE rope-then-pool 银行 → `applyRraSketch(readAt)` + 权重闭环 + dim32→64→128 阶梯 | ✅（玩具；`gate:m5-rope`；≠ 真实解码器） |
| **M5-D** | 压缩权重 dim/协议契约护栏 | ✅（`gate:m5-dim`；拒假生产协议；≠ 真解码器） |

## M4 是什么、不是什么

- **是**：`dsh-open-world` 适配器在 `rra.sketch=true` 时可动态调用 `applyRraSketch`；默认关；`memory.neural` / `implemented` / `fullNeuralRra` 恒 false。
- **不是**：生产级 Reciprocal-Resolution Attention；正式 `applyReciprocalResolutionAttention` **仍抛错**。

## M3 是什么、不是什么

- **是**：流式闭合区段 seal 进 KV 银行；分块预填充与逐词元预言机数值等价；`applyRraSketch` 按 exact/compressed/landmark 分层、RoPE 相对读（`readAt`）、因果过滤未来位置；协议标签 `rra/0.10-proto-m3-sketch`。
- **不是**：完整 Reciprocal-Resolution Attention。正式入口 `applyReciprocalResolutionAttention` **恒抛错**直至 M4/生产接入。草图不可在 OW 暗示「神经记忆已启用」。

## S1 是什么、不是什么

- **是**：论文《面向因果 Transformer 的互易分辨率记忆》6.2「阶段 1：冻结骨干网络的适配」的**形状完整**脚手架。
- **不是**：真实模型实验。骨干是 dim=32 的玩具。**S1 全绿 ≠ 神经 RRA 有效**。

## 命令

```powershell
cd D:\dsp\rra-proto
npm test
npm run gate:l6
npm run gate:m1
npm run gate:m2
npm run gate:s1
npm run gate:beat
npm run gate:beat-eq
npm run gate:beat-eq-content
npm run gate:beat-eq-noslot
npm run gate:true-random-ceiling
npm run gate:s1-weight
npm run gate:s1-sketch-bridge
npm run gate:m5-rope
npm run gate:m5-dim
npm run gate:m3
```

## 对打（本机可证明的「超过旧办法」）

```powershell
npm run gate:beat
```

在**极紧预算（1 条记忆槽 + 序列 2048）+ 干扰显著点（trueEvery=3，真点范数略高于干扰）**上，按探针时刻做因果时龄打包 + 远侧重 + 轻量主题 CE + **SCST-REINFORCE（采样 vs greedy）**，学习式互易记忆的远距主题召回聚合 ≥ **0.80**，显著高于 Sliding / Uniform / Fixed-chunk / 未训练互易 / **显著性捷径**；常驻约全量 **<2%**。门禁要求捷径本身 **<0.80**（防送分任务）。  
口径：超过的是本合成任务上的旧办法，**不是**真实模型 SOTA；玩具策略梯度 ≠ 生产 RLHF。

### 等范数对打（并列门禁）

```powershell
npm run gate:beat-eq
```

在**真/干扰同范数**（`salientScale=distractorScale`）+ ≤8 槽上，启用 **槽位模偏置（slotMod）** 与 **显著格点单 token 打包**：可稳定 ≥0.80 召回。  
**诚实限制**：模型主要学的是合成 `trueEvery` 周期结构（哪一类显著槽是真点），不是开放域「只靠内容、无周期线索」的检索；关掉 `slotMod` 后召回回落（消融 ≈0.45）；再压到 e6/e4 种子不稳。oracle（只打包真点）仍说明读出本身够用。与 `gate:beat`（e1 + 范数差）并列，不互相替换。

### 等范数·无 slotMod + 注意力模仿（并列；推荐 `gate:beat-eq-noslot`）

```powershell
npm run gate:beat-eq-noslot
# 旧别名（同脚本）：npm run gate:beat-eq-content
```

语义是 **no-slotMod + attnImitate**（**不是**开放域「内容检索」）。关 `slotMod`，同范数 + 内容 oracle 注意力模仿 + 显著格点打包，预算 ≤12；门禁内含 **无 imitate 消融**（单种子须明显掉召回）。  
**诚实限制**：e8 同配方软顶约 **0.78**（不能锁 3/3≥0.80，故未做易抖负门禁）；仍依赖合成 **周期** `trueEvery`；不得替代 `gate:beat-eq` / `gate:beat`。

### 破周期天花板（负结果门禁）

```powershell
npm run gate:true-random-ceiling
```

`trueRandom` 打散真点后，no-slotMod 与 slotMod 配方召回均须 **<0.70**（证明现配方不是任意位置内容检索）。

### M5-R：RoPE 银行 → readAt 草图（真实尺度第一刀·玩具）

```powershell
npm run gate:m5-rope
```

与 S1 **pooled** 桥不同：压缩走 `compress.mjs` rope-then-pool，apply 带 `model` 走 **readAt**；须与 pooled-only 路径数值有差。门禁另含 **压缩权重存取闭环** 与 **尺度阶梯 dim32→64→128**（冒烟，仍玩具）。**不是**生产 apply / 真解码器。

OW 侧可选：`rra.compress_weights`（或 `tryApplyRraSketch` 的 `compressWeights`）加载同一快照；**dim 必须与 `q.length` 一致**，否则拒绝。加载前走 **M5-D 契约**（协议/形状/禁假生产标签）。默认仍不加载；加载 ≠ 启用神经记忆。

### M5-D：dim / 协议契约（护栏）

```powershell
npm run gate:m5-dim
```

钉死：合法玩具协议、形状、`q.dim` 对齐；拒绝奇数 dim、假 `rra/1.*` / `implemented:true` 快照。**不是**真解码器，只是通向真实尺度时的护栏。

## 禁区

- 不在 OW 界面暗示「神经记忆已启用」
- `applyReciprocalResolutionAttention` 在完整实现前**恒抛错**（草图走 `applyRraSketch`）
- 不把壳层 RRM `falsify` 说成神经质量
- M2 热读有界 ≠ 胜过精确窗口 / 完整 RRA
- S1/M3 玩具尺度结果**不得**表述为与真实模型 / SOTA 的比较
