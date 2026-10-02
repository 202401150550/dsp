# DSH 通宵迭代记录（2026-10-01 夜）

> 范围：`dsh-self`（宿主执行层）→ `dsh-self` 工具面（预算 / plan.validate）→ `dsh-open-world`（聊天坞 + 入口归纳）。
> 原则：只改项目文件，不动运行中的系统、不装软件、不启服务；**未做任何 git commit / push**，全部改动留在工作区待审阅。
> 上一份评估见 `docs/mcp-dsp-review-20261001.md`（626 条既有断言全绿；隔离复现 4 类边界缺陷）。

## 0. 一句话结论

夜间共改动/新增 17 个文件（宿主层 8、Open World 9），**新增 45 条断言全部通过**（宿主边界 26 + 聊天存储 19），既有 52 条宿主断言保持全绿；
上轮复现的 4 类宿主边界缺陷（git 逃逸 / 联接绕过 / 提交范围泄漏 / 二进制快照损坏）均已修复并有回归测试锁定；
Open World 增加本地优先的**聊天坞**（像微信一样发消息、发文件）并把入口收进两个日常动作位。

## 1. 改动清单

### 1.1 底层 · dsh-self（宿主执行层）

| 文件 | 行数 | 改动要点 |
| --- | --- | --- |
| `host-runtime.mjs` | 503 | ① `deny_names` 在 realpath 之后**复检**（联接/别名不再绕过）；② 二进制目标拒写（`binary-target-unsupported`）；③ `previewFsWrite` 返回 `ok / pending-approval / denied` 三态；④ 快照附带 `sha256` + `byteLen`；⑤ `fs.write` 拒绝破坏非 UTF-8 无损文本；⑥ `git commit` 改为「未跟踪先 intent-add → `git commit --only -m <msg> -- <files>`」，返回 `strategy: 'only-paths'` 与 `staged_before/after` |
| `host-rewind-bridge.mjs` | 184 | 快照 v2（`version/existed/encoding/byteLen/sha256/mode/before`），兼容 v1；回滚校验 sha256 + 长度并回 `verified`；旧版快照内容未知时拒绝回滚 |
| `host-policy.yml` | 65 | `binary_write: refuse`；新增 `deny_args`（git `-C/--git-dir/--work-tree/--exec-path/--namespace/--upload-pack/--receive-pack/--config-env`、`node -e/-p/--eval/--require/--loader/--import/--inspect`、`pnpm -C/--dir`）；`max_steps` 由策略读取 |
| `host-agent.mjs` | 299 | 任务级账本（`{version:2, runs:{runId:…}}`，旧单任务文件自动升级）、`DSH_HOST_RUN_ID`、审计先脱敏再落盘、dry-run 被拒返回 `ok:false`；新增 `plan.validate` 工具与 `sessions` / `reset-session` 命令 |
| `plan-validate.mjs` | 123（新） | 13 项能力登记表 + 计划校验：写后执行 / 双提交 / 配置写后再执行判为冲突；疑似凭证与越界路径给警告 |
| `index.js` | 360 | HTTP 面暴露 `plan.validate` 与新命令 |
| `package.json` | — | `test` 脚本纳入边界回归 |
| `test/host-boundary-regression.mjs` | 235（新） | B1–B9 共 26 条断言（详见 §2） |

### 1.2 Open World · 聊天坞

| 文件 | 行数 | 改动要点 |
| --- | --- | --- |
| `bridge/chat-store.mjs` | 258（新） | 线程/消息/附件落本地文件；文件名清洗 + 敏感名拒绝；尺寸与条数上限 |
| `bridge/chat-view.html` | 362（新） | 独立可打开的聊天页（含离线演示模式，便于无桌面环境预览） |
| `client/modules/chat.js` | 246（新） | 壳内 `ChatDock`：未读、搜索、拖放、粘贴、附件、失败重试、注入当前会话 |
| `index.js` | 3266 | 新增 `/api/open-world/chat/*` 路由（下节 API 表） |
| `client/modules/constants.js` | 145 | `CHAT_*` URL 常量、`APP_SURFACES.chat`、快捷操作加「聊天」；预留 `DAILY_SURFACES / LAB_SURFACES / UI_MODE_KEY` 分组键位 |
| `client/modules/shell.js` | 1330 | 内嵌面板 `chat` 分支 + `SURFACE_META.chat` |
| `scripts/client-build-meta.mjs` | 102 | `MODULE_ORDER` 纳入 `chat.js`（在 `constants.js` 之后） |
| `test/chat-store.mjs` | 80（新） | 聊天存储 19 条离线断言 |
| `package.json` | — | `test` 纳入聊天存储用例；`test:chat` 单独入口；files 增加两个桥文件 |

### 1.3 聊天坞存储与接口

- 存储：`<home>/open-world/chat/{meta.json, messages/<thread>.json, files/<thread>/<sha12>-<name>}`
- 上限：正文 8000 字、单附件 8 MiB、单线程 500 条、线程 50 个；文件名清洗并拒绝 `.env / credentials / id_rsa / *.pem` 等敏感名
- 接口：`GET /chat/threads`、`GET /chat/messages?thread=&limit=&since=`、`POST /chat/post`、`POST /chat/upload?thread=&name=`、`GET /chat/file?thread=&id=&download=`、`POST /chat/read`、`GET /chat/view`
- 消息落盘后，用户消息会同步一份到既有信箱（`kind: 'chat'`）并触发 SSE，助手侧可沿用原有通道回话

## 2. 旧缺陷 → 现在行为（回归测试锁定）

| 编号 | 上轮复现的问题 | 现在行为 | 对应断言 |
| --- | --- | --- | --- |
| F01 | `git -C <其它目录>` / `--git-dir` 逃出 cwd 白名单 | 参数级拒绝（`ok:false, error:arg-denied`） | B1、B1b、B2 |
| F02 | 联接（junction）别名绕过 `deny_names` | realpath 后复检直接拒绝 | B4a、B4b |
| F03 | `git add` + 普通 commit 带入既有暂存区无关文件 | 只提交清单内文件，既有暂存保留并可审计 | B5a–B5e |
| F04 | 二进制快照/回滚报成功但字节损坏 | 二进制拒写；文本回滚逐字节校验 | B6a–B6c、B7a–B7e |
| 新增 | 预算跨任务串号 | 每任务独立账本，互不影响，旧记录保留 | B8a–B8d、B9a–B9c |

> 回归测试自带隔离夹具（`%TEMP%` 内独立仓库、提交前断言 toplevel 相等、结束后自清理），不触碰真实仓库。

## 3. 为什么把聊天坞做成「微信/QQ 式」

**好处**

1. **说一句话就能派活**：聊天即入口，不必先建任务、填表单；拖一份文件进去就等于把文件加入了工作上下文。
2. **历史和附件是真文件**：消息与附件都落在 `<home>/open-world/chat/`，可以直接备份、可以审计、可以用任何工具打开，不是只存在于内存或远端账号里。
3. **附件可点开、可下载**：`/chat/file` 内联预览、`?download=1` 下载；不像传统对话框只能「看一眼」。
4. **未读、搜索、拖放、粘贴、失败重试**都在壳内完成，与任务看板/回退时间轴同一套壳，日常操作不外跳。
5. **与信箱打通**：发出去的消息会进既有信箱并触发 SSE，助手沿用原通道回复；等于给现有通道加了一层「人话界面」。

**边界（需要明确）**

1. 这是**本地办公聊天**，不是加密 IM：落盘明文，只适合本机/受控环境，不要用来传密钥或机密材料。
2. 单附件 8 MiB、正文 8000 字；大文件请走共享目录或既有文件通道。
3. `.env`、`credentials`、`id_rsa`、`*.pem` 等敏感名会被直接拒绝（保护优先于便利）。
4. **不替代对外微信/QQ**：没有账号体系、没有跨机投递，只在 Open World 所在机器上工作。
5. 需要 Open World 服务在本地运行；壳内未加载 `chat.js` 时面板会提示 `运行 npm run build:client`。

## 4. 验证记录（远端 D:\dsp 实测）

| 命令 | 结果 |
| --- | --- |
| `node dsh-self/test/host-boundary-regression.mjs` | **26 passed, 0 failed** |
| `node dsh-self/test/host-fs-write-snapshot.mjs` | **26 passed, 0 failed** |
| `npm --prefix dsh-open-world run build:client` | `CLIENT_BUILD=3a795ae8cc`（v2.78），产物 340 036 字节 |
| `npm --prefix dsh-open-world run check:client` | `OK — CLIENT_BUILD 3a795ae8cc` |
| `npm --prefix dsh-open-world test`（13 个套件） | **533 passed, 0 failed**（含新增 chat-store 19） |
| 静态核对（`client.js`） | 含 `dsh-open-world/chat`、`ChatDock`、`panel === 'chat'`、`/api/open-world/chat/post`，且 chat 模块位于 shell 之前 |

逐套件：smoke 226 / bridge 34 / manifest 8 / rrm 62 / fleet 13 / world-state 21 / space-auth 26 / space-acl 52 / capability-registry 14 / capability-graph 13 / world-packs 24 / action-layers 21 / chat-store 19。
较上轮基线（514）净增 19 条，均为新增用例。

## 5. 审阅指引

- 改动文件：§1 两张表；`git status` 中与本次相关的为 `dsh-self/*`、`dsh-open-world/{index.js,package.json,client.js,client/modules/*,bridge/*,scripts/*,test/*}`、新增 `dsh-self/test/host-boundary-regression.mjs`、`dsh-open-world/test/chat-store.mjs`。
- 只想快速看效果：打开 `http://127.0.0.1:<Open World 端口>/api/open-world/chat/view`（离线演示模式不依赖服务）；
  壳内则点左侧「快捷操作 · 聊天」。
- 只想快速回退：`git checkout --dsh-self dsh-open-world`（或逐文件 `git restore`）；新增文件直接删除。
- 尚未接线（预留）：`DAILY_SURFACES / LAB_SURFACES / UI_MODE_KEY` 只是键位，**没有**本夜可切换的分组开关 UI，避免在冻结期改动导航结构。
- 与规划对齐：`plan.validate` 对应 `ARCHITECTURE_PLAN.md` 的 P2 slice1；本夜只做能力与校验，不改冻结中的架构。

## 6. 建议的下一步

1. 用一晚的产物跑一次「真任务」试跑（写文件 + 提交 + 回滚），确认审计记录符合预期。
2. 若需要分组开关：在 `app-layout` 的快捷操作区按 `UI_MODE_KEY` 折叠实验组（本夜预留键位已就绪）。
3. 聊天坞可选增强：消息检索命中高亮、按日期归档、把附件一键挂到当前任务。
