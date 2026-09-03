#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/.local/node/bin:${PATH}"

echo "== dump-config bundles =="
dsh --profile web --dump-config 2>/dev/null | head -c 8000 || true
echo
echo
echo "== profile package =="
cat "${HOME}/.dsh/profiles/web/package.json"
echo
echo "== ensure server up =="
if ! curl -fsS -m 2 http://127.0.0.1:3080/ >/dev/null 2>&1; then
  echo "starting dsh web in background..."
  nohup dsh web --no-open >/tmp/dsh-web-bg.log 2>&1 &
  echo $! >/tmp/dsh-web-bg.pid
  sleep 4
fi
curl -fsS -m 5 -o /dev/null -w "web_root_http=%{http_code}\n" http://127.0.0.1:3080/ || true
# open-world API if mounted
for u in /api/open-world/snapshot /api/open-world /api/health; do
  code=$(curl -s -m 3 -o /tmp/curl-body.txt -w "%{http_code}" "http://127.0.0.1:3080$u" || true)
  echo "$u -> $code"
  head -c 200 /tmp/curl-body.txt 2>/dev/null; echo
done
