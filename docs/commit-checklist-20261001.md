# 提交清单（Commit Checklist · 2026-10-01 复检后定稿）

> 仓库：D:\dsp（单一仓）· HEAD **05301e3** · 工作区 47 文件改动 + 新增若干
> 复检终态：**15 套件全绿**——fresh 0 · smoke 228/0 · bridge 40/0 · manifest 8/0 · rrm 62/0 · fleet 13/0 · world-state 21/0 · space-auth 26/0 · space-acl 52/0 · capability-registry 14/0 · capability-graph 13/0 · world-packs 24/0 · action-layers 21/0 · chat-store 25/0 · garden-view 35/0 · **command-census 33/0**（日志 _scratch/recheck-final.log、re2-*.log）
> 复检中抓到并已解决：远端测试文件漂移（census 220 行/69 断言假象）——已用本地干净版整推覆盖，两端 md5 一致（census 0f0ac752…、garden 5a5ee3fe…）后重跑定账。

## A 组 · 开放世界主线（dsh-open-world/）——本轮验证全覆盖 ✅

**改动（M）**：README.md · bridge/action-layers.mjs（rewind-panel 登记）· bridge/capability-registry.mjs（garden 面）· bridge/execute.mjs · client.js（构建产物 bf449aecf9→16be982e75）· client/client-main.js（进世界门+品牌行星）· client/modules/{app-layout,ati-lab,ati-view,chrome,constants,hooks,hubs,idea,portal,shell,styles,views-space}.js · index.js · open-world.yml（worlds.garden）· package.json（files/test 链/test:census/verify）· scripts/client-build-meta.mjs · scripts/launch-desktop-cdp.mjs

**新增（??）本轮验证覆盖**：bridge/chat-store.mjs · bridge/chat-view.html · client/modules/chat.js（常量化）· client/modules/garden-view.js（十景+可及性+防抖）· test/command-census.mjs（第 15 套件）· test/garden-view.mjs · test/chat-store.mjs

**新增（??）协作者产物·随仓提交**：client/modules/conversation.js · client/modules/history.js · test/{boot-integration,build-meta,conversation,desktop-launcher,history,rra-integration,ui-runtime}.mjs · .gitattributes · .gitignore · LICENSE · RELEASE_CHECKLIST.md（这些不在本轮 15 套件覆盖内，提交前可抽查；不阻塞）

## B 组 · 550C 插件（dsh-550c-boot/ 新家，untracked）✅

- 新家 **D:/dsp/dsh-550c-boot/**（今日从 _scratch 迁出，diff 一致；_scratch 原件留作备份）
- 修复：src/client.js（播完才进门 · 650ms 防误触 · prefers-reduced-motion · 跳过角标+3.5s 淡出 · 设置文案）· lib/client.js 已重建（语法 0）· package.json **v0.1.3**
- 挂接：profiles/desktop 已指向新家（link 已验证）；plugins.yml 同步；**下次重启桌面生效**（当前运行中实例仍用旧路径，两份一致无风险）
- doctor 说明：apply 时 doctor 报的 `electron-run-as-node`（high）是**本 MCP 终端环境变量所致**，历史体检既有同条，与你桌面 GUI 无关

## C 组 · 生态配套（协作者+本轮小改）——随仓提交

- dsh-desktop-toggle：plugins.yml（550c link 新家）· active-preset.json · apply.mjs · presets.yml（协作者）
- dsh-self：host-runtime/host-agent/host-policy/host-rewind-bridge/capability-registry.yml/client* 等（模型能力注册表工作，DeepSeek 会话产物）+ 新增 plan-validate.mjs · test/{capability-registry-meta,host-boundary-regression}.mjs（建议提交后跑 dsh-self 自测）
- 其余：deep-whale-day-night-theme · dsh-apiproxy-compat（含 prompt.test.mjs）· dsh-rewind-plugin · dsh-better-sidebar/ventus-*（子仓指针）

## D 组 · 文档（docs/ 28 份，全部 untracked）

本轮产出：VERSIONS.md（v1-v100 总账）· ow-experience-report · ow-5h-plan-census · mcp-garden-view · mcp-open-world-rebuild · mcp-550c-gate-verify · mcp-550c-complete-play · mcp-color-line · dsh-data-map · deploy-onepage · troubleshoot-onepage
协作者产出：mcp-open-world-gaps-tests / history-in-world / native-conversation / github-review / historical-artifacts / responsive-diagnostics / stability / user-acceptance / plugin-agent-acceptance / host-session-acceptance / live-acceptance / agent-fix-acceptance / resume-verification / isolated-actions / xing-xiang / dsp-review / connection-* 等

## E 组 · 提交前请甄别（2 项）

- `pelican-bike.html`（仓根，来历不明，建议确认后再定）
- `../dsh-voice/`（未跟踪目录，确认是否入库或加 ignore）

## 建议提交切分（4 个 commit）

1. `feat(open-world): 园子第四视图 + 聊天合一 + default_view（P1-P3）+ 第15套件全指令普查`
2. `feat(550c): 播完才进门 + 防误触 + reduced-motion + 跳过角标（v0.1.3，迁家 D:/dsp/dsh-550c-boot）`
3. `feat(eco): dsh-self 模型能力注册表 + toggle 档位/链接维护`
4. `docs: 交付文档 28 份 + 部署/排查一页纸 + 百版总账`

## 遗留（不阻塞提交）

- 真机轮：带 `--remote-debugging-port=9333` 重启桌面后跑 `npm run test:live`（唯一硬待办）
- ⏳ 基础设施项：census 判定表 HTML 版 / CI 就绪检查（需 CI 环境）
- 所有改动未 push；commit 由你执行

## 追记（2026-10-02 下午 · v106）
新增待提交：`dsh-desktop-toggle/plugins.yml`（+dsh-office 条目）· `dsh-open-world/bridge/capability-registry.mjs`（office 条目+tools[]）· `client/modules/chat.js`（成文 chip）· `test/capability-registry.mjs`（14→18）——建议并进 A 组（开放世界主线）一起提交，或单独第 5 个 commit「feat: office 成文（Tianshu 择优 #6/#5）」。office 本体在 profile node_modules（不入仓）。全量复验已过（构建 3b09508e25）。

## 追记 2（2026-10-02 傍晚 · v107）
再增待提交：`client/modules/ati-view.js`（重写）· `client/modules/app-layout.js`（去 preset 传参）· `client/modules/hooks.js`（去实验室命令项）——与 v106 四文件一并入 A 组或第 5 commit。`client/modules/ati-lab.js` 文件暂留（已无人引用，工厂不执行；物理删除留待后续清理窗口）。
