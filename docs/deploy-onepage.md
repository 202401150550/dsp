# 开放世界 · 部署一页纸（小白版）

1. 装好 DSH Desktop，把 `dsh-open-world` 放进 `D:/dsp/`，在 dsh-desktop-toggle 的 plugins.yml 保持 `dsh-open-world: enabled: true`，跑 `node apply.mjs`，重启桌面。
2. 想让小白开机即进园：编辑 `~/.dsh/open-world.yml` 加 `default_view: garden`（确保 `worlds.garden` 未设为 false）。
3. 改过代码后：`npm run build:client`，重启桌面并 Ctrl+Shift+R。
4. 一键自检：仓库里 `npm run verify`（构建新鲜 + 普查 + 园套件）。
5. 出问题：会话页「一键报错」生成脱敏诊断包（若装了 dsh-diagnostic-bundle），发给技术支持。
