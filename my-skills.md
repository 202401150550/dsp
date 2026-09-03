# 我的 Skills 清单

> 整理日期：2026-08-17
> 存储位置：`C:\Users\admin\.agents\skills\`（DSH 用户级 skills 目录，自动扫描）
> 另有备份/副本：`C:\Users\admin\.claude\skills\`（Claude Code 的 skills 目录）

## 一共 6 个 Skills

| # | 名称 | 版本 | 用途 |
|---|------|------|------|
| 1 | **agently-mail** | 1.0.0 | 通过 `agently-cli` 操作邮件：发送、回复、转发、搜索、读取、下载附件、管理收件箱（后台：agent.qq.com） |
| 2 | **archify** | 2.11 | 生成专业架构图/流程图/时序图/数据流图/生命周期图，输出独立 HTML+SVG，带明暗主题切换，可一键导出 PNG/JPEG/WebP/SVG；也接受 Mermaid 代码转图 |
| 3 | **archify-er** | - | Archify 扩展：生成陈氏（Chen's）ER 实体关系图，独立 HTML+SVG，带主题切换和导出 |
| 4 | **mspm0-ccs** | - | TI MSPM0 嵌入式开发规则：CCS/Keil/CMake+OpenOCD、.syscfg 配置、DriverLib API、SysConfig 校验、NUEDC 风格固件 |
| 5 | **powerpoint-ppt** | 1.3 | PowerPoint (.pptx) 操作：创建幻灯片、格式化、占位符管理、插图、套用模板、提取 .pptx 文字 |
| 6 | **pplx-cli** | - | 安装并使用 Perplexity 的 `pplx` CLI：实时网页搜索、获取指定 URL 的查询相关摘录 |

## 各 skill 目录内容

```
C:\Users\admin\.agents\skills\
├── agently-mail\        SKILL.md（209 行）
├── archify\             SKILL.md（278 行）+ bin/archify.mjs + assets/template.html + examples/
├── archify-er\          SKILL.md（94 行）+ bin/archify-er.mjs + README.md + examples/（ER 图）
├── mspm0-ccs\           SKILL.md（182 行）+ assets/snippets/*.syscfg.md + examples/empty_project/
├── powerpoint-ppt\      SKILL.md（104 行）+ scripts/ppt-automation.py + examples/ + CHANGELOG.md
└── pplx-cli\            SKILL.md（82 行）
```

## 相关位置备忘

- 用户级 skills 根目录：`C:\Users\admin\.agents\skills\`（DSH 扫描 `~/.agents/skills`）
- 项目级 skills 约定位置（当前不存在）：`<工作区>\.dsh\skills`、`<工作区>\.agents\skills`
- DSH 全局 skills 根（当前不存在，可创建）：`C:\Users\admin\.dsh\skills`
- archify 源码/安装包：`C:\Users\admin\Desktop\archify-2.11.0\archify`

## 使用方式

在对话中说 skill 名（如"用 archify 画个架构图"、"用 pplx 搜索"），我加载对应 skill 后按其完整说明执行。
