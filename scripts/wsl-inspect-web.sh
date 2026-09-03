#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/.local/node/bin:${PATH}"
P="${HOME}/.dsh/profiles/web"
echo "PROFILE=$P"
echo '==== package.json ===='
cat "$P/package.json"
echo
echo '==== cordis.yml ===='
cat "$P/cordis.yml"
echo
echo '==== cordis.patch.yml ===='
cat "$P/cordis.patch.yml"
echo
echo '==== ls ===='
ls -la "$P"
echo
echo '==== plugin help ===='
dsh plugin --profile web --help || true
