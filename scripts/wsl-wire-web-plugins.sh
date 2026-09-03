#!/usr/bin/env bash
# Wire dsp plugins into Linux dsh web profile (separate from Windows Desktop).
set -euo pipefail
export PATH="${HOME}/.local/node/bin:${PATH}"
export DSH_HOME="${HOME}/.dsh"
PROFILE="${DSH_HOME}/profiles/web"
DSP="/mnt/d/dsp"
export PROFILE DSP

echo "== enable pnpm =="
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm --version

echo "== write profile package.json =="
node <<'NODE'
const fs = require('fs')
const path = require('path')
const profile = process.env.PROFILE
const dsp = process.env.DSP
const pkgPath = path.join(profile, 'package.json')
const links = {
  'dsh-open-world': `link:${dsp}/dsh-open-world`,
  'dsh-rewind-plugin': `link:${dsp}/dsh-rewind-plugin`,
  'dsh-better-sidebar': `link:${dsp}/dsh-better-sidebar`,
  'dsh-ventus-progress': `link:${dsp}/dsh-ventus-progress`,
  'dsh-ventus-search': `link:${dsp}/dsh-ventus-search`,
  'dsh-plugin-smooth-stream': `link:${dsp}/dsh-plugin-smooth-stream`,
  'dsh-file-drop': `link:${dsp}/dsh-file-drop`,
}
const bundles = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  'dsh-open-world',
  'dsh-rewind-plugin',
  'dsh-better-sidebar',
  'dsh-ventus-progress',
  'dsh-ventus-search',
  'dsh-plugin-smooth-stream',
  'dsh-file-drop',
]
const text = JSON.stringify({
  name: 'dsh-profile-web',
  private: true,
  dependencies: links,
  dsh: { profile: { bundles, patchReload: 'live' } },
}, null, 2) + '\n'
fs.writeFileSync(pkgPath, text)
console.log(text)
NODE

echo "== verify linked packages exist =="
for d in dsh-open-world dsh-rewind-plugin dsh-better-sidebar dsh-ventus-progress dsh-ventus-search dsh-plugin-smooth-stream dsh-file-drop; do
  if [[ -f "$DSP/$d/package.json" ]]; then echo "ok $d"; else echo "MISSING $d"; exit 1; fi
done

echo "== pnpm install in profile =="
cd "$PROFILE"
pnpm install

echo "== link check =="
ls -la node_modules/dsh-open-world node_modules/dsh-rewind-plugin node_modules/dsh-better-sidebar 2>&1 | head -30

echo "== boot probe 25s =="
cd "$DSP"
rm -f /tmp/dsh-web-plugins.log
set +e
timeout 25s dsh web --no-open > /tmp/dsh-web-plugins.log 2>&1
code=$?
set -e
echo "exit=$code"
echo '---- log ----'
cat /tmp/dsh-web-plugins.log
echo '==== done ===='
