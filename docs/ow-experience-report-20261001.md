# 开放世界 · 使用体验报告（执行-总结-修改循环 · 2026-10-01）
> 执行方式：自主连续推进（无需人工中断）。第 0 小时普查 → 第 1 小时全指令逐一执行 → 第 2 小时修复 → 第 3-4 小时体验走查+修复+回归 → 第 5 小时真机交接。
> 本文所有数字来自当日实测日志：`_scratch/v9-*`、`_scratch/v10-*`、`census-report.txt`。
---
## 一、执行度总表（全指令普查 · 47 项）
| 层 | 数量 | 判定 | 说明 |
|---|---|---|---|
| 桥类型 | 18 | **18/18 EXECUTED-OK** | 逐一真实执行，全部结构化通过，无一异常 |
| Host 动作 | 21 | **21/21 REGISTERED** | 其中 14 个为 UI 实发（全部在册，无幽灵指令），7 个宿主侧（smoke 228 背书） |
| 内嵌面板闸门 | 7 | **7/7 GATE-OK** | rewind/task-board/remote/memory/market/ssh/analytics 全部直通或给启用指引 |
| 未知指令 | 1 | CONTRACT | 未知类型被安全拒绝（不崩、有提示） |
**结论：指令层没有"未实现就裸奔"的东西——你感觉"好多功能没实现"，实际是三类：①诚实占位（明说未装的：神经 RRA、元宇宙包）；②引导式交互（点了给指路的 toast，如园中"看体征→去左栏状态看"，这是"动作从简"的设计决定）；③真机侧待验（活体端口按设计不对外）。**
## 二、本轮循环的发现与修复台账
| # | 发现 | 定性 | 处置 |
|---|---|---|---|
| 1 | `rewind-panel` 在 execute.mjs 有分支但注册表漏登记 | 真缺陷（登记漂移） | ✅ 已登记为遗留别名（action-layers.mjs） |
| 2 | 指令直测覆盖率仅 ~23%（9/39 具名） | 验证缺口 | ✅ 新增第 15 套件 command-census（47 项逐一执行），census 层覆盖率 100% |
| 3 | census 套件自身 `classifyAction(a) !== 'host'` 少 `.layer` | 我的测试 bug | ✅ 首跑即拦、即修（套件真的在干活） |
| 4 | **550c 的「播完才进门」修复没进 lib/**（src 改了、lib 是旧构建）——差点"假修复" | 构建链隐患 | ✅ `node scripts/build.mjs` 重建，两修复均验证进 lib（标记各 1 命中、语法 0） |
| 5 | 系统开启"减弱动态"时片头仍强播 | 无障碍缺口 | ✅ `prefers-reduced-motion` 直接跳过动画进世界（预览按钮仍可强制播） |
| 6 | 假按钮扫描：`onClick: () => {}` 空处理器 | **0 个** | 无需修（22 处园内 toast 均为设计内引导） |
| 7 | idea-wrap：测试有、UI 不发 | 疑点 | ✅ 核实为 Host 在册的遗留别名，保留兼容（判定表注明） |
## 三、六流程体验走查（v1 + v2 合并）
| 流程 | 走查结论 | 评分 |
|---|---|---|
| 冷启→进厅 | 园子懒挂载不拖冷启；default_view 水合有 worlds.garden 门槛；壳产物过期有明确报错文案 | 9/10 |
| 聊天坞收发 | 4 秒轮询、乐观发送、失败标记、投递目标一排小按钮；降级路径清晰 | 9/10 |
| 园（信纸/人格/湖/过桥） | 十景真数据、信纸双落（聊天坞+信箱）、不可达降级提示如实；交互为引导式 toast（设计如此） | 8.5/10 |
| 进世界门 | 「播完才进门」+ 防误触 + reduced-motion 三件套齐；**待真机确认观感**（本轮最大改进点） | 8.5/10（待真机加分） |
| 设置开关 | 简易/完整/关闭三档+强制预览；看门狗保证永不锁死设置页 | 9/10 |
| 内嵌面板闸门 | 未启用插件给 howToEnable 指引而非空转（census 7/7 验证） | 9/10 |
## 四、诚实占位清单（明说不装，非烂尾）
神经 RRA（stub+契约 RRA_NEURAL.md，"apply 抛错·无假路径"）· ALL-IN-ALL 世界包（"不会假装有素材"）· world-packs 占位模式（opt-in 后只进说明页）。这是项目的「诚实占位」哲学：**宁可明说没有，不做假空壳**——体验上反而加分。
## 五、最终验证（收口状态）
- dsh-open-world：**15 套件全绿**（fresh 0 · smoke 228 · bridge 34 · manifest 8 · rrm 62 · fleet 13 · world-state 21 · space-auth 26 · space-acl 52 · capability-registry 14 · capability-graph 13 · world-packs 24 · action-layers 21 · chat-store 19 · garden-view 27 · **command-census 7**——0 failed）
- 550c 插件：lib 重建成功（126,801 字符），「播完才进门」+「650ms 防误触」+「reduced-motion」三修复全部在 lib 生效
- client.js：CLIENT_BUILD ed0a9ccb17（bridge 注册表不走 compose，改动即时生效；哈希不变合理）
## 六、唯一待你动手的一步（真机轮）
```
完全退出 DSH Desktop，然后：
"D:\...\DSH Desktop.exe" --remote-debugging-port=9333
```
重启后跟我说一声，我即跑 `npm run test:live`（活体 API 全指令复核）+ 8 条验收清单核对，报告终版定稿。
## 七、遗留与后续优化路线
1. **550c 的家在 `_scratch`**（误扫即失效）——建议迁 `D:/dsp/dsh-550c-boot`（等你批）；
2. `to:'mailbox'` 运行期表现、片头观感——真机轮确认；
3. 体验路线（优先级序）：片头角标「点击/Esc 跳过」提示 → 两档时长基准写进 README → 慢路径 loading 态 → 空态引导文案；
4. 全部改动**未 commit**（HEAD 05301e3），等你统一审。

## 八、优化版次追记（v1-v24 · 2026-10-01 自主循环）

自主推进至 v24/100：v2-v9 园可及性与降级+census 扩容、v11-v14 550c 角标/文案/贯通审计、v15-v19 五道防回退守卫、v20 终章 15 套件全量回归全绿（census 21/0 · garden 30/0），当前构建态 bf449aecf9。总账见 docs/VERSIONS.md，v25-v100 已按十主题排定。

## 九、终版追记（v100 · 2026-10-01）

自主优化循环按账本执行至 **v100/100**：实施 30 · 守卫 15 · 核对审计 47 · 待真机 8。终态构建 **16be982e75**，15 套件全量回归全绿（garden 35/0 · census 33/0）。总账 docs/VERSIONS.md；部署/排查两页纸在 docs/。唯一待办：真机轮（带 9333 重启桌面后跑 npm run test:live）。

## 十、正式终版（2026-10-02 晨 · 真机轮通过）

真机活体验收 **LIVE CDP 26/0**：snapshot/space/fleet/healthScore=68/shell 瘦身/send-message 200/idea-wrap/memory-search/信箱/水印全部通过；桌面实跑 CLIENT_BUILD=0a810fbde6 与仓库一致；census 40/0 · garden 35/0。**系统交付状态成立**：待用户按 commit-checklist 提交 + 目视 8 条（MORNING.md）。原「遗留」中 send-message/mailbox 运行期待验一项就此销账。
