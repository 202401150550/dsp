# Open World · 「进世界」分层总规划（WORLD_PLAN）

> 状态：**规划定稿草案** · 2026-09-09  
> 前提：运行时 **v2.76** · 壳定稿 [SHELL_PLAN.md](./SHELL_PLAN.md) · 系统分层 [SYSOP_v0.1.md](./SYSOP_v0.1.md) · ACL/契约已落地  
> 主航道（冻结）：**先进一个世界（体验）→ 再扩 peer 写（跨机）→ 元宇宙素材以后再说**  
> **阶段 0–4 已落地**（进世界 · peer+memory-search · 世界包接口预留 · v2.73）

---

## 0. 定调

1. 底下用 **拓扑 / 数学**，要稳；稳了再往上加，不许倒着堆 UI。  
2. **稳定性 + 易用性** 同时验收：约 **60%** 普通 DSH 用户能在 5 分钟内走通主路径。  
3. 产品仍是 **系统壳**，不是聊天替代品；「世界」= 从壳进入的真实器官面，不是第二套 Agent。

---

## 1. 分层模型（自下而上，冻结）

```text
L4  跨机放大器（后置）     peer 白名单扩展 · Pair 仍独立
L3  叙事（可选壁纸）       拓扑动画 / ATI 实验室 · source=metaphor
L2  壳 + 进世界仪式        状态·动作·事件 · 一键进入 · 退回
L1  宿主桥                 probe · resolveEmbedGate · 插件 API
L0  稳定核（可测数学）     CapabilityGraph · DerivedMetrics · Gates
```

| 层 | 职责 | 拓扑/数学用在哪 | 禁止 |
|----|------|-----------------|------|
| **L0** | 图 + 度量 + 门禁 | 能力图、进场代价、健康等 **derived** 合成（公式可单测） | 宣称神经 / 生产 ML |
| **L1** | 探测与 embed | online/offline 作边权 | 空壳 embed |
| **L2** | 壳 + **进世界仪式** | 默认 CTA = 代价最低的稳路径 | 术语墙；NEXORA 黑话首屏 |
| **L3** | 壁纸 | 用 L0 数驱动动画；标签固定隐喻 | 混进 60% 验收 |
| **L4** | Space / Pair | 跨机放大体验 | 合并两条协议；未稳就扩写 |

**数学角色（分层都要）**

- 底层：真公式、可证伪（图、权重、derived 指标）。  
- 表层：环面 / 莫比乌斯等可玩，但 **不决策、不冒充智能**。  
- `rra-proto`：大行李，**默认不进 60% 路径**；无 checkpoint 不开生产神经 RRA。

现有分家继续加强：`ati.source=derived` · `lab.*.source=metaphor` · CapabilityRegistry。

---

## 2. 60% 易用性（可验收，不是感觉）

**「会用」= 连续做完 4 步，无需读文档：**

1. 点 ✦ 打开壳（水印版本正确）  
2. 看懂「现在稳不稳」（状态页白话）  
3. **一键进入一个世界**，完成一件真事  
4. 退回壳 / 回聊天；事件里有痕迹  

**不进 60% 默认路径：** peer 签发、Hindsight、ATI 实验室、Monitor JSON、Space LAN、Pair 配对。

**度量（目标）：** 冷启后「触发器 → 世界内首个成功动作」≤ **90s**；主路径文案无 Host / OWIP / principal。

---

## 3. 「进世界」共用契约（所有世界同一套）

1. 壳上主 CTA 或节点一击 → `resolveEmbedGate`  
2. 通过则进入主区/全屏世界（不是又一张说明卡）  
3. 世界内提供 **一件默认真事**（看列表 / 新建 / 执行）  
4. 顶栏固定：**返回开放世界** · **返回聊天**  
5. 进入/离开写审计事件（`enter-world` / `leave-world`）  
6. 失败只 toast `howToEnable`；禁止半开空白  

新世界必须：登记 CapabilityRegistry · 可 feature flag 关掉 · 关掉后壳仍完整可用。

---

## 4. 阶段路线图

### 阶段 0 · 底座固化（缝合）

- 已有：壳三栏、ACL、Registry、embed 门禁、CDP live。  
- 补：显式 **CapabilityGraph**（节点=registry 行；边=可进场；权=online/失败/代价）。  
- 门禁：`npm test` + `test:live-cdp` 全绿才能进阶段 1。

### 阶段 1 · 第一个世界（主航道）

**默认第一刀：任务看板**（「有什么要干」60% 心智最稳）。  
若主人点名 rewind，则对调，契约不变。

- 落地进场仪式 + 默认真事（看队列或新建/跑）。  
- L0：默认 CTA = 图上代价最低且 online 的工作边（通常 task-board）。  
- 版本建议：**v2.70**（体验里程碑）。

### 阶段 2 · 第二世界 + 导航诚实

- 第二世界：**对话回退**（同一仪式）。  
- 节点灰态 + 一句如何启用；禁止点进空壳。  
- 极简「世界地图」白话：**任务 / 回退 / 连接**（不是星系黑话）。

### 阶段 3 · peer 写（跨机放大器）

仅当 1–2 绿且不破坏 60% 路径：

- `PEER_ACTION_ALLOWLIST` **每次 +1**（单测 + 审计）。  
- 顺序建议：已有消息 → 更深只读 → 极窄「请求本机白名单动作」。  
- Pair 永远独立；枢纽双卡不合并。
- **v2.72**：+`memory-search`（更深只读）。
- **v2.74**：+`world-state-get`（更深只读 · 读 world-state）。
- **v2.75**：+`request-local`（极窄本机动作；`PEER_LOCAL_REQUEST_ALLOWLIST`=`share-snapshot`）；下一刀另议。

### 阶段 4 · 元宇宙素材（后置）

- ALL-IN-ALL 等 = 可选世界包，走同一仪式 + registry。  
- **默认档关闭**；不拖冷启、不进 60% 文案。
- **v2.73**：`bridge/world-packs.mjs` + `snapshot.worldPacks`（source=reserved）；`worlds.packs.all-in-all: false`。
- **v2.76**：opt-in 后可进诚实占位世界（mode=placeholder）；默认仍关、不进 60% 地图。

---

## 5. 稳定性工程（每次迭代必过）

| 门禁 | 要求 |
|------|------|
| 离线 | `npm test`（acl · registry · 进世界 smoke） |
| 真机 | `desktop:cdp` + `test:live-cdp`（水印 + 进世界 CTA） |
| 契约 | 禁止裸字符串 embed；必须走 registry/graph |
| 诚实 | probe / derived / metaphor 分家；主路径不宣称神经 RRA |
| 性能 | 默认 `snapshot?view=shell`；进世界不拉调试全量 |
| 回滚 | yml flag；关世界后壳仍可用 |

---

## 6. 文档同步（阶段 1 一并做）

| 文档 | 改什么 |
|------|--------|
| 本文件 | 真源规划 |
| [QUICKSTART.md](./QUICKSTART.md) | 改成「打开 → 进入任务 → 退回」 |
| [SYSOP_v0.1.md](./SYSOP_v0.1.md) §8 | 主航道=进世界；跨机/元宇宙后置 |
| [DEVELOPER.md](./DEVELOPER.md) | 进世界契约；与 Space/Pair 表并列 |
| [CHECKLIST.md](./CHECKLIST.md) | 60% 四步 + 门禁勾选 |

---

## 7. 明确不做（本规划周期）

- 合并 Space 与 Pair  
- 默认开 Hindsight / remote-web-ui / 全家桶  
- 把 rra-proto 挂进 60% 路径或宣称生产神经 RRA  
- 为数学好看把星系视图重新扶成主交互  
- 未过门禁扩 peer 写列表  

---

## 8. 节奏（单人连续，粗估）

| 周次 | 产出 |
|------|------|
| W1 | CapabilityGraph 雏形 + 任务世界进场 MVP |
| W2 | CDP/易用验收 + QUICKSTART 60% 路径 + **v2.70** |
| W3 | 回退世界同一契约 + 节点灰态 |
| W4+ | 按需 peer +1；元宇宙仅接口预留 |

---

## 9. 待主人拍板（一句话即可）

- 第一世界是否确认 **任务看板**？（推荐）  
- 确认后从阶段 0→1 开工；未确认前不改主路径代码。
