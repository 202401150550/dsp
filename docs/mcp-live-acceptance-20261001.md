# DSH 真机续跑验收报告

日期：2026-10-01。此报告更新上一轮“CDP 未开放、550C 待真机验证”的状态。

## 结论
**已在运行中的 DSH Desktop 页面完成 550C 播放、跳过、关闭、减弱动态及完整片头后入场验证。**
页面与 Host 均加载 `85ce6263b5`；不是仅依据源码、构建产物或录制依赖推断。
仍不宣称全部 Host/Session 指令已在真机执行。

## 重启与新发现
- 正常关闭检查未找到可关闭的主窗口；用户随后明确选择“允许结束进程并重启”，知悉可能中断任务或丢失未保存内容。
- 按授权结束旧 DSH Desktop 进程，并确认当时剩余进程为 0。
- 首次启动失败暴露了两个环境问题：MCP 终端继承 `ELECTRON_RUN_AS_NODE=1`；LOCALAPPDATA 的 C 盘候选指向另一份安装，和原先运行的 D 盘安装不同。
- 本轮显式使用原 D 盘 `DSH Desktop.exe`，清除 GUI 子进程的 Node-only 环境变量后重启成功。安装包的版本元数据为 2.0.16；Open World Host 为 2.78。
- CDP 监听地址实测为 `127.0.0.1:9333`，未绑定外网地址。桌面保留运行，供后续联调。

## 启动器修复
文件：`dsh-open-world/scripts/launch-desktop-cdp.mjs`。
1. 仅从 GUI 子进程环境中移除 ELECTRON_RUN_AS_NODE，不修改父终端环境。
2. CDP 页面列表为空时继续等待，不再把 page targets=0 当成就绪。
3. 等待窗口由 20 秒扩大到 60 秒；仍无页面时退出码为 5，不再返回成功。
4. 启动后的提示改为先做只读核验，明确旧 test:live 会发送测试消息。

**安装选择边界**：没有改写系统安装或把用户专属 D 盘路径硬编码进项目。默认候选仍依赖 LOCALAPPDATA；这台机器复跑应显式设置 DSH_DESKTOP_EXE 为原 D 盘安装。

## 真机结果
| 项目 | 本次结果 |
|---|---|
| 页内 snapshot GET | HTTP 200、ok=true、Host 2.78、owip/0.3-draft、12 个节点 |
| 冷启不自动播放 | 页面就绪后未见片头遮罩，play 接口可用 |
| 实际加载构建 | Host 与 UI 都是 85ce6263b5 |
| 简易完整播放（预览调用） | 约 4.581 秒；淡出约 0.567 秒；完成后无遮罩 |
| 完整播放（预览调用） | 约 13.017 秒；淡出约 0.570 秒；完成后无遮罩 |
| 重复 play 调用 | 返回同一播放 Promise，没有创建第二轮播放 |
| 防误触与 Esc | 100ms 时点击并按 Esc，400ms 时仍未提前淡出；800ms 后 Esc 可跳过，含淡出约 1.419 秒结束 |
| 关闭档 | played=false，不创建遮罩 |
| 减弱动态 | 使用 CDP 媒体特性模拟 reduce；约 0.1ms 返回 played=false，无遮罩；模拟随后已撤销 |
| 点击“任务世界”完整流程 | 约 12.988 秒出现 is-arriving；从淡出开始到入场约 0.589 秒；入场时遮罩不存在 |

这些时间是本机本轮单次测量，不是跨设备性能保证或统计基准。预览播放和实际点击进入世界的结果分开记录。

### 一次失败与定位
最初的世界入场探针记录 passed=false，原因是只观察 document.body。
后续核实 `document.body.contains(开放世界根节点) === false`：桌面 Portal 挂在 body 外，因此原探针看不到入场类的变化。
- 简易路径追踪已观察到：播放完成时无遮罩；其后约 1ms 才发起 world-enter 审计。
- 修正探针为观察 document.documentElement 后，重新点击任务世界，完整路径通过。
- 没有为消除测试失败去改动产品的播放/入场逻辑；原失败记录保留。
- CDP 探针现在会在 passed/allPassed 为 false 时返回非零退出码，避免把“脚本运行结束”误当成“验收通过”。

## 回归结果
- 原完整 `npm test` 再次通过：15 套件、648 条断言、0 失败。
- 新增独立启动器回归：`node test/desktop-launcher.mjs`，9 条断言、0 失败。
- 两者合计 657 条断言。本轮新测试独立运行，**尚未加入 npm test 默认链**。
- 启动器测试用替身覆盖：找不到安装、已有进程、端口占用、空页面后就绪、正确安装参数、环境隔离、父环境保留、超时失败；不额外启动或终止真实桌面。
- 启动器与新测试语法检查通过；启动器 diff 空白检查通过；启动器编辑器诊断无 error/warning。

## 操作边界与遗留项
- 实际点击任务世界触发了正常 world-enter 审计及界面状态持久化；不是全程只读。
- 未广播测试消息，未创建/运行真实任务，未执行真实回退，未改动凭据、系统安装或既有会话内容。
- 测试临时修改的 550C 播放模式已在 finally 中恢复；fetch/play 追踪包装已撤销；媒体特性模拟已撤销。
- 界面导航在验收中进入过任务世界，不声称恢复了每一项原始 UI 状态。
- **后续未验收**：隔离测试会话中的真实任务创建/运行、消息投递、回退；其他插件面板的端到端能力；长时间稳定性、跨设备性能及人工视觉体验。
- 没有新增虚构版本号，也未提交或重置已有工作树。

## 证据与复跑
相对 `D:\dsp`：
- `_scratch/resume-desktop-launch.log`：环境清理后启动记录。该次启动还使用了“空页面也就绪”的旧判断；页面可用另有后续页内证据，不以此日志单独验收。
- `_scratch/resume-live-state.json`：页内只读快照摘要。
- `_scratch/resume-splash-timing.json`：简易、完整、跳过、关闭测量。
- `_scratch/resume-world-entry.json`：原 body-only 探针失败记录。
- `_scratch/resume-entry-trace.json`：播放完成与 world-enter 的顺序记录。
- `_scratch/resume-world-entry-fixed.json`：修正 Portal 观察范围后的完整入场复测。
- `_scratch/resume-reduced-test.json`：减弱动态验证。
- `_scratch/resume-launcher-test.log`：9 项启动器回归。
- `_scratch/resume-live-full-regression.log`：完整 15 套件回归。

复跑脚本保留于 `_scratch/resume-cdp-probe.mjs`、`resume-splash-timing.js`、`resume-world-entry.js`、`resume-reduced-test.js`。世界入场脚本会操作 UI 和触发正常入场审计，不能作为只读健康探针运行。
