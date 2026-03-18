#!/bin/bash
# Post-edit hook: run svelte-check only when .svelte or .ts files are edited
FILE=$(jq -r '.tool_input.file_path // .tool_response.filePath')
if echo "$FILE" | grep -qE '\.(svelte|ts)$'; then
  cd "$(dirname "$0")/.."
  npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -3
fi
