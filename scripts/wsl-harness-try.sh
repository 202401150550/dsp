#!/usr/bin/env bash
# Minimal Linux (WSL) harness playground for dsp.
# Usage: wsl -d Ubuntu -- bash /mnt/d/dsp/scripts/wsl-harness-try.sh
set -euo pipefail

export PATH="${HOME}/.local/node/bin:${PATH}"

echo "== Linux playground =="
echo "host=$(uname -srm)"
. /etc/os-release
echo "os=$PRETTY_NAME"
echo "node=$(node -v)  npm=$(npm -v)"
echo "cwd hint: /mnt/d/dsp  (Windows D:\\dsp)"

echo
echo "== 1) open-world unit tests =="
cd /mnt/d/dsp/dsh-open-world
node test/manifest.mjs
node test/smoke.mjs
node test/bridge.mjs

echo
echo "== 2) dsh-self slot-remap =="
cd /mnt/d/dsp/dsh-self
node test/slot-remap-chat.mjs

echo
echo "== 3) what Linux is good for here =="
cat <<'EOF'
- 跑 Node 测试 / 脚本 / CLI（路径、权限更接近官方 Linux CI）
- 不替代 Windows 上的 DSH Desktop 图形界面
- 进壳：wsl -d Ubuntu
- 进仓库：cd /mnt/d/dsp
EOF

echo
echo "== done =="
