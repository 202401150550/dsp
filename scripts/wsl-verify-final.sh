#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/.local/node/bin:/usr/bin:/bin:${PATH}"

dsh --profile web --dump-config > /tmp/dsh-dump.yml 2>/tmp/dsh-dump.err || true
echo "dump_lines=$(wc -l < /tmp/dsh-dump.yml)"
echo '== matched plugin entries =='
grep -nE 'open-world|rewind|better-sidebar|ventus|smooth-stream|file-drop|dsh-open-world|dsh-rewind|dsh-better|dsh-ventus|dsh-plugin-smooth|dsh-file-drop' /tmp/dsh-dump.yml || echo '(none in dump)'
echo '== dump err =='
head -n 20 /tmp/dsh-dump.err || true

# restart server
if command -v pkill >/dev/null; then pkill -f 'dsh web' || true; fi
fuser -k 3080/tcp 2>/dev/null || true
sleep 1
nohup dsh web --no-open >/tmp/dsh-web-bg.log 2>&1 &
echo $! >/tmp/dsh-web-bg.pid
for i in $(seq 1 15); do
  if curl -fsS -m 2 http://127.0.0.1:3080/ >/dev/null 2>&1; then
    echo "server up after ${i}s"
    break
  fi
  sleep 1
done

echo '== http =='
curl -s -m 5 -o /dev/null -w "root=%{http_code}\n" http://127.0.0.1:3080/ || true
curl -s -m 5 -o /tmp/ow.json -w "open-world=%{http_code}\n" http://127.0.0.1:3080/api/open-world/snapshot || true
python3 - <<'PY'
import json
p='/tmp/ow.json'
try:
  raw=open(p,'r',encoding='utf-8').read()
  print('body_prefix', raw[:240])
  j=json.loads(raw)
  print('ok', j.get('ok'), 'keys', list(j.keys())[:12])
  plugs=j.get('plugins') or []
  print('plugins', len(plugs), [p.get('id') for p in plugs[:8]])
except Exception as e:
  print('parse_fail', e)
PY
echo '== boot log =='
tail -n 30 /tmp/dsh-web-bg.log || true
