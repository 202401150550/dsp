# dsh-open-world

DSH 上的 **系统壳**（SYSOP + OWIP）：像任务管理器 + 桌面，聚合会话、任务、回退、插件、记忆、舰队与第二屏——**不是聊天替代品，也不是第二套 DSH**。

当前实现：**v2.60** · 默认协议 **`owip/0.3-draft`** · 产品规划：[SHELL_PLAN.md](./SHELL_PLAN.md) · 系统规划：[SYSOP_v0.1.md](./SYSOP_v0.1.md)

## 30 秒验收

打开 Open World 后，应能立即回答：

| 问题 | 读哪里 |
|------|--------|
| 现在什么状态？ | 左栏 **状态** · `snapshot.core` |
| 我能做什么？ | 左栏 **动作** 或中间节点 · `snapshot.nodes[].action` |
| 刚才发生了什么？ | 左栏 **事件** · `snapshot.events` / 消息 |

水印：`OPEN-WORLD v2.60`（须与 `framework.version` 一致）

## 三层模型（系统隐喻）

| 层 | 系统类比 | 内容 |
|----|----------|------|
| **L1 宿主** | 内核 + 驱动 | DSH Harness + 插件 API（只桥接） |
| **L2 指挥** | 壳 + 系统调用 | 聚合 / 动作 / 消息 / 回退 / Bridge / WM / 舰队 |
| **L3 叙事** | 壁纸 / 特效 | ATI 视觉（**隐喻**，非实时 ML/DL） |

`lab.*` 的输入信号来自真实会话、任务、插件与 Hindsight；**曲线与流形动画为叙事隐喻**。

## 入口

- 侧栏 / 输入框 **✦** 按钮
- 水印：`OPEN-WORLD v2.60`（须与 `framework.version` 一致）
- 产品规划：[SHELL_PLAN.md](./SHELL_PLAN.md)（删减冗余 · 日常三步）
- 神经 RRA：L5 适配器默认关（`rra.probe: false`）；见 [RRA_NEURAL.md](./RRA_NEURAL.md) · [`../rra-proto`](../rra-proto)
- 真机 RRA：`npm run test:live-rra`（Desktop 进程外常 403 → 自动 CDP；需 `--remote-debugging-port=9333`）
- 已绿门禁总表：[`../rra-proto/PRODUCTION.md`](../rra-proto/PRODUCTION.md)（脚手架冻结；下一刀要真实 checkpoint）
- Snapshot schema：`version: 8`；Host/Bridge 分层见 `framework.actionLayers`（含 `coreShell`）
- Client 模块：`styles` / `runtime` / `app-layout`（左中右栏）已抽出；编排仍在 `client-main`
- 底栏视图：主视图 · IDEA · 调试 JSON（拓扑进 Ctrl+K）

## 阶段切片（已落地）

| 阶段 | 内容 |
|------|------|
| A | 任务三问可信 · Bridge 关键路径 API · 驱动诚实 |
| B | 窗口管理 · world-state · ATI 进应用表面 · 进程舰队 |
| C | 第二屏 Bearer · 密封 outbox · SSE 同步 · `/space/view` |

## 验证（开发）

```powershell
node --check index.js
node --check client.js
npm test
# Desktop 已启动时：
npm run test:live
```

改 Client 源后必须：`npm run build:client`，再**完全退出并重启** DSH Desktop。

## 安装

在 `dsh-desktop-toggle/plugins.yml` 启用 `dsh-open-world` 后：

```powershell
cd D:\dsp\dsh-desktop-toggle
node apply.mjs
```

完全退出并重启 DSH Desktop，再 `Ctrl+Shift+R` 强刷。

## 文档

- [DEVELOPER.md](./DEVELOPER.md) — **给开发者一页**（CDP live · 核心 action · snapshot）
- [SYSOP_v0.1.md](./SYSOP_v0.1.md) — **系统规划**（定位 · 驱动目录 · 阶段路线）
- [QUICKSTART.md](./QUICKSTART.md) — 主人 5 分钟速查
- [OWIP_v0.1.md](./OWIP_v0.1.md) — 系统调用协议（含 0.2-draft 空间层说明）
- [CHECKLIST.md](./CHECKLIST.md) — 验收清单
- [RRM.md](./RRM.md) — 壳层记忆分层

## 依赖（可选）

- `web-ui-task-board` — 任务队列
- `dsh-rewind-plugin` — 回退时间轴
- `@vectorize-io/hindsight-coding-agents` — 记忆节点
