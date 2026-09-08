# rra-proto — 神经 RRA 原型（大行李）

> **阶段：脚手架冻结点（玩具已绿）** · OW 可选 sketch 挂载（默认关）  
> **完整神经 RRA：`implemented: false` / `fullNeuralRra: false`**  
> **下一刀：真实解码器 checkpoint**；无则停新功能。  
> 契约：[`../dsh-open-world/RRA_NEURAL.md`](../dsh-open-world/RRA_NEURAL.md) · **已绿表** [`PRODUCTION.md`](./PRODUCTION.md)

## 阶段

| 阶段 | 状态 |
|------|------|
| L0–L5 | ✅ |
| L6 / M0–M2 | ✅ |
| L6 / S1 冻结骨干适配（玩具尺度） | ✅ |
| **L6 / M3 在线因果 + RoPE apply 草图** | ✅（正式 apply 仍抛错） |
| **L6 / M4 OW 可选 sketch 挂载（默认关）** | **✅** |
| M5-R / M5-D / M6-P / Desktop Live(CDP) | ✅（玩具 / 护栏 / 页内联调） |
| 生产级真实 apply | **阻塞：checkpoint** |

## 命令

```powershell
cd D:\dsp\rra-proto
npm test
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
npm run gate:decoder-pack
npm run gate:m3
```

对打细节与诚实限制见 [`PRODUCTION.md`](./PRODUCTION.md)。

## M3 一眼结论

- 逐词元推入 ≡ 分块预填充（码逐位相等）
- 未来注毒 / 乱序位置必拒
- `applyRraSketch`：exact / compressed / landmark + `readAt` 相对 RoPE；`causal:false` 抛错
- `applyReciprocalResolutionAttention` **仍抛错**（诚实）

## S1 一眼结论（玩具尺度）

- **`gate:beat`**：e1 + 范数差，远距召回 ≥0.80，常驻 ~1.6%
- **`gate:beat-eq`**：等范数 + `slotMod`（学合成周期），召回 ≥0.80
- **`gate:beat-eq-noslot`**（别名 `beat-eq-content`）：等范数 **no-slotMod + 注意力模仿**（e12）；含无 imitate 消融；e8 软顶 ~0.78；破周期见下
- **`gate:true-random-ceiling`**：`trueRandom` 后召回须 <0.70（负结果）
- **`gate:s1-weight`**：适配器训→存→载→评闭环（玩具权重，非生产）
- **`gate:s1-sketch-bridge`**：权重条目 → `applyRraSketch`（pooled；非 RoPE 互通）
- **`gate:m5-rope`**：RoPE 银行 → `readAt` + 权重闭环 + dim32→64→128 阶梯（玩具）
- **`gate:m5-dim`**：压缩权重 dim/协议契约护栏（拒假生产；≠ 真解码器）
- **`gate:decoder-pack`**：解码器权重包契约（结构可开 / 生产 apply 仍拒）

均非开放域 / 真实模型 SOTA。OW：`rra.probe` / `rra.sketch` 默认关；探测 ≠ 启用。
