#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/.local/node/bin:${PATH}"

echo "== dump plugin ids =="
dsh --profile web --dump-config 2>/dev/null | grep -E 'id:|name:|dsh-open|rewind|better-sidebar|ventus|smooth|file-drop' | head -80

echo "== wait for server =="
# kill stale
pkill -f 'dsh web' 2>/dev/null || true
sleep 1
nohup dsh web --no-open >/tmp/dsh-web-bg.log 2>&1 &
echo $! >/tmp/dsh-web-bg.pid
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS -m 2 http://127.0.0.1:3080/ >/dev/null 2>&1; then
    echo "up after ${i}s"
    break
  fi
  sleep 1
done
curl -fsS -m 5 -o /dev/null -w "web=%{http_code}\n" http://127.0.0.1:3080/ || true
code=$(curl -s -m 5 -o /tmp/ow.json -w "%{http_code}" http://127.0.0.1:3080/api/open-world/snapshot || true)
echo "open-world snapshot -> $code"
head -c 400 /tmp/ow.json 2>/dev/null; echo
echo '---- boot log tail ----'
tail -n 40 /tmp/dsh-web-bg.log
