# Agent 参数修复、真实回复与兼容层安全回归

日期：2026-10-01。续接《任务插件兼容性审计与最小 Agent 实测》；此前失败证据保留，本报告记录用户明确授权修复默认推理强度之后的结果。

## 最终结果
**真实 Agent 最小请求已通过。** 同一隔离 Session 返回 `OW-SELFTEST-OK`，回合 reason.kind=completed，最终 running=false，未观察到工具调用。

| 验证 | 本轮结果 |
|---|---|
| 官方模型目录与参数修正 | 通过，提供商/模型保持不变 |
| 隔离 Session 真实助手回复 | 通过，不是请求文本匹配 |
| 兼容层新增契约回归 | 修复前 3 通过/3 失败 → 修复后 6 通过/0 失败 |
| 完整 npm test 重新执行 | 15 套件，662 通过/0 失败 |
| desktop-launcher 专项重新执行 | 9 通过/0 失败 |
| 兼容层语法与 diff 空白检查 | 通过 |
| 正常关闭并重新启动 Desktop | 通过，本轮未强杀 |
| 重启后联合检查 | 9/9 通过 |
| 真实任务生命周期、聊天回退 | **仍未验收** |

## 1. 默认模型配置修复
用户选择“允许修复并继续验收”，并已获知默认配置会影响后续使用该默认值的请求。

修复前：
```json
{"provider":"stepfun","model":"step-3.5-flash","reasoningEffort":"high"}
```

正式 `session/modelCatalog` 中，该模型没有 reasoning efforts 元数据；先前实际运行明确拒绝 high。因此没有猜测替换成 medium/low，而是通过正式 `session/selectModel` 选择同一提供商和模型、不传 reasoningEffort。

修复后，控制器返回的选项和模型目录中的默认值一致：
```json
{"provider":"stepfun","model":"step-3.5-flash"}
```

未更换提供商、模型或密钥。该接口保存了全局默认选择，不是纯 Session 局部覆盖；正常重启后再次读取目录，修正仍然保留。

## 2. 真实请求与隔离边界
- Session 仍为 `ow-selftest-session-20261001-a1`。
- cwd 仍为 `D:/dsp/_scratch/ow-session-fixture-20261001-a1`。
- 已知第一次请求明确结束于参数错误后，才提交新的 requestId：`ow-selftest-prompt-20261001-a2`；没有盲目重放不确定的请求。
- 重试脚本先确认只有此前那次参数失败的回合，再提交固定回复请求；统计只覆盖本次提交后的事件。
- accepted=true，轮询观察到 running=true，最终 running=false。
- assistant/message 中提取的实际助手正文是 `OW-SELFTEST-OK`。
- 持久化的最后一个 turn/end 原因是 completed；未观察到工具事件，无需取消。
- 该探针窗口约 7.1 秒，包含提交、轮询与读取，不等同于精确的模型生成耗时。
- 会话已标为 `OW 验收 — Agent 固定回复通过`，不再称为空会话。

事件统计出现多条 user/message 记录，不能据此误称提交了多次 RPC；本轮重试只调用了一次 prompt。未导出其他 Session 的消息内容。

## 3. 兼容层修复
改动文件：
- `dsh-apiproxy-compat/index.js`
- `dsh-apiproxy-compat/prompt.test.mjs`（新增）
- `dsh-apiproxy-compat/README.md`

原行为：斜杠文本经普通 prompt 转交后，兼容层自行补出 `command.kind=success`，任务执行器据此判断 `/permission` 被确认。

新行为：
- 对所识别的斜杠命令，在调用 sessionController.prompt **之前**返回 `compat/command-unsupported`。
- 不将旧命令当成模型提示词提交，不伪造权限确认。
- 普通提示词保持原有 admission 语义、requestId 传递及错误返回。

六项替身测试覆盖：普通权限命令、前导空白权限命令、未知斜杠命令的拒绝与零转发；普通提示词；调用方 requestId 保留；控制器异常。生产请求数为零。

**这是明确拒绝不支持命令的安全修复，不是实现了新版权限控制。** 带 task.permission 的旧任务在当前兼容层上应失败，而不是假装权限已设置。任务历史接口、当前权限控制、设置和 UI 的整体兼容性仍需继续验证。

## 4. 完整回归与正常重启
- 本次重新执行 npm test：14 个标准格式汇总为 627 项，加上 garden-view 独立格式的 35 项，共 15 套件 662 项，失败 0；避免因日志格式不同漏计园套件。
- 启动器专项 9/0。
- 重启前正式 Session 列表确认 running=0、没有未读取 cursor。
- 使用 Browser.close 正常退出。关闭应答因进程退出未收到，脚本独立确认进程已退出后才继续启动，没有强杀。
- 以原 D 盘 Desktop 可执行文件启动，CDP 就绪；关闭/重启命令最终退出码 0。
- 重启后的 9 项检查覆盖：测试 Session 唯一、cwd 正确、已使用且空闲、固定助手回复保留、最后回合非错误、默认参数修正保留、任务世界仍不可进入、5 条历史任务保留、原测试便笺仍只有一条。
- 当前 Session 总数 104，运行中 0。

重启后验证的是历史回复与配置的持久化，没有再次发送第三个模型请求。新进程已重载工程，但本轮没有通过生产任务路由触发兼容层命令拒绝；该分支的直接行为证据来自 6 项离线契约测试。

## 5. 未改变和未完成的内容
- 任务插件继续停用，没有改写其 profile 注册或安装包。
- 5 条历史任务不作为试验对象；此前只读汇总为 8 条执行记录、0 未结束执行、0 定时任务。
- 未进行真实任务创建→排队→执行→完成→查询；未进行聊天回退或文件恢复。
- 本轮没有重复测试 550C 动画；先前动画/入场结果不能代替任务服务验收。

下一步是验证任务插件当前权限/历史/设置接口，并设计隔离账本和禁自动调度的恢复方案。正式启用涉及配置变更，不能因最小 Agent 已通过就直接对历史任务开放。

## 6. 证据（相对 D:/dsp）
- `_scratch/resume-model-catalog.json`、`resume-model-fix.json`
- `_scratch/resume-minimal-agent-retry.json`
- `_scratch/resume-compat-red.log`、`resume-compat-green.log`
- `_scratch/resume-agent-fix-full.log`、`resume-agent-fix-summary.json`
- `_scratch/resume-agent-fix-launcher.log`
- `_scratch/resume-agent-fix-close.log`、`resume-agent-fix-relaunch.log`
- `_scratch/resume-agent-final-check-before.json`、`resume-agent-final-check-after.json`

此前失败报告 `docs/mcp-plugin-agent-acceptance-20261001.md` 保留，记录的是修复前状态；本报告为后续结果。
