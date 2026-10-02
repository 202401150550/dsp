# DSH 续跑核验（2026-10-01）

## 范围与计划
1. 保留已有未提交修改；核对源码、测试入口和运行中的桌面。
2. 用延迟 Promise 回归测试复现桥接 afterClose 提前返回，先红后绿修复。
3. 修正 census：有效参数、预期副作用、显式在线/离线插件，不把静默空路径算成功。
4. 重建过期 client，执行完整 npm test；同步日志及未验收项。

## 基线证据
- Node v24.13.0；包版本 2.78.0。
- Windows 进程查询确认 DSH Desktop 正在运行；9333 CDP 连接失败不能解释为桌面未运行。
- 本次首轮 npm test 被 pretest 阻断：client.js 过期，expected=9c02ba5aaa，embedded=16be982e75。日志：_scratch/resume-20261001-before.log。
- 现有 live 脚本会广播消息，未盲跑；未强杀桌面、未操作实际回退/任务、未清理工作区。
- 源码/单测/录制依赖不等于真机验收；550C 实际播放时序、当前桌面 UI 和 Host 真机动作仍待验证。

## 本轮结果

### 修复与验证
- `bridge/execute.mjs`：afterClose 现在 await 异步回调，避免 rewind-exec 在 session.command 仍未结束时提前返回。
- `test/bridge.mjs`：新增延迟 Promise 回归。修复前 37 通过 / 1 失败；修复后 38 / 0。均未触发实际回退。
- `test/command-census.mjs`：18 桥类型提供有效参数并核对具体副作用；7 插件面板各测在线、离线、未知状态；3 直通面板核对实际 embed 调用；未知动作核对准确提示。
- UI action 改为当前模块源码的静态字面量扫描；动态表达式不宣称覆盖。
- Host 21 项只标记 HOST-REGISTERED；桥契约标记 MOCK-PASS，不再称为“真机执行”。550C 字符串检查仅是静态证据。
- 已备份并重建 client.js。当前 CLIENT_BUILD=`85ce6263b5`，406,564 字节；freshness 检查通过。旧文件保留于 `_scratch/resume-20261001-client-before.js`。

### 完整回归（本次实跑）
`npm run build:client && npm test` 完成，退出码 0；15 套件合计 **648 通过 / 0 失败**。这是断言数，不是 648 条系统指令。

| 套件 | 通过 | 失败 |
|---|---:|---:|
| smoke | 228 | 0 |
| bridge | 38 | 0 |
| manifest | 8 | 0 |
| rrm | 62 | 0 |
| fleet | 13 | 0 |
| world-state | 21 | 0 |
| space-auth | 26 | 0 |
| space-acl | 52 | 0 |
| capability-registry | 14 | 0 |
| capability-graph | 13 | 0 |
| world-packs | 24 | 0 |
| action-layers | 21 | 0 |
| chat-store | 19 | 0 |
| garden-view | 35 | 0 |
| command-census | 74 | 0 |

### 反向验证（故意破坏测试替身）
用临时测试副本运行，未改真实桥接实现，未覆盖正式 census-report。审计脚本退出码 0 代表三种破坏均被识别。

| 故障注入 | 普查检出的失败断言 |
|---|---:|
| 所有 bridgeExecute 变成空函数 | 43 |
| 丢失全部参数，只保留 type | 29 |
| 忽略插件离线状态 | 7 |

三种副本各自退出码均为 1，并有完整 census 结果摘要，不是把语法崩溃当成检出。临时副本均已删除。

### 真机只读探测与未完成项
- 发现 6 个 DSH Desktop 进程；仅探测其拥有的 4 个监听端口，未扫描其他机器。
- 43120 的 snapshot GET 返回 HTTP 403；其余三个端口没有得到可用 snapshot。
- CDP 9333 返回 ECONNREFUSED。只读探测脚本退出码 0 仅代表探测结束，**不是 live 验收通过**。
- 本次没有强杀、重启桌面，没有发送广播消息、创建真实任务或执行真实回退。
- **仍未验收**：550C simple/full 完整播放时长、淡出结束后入场、防双击/Esc、减弱动态、当前桌面实际加载的新 build，以及真实 Host/Session 动作结果。
- 下一步需要在确认桌面当前工作可安全退出后，通过已授权的桌面重启开启 CDP；先做只读 build/页面核验，再隔离测试会话验证动作及 550C 时序。不要以当前源码测试替代这一项。

### 检查边界
- client.js 语法、freshness 均通过；桥接和测试目录编辑器诊断无 error/warning。
- 桥接实现和桥接测试的 git diff --check 通过（有 CRLF/LF 提醒）。生成 client.js 仍报告一处样式段空白行的 trailing whitespace；没有为消除格式提示去改动已有样式修改。
- 未改包版本、未制造新版本号、未提交或重置工作树。既有未提交修改保留。
- 这是一轮工程核验报告，不是主观体验打分；没有测得的性能、视觉和真机结果不打分。

## 证据路径（相对 D:\dsp）
- `_scratch/resume-20261001-before.log`：首次 pretest 阻断。
- `_scratch/resume-20261001-bridge-red.log` / `...-bridge-green.log`：先红后绿回归。
- `_scratch/resume-20261001-full.log`：完整构建与 15 套测试。
- `_scratch/resume-20261001-mutations.log`：反向验证摘要。
- `_scratch/resume-20261001-live-readonly.log`：只读真机端口结果。
- `dsh-open-world/_scratch/census-report.txt`：正式契约判定表。
- `dsh-open-world/_scratch/census-mutation-*.log` / `.txt`：故障注入的独立日志与表。
- `_scratch/resume-census-mutations.mjs` / `resume-live-readonly.mjs`：复跑脚本，从 dsh-open-world 目录执行。
