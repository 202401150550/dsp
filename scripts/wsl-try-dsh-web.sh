#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/.local/node/bin:${PATH}"

echo "== which =="
type dsh || true
type node
npm root -g
ls "$(npm root -g)/@deepseek-ai" 2>/dev/null || true

echo "== version / help =="
dsh --version 2>&1 || true
dsh -h 2>&1 | head -50 || true

echo "== homes =="
echo "HOME=$HOME"
ls -la "$HOME/.dsh" 2>&1 | head -10 || echo "no linux ~/.dsh"
ls -la /mnt/c/Users/admin/.dsh 2>&1 | head -10 || echo "no windows .dsh mount"

echo "== try web 15s =="
cd /mnt/d/dsp
rm -f /tmp/dsh-web-try.log
set +e
timeout 15s dsh web --no-open > /tmp/dsh-web-try.log 2>&1
code=$?
set -e
echo "exit=$code"
wc -l /tmp/dsh-web-try.log
echo "---- log ----"
cat /tmp/dsh-web-try.log
