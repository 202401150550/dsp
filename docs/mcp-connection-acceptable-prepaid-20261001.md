# MCP 新连接就绪（2026-10-01）

- 新隧道主机：acceptable-prepaid-pdas-arrange.trycloudflare.com；不记录会话标识或完整连接凭据。
- initialize 与 initialized 已完成；服务 shuncode-bridge 0.7.5，协议 2025-03-26。
- tools/list 返回 15 项工具，已读取描述与参数约束。
- 只读验证：list_directory、read_files、run_command(pwd) 成功，当前工作区为 D:\dsp（Bash /d/dsp）。
- 已读取根 AGENTS.md；本次仅做连接准备，未重跑测试、修改业务代码或重启桌面。

## 执行规则
- 先定位、读文件，再做聚焦修改；已有版本哈希用于 expected_versions，过期则重读。
- 文件查找使用 find_files，文本检索使用 search_files，符号导航优先 lsp；空 LSP 结果不代表不存在。
- 独立读取可并行，同一文件写入必须串行；保留既有未提交修改。
- 修改后执行诊断与相关测试；区分静态检查、替身测试和真机结果。
- run_command 使用宿主 Bash；Windows 专属设施显式调用 PowerShell。返回 running 不代表完成或已被终止。
- 命令输出按 command_id 与 next_offset 读取；旧会话的命令句柄不可假定新会话可用。
- 工作区外先只读定位确切路径；工具提供访问能力不等于任意修改授权。高风险操作遵守本机确认机制。
- 多步任务维护完整有序 todo，至多一项进行中；结尾状态如实标注。长期报告放 docs，脚本和日志放外部目录。
- 不因连接恢复自动重复可能已执行的写入操作。

## 既有断点保留
上一轮容量回归测试已写入，生产容量修复尚未确认应用。接续时先读 _scratch/resume-chat-cap-red.log、当前源码与工作树，确认中断命令是否执行，再修复和复测。独立 self-test 消息已创建，不重复创建；真实 Agent/任务/回退验收仍未完成。
