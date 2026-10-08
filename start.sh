#!/usr/bin/env sh
# Serves this folder and opens the viewer. See serve.py for why a server is
# needed at all. A port can be forced: ./start.sh 9000
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  exec python3 serve.py "$@"
elif command -v python >/dev/null 2>&1; then
  exec python serve.py "$@"
elif command -v npx >/dev/null 2>&1; then
  echo "No Python found; falling back to npx serve."
  exec npx --yes serve -l "${1:-8080}" .
else
  echo "Need Python or Node installed to serve this folder." >&2
  exit 1
fi
