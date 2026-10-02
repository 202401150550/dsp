# dsh-apiproxy-compat

Desktop **2.0.4**（`dsh-base` / `dsh-api-remotes` **alpha.1**）上，官方 `@deepseek-ai/dsh-host-apiproxy@0.1.0-rc.7` 会从 `@deepseek-ai/dsh-api-remotes` **包根** import `ApiRemoteSessionNotFound` 等符号；alpha.1 根入口默认不再导出它们，插件加载失败，task-board 一直等 `ctx.apiProxy`。

本包用 `sessionController` + `workspaceRegistry`（+ 可选 `sessionQuery` / `agentPresets`）提供 **最小** `ctx.apiProxy`（sessions / workspace / agentPresets），不碰官方 rc。

## 退出条件（满足后再切回官方）

**全部**满足才算可退：

1. **探测通过**：`node D:/dsp/dsh-desktop-toggle/probe-apiproxy.mjs` → `recommendation: switch-to-official`
2. **无需 DSP 补丁**：`dsh-api-remotes/lib/index.js` **没有** `DSP-PATCH: api-remotes agent-lookup`，且官方 apiproxy 所需符号仍能从包根解析；**或** 新版 `dsh-host-apiproxy` 已改 import 路径，不再依赖这些根导出
3. **版本线索（辅助）**：Desktop / `dsh-api-remotes` 高于当前 `2.0.4` / `0.1.2-alpha.1`，且发行说明提到 apiProxy / remotes 对齐（探测通过优先于版本号）

## 切换步骤

```powershell
# 1) 必须先绿
node D:/dsp/dsh-desktop-toggle/probe-apiproxy.mjs

# 2) 关兼容、开官方（互斥）
node D:/dsp/dsh-desktop-toggle/apply.mjs set apiproxy-compat false
node D:/dsp/dsh-desktop-toggle/apply.mjs set host-apiproxy true

# 3) 完全退出并重开 DSH Desktop
# 4) 确认任务看板可创建/跑任务（ctx.apiProxy 在线）
```

若官方仍挂：立刻 `set host-apiproxy false` + `set apiproxy-compat true` 并重启。稳定一周后可归档本目录。

## 不要做的事

### 2026-10-01：命令确认安全边界

- 普通 prompt 的 `{ accepted: true }` 仅代表接收，不代表执行完成。
- 兼容层不再为斜杠命令合成 `command.kind=success`；在调用控制器前返回 `compat/command-unsupported`，不会将其当成模型提示词提交。
- 因此带 `task.permission` 的旧任务会明确失败，直到接入并验证当前权限控制接口。这不是任务插件整体兼容验收通过。
- 离线回归：`node --test prompt.test.mjs`，全部使用替身，不操作生产 Session。
- 已启动 Host 需要重新加载后才会采用源码变更；重新加载和任务插件启用必须另做验收。


- 不要同时启用 `apiproxy-compat` 与 `host-apiproxy`（两个 `apiProxy` Service）
- 不要为了开官方而长期依赖 `patch-api-remotes-exports.mjs`——那是权宜之计，不是退出
