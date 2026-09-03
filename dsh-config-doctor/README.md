# dsh-config-doctor — 已并入 dsh-self（归档）

应用内运维 API 与 UI 已迁到 `dsp/dsh-self`：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/dsh-doctor/check` | 诊断 |
| POST | `/api/dsh-doctor/fix` | 清 hot-yml + 强化市场禁用皮肤 |
| POST | `/api/dsh-doctor/baseline-save` | 保存基线快照 |
| GET | `/api/dsh-toggle/list` | 列出 features |
| POST | `/api/dsh-toggle/set` | 单开单关并 apply |

本目录仅作历史源码备份，**不再写入 desktop profile 依赖**。

卡死时仍用带外：`dsp\dsh-doctor\safe-launch.cmd`。
