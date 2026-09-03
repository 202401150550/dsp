# 生产神经 RRA · L6 起（仓外）

> 状态：**L6 / M2** · `implemented: false` · `fullNeuralRra: false`  
> OW 仍 **probe-only**，禁止 `memory.neural=true`。

## 目标

可训、可持久的压缩 KV 银行，最终支撑因果在线的 Reciprocal-Resolution Attention。  
本阶段只交付**可证伪脚手架**，不宣称生产完成。

## 里程碑

| 编号 | 内容 | 状态 |
|------|------|------|
| **L6 / M0** | `kv-bank`：训 → 存 → 载 roundtrip | ✅ |
| **M1** | 存 raw/pooled 快照，银行内可继续训 | ✅ |
| **M2** | 长上下文字节匹配 ≥ L4 且压缩码可热读 | ✅ |
| **M3** | 严格在线因果 + 与 RoPE 读一致的 apply 草图 | 未开（仍抛错） |
| **M4** | OW 可选挂载（默认关）真实 apply | 未开 |

## 命令

```powershell
cd D:\dsp\rra-proto
npm test
npm run gate:l6
npm run gate:m1
npm run gate:m2
```

## 禁区

- 不在 OW 界面暗示「神经记忆已启用」
- `applyReciprocalResolutionAttention` 在完整实现前**恒抛错**
- 不把壳层 RRM `falsify` 说成神经质量
- M2 热读有界 ≠ 胜过精确窗口 / 完整 RRA
