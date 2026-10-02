# DSH 开放世界 · 生态套件

> **Turn your AI coding cockpit into a place of your own.**
> 把 AI 助手的驾驶舱，变成「你的地方」。

基于 [DeepSeek Harness（DSH Desktop）](https://www.deepseek.com/) 的社区插件生态：一座会流动的十景园、一间聊天与投递合一的聊天坞、一面只说真话的系统拓扑镜——以及让这一切值得信赖的 **47 条指令普查** 与 **18 套自动化测试**。

## 这是什么

DSH Desktop 是很强的 AI 编程助手，但它是「替你干活的员工」——用完即走。这套生态把它变成「你的地方」：系统被装进一座园子，记忆是湖、事件是幡、每个器官可点可查可指令。

- 🌌 **开放世界指挥中心** —— 空间/舰队/能力图/世界包，owip/0.3 协议
- 🏞️ **十景园** —— 月色下的真实系统倒影：湖（记忆）、幡（事件）、园径（导航），生成信纸寄一句晚安
- 💬 **聊天坞** —— 对话+投递台合一：本机/广播/全会话/跨机/剪贴板/导出，一键「成文」把对话变 Word
- 🪞 **ATI 系统拓扑镜** —— 只显示真实健康度：点节点看详情，双击直达面板。**真数据不戏服**：假数据装饰一律不做，信息源打标「推算/隐喻」
- 🩺 **dsh-self 器官自愈** · 🔁 **对话回退** · ⚡ **子代理舰队进度** · 🚪 **550C 进世界开场**（可跳过）
- 📄 **office 成文**（@huiliyi37/dsh-office）—— docx/xlsx/pdf/pptx 十六件工具

## 设计原则

1. **真数据不戏服** —— 每个数字都有出处；推算打「推算」标，隐喻打「隐喻」标，编的数据根本不上屏
2. **诚实未启用** —— 插件离线就直说，并告诉你怎么启用；不做空壳面板
3. **一花一草一木可操控** —— 47 条指令逐一测试（command-census 40 断言全绿）
4. **意象克制** —— 园子是唯一放意象的地方；工具区只讲效率

## 安装

前置：[DSH Desktop](https://www.deepseek.com/) ≥ 2.0.16 · Node ≥ 20 · Git

```bash
git clone <本仓库> D:/dsp
cd D:/dsp/dsh-desktop-toggle
# 编辑 plugins.yml：把 link: 指向你的本地路径
node apply.mjs        # 写入 profile 并自动装依赖
# 完全退出并重启 DSH Desktop
```

验证：`cd dsh-open-world && npm run verify`（构建+新鲜度+40 条指令普查+园子 35 断言）· `npm run morning`（晨检全链含真机活体 26 断言）

## 结构

```
dsh-open-world/     旗舰：开放世界壳、园子、聊天坞、拓扑镜（client/ + bridge/ + test/）
dsh-desktop-toggle/ 档位开关 daily/bridge/full + apply 工具
dsh-self/           器官自愈系统
dsh-550c-boot/      进世界开场（简/完整/关）
…                   其余见各目录 README
```

## 测试

15 套件 · 400+ 断言 · 全绿。含指令普查（每一格可操控点都逐一执行）、真机活体验收（CDP 直连运行中的桌面）、对比度 WCAG 审计、census 自完整性守卫。

## 许可

MIT © 2026。社区项目，与 DeepSeek 官方无关；DSH Desktop 为其官方产品，尊重其各项条款。
