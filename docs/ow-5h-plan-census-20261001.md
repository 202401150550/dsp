# 开放世界 · 五小时自动优化计划 + 指令普查矩阵（2026-10-01）
## 0 · 自动化契约（先说诚实边界）
- 我无法在无人发消息时持续运行；**每阶段 = 你发一次「继续」，其余全自动**（执行→总结→修改→落盘→回归）。
- 全程进度持久化：`_scratch/`（日志证据）+ `docs/`（报告与计划），中断随时续。
- 唯一一次手工步骤：第 5 小时真机轮前，重启 DSH Desktop 带 `--remote-debugging-port=9333`（我会给出确切命令）。其余小时不需要你做任何事。
- 安全红线不变：破坏性指令只在测试沙箱执行，不碰生产数据；不自动 commit。
## 1 · 指令普查矩阵 v1（第 0 小时实测）
**指令词汇表 = 桥类型 18 + OW 动作 14 + 内嵌面板 7**
桥执行层 switch 分发（execute.mjs）：`agent-prompt / close / composer / embed / enter-app / enter-world / idea-panel / inject-message / monitor / panel / remote / rewind-exec / rewind-open / rewind-panel / session-focus / settings / task-create / task-run`
OW 动作（UI→/api/open-world/action）：`idea-compare / idea-inject / mark-read / memory-search / notification-ack-all / pair-issue / pair-stop / rrm-session-apply / rrm-session-clear / send-message / share-snapshot / space-token-issue / space-token-revoke / world-leave`
内嵌面板闸门（EMBED_PLUGIN_ID）：`rewind / task-board / remote / memory(hindsight) / market / ssh / analytics`
**测试覆盖现状（按名字直接命中）**：动作侧仅 4/14 有具名测试（idea-inject、memory-search、send-message、idea-wrap*）；桥类型侧仅 5/18（inject-message、panel、rewind-open、session-focus、settings）。*idea-wrap 在测试中出现但 UI 未发——疑似遗留别名，第 1 小时核实。
**已知诚实占位（设计如此，非缺陷）**：神经 RRA（stub+契约文档 RRA_NEURAL.md）、ALL-IN-ALL 世界包（明示未装素材）、world-packs 诚实占位模式。
**完善度底数**：指令共 ~39 项；实现率经 smoke 228 间接背书，但**具名直测率仅 ~23%**——「逐一执行验证」正是补这个缺口。
## 2 · 五小时分段（每段一次「继续」）
### 第 1 小时 · 全指令逐一执行（自动化普查测试）
- 新写 `test/command-census.mjs`（第 15 套件）：遍历 39 项指令，经 bridge execute 在沙箱 home 逐条真实执行，断言结构化返回/预期错误；产出**逐指令判定表**（PASS/带契约拒绝/占位/失败）。
- 核实 idea-wrap 别名疑点；补 `to:'mailbox'` 运行期路径的沙箱验证。
- 验收：15 套件全绿 + 普查判定表落 `_scratch/census-report.txt`。
### 第 2 小时 · 修复轮一（执行-总结-修改）
- 修普查失败项与「假按钮」扫描结果（UI onClick 只弹提示无实事的点）。
- 给零覆盖动作补具名测试（目标：具名直测率 23%→80%+）。
- 验收：修复清单 + 回归全绿。
### 第 3 小时 · 体验走查（六条流程逐流审查）
- 流程：冷启→进厅 / 聊天坞收发 / 园（信纸·人格·湖·过桥）/ 进世界门 / 设置开关 / 内嵌面板闸门。
- 每流产出：步骤、等待点、反馈明确度、失败降级、文案语气。**使用体验报告 v1** 落 docs。
- 验收：报告 v1 + 问题清单（按影响排序）。
### 第 4 小时 · 修复轮二 + 全量回归
- 实施报告 v1 的 Top 修复（候选：片头跳过提示、reduced-motion、慢路径 loading、空态引导文案）。
- 重建 + 15 套件全绿；报告 v2（修订记录）。
### 第 5 小时 · 真机轮 + 定稿（唯一手工步骤在此前）
- 你重启桌面（我给命令）→ CDP 活体：`npm run test:live` 真端口全指令复核 + 8 条验收清单逐项自动核对。
- **使用体验报告定稿**：执行度统计、体验评分、遗留与后续优化路线。
## 3 · 使用体验报告骨架（随各段增写）
1. 执行度总表（39 指令 × 实现/测试/真机三列） 2. 六流程体验记分 3. 诚实占位清单 4. 修复台账 5. 遗留风险 6. 下一步路线。
## 执行状态（自主推进实录 · 2026-10-01）
- H0 普查 ✅（47 项底数）
- H1 全指令逐一执行 ✅（command-census 第 15 套件 7/0；判定表 47 项零异常）
- H2 修复轮一 ✅（rewind-panel 登记 + census 自身 bug 修复；假按钮审计 0 个）
- H3 体验走查 ✅（六流程评分入报告）
- H4 修复轮二 ✅（550c 补构建——「播完才进门」实际进 lib；reduced-motion；15 套件全绿）
- H5 真机轮 ⏳ 待用户带 9333 端口重启桌面后执行
