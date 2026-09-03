#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/.local/node/bin:${PATH}"

echo "== free 3080 =="
if command -v fuser >/dev/null 2>&1; then
  fuser -k 3080/tcp 2>/dev/null || true
fi
# WSL-friendly: kill node dsh processes listening
pids=$(ss -lptn 'sport = :3080' 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u || true)
if [[ -z "${pids}" ]]; then
  pids=$(ps -ef | awk '/dsh web|dsh-app-boot|@deepseek-ai\/dsh/ && !/awk/ {print $2}' || true)
fi
for p in $pids; do
  echo "kill $p"
  kill "$p" 2>/dev/null || true
done
sleep 1

echo "== boot 30s =="
rm -f /tmp/dsh-web-plugins2.log
set +e
timeout 30s dsh web --no-open > /tmp/dsh-web-plugins2.log 2>&1
code=$?
set -e
echo "exit=$code"
cat /tmp/dsh-web-plugins2.log
echo
echo "== grep plugin hints =="
grep -Ei 'open-world|rewind|sidebar|ventus|smooth|file-drop|Error|failed|3080' /tmp/dsh-web-plugins2.log || true
