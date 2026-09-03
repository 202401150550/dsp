#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/.local/node/bin:${PATH}"
export DSH_HOME="${DSH_HOME:-$HOME/.dsh}"

echo "DSH_HOME=$DSH_HOME"
echo "dsh=$(dsh --version)"
find "$DSH_HOME" -maxdepth 4 \( -name package.json -o -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | head -80
echo '==== profiles ===='
ls -la "$DSH_HOME/profiles" 2>/dev/null || true
for p in "$DSH_HOME"/profiles/*; do
  [ -d "$p" ] || continue
  echo "-- $p"
  ls -la "$p" | head -20
  if [ -f "$p/package.json" ]; then
    echo 'package.json deps:'
    node -e 'const j=require(process.argv[1]); console.log(JSON.stringify(j.dependencies||{},null,2)); console.log("bundles", JSON.stringify(j.dsh&&j.dsh.profile&&j.dsh.profile.bundles,null,2))' "$p/package.json"
  fi
done
echo '==== dsh plugin help ===='
dsh plugin --help 2>&1 | head -40 || true
dsh plugin --profile web --help 2>&1 | head -40 || true
