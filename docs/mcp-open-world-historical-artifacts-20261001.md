# Open World 第二批：历史产物入口兼容修复

日期：2026-10-01

## 本轮结论

已移除 better-sidebar 对会话产物行的旧接口拦截，并重新构建、正常重启 Desktop。当前页面重载复测没有再捕获到 `SidebarProducedFiles / matched.slice` 报错。文件产物行交还官方组件处理，保留独立的工作区文件打开拦截，不用空数组吞掉产物。

**仍不等于“世界内历史产物全链路已经完成”。** 本轮另沿桌面文件列表打开了现有 `D:/dsp/dsh-architecture.html`，实际预览显示了架构图；该入口修复前也能打开，因此不能把它记作本轮修好的历史产物入口。Open World 内从历史会话定位产物、打开并返回的完整链路仍待实现和验收。

## 最终验证结果

| 验证 | 结果 |
|---|---|
| 插件 bundle | 成功，退出码 0 |
| TypeScript 检查 | 通过，退出码 0 |
| 产物注册、路径处理、文件打开专项 | 4 套件、19 项通过 |
| Open World 既有界面回归 | 21/21 |
| 数据和模型保持检查 | 9/9 |
| 当前页重载错误捕获 | 旧产物行错误由 4 条降至 0 条；本次捕获其他错误也为 0，不代表所有会话无错误 |
| 侧栏全量回归 | **893 通过、14 失败、12 跳过，另有 1 个未捕获异常** |

全量 93 个套件中 85 通过、7 失败、1 跳过。未通过部分涉及浮窗菜单拖动、Windows 符号链接权限、PTY 信号/等待、Git 集成/历史假设与打包测试的 tar 路径。**既包含测试环境/平台限制，也包含尚需排查的行为问题，不能统一归咎于环境。**

本轮修复可用，不等于整个侧栏通过发布验收。未执行发布、安装官方包或合并 main。

## 实际改动

插件仓库 `D:/dsp/dsh-better-sidebar`，分支 `fix/turn-tail-deliverables-20261001`：

- `src/client/index.tsx`：取消旧 turn-tail 拦截的注册；不改官方插件。
- `tests/native-deliverables.spec.ts`：防止重复注册复发，同时确认独立文件打开注册保留。
- `scripts/test.mjs` 和 `package.json` 的 test 命令：统一 Windows 盘符大小写，避免 Vitest 出现两个模块身份、无法找到 runner/suite。
- `lib/`：使用项目原有 bundle 命令重新生成。客户端 SHA-256：`6ee56c65e0ab54043887ccabe7a66061188ba2583c50df3410dbcbf7091b298e`。

既有脏改动保留，没有整体回退、重置或提交他人改动。没有合并 main；本机没有 `gh`，PR 尚未创建。

## 依赖与测试过程中的真实问题

1. 起初 `react-icons`、`mermaid`、多个编辑器依赖无法解析，构建失败。
2. 单独安装图标依赖遇到 peer 版本冲突；隔离安装仅解决图标，不足以完成整个构建。
3. 最终在插件目录重建开发依赖，禁用安装脚本、不保存 manifest 依赖版本、不重写 lockfile。使用 legacy peer 解析，日志记录新增 8、移除 1、变更 207 个依赖包；这不是官方桌面升级。
4. 原始 `npm test` 在收集阶段 93 个套件全部失败、没有执行用例。依赖补齐后仍复现；把 Windows 路径统一为 `D:/...` 后，新测试通过，进一步将修复写入测试启动器。
5. 首轮完整回归仍有失败与 worker 异常，随后用两个 worker 复跑。没有删除失败测试或把全量回归写成全绿。

## 界面与数据核对

- Open World 的构建仍为 `b90c1ba3f3` / v2.78；本轮不虚增版本号。
- 世界内既有 21 项行为检查已再次通过。第一次复跑按摘要查找测试记录失败；记录仍在，但最新摘要已变化。改为按稳定 thread ID 定位，并等待列表出现后通过，没有删除或改写那条记录。
- 现有架构 HTML：预览 iframe 可见、预览内容 72,604 字节，并查看截图确认不是空白。这是桌面原生预览，不是世界内预览，也没有验收其中的导出菜单。
- 保持检查 9/9：104 个 Session、运行中 0、原验收回答保留、模型/provider 不变、5 条历史任务保留且停用。
- 正常关闭前检查运行状态；本轮未强杀 Desktop。曾出现 CDP 端口不可达，之后正常启动恢复；不据此猜测退出原因。
- 没有在真实会话发送新 Agent prompt，没有执行历史任务、回退、恢复或删除历史内容。

## 未完成项与后续顺序

1. **世界内历史产物全链路**：按真实会话的产物元数据组织入口；不以桌面文件树或新附件测试替代。
2. **世界内问答闭环**：世界窗口对应专属 Session，回复回到同一窗口。
3. **回退兼容性**：旧 `order` 字段问题本轮未改；当前页没有捕获到它，不代表所有历史会话均已修复。
4. **全量侧栏回归失败**：区分平台/测试环境问题与实际布局缺陷，逐项处理，不作为已通过功能交付。
5. **具体失败 URL**：仍需沿实际链接复现；本轮没有验证所有外部网址。

## 证据位置

相对 `D:/dsp/_scratch`：
- `sidebar-live-before.json`、`sidebar-live-after.json`：实际页面异常捕获。
- `sidebar-native-bundle-final.log`、`sidebar-typecheck.log`。
- `sidebar-tests-targeted.log`、`sidebar-tests-canonical.log`、`sidebar-tests-final.log`。
- `sidebar-native-close.log`、`sidebar-native-relaunch.log`。
- `sidebar-reopen-before.json`、`sidebar-reopen-after.json`、`sidebar-preview-check.json`、`sidebar-historical-preview.png`。
- `sidebar-world-regression.json`（首次失败）、`sidebar-world-regression-final.json`（21/21）。
- `sidebar-data-preserved.json`、`sidebar-route-health.json`。

## 全量回归仍失败的用例

- `tests/agent-pty.spec.ts > AgentPtyRegistry > waitFor returns found when the needle is already in the transcript`
- `tests/free-window.spec.tsx > free windows: the window > a pointerdown on the portaled header menu must not start a header drag`
- `tests/fs-operations.spec.ts > writeWorkspaceUpload > refuses upload directories and targets that resolve outside the workspace`
- `tests/git-worktree.spec.ts > linked Git worktrees > discovers dirty linked checkouts and fences selected targets`
- `tests/git.spec.ts > git parsing > discovers and selects direct child repositories under a workspace directory`
- `tests/market-manifest.spec.ts > DSH community-market manifest compatibility > declares no install lifecycle scripts in the PACKED manifest (the published surface)`
- `tests/smoke.spec.ts > host plugin smoke > runs git status/log/branches against this repository`
- `tests/smoke.spec.ts > host plugin smoke > enriches the log (full hash + refs) and renders commit diffs`
- `tests/smoke.spec.ts > host plugin smoke > pages the log lazily with skip/count`
- `tests/smoke.spec.ts > host plugin smoke > pty manager releases the quota on close and respawns after exit`
- `tests/smoke.spec.ts > host plugin smoke > pty manager: exited zombie handles do not consume the quota`
- `tests/smoke.spec.ts > git destructive operations (scratch repository) > discard restores the worktree file from the index (staged changes kept)`
- `tests/smoke.spec.ts > git destructive operations (scratch repository) > revert creates a revert commit`
- `tests/smoke.spec.ts > git destructive operations (scratch repository) > cherry-pick applies a commit from another branch`

另有 Windows PTY `Signals not supported on windows` 未捕获异常。完整日志保留，不删除测试来获取通过率。
