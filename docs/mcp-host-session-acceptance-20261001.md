# Host 重载、任务可用性与真实 Session 隔离验收

日期：2026-10-01。

## 本轮结论
1. 已正常关闭并重新启动原 D 盘 DSH Desktop；当前 Host 已加载新的任务存在性判定，聊天接口在新进程中正常提供服务。
2. 已通过正式 Session RPC 创建一个专属目录中的真实空会话，8 项隔离检查通过；重启后 9 项联合检查通过。
3. 修复了“旧任务账本令缺失的插件被误判在线”的问题。当前任务世界如实显示不可进入，5 条历史任务记录保留。
4. **未发送 Agent prompt、未运行任务、未执行回退**。独立会话的创建/持久化通过不等于这些业务动作通过。

## 真机发现与原因
初始只读探测：
- Open World snapshot HTTP 200，Host 2.78，任务世界 online=true / enterable=true。
- `/api/task-board/state` 实际返回 404。
- fleet 显示 sessions=1、tasks=5、running=1。

随后核实：
- `taskBoardMetrics()` 只要读到非空 ledger，就硬编码 available=true、installed=true。
- 当前 Desktop profile 的 package.json 没有声明 `@linxin666/dsh-client-ui-task-board`。
- node_modules 中仍有 0.1.20 的任务包文件，**文件存在不代表当前已启用**。本轮未擅自安装、启用或改写 profile。
- 正式 `session/list` RPC 返回 103 个会话、running=0；与旧账本的 running=1 不是同一种运行状态证据。重启前再次核实 RPC 没有运行中会话。

## 源码修复与回归
修改 `dsh-open-world/index.js`：
- 有历史任务时也依据当前 profile 依赖声明判断 installed/available，不再由账本存在硬编码为 true。
- 保留原历史任务、计数与执行状态，不删除或伪造账本。
- 添加 source 与 runtimeVerified=false，区分持久化数据和真实运行证据。
- 这不是全面的后端健康探测：依赖声明存在仍不能证明路由可用；本轮解决的是无依赖声明却被历史账本误报的问题。

修改 `dsh-open-world/test/smoke.mjs`：新增 8 条临时目录回归，覆盖无依赖、孤立账本、历史记录保留、目录判定及有声明但无历史任务等情况。

| 验证 | 结果 |
|---|---|
| 新回归修复前 | smoke 232 通过 / 4 失败 |
| 修复后完整 npm test | 15 套件，662 通过 / 0 失败 |
| 独立 desktop-launcher 回归 | 9 通过 / 0 失败 |
| index.js / smoke 语法与 diff 空白检查 | 通过 |
| index.js 编辑器诊断 | 0 error/warning |
| 客户端 freshness | 85ce6263b5，通过 |

## 真实 Session 隔离验证
接口是 DSH 正式的 `/api/session/*` RPC，不是聊天坞线程，也不是录制依赖替身。
- sessionId：`ow-selftest-session-20261001-a1`
- cwd：`D:/dsp/_scratch/ow-session-fixture-20261001-a1`
- 标题：`OW 验收 — 空会话（未调用模型）`
- 保留 1 个可识别空会话和专属测试目录；会话总数从 103 到 104。

8 项通过：指定身份创建；相同身份/cwd 幂等复用；仅重命名自己的测试会话；只有一个测试身份；专属 cwd；blank 且不运行；标题可识别；原有会话身份与目录保留。

未使用 session/prompt、未调用模型选择接口、未切换或改名既有会话。没有已核实的删除 Session 接口，因此不直接删除持久化文件。

## Host 重新加载与重启后证据
- 已确认 Desktop profile 中 dsh-open-world 实际链接到 `D:\dsp\dsh-open-world`，该目录包含容量修复。
- 重启前再次用正式 Session RPC 确认无运行中会话、无待翻页 cursor。
- 发送正常 `Browser.close`；关闭应答因进程退出丢失，探针报超时。没有据此强杀：独立 tasklist/端口检查确认 Desktop 进程数为 0、CDP 不再监听。
- 使用原 D 盘安装和修复后的启动器重新启动，CDP 出现 1 个页面，启动器退出码 0。
- 重启后 9 项检查全部通过：任务世界不再误报可进入；依赖缺失不再误报安装；任务集成不可用；聊天接口可用；原测试便笺仍只有一条；真实 Session 唯一持久化；空闲/blank；标题保留；cwd 保留。
- 当前快照：任务 total=5、available=false、source=persisted-ledger、runtimeVerified=false；会话 104、running=0。

容量修复随当前工程重新加载，但满 50 线程的拒绝行为仍以临时目录回归验证，不在真实聊天存储中填满线程来测试。

## 操作边界与下一步
- 本次没有强杀进程，没有修改桌面安装或 profile 配置，没有重复创建聊天坞便笺，没有删除历史任务。
- 旧版 550C“入场通过”证明的是动画与壳内入场顺序，不证明任务服务可用；本轮明确补上这个区分。
- 当前任务 API 404，真实任务创建/运行验收被阻塞。恢复前应核对 0.1.20 任务包与当前 Desktop 的兼容性、历史禁用原因，并按要求取得配置/安装操作的确认。
- 独立空 Session 已准备好；后续可在该 ID/cwd 中验证最小 Agent 消息及聊天回退，不能作用于其他会话或文件锚点。
- 浏览器探针只输出汇总与测试对象信息，没有在报告中导出既有会话内容。

## 证据（相对 D:\dsp）
- `_scratch/resume-action-preflight.json`：404 与原先在线状态矛盾。
- `_scratch/resume-task-presence-red.log`、`resume-task-presence-full.log`：先红后绿。
- `_scratch/resume-task-presence-launcher.log`：启动器专项。
- `_scratch/resume-session-list-probe.json`：正式 Session 查询摘要。
- `_scratch/resume-session-isolation.json`：8 项独立 Session 检查。
- `_scratch/resume-host-reload.log`：正常关闭请求及应答超时。
- `_scratch/resume-host-relaunch.log`：重新启动成功。
- `_scratch/resume-post-reload-check.json`：9 项重启后检查。

复跑注意：`resume-session-isolation.js` 检测到已有测试 ID 会拒绝重复创建；后续直接使用既有 ID，不要换 ID 无谓堆积会话。
