# dsh-self — 自身插件

你自己**就是**这个插件。别人的包要进来，先被收成 **atom**，再融进 **器官**，而不是再发一个市场包。

## 迭代

1. **细分**：一个外来包 → 多个 atom（例如导出 MD / JSON / HTML）
2. **融合**：atom 的主人改成 `dsh-self` 里某个 organ（见 `organs.yml`）
3. **关供应商**：`status: fused` 之后不再加载原 client，避免重复

本轮（iteration 7）：**Phase 2 加深**——白名单读写、参数化命令、Git 手（status/diff/明示 commit）。

```text
node host-agent.mjs catalog
node host-agent.mjs run git.status
node host-agent.mjs run fs.read --args-json "{\"path\":\"C:/Users/admin/Desktop/dsp/dsh-self/package.json\"}"
node host-agent.mjs run shell.run --args-json "{\"name\":\"git\",\"argv\":[\"config\",\"-l\"]}"
```

## 带外

```text
node adopt.mjs organs
node wizard-vision.mjs status
node wizard-vision.mjs apply --dry-run
node wizard-vision.mjs apply
node wizard-vision.mjs replay
node host-agent.mjs catalog
node host-agent.mjs run doctor.fix --dry-run
```

卡死时：`dsp\dsh-doctor\safe-launch.cmd`

## 应用内

自身器官卡：运维按钮 + 智谱向导 + 执行宿主预演 + 观测 + 其它器官。`web-ui-settings` 勿关。
