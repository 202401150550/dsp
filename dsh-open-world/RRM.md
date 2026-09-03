# OW Reciprocal Resolution Memory

壳层协议 `ow-rrm/0.1`（已实现）与神经 RRA 占位（未实现）。  
大行李契约：[RRA_NEURAL.md](./RRA_NEURAL.md)

## 行李划分

| 行李 | 内容 | 状态 |
|------|------|------|
| 中 | 三通道投影 + 证伪 + 会话覆盖 + archives + **尾预览** | `bridge/rrm-memory.mjs` |
| 小 | MemoryBrief 最近归档标题；大文件只扫末尾 64KB；双通路诚实 | Host + Client |
| 大 | 可训练 Reciprocal-Resolution Attention | **L6/M2 热读** · 仍 `implemented:false` · `rra.probe` 默认关 |

## API

- Snapshot 字段：`memory`（含 `mailbox` / `tasks` / `compare.channels` / `archives.recent` / `active.source`）
- `memory.neural` 恒为 `false`；`memory.neuralStub.stage` 现为 **L6-M2**（热读脚手架；OW 适配器默认关）
- `config.rra.probe` — 显式探测开关（默认 `false`）
- `GET /api/open-world/rra` — 适配器状态；`?probe=1` 强制深探测
- `GET /api/open-world/memory` — 三通道 + 归档尾预览 + 证伪对照（UI「刷新记忆」主路径）
- `GET /api/open-world/memory/archives?q=` — 本地 RRM 归档末尾扫描（非 Hindsight、非全库索引）
- `GET /api/open-world/memory/search?q=` — **Hindsight** daemon/cache（UI「搜 Hindsight」；与本地归档分路）
- `GET /api/open-world/memory/compare` — 参数对照降级路径
- Host action：`rrm-session-apply` / `rrm-session-clear`（只改 `~/.dsh/open-world/rrm-session.json`，**不写** `open-world.yml`）

## 配置

见 `open-world.yml` → `rrm:`，用户可覆盖 `~/.dsh/open-world.yml`。  
会话覆盖优先级：`rrm-session.json` > yml > 默认。

## 大行李

- L0–L4：契约 / 基线 / RoPE / 因果 / 长上下文对照 — ✅
- L5：OW 薄适配器（`rra.probe` 默认关）— ✅
- L6：可持久 kv-bank 脚手架 — ✅
- M1：raw/pooled 快照 + 断点续训 — ✅（完整 apply 仍未实现）
- 生产级可训 RRA — **未开**（仓外）
- 禁止把壳层 `falsify`、proto 对照分或探测成功宣称为神经已启用
