# 任务插件兼容性审计与最小 Agent 实测

日期：2026-10-01。此报告续接 Host 与独立会话验收，覆盖本轮实际操作，不替代上一轮的测试记录。

## 结论
- 真实 Agent 请求已提交且被接收，但**回复验收失败**。运行明确因模型参数不兼容结束，不是仍在等待，也不是成功生成后遗漏展示。
- 任务插件确实未在当前 profile 注册；安装目录是 vendor 源码链接，不是文件缺失。
- 离线替身验证复现了兼容层“将接收请求包装为命令成功”的行为。这不足以证明权限设置成功，不能直接用它恢复任务执行。
- 未修改模型默认配置、任务插件代码、profile 或历史任务账本；未安装插件、未额外重启。

## 1. 真实 Agent 请求
使用既有隔离对象，没有新建第二个会话：
- Session：`ow-selftest-session-20261001-a1`
- cwd：`D:/dsp/_scratch/ow-session-fixture-20261001-a1`
- requestId：`ow-selftest-prompt-20261001-a1`
- 请求：只输出 `OW-SELFTEST-OK`，不调用工具、不访问或修改文件、不执行命令。

结果：
| 检查 | 实测 |
|---|---|
| 正式 session/prompt | accepted=true |
| 提交内容进入事件流 | agent/inbox/spliced inserted=1 |
| Agent 开始回合 | turn/start、step/start |
| 回合结束 | turn/end，reason.kind=error |
| 错误码 | UNSUPPORTED_REASONING_EFFORT |
| 助手回复 | 0 条，未获得固定响应 |
| 工具调用 | 本轮事件中未观察到工具调用 |
| 最终运行状态 | running=false，无需取消 |
| 最小请求验收 | **失败，不算通过** |

服务记录的明确错误：
> provider "stepfun" model "step-3.5-flash" does not support reasoning effort "high"

这说明运行时能够解析到一个默认模型；此前 Session 中 next/lastUsed 为空并不等于没有全局默认模型。请求很快结束，轮询未采到 running=true，但持久化的 start/end 事件证明实际进入过回合。

初始探针统计 user/message=0，不代表请求没进入：当前事件里可见 inbox 插入和随后的回合开始。不能把请求文本中的固定响应字符串当作助手回复。

测试会话现改名为 `OW 验收 — Agent 最小请求（未获回复）`，blank=false。原“空会话（未调用模型）”标题和前一轮 blank=true 仅代表当时状态。

### 为什么没有直接调整模型重试
已核对 Desktop 2.0.16 控制器源码：`selectModel` 虽设置 Session 的下一次模型选择，仍会在后台调用 `agentDefaultModel.saveSelection(selected)`。它不是纯会话局部操作；`initializeDefaultModel` 同样涉及默认配置写入。

因此本轮没有偷偷修改全局默认值，也没有盲目重复提交请求。下一步应先核实该模型支持的 reasoning effort，再取得默认配置变更确认；不要猜测填入一个强度。

## 2. 任务插件存在性与禁用线索
- 当前包版本 0.1.20，实际指向 `D:/dsp/vendor/dsh-web-ui/dsh-task-board`。
- 当前 profile package.json、cordis.yml、cordis.patch.yml 中没有任务插件注册；此前真机路由 `/api/task-board/state` 返回 404。
- 63 份 package.json 备份中，2026-09-29T14-45-12 仍声明任务插件，2026-09-30T06-31-47 已不声明。
- 这只能定位配置变化时间窗口，**不能证明是谁、因何禁用**。
- `dsh-apiproxy-compat` 自身仍列在 profile 依赖并出现在 cordis.patch.yml；这不是任务插件已运行的证明。

## 3. 权限确认兼容性缺口
源码：`dsh-apiproxy-compat/index.js` 的 prompt 转接对斜杠文本补出 `command: { kind: 'success' }`，尽管底层 sessionController.prompt 只返回 `{ accepted: true }`。

任务执行器在存在 task.permission 时发送 `/permission ...`，随后依赖 `command.kind === 'success'` 判断权限命令是否被确认，再提交任务正文。

离线验证结果：
- 仅注入 mock sessionController，生产请求数 0。
- mock 返回 `{accepted:true}`。
- 兼容层返回 `command.kind=success`。
- 合成成功结果的行为已复现；没有证明权限配置真正生效。

应修复为使用有真实结果的当前控制接口，或无法验证时明确失败，而不是将 admission 当作成功。本轮只读审计，没有擅自修改该兼容层或启用任务插件。

## 4. 历史账本与启动副作用
只读汇总：
- 历史任务 5 条、执行记录 8 条。
- 带 schedule 的任务 0 条；带 permission 的任务 0 条。
- 未结束执行记录 0 条；附着 Session 的未结束执行记录 0 条。

所以不能声称当前确有待自动触发的历史定时任务，也不能声称上述权限缺口已影响这 5 条历史任务。

不过插件启动会立即轮询执行状态并运行调度 tick；默认启用时 tick 会写入 scheduler.lastTickAt。启用并非无副作用的只读探测。恢复时仍应先设计隔离账本和禁自动调度方案，并验证设置、接口、事件历史和 UI 兼容性。

## 5. 本轮范围与后续顺序
1. 先移除/修正命令成功的合成行为，补离线契约测试；验证当前权限控制与历史分页接口，不直接打开生产任务插件。
2. 经确认后，调整不兼容的默认推理强度，再在同一隔离 Session 以新的明确 requestId 重试固定响应。
3. 单次 Agent 回复通过后，才进入隔离任务创建→排队→执行→完成→查询。
4. 最后验证仅聊天回退，不能混同于工作区文件恢复。

本轮没有重新运行完整 npm 回归。上一轮的 662/0 与启动器 9/0 仍是上一轮源码/Host 的证据，不应冒充本轮 Agent 或任务执行通过。真实任务生命周期和聊天回退仍未通过验收。

## 6. 证据文件（相对 D:/dsp）
- `_scratch/resume-plugin-audit.json`：安装链接、配置及备份线索。
- `_scratch/resume-minimal-agent.json`：请求已接收但验收失败。
- `_scratch/resume-agent-result-inspect.json`：原始事件类型/结构汇总。
- `_scratch/resume-agent-end-reason.json`：明确结束原因与测试标题修正。
- `_scratch/resume-compat-contract-probe.json`：离线复现合成成功结果。
- `_scratch/resume-final-plugin-risk.json`：账本风险和兼容层声明汇总。

脚本保留于 `_scratch/resume-*.js/mjs`；最小请求脚本会拒绝已使用的 fixture，不能直接重放当作新测试。
