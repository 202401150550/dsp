# Open World · 给开发者（一页）

> 对接壳 API / 真机联调时看本页即可。产品用法见 [QUICKSTART.md](./QUICKSTART.md)；协议全文见 [OWIP_v0.1.md](./OWIP_v0.1.md)。  
> 运行时：**v2.77** · 协议（space 开）：**owip/0.3-draft** · 进世界：[WORLD_PLAN.md](./WORLD_PLAN.md)

---

## 1. 为什么脚本会 403

Desktop 对本机**进程外** HTTP 常返回 **403**（Host/连接围栏）。  
**同源 cookie**（壳内 `fetch`）与 **CDP 页内 `Runtime.evaluate`** 可用；裸 `curl 127.0.0.1:43120` **不承诺**。

| 通道 | 场景 | 承诺 |
|------|------|------|
| 壳内同源 | UI 轮询 / 按钮 | 默认（loopback-shell） |
| Space Bearer | 第二屏 / LAN | 默认只读；`peer` 仅白名单回写 |
| 进程外 HTTP | 外部脚本 | **不承诺** → 用 CDP |

---

## 2. CDP 真机联调

### 启动 Desktop（带 CDP）

```powershell
# 先完全退出 Desktop（含托盘）
cd D:\dsp\dsh-open-world
npm run desktop:cdp          # 等价：node scripts/launch-desktop-cdp.mjs
npm run test:live            # HTTP 403 时自动走 CDP
```

### 命令

```powershell
cd D:\dsp\dsh-open-world
npm run build:client          # 改 client/ 后必跑；再完全退出并重启 Desktop
npm test                      # 离线门禁
npm run test:live             # Desktop 已开；HTTP 失败/403 时自动 CDP
npm run test:live-cdp         # 直接 CDP 冷启验收（snapshot shell · coreShell · 水印）
npm run test:live-rra         # RRA；外网 403 时自动落到 CDP
npm run test:live-rra-cdp     # 直接 CDP 页内：snapshot / rra probe·sketch
```

要点：

1. 先确认 `http://127.0.0.1:9333/json/list` 有 `type: page`  
2. CDP 在 **Electron 页内** 发同源请求，绕开进程外 403  
3. 神经 RRA 仍默认关；无真实 checkpoint 时不要宣称生产神经通路（见 [RRA_NEURAL.md](./RRA_NEURAL.md)）

---

## 3. Snapshot

| URL | 用途 |
|-----|------|
| `GET /api/open-world/snapshot?view=shell` | **UI 主路径**（瘦身；`SNAPSHOT_URL`） |
| `GET /api/open-world/snapshot` | 完整字段；Monitor / 调试 |

壳主路径依赖：`core` · `nodes[].action` · `events` · `mailbox` / `fleet` 摘要 ·（主视图仍带 `ati` / `lab`）

---

## 4. 核心 Host action（日常）

运输：`POST /api/open-world/action` · body `{ "action": "<id>", ... }`  
源码常量：`CORE_SHELL_HOST_ACTIONS`（`bridge/action-layers.mjs`）

| action | 干什么 |
|--------|--------|
| `send-message` | 信箱发消息 / 广播 |
| `idea-inject` | 人格前缀包装后投递（Host 包装 → Bridge 真注入） |
| `memory-search` | Hindsight 检索 |
| `world-state-get` / `world-state-save` | 壳 UI 状态（页签 / 窗口模式） |
| `space-token-issue` / `space-token-status` | Space 令牌（默认 `second-screen`；可显式 `role: peer`） |
| `world-enter` / `world-leave` | 进世界审计事件（壳 CTA → 任务/回退世界） |
| `pair-issue` / `pair-stop` | Pair 配对（需 remote-web-ui 在线） |

**进世界（v2.70）**：状态页 CTA「进入 · 任务」→ Bridge `enter-world` → embed；图真源 `bridge/capability-graph.mjs`。

**Space ACL（0.3）**：observer 禁写；peer 走 `POST /space/peer-action`；SSE 用 `POST /space/sse-ticket`。能力契约：`bridge/capability-registry.mjs`。

### Space vs Pair（勿混）

| | **Space（OW）** | **Pair（remote-web-ui）** |
|--|-----------------|---------------------------|
| 目的 | 局域网第二屏观察 + 可选受限回写 | 手机控工作区（`/m`） |
| 凭证 | OW Bearer · role=`second-screen`\|`peer` | Pair 配对码 / remote Host |
| 写能力 | 仅 peer：`send-message` · `mark-read` · `memory-search` · `world-state-get` · `request-local`(→`share-snapshot`|`space-token-status`) | 由 remote-web-ui 决定（非 OW ACL） |
| 入口 | 枢纽「跨机 · 观察/回写」· `space-view.html` | 枢纽「跨机 · 手机控」· `pair-issue`/`pair-stop` |
| 信箱 `to: remote` | 本地 outbox，**不是**手机实时通道 | — |

其余 Host（`notification-*` · `idea-compare` · `rrm-session-*` · `space-token-revoke` …）标 **高级**，见 `framework.actionLayers.host.advanced`。

---

## 5. 常用 Bridge 类型（Client）

不经 Host HTTP；壳内 `bridgeExecute` → DSH session / 插件 / DOM。

| type | 干什么 |
|------|--------|
| `inject-message` | 投递到官方聊天（IDEA 链路第二段） |
| `rewind-open` / `rewind-exec` | 回退表面 / 执行锚点 |
| `task-run` / `task-create` | 任务看板 |
| `session-focus` | 切换会话 |
| `embed` / `enter-app` / `idea-panel` | 壳内表面 |
| `settings` / `panel` / `remote` | 打开宿主面板 |

完整列表：`BRIDGE_ACTION_TYPES` · `framework.actionLayers.bridge`。

**IDEA 投递路径**：`Host idea-inject`（包装）→ `Bridge inject-message`（聊天）。

---

## 6. 诚实边界（对外口径）

- ATI 实验室曲线 / 拓扑 = **隐喻**，不是实时 ML  
- `memory.neural.implemented` / `fullNeuralRra` 在无 checkpoint 时保持 **false**  
- 进程外 HTTP 绿 = **不要**写进对外承诺  

相关：[SHELL_PLAN.md](./SHELL_PLAN.md) · [SYSOP_v0.1.md](./SYSOP_v0.1.md) · [`../rra-proto/PRODUCTION.md`](../rra-proto/PRODUCTION.md)
