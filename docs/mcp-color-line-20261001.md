# 配色匹配线收尾（2026-10-01）
## 背景
9-30 深夜用户提出：开场动画（550C 片头，琥珀 CRT + 星球意象）与进入后的世界颜色要一致、「做相似的处理」。该线系另一位协作者的半成品（.ow-brand +3−3），DeepSeek Harness 会话 turn 17 只完成了「进世界门」两修复，配色线未动即死锁（上下文超限）。本轮接手收尾。
## 侦察结论（接手时的现状）
- 世界的强调色已与片头同源：--ow-accent:#E7B24B == 片头 --am:#E7B24B；大量点缀（fleet/chip/guide/ati-lab）已用琥珀。
- 进世界「抵达浪潮」已是琥珀（.ow-overlay.is-arriving::after 径向琥珀渐隐，styles.js:61）。
- .ow-brand 渲染处在 client/client-main.js:252-254（topbar 左：logo+「开放世界」+格言 tag）。
- 遗留三处：品牌 logo 只是素圈+点（无星球感）；.ow-lab-loss 规则含手误 `stroke-width:2;)}` 整条失效；guide 关闭钮 hover 青白 #c4f5ef 出戏。
## 本轮改动（styles.js 三处，一补丁落地）
1. **品牌 logo = 琥珀小行星**：径向渐变球体（#F6DFA6 高光 → var(--ow-accent) → 渐隐）+ 辉光 + 暗面晨昏线（::after 半影）+ 倾斜光环（::before，26×9px 椭圆环 rotate(-22deg)，pointer-events:none）。尺寸仍 18px，不撑顶栏；呼应片头琥珀与星球意象，科技中国风的「日晕/环星」。
2. **修 .ow-lab-loss 手误**：去掉多余 `)`，ati-lab 损耗线恢复渲染（此前整条规则被浏览器丢弃）。
3. **hover 统一**：.ow-shell-guide-x:hover 文字 #c4f5ef → var(--ow-accent)，全家一个琥珀。
## 验证
- node scripts/compose-client.mjs → **CLIENT_BUILD=968c87e477**（npm 包装层被 pty 吞，直连 compose 成功），node --check exit=0。
- 14 套件全绿：fresh=0、smoke=0、bridge=0、manifest 8/0、rrm 62/0、fleet 13/0、world-state=0、space-auth=0、capability-registry=0、capability-graph=0、world-packs=0、action-layers=0、chat-store=0、garden-view=0，日志无一处 ✗。证据：_scratch/v6-color-build.log、_scratch/v6-color-tests.log。
## 真机验收点（重启 DSH Desktop + Ctrl+Shift+R）
- 顶栏左上「开放世界」旁：琥珀小行星带光环（静态、不闪不吵）。
- 点「进世界」：琥珀浪潮先漫后散（原有行为，颜色与片头一致）。
- 教学实验室内损耗线（ow-lab-loss）恢复显示。
- 引导条关闭钮 hover 变琥珀。
## 账目
- 本轮仅改 styles.js（未 commit，HEAD 05301e3）；styles.js 工作区 diff 现含 550C 期改动 + 园子 CSS + 本轮三处，三者共存、全链绿。
- 桌面会话原件全程只读。
