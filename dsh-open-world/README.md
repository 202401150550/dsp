# dsh-open-world

DSH 上的 **系统壳**（SYSOP + OWIP）：像任务管理器 + 桌面，聚合会话、任务、回退、插件、记忆、舰队与第二屏——**不是聊天替代品，也不是第二套 DSH**。

当前实现：**v2.78** · 默认协议 **`owip/0.3-draft`** · 产品规划：[SHELL_PLAN.md](./SHELL_PLAN.md) · 进世界：[WORLD_PLAN.md](./WORLD_PLAN.md) · 系统规划：[SYSOP_v0.1.md](./SYSOP_v0.1.md)

## 开发预览状态与边界

这是开发预览代码，不是稳定版发布承诺。当前发布复检与待办见 [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)。

- Open World 内可进入原生会话、查看上下文、继续问答和重新打开产物；模型与凭据由宿主提供，不在本项目配置。
- 请求被宿主接受不等于模型已完成；发送结果不确定时应先只读核对，不能自动重复提交。
- 历史时间轴可查看；实际回退／文件恢复尚未开放。任务插件兼容尚未验收，参考环境保持禁用。
- HTML 产物以受限 sandbox 打开；PDF／DOCX／XLSX 提供下载回退，不宣称内嵌 Office 阅读器。工作区链接读取当前文件，不是历史版本快照。
- 侧栏为独立项目；开场动画插件、RRA 原型、任务及记忆插件均不随本仓库自动提供。

## 30 秒验收

打开 Open World 后，应能立即回答：

| 问题 | 读哪里 |
|------|--------|
| 现在什么状态？ | 左栏 **状态** · `snapshot.core` |
| 我能做什么？ | 左栏 **动作** 或中间节点 · `snapshot.nodes[].action` |
| 刚才发生了什么？ | 左栏 **事件** · `snapshot.events` / 消息 |

水印：`OPEN-WORLD v2.78`（须与 `framework.version` 一致）



## 三层模型（系统隐喻）

| 层 | 系统类比 | 内容 |
|----|----------|------|
| **L1 宿主** | 内核 + 驱动 | DSH Harness + 插件 API（只桥接） |
| **L2 指挥** | 壳 + 系统调用 | 聚合 / 动作 / 消息 / 回退 / Bridge / WM / 舰队 |
| **L3 叙事** | 壁纸 / 特效 | ATI 视觉（**隐喻**，非实时 ML/DL） |

`lab.*` 的输入信号来自真实会话、任务、插件与 Hindsight；**曲线与流形动画为叙事隐喻**。

## 入口

- 侧栏 / 输入框 **✦** 按钮
- 水印：`OPEN-WORLD v2.78`（须与 `framework.version` 一致）


- 产品规划：[SHELL_PLAN.md](./SHELL_PLAN.md)（删减冗余 · 日常三步）
- 神经 RRA：L5 适配器默认关（`rra.probe: false`）；见 [RRA_NEURAL.md](./RRA_NEURAL.md)；原型是独立可选 checkout，不属于基础运行依赖
- 真机 RRA：`npm run test:live-rra`（Desktop 进程外常 403 → 自动 CDP；需 `--remote-debugging-port=9333`）
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

需要 Node.js 22+。在项目目录执行；以下基础门禁不需要 API key、DSH 运行进程或相邻项目，也不需要为测试安装 React：

```sh
node --check index.js
node --check client.js
npm test
```

修改 `client/` 或桥接源码后先执行 `npm run build:client`，再执行 `npm test`。构建指纹基于项目相对路径及标准化换行，换目录／换机器不会误判过期。

可选集成有独立门禁，**缺少依赖时返回非零，不静默跳过**：

```sh
npm run test:rra-integration    # 需要相邻 rra-proto checkout
npm run test:boot-integration   # 本工作区独立 550C 启动插件的静态检查
```

这些命令通过不代表完整神经 RRA 或真实动画时序已验收。`test:live*` 会访问真实宿主，运行前必须确认测试环境和会话归属；不要对正在使用的会话盲目执行。

## 接入宿主

本包不是独立桌面应用。先完成上面的离线验证，再按所用 DSH 版本的本地插件/profile 文档，将本目录作为独立包引用，并使用本包 `cordis.patch.yml` 的挂载声明。宿主需提供 webServer、sessions 以及客户端运行时；不要修改官方源码。

本次不附带可跨版本照抄的安装命令，也不依赖某台机器的 `D:\dsp` 路径。集成打包和真实 scratch profile 挂载仍是发布门禁，不以源码测试代替。不要直接覆盖日常 profile；先在独立验收 profile 验证。

只有确认没有运行任务、没有未发送草稿且得到允许后，才刷新或重启日常 Desktop。不要通过改 provider、model 或 key 规避兼容问题。

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
