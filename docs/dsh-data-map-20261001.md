# DSH 数据地图 · 开放接口图（2026-10-01）
> 依据：dsh-diagnostic-bundle 1.22.4 源码（log-sources.cjs / config.js）+ 本机实勘（~/.dsh、profiles、junction 链接逐一验证）。
> 结论先行：**链接全部健康、桌面与仓库零差异；未发现需要立即维修的断点；两处风险/建议待批。**
---
## 一、开放式接口是什么：三层
```
┌─ L1 插件挂接接口（谁来挂、怎么挂）─────────────────────┐
│ D:/dsp/dsh-desktop-toggle/plugins.yml   ← 总注册表（人改这里）      │
│   + presets.yml（daily 瘦身 / bridge 指挥舱 / full 全开）           │
│        ↓ node apply.mjs（自动 doctor check）                        │
│ C:/Users/admin/.dsh/profiles/desktop/                               │
│   ├ cordis.patch.yml（AUTO-GENERATED，勿手改）                      │
│   ├ package.json（enabled 包写成 "link:D:/dsp/..."）                │
│   └ node_modules/dsh-*（全部是指向 D:/dsp 源码的链接，非拷贝）      │
│        ↓ 客户端装载                                                  │
│   bundle 挂接（dsh.bundle.patch，open-world/550c 用这条）           │
│   cordis insert（api-proxy 等用这条；同 id 双挂会 duplicate loader）│
├─ L2 开放世界 HTTP 接口（OWIP 协议）────────────────────┤
│ /api/open-world/snapshot（state 等同源；OWIP owip/0.3-draft）       │
│ /api/open-world/action（send-message / idea-inject /                │
│   idea-compare / pair-issue …）                                     │
│ /api/open-world/chat/*（threads/messages/post/upload/read）         │
│ 消费方：客户端模块（chat/garden/shell…）、14 套件、test:live、       │
│         移动端上桥（pair-issue → 扫码）                              │
├─ L3 会话与诊断数据格式──────────────────────────┤
│ session.v4.jsonl（会话流水，DSH 原生导出格式）                       │
│ dsh-diagnostic-bundle 1.22.4（诊断插件：一键报错→脱敏→打包；        │
│   目前【未挂载】，桌面包是其独立发行 tgz）                           │
└──────────────────────────────────────────────┘
```
## 二、具体用在哪些地方（今日实勘）
| 挂载点 | 指向 | 状态 |
|---|---|---|
| profiles/desktop/node_modules/dsh-open-world | **D:/dsp/dsh-open-world**（链接） | ✅ 与仓库 diff 零差异（ed0a9ccb17） |
| profiles/desktop/node_modules/dsh-550c-boot | **D:/dsp/_scratch/dsh-550c-boot**（链接） | ✅ 零差异（门两修复在位） |
| profiles/desktop/node_modules/dsh-self | D:/dsp/dsh-self（链接） | ✅（file-drop/usage 等已收编其中） |
| profiles/desktop/node_modules/dsh-ventus-progress | D:/dsp/dsh-ventus-progress（链接） | ✅ |
| 档位 | bridge=指挥舱（OW 卫星集：open-world+550c+rewind+ventus-progress+better-sidebar+archify+apiproxy） | ✅ 当前在用 |
| dsh-diagnostic-bundle | **未挂载**（dsh-self/全 profile 均无） | ⚪ 独立工具包，未启用 |
因为全是**链接**：改仓库 → `npm run build:client` → 重启/强刷即生效，没有"拷贝落后"问题。
## 三、其他地方是否也需要使用？
- **该用的都在用**：我们的三件（open-world / 550c / dsh-self 器官）全部经 L1 挂接、经 L2 互通；capability-registry 的 owSurfaces 已登记 garden 面（capability-registry 套件 14/0）。
- **架构红线（plugins.yml 原文）**：open-world「自带 dsh.bundle.patch → 必须走 bundles，勿再 cordis.patch insert（否则 duplicate loader）」——以后给园子加卫星件，照 550c 的样子登记进 plugins.yml + presets 的 bridge 档即可，不要直接改 profile 生成物。
- **一项未接**：诊断插件（一键报错按钮）没挂。小白部署（P3）场景下它很配——装不装由你定：`dsh plugin --profile desktop add <解包路径>` 后重启即得，装后出问题一键打包发你。
## 四、维护与维修结论
**本轮未动任何文件（全健康，无需维修）**。两处建议待批：
1. **550c 的家安在 `_scratch` 里**（D:/dsp/_scratch/dsh-550c-boot）——扫scratch 有被清掉的风险，届时桌面插件即失效。建议迁到 D:/dsp/dsh-550c-boot 并改 plugins.yml 的 link + 重跑 apply（需重启桌面生效，等你点头）。
2. **live 活体测试端口**：桥接端口对进程外不开放（官方诊断插件同样把"端口占用/发现"列为排查项，证实这是设计）。要跑 `npm run test:live`，需以 `--remote-debugging-port=9333` 重启桌面——同样等你点头再动。
## 五、数据地图（DSH 家底在哪）
| 数据 | 位置 |
|---|---|
| 主目录（web 宿主） | ~/.dsh（settings 迁移后旧文件改名 settings.yaml.imported） |
| 桌面宿主桶 | ~/.dsh/dxb-desktop（诊断插件自有状态按宿主分桶） |
| 插件档案 | ~/.dsh/profiles/desktop（cordis.patch.yml 自动生成）+ ~/.dsh/plugins |
| 会话流水 | ~/.dsh/sessions（session.v4.jsonl 导出格式） |
| 开放世界数据 | ~/.dsh/open-world（mailbox.json、chat/ 线程与消息、worldPacks…） |
| 回退快照 | ~/.dsh/rewind-snapshots · 任务板 ~/.dsh/task-board |
| 官方日志 | ~/.dsh/logs/（vision-router 等）；诊断插件日志 ~/.dsh-doctor、dxb-log-retention.jsonl |
| 园子读的快照 | L2 的 /api/open-world/snapshot（core/nodes/taskBoard/memory/rewind/space/events/mailbox/worldPacks/idea/plugins） |
