# MCP连接准备记录

日期：2026-10-01。

## 连接与工作区

- 已使用用户本轮提供的新地址完成initialize及tools/list，不记录完整连接凭据。
- 服务shuncode-bridge 0.7.5，协议2025-03-26，共15个工具，完整工具定义已获取。
- list_directory与read_files实际验证成功。
- 当前工作区为DSH相关项目；ARCHITECTURE_PLAN.md声明范围为D:\dsp。根package.json名称为lobsterai，包含多个dsh-*项目。不是此前HotelPMS工作区，不沿用酒店项目路径或操作计划。
- 已阅读[AGENTS.md](../AGENTS.md)、[package.json](../package.json)，以及[ARCHITECTURE_PLAN.md](../ARCHITECTURE_PLAN.md)前85行。后续涉及具体模块时再阅读相应完整规划和子目录约定。
- AGENTS.md引用v2.77，架构规划当前标题为v2.78；仅记录差异，本轮未自动修订项目规划。

## 执行规则

1. 文件修改前read_files；apply_patch使用版本哈希，冲突重读，避免覆盖已有修改。
2. 符号定位优先lsp，精确字符串用search_files；空LSP结果不证明目标不存在。
3. 独立读取可以并行，同文件写入和依赖操作串行。
4. 修改后检查get_diagnostics；构建、测试用run_command，并检查真实退出码；长任务按command_id及next_offset增量读取。
5. 多步骤任务维护完整set_todos，最多一个in_progress；report_progress用于即时状态，未完成项不得假标完成。
6. 取消、安装、恢复或其他高风险操作遵守宿主确认，不强退用户程序、不擅自清理数据。
7. 遵循项目先规划后行动的约定，保护子模块及未提交内容；不因连接准备而运行修复、切换预设或启用服务。
8. 不主动调用宿主文件操作或开启Hindsight/OpenViking等额外服务；需具体任务授权和相应条件确认。
9. 交付记录保存docs/mcp-*.md，使用LF、无尾空格；探针和机器可读输出不混入文档目录。

## 本轮边界

仅建立连接、读取规则及项目入口，并新增本连接记录。未安装依赖、启动服务、修改应用代码或业务数据，未重新恢复此前清空的酒店源码、安装包和分析文件。不把历史规划中的测试通过记录当作本轮重新验证结果。

状态：连接准备完成，等待用户安排后续任务。
