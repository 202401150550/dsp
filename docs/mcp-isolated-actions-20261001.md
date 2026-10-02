# 隔离动作续跑（2026-10-01）

## 本轮计划
1. 读真实路由，确认线程、信箱、Agent 会话的边界。
2. 独立 self-test 线程仅写 system 类型测试便笺，验证 HTTP 读写与自己的已读状态；不发送 user 类型消息。
3. 修复线程达到上限时新线程挤掉既有元数据的问题；先红后绿，完整回归。
4. 继续查找任务/会话的隔离入口；不能确认隔离则不碰已有任务或回退锚点。

## 已核实的安全边界
/chat/post 即使使用独立 threadId，user 消息仍会调用 sendMailboxMessage(to=agent)。因此独立聊天坞线程不等于独立 Agent 会话。
聊天坞没有已确认的删除线程 API。本轮至多保留一个 ow-selftest-* 线程、一条 system 便笺，并仅清除该线程未读；不改写生产 meta.json 做清理。

## 连接恢复后的容量修复结果

### 断点确认
读取旧日志确认中断前测试已经执行：chat-store 21 通过、4 失败。此前未知的是执行结果，不应重复创建测试消息。

### 已应用修复
- `dsh-open-world/bridge/chat-store.mjs`：当线程数达到 MAX_THREADS（50）时，ensureThread 对新 ID 返回 `{ ok: false, error: 'thread-limit-reached', max: 50 }`。
- 既有 ID 不受新建容量限制，仍允许追加消息。
- appendMessage 会沿用 ensureThread 的拒绝结果，不创建新线程消息文件，不挤掉既有索引。
- `dsh-open-world/test/chat-store.mjs`：加强保留断言，检查全部 50 个原 ID，而非仅检查数量和其中一个 ID。
- 测试在临时目录中完成；没有在真实聊天存储中创建 50 个线程，也没有改写生产 meta.json。

### 本轮实际回归
| 验证 | 结果 |
|---|---|
| chat-store 专项 | 25 通过 / 0 失败 |
| 完整 npm test（15 套件） | 654 通过 / 0 失败 |
| 独立 desktop-launcher | 9 通过 / 0 失败 |
| 语法、diff 空白检查 | 通过 |
| chat-store 编辑器诊断 | 0 error/warning |
| 客户端 freshness | 通过，85ce6263b5 |

专项 chat-store 已包含在完整 654 条中，不重复计数；加独立启动器测试共 663 条。组合验证命令退出码为 0。

### 生效与验收边界
- 源码已修复，完整离线回归已通过。
- 本次未重启 Desktop，也未验证正在运行的 Host 是否重新加载聊天存储模块。客户端 build 未变化不能证明 Host 模块已热更新。
- 后续需受控重新加载 Host，再确认使用该实现；不通过向生产存储塞满 50 个线程来做验证。
- 上轮 HTTP 验证的 8 项通过是既有结果，本轮没有重跑写入，也没有创建第二条测试便笺。
- 真实隔离 Agent 会话、任务创建/运行和回退仍待后续验收。

### 日志（相对 D:\dsp）
- `_scratch/resume-chat-cap-red.log`：旧实现 4 条失败。
- `_scratch/resume-chat-cap-green.log`：修复后专项通过。
- `_scratch/resume-chat-cap-full.log`：本轮完整 15 套件通过。
- `_scratch/resume-chat-cap-launcher.log`：启动器 9 项通过。
