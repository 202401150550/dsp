# 开放世界 · 故障排查一页纸

| 症状 | 先看 | 处置 |
|---|---|---|
| 顶部红字「壳产物过期」 | client.js 的 CLIENT_BUILD ≠ Host | `npm run build:client` 后完全退出重开 |
| 点「进世界」没动画 | 设置→通用 550C 档位 | 关=不播；系统「减弱动态」开启会自动跳过（属正常） |
| 园里寄信提示「聊天坞暂不可达」 | 聊天坞服务状态 | 信已进信箱（降级）；稍后重试即可同步 |
| 园子空白/十景不动 | snapshot 是否可达 | 看调试 JSON 视图；worlds.garden 是否被关 |
| 测试挂 census | 看判定表 _scratch/census-report.txt | 按行修复后再跑 `npm run test:census` |
| live 测不通端口 | 设计如此（进程外 403） | 用 `--remote-debugging-port=9333` 重启后 npm run test:live |
| 会话卡死「继续」无效（上下文超限） | 会话过大（如 35 万 token > 模型 26 万上限），压缩请求同样超限 | 别硬续：新开会话 + 引用旧会话 end-seed/摘要（教训见 2026-10-01 诊断） |
| apply 后插件没装上（install code=1） | pnpm 11.8 无 TTY 要重建 node_modules 时直接弃权（ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY） | 过渡：npm pack→解压入 profile node_modules→包内 npm install --ignore-scripts（依赖嵌套自带）；根治：桌面完全停止后 CI=true 跑一次全量 install |
