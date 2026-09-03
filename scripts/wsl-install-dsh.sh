#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/.local/node/bin:${PATH}"
export DEBIAN_FRONTEND=noninteractive
export npm_config_registry="${npm_config_registry:-https://registry.npmmirror.com}"

echo "== 0) toolchain =="
echo "PATH node bin: ${HOME}/.local/node/bin"
node -v
npm -v

echo "== 1) apt: git htop bubblewrap =="
sudo apt-get update -qq
sudo apt-get install -y -qq git htop bubblewrap
git --version
htop --version | head -1
bwrap --version || true

echo "== 2) npm global: @deepseek-ai/dsh =="
npm install -g @deepseek-ai/dsh
hash -
echo "which dsh=$(command -v dsh)"
dsh --version || dsh -V || true
npm ls -g --depth=0 @deepseek-ai/dsh || true

echo "== 3) home dirs =="
echo "linux HOME=$HOME"
echo "linux .dsh=$(ls -la "$HOME/.dsh" 2>/dev/null | head -5 || echo 'missing')"
echo "windows .dsh mount=$(ls -la /mnt/c/Users/admin/.dsh 2>/dev/null | head -5 || echo 'missing')"

echo "== 4) brief web boot (no-open, 12s) =="
cd /mnt/d/dsp
set +e
timeout 12s dsh web --no-open 2>&1 | tee /tmp/dsh-web-try.log | tail -n 80
code=$?
set -e
echo "exit_code=$code (124=timeout expected if server stayed up)"
echo "== log head =="
head -n 40 /tmp/dsh-web-try.log || true
echo "== done =="
