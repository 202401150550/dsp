# GitHub 上传指南（2026-10-02 · 贴前体检已做）

## 一、体检结论（本轮全仓扫描）

- 假数据残留：**干净**。隐喻层只剩休眠的 ati-lab.js（无人引用）+ 诚实标签机制本身（保留，它是「推算/隐喻」打标系统）。园子里的 Math.random 是星星/草/流明的坐标散布，动画本性，不是假数据。
- 大体积：dsh-voice **102M**（内含离线模型）、vendor **32M**（第三方）——都不建议进 GitHub。
- 个人信息：会话与信箱数据在仓根 `open-world/`（chat/mailbox/outbox）——**绝不上传**；`_scratch/` 全是过程日志——不上传；plugins.yml 含本机绝对路径（C:/Users/admin、D:/dsp）——自用仓可接受，公开仓建议先过一遍。
- 密钥：历轮扫描未见 token/密钥入库；推送前再跑一遍文末自查命令兜底。
- 待提交：v106/v107 共 7 个文件仍未 commit（HEAD 05301e3）——**上传前必须先按 checklist 完成 commit**。

## 二、上传清单

**建议上传（你自己的原创件）**
- dsh-open-world/（旗舰：开放世界+园子+聊天坞+ATI 拓扑镜）
- dsh-desktop-toggle/（档位开关+apply 工具）
- dsh-self/（器官自愈）、dsh-550c-boot/（进世界开场）、dsh-rewind-plugin/、dsh-ventus-progress/、dsh-apiproxy-compat/、dsh-better-sidebar/、deep-whale-day-night-theme/、dsh-config-doctor/、dsh-doctor/、dsh-file-drop/、dsh-plugin-smooth-stream/、dsh-deepseek-usage-patch/、dsh-enable-image-input-pkg/、dsh-ventus-search/、docs/（文档）

**不上传（加入 .gitignore）**
```
_scratch/
open-world/
*.log
node_modules/
.pnpm-store/
.codex/
.tmp/
.workbuddy/
.zcode/
.freebuff/
vendor/
dsh-voice/          # 102M 模型；如需共享在 README 里发上游链接
dshmarket/          # 第三方市场件，先甄别归属
dsh-mic-input/      # submodule，确认指向你自己的仓库后再收
pelican-bike.html   # E 组甄别项
ati-core/           # 甄别：确认归属与体量再定
```

## 三、历史卫生（关键一步）

老仓库历史里可能已有个人数据（聊天/日志/路径）。公开前二选一：
- **稳妥（推荐）**：以「干净新史」发布——`git checkout --orphan clean-main && git add -A && git commit -m "feat: DSH 生态套件 · 首次公开" && git branch -D main && git branch -m main`，只推这一个分支。
- 简单：先建 **Private** 仓推上去，检查无误后再转 Public。

## 四、推送前自查（一条命令）

```
grep -ril "sk-[a-zA-Z0-9]\{20\}\|api[_-]key" --include="*.yml" --include="*.json" --include="*.mjs" . | grep -v node_modules
```
无输出=放心推。另查 `git log --oneline | wc -l` 确认要推的历史量。

## 五、步骤

1. 按 docs/commit-checklist-20261001.md 完成 commit（含 v106/v107 追记的 7 文件）。
2. 补 .gitignore（上面清单）→ `git rm -r --cached _scratch open-world` 类清理 → commit。
3. GitHub 建仓（先 Private）→ `git remote add origin <url>` → 推送（新史则 `git push -u origin main --force`）。
4. 放 README（见 docs/github-readme-draft-20261002.md）→ 截图三张：园子夜景 / 新 ATI 拓扑镜 / 聊天坞。
5. 加 LICENSE（建议 MIT，你是唯一作者）→ 观察 → 转 Public。

## 六、介绍词（一句话版，用于仓库 About）

> 把 AI 助手的驾驶舱，变成「你的地方」——DSH Desktop 社区生态套件：十景园、聊天坞、真实系统拓扑镜，47 条指令一花一草一木可操控。
