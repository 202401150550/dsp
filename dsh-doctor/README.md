# dsh-doctor（Phase 1a · 带外自救）

不依赖 DSH 界面。卡在 Loading plugins 时用这个。

## 用法

```bat
cd /d C:\Users\admin\Desktop\dsp\dsh-doctor
dsh-doctor.cmd check
dsh-doctor.cmd fix
dsh-doctor.cmd baseline-save
dsh-doctor.cmd baseline-restore --yes
dsh-doctor.cmd launch
dsh-doctor.cmd safe-launch
```

或双击 `safe-launch.cmd`。

## 命令

| 命令 | 作用 |
|------|------|
| `check` | 诊断：hot-yml、违规皮肤 deps、ELECTRON_RUN_AS_NODE、缺 lib |
| `fix` | 删除 hot-*.yml，并把皮肤包写入 market disabled |
| `baseline-save` | 备份 profile 的 package.json / cordis.patch.yml + settings.yaml |
| `baseline-restore --yes` | 从上次 baseline 恢复（先备份当前） |
| `launch` | 清进程 env 后启动 Desktop |
| `safe-launch` | stop → fix → launch |
| `report` | check + 写入 `dsp/_doctor-last.json` |

## 环境变量（可选）

- `DSH_PROFILE_DIR` — 默认 `%USERPROFILE%\.dsh\profiles\desktop`
- `DSH_DESKTOP_EXE` — Desktop 可执行文件路径
