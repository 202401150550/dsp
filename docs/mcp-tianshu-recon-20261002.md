# Tianshu（天枢）侦察报告（2026-10-02 · 只读）

## 身份
天枢 = 北斗第一星（Dubhe）。同名产品 **Tianshu Harness**（tianshuharness.com）：开源 AI 编程智能体运行时，CLI 命令 rivet（开发代号 Rivet），Apache-2.0（v3.26.0，npm tianshu-harness/tianshu-tui，主仓 stars 928 · tests 17,127）。**桌面端专有**（EULA 1.0：激活/许可证绑定设备/混淆产物），**CLI 内核开源**。本机安装：AppData/Local/Tianshu（tianshu-desktop.exe），.dsh-drops 里有快捷方式。

## 内部功能盘点（非付费部分）
1. **认知虚拟机 CVM**：72 个运行时 hook × 5 大阶段——模型输出与真实动作之间加可观测可纠偏层；拦 AI 坏习惯（被质疑就认错/原地转圈/未验证报完成）。
2. **前缀缓存工程**：DeepSeek V4 深度适配，长会话稳态命中 95–99%。
3. **16 星域认知姿态 + 多代理编排**：/plan /council /team 斜杠命令；星域速选（北斗文化包装延伸）。
4. **信息素自衰减记忆**（Stigmergy）。
5. **插件系统**：tianshu manifest（name/tools/permissions/skills 声明式）；自带 office 五件套（docx/xlsx/ppt/pdf/design）——**office-docx 描述明写 "synced with @huiliyi37/dsh-office 0.1.5"（与 DSH 插件生态互相同步！）**。
6. **mobile-web 伴生端**：仅 2.4KB 的 mobile.html（轻页思路）。
7. 自带 node-runtime / ripgrep-runtime（与 DSH 同款打包思路）；rivet-runtime 含 agent/browser-cli/account 模块。

## 结论：要不要加进我们系统？
**整包：不加。** ①桌面壳闭源+激活绑定，EULA 明令禁止集成/逆向；②它本质是"另一个 DSH"（同类 agent 运行时），与 DeepSeek Harness 并装无意义；③它的能力边界与我们的园子不同层。

**借鉴：三条可落地（借意不借码，内核开源学起来合法干净）**
1. CVM「验证后才报完成」纪律 → 我们的 census 全指令逐一执行已是同源思想；可再加"任务完成前自证"一步（建议采纳）。
2. office 文档能力 → 不从 Tianshu 拿：DSH 生态原生有 **@huiliyi37/dsh-office**（Tianshu 都在同步它），装它即得 docx/xlsx/ppt/pdf；园子可加「书房」意象承接（湖旁书房：对话产物一键成文档）——候选待批。
3. 移动轻伴生端 → pair-issue 扫码上桥已有；2.4KB mobile.html 印证轻页路线；园径/信箱移动皮肤排后续候选。

## 北斗意象（文化层候选）
园子已有月/十景/印章红，与天枢同一文化语系。候选（不实施）：园径导航做「北斗指路」——七星对七条主指令路径，纯意象层。
