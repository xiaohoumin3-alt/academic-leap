#!/bin/bash

export MINIMAX_API_KEY="sk-cp-wckNQgNpPA6ZCK0o4dpRYLBlQZlmI90H_B6SYJXJho60UI2kg6V_UtzX6e1rn5M-6-H6ykw5_dViXSDrBj3ofTVmipW5VsoTRcCD9LahfIEfAqhk8grSqhQ"
export MINIMAX_BASE_URL="https://api.minimaxi.com/anthropic"

cd "$(dirname "$0")/.."
npx tsx scripts/extract-complexity.ts --batch-size 16 --delay 300 --force
