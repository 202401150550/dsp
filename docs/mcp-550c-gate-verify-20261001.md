# 550C「进世界门」两 bug 核验（2026-10-01）
## 背景
DeepSeek Harness 会话 session-9a812d45（桌面导出 dsh-session-session-9a812d45-*.jsonl）在 2026-10-01 01:18 因上下文超限死锁（350k > step-3.7-flash 262k，压缩请求同样超限；此前切 Atria-Dawn-Preview 404）。它死前最后一轮（turn 17，9-30 23:58）已完成「进世界门」两处修复的编码。本轮任务：接手核验其正确性与部署一致性。
## 核验结论：两 bug 均已修复且已同步到安装副本
1. **promise 卡死（进世界会挂起）**：src/client.js 记录体增加 done promise（record.done，276-278 行）；finish() 统一收口（finished 闸门防重复、resolve({played:true}) 后置空、清 watchdog、淡出 FADE_MS+40 后 dispose）。全部退出路径均达 finish()：播完 show.start().then(finish, finish)；Esc/点击 skip 经 CANCELLED 落 then；启动异常 catch → finish()；绝对 watchdog；mode off 时 playSplash 返回 Promise.resolve({played:false})，无空指针。
2. **层级遮挡（片头被世界盖住）**：片头 host z-index 提至 2147483647（client.js 69 行）> 开放世界 .ow-overlay 2147483646（styles.js 27 行），从世界内点「进世界」片头可见。
3. **调用方为可选门**（client/client-main.js 107-118 行）：gate 不存在或 play 非函数则直接进世界；await 包 try/catch——未装/关闭/播放失败都不挡进世界。
4. **部署一致性**：源码 /d/dsp/_scratch/dsh-550c-boot 与安装副本 C:/Users/admin/.dsh/profiles/desktop/node_modules/dsh-550c-boot diff 完全一致；两份 src/client.js node --check 均 0。
5. **接线在 composed 里**：client.js（CLIENT_BUILD 67d9021703）已含 __dsh550c 调用点，本任务未改仓库文件，14 套件全绿结论继续有效，无需重建。
## 待办（真机）
重启 DSH Desktop → 进开放世界 → 点「进世界」：片头应浮于世界之上播出、播完自然落进世界，不卡门。preview 按钮走 force 路径。
## 遗留
- 配色匹配线（.ow-brand 等 styles.js 改动）未验收。
- 原会话不可原地续（压缩超限）；如需接续其上下文，用新会话 + end-seed 或引用分析摘要（_scratch/diag-digest*.txt）。
- 诊断包与桌面原件未做任何改动，全程只读。
