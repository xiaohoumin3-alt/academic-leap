#!/bin/bash

export MINIMAX_API_KEY="sk-cp-wckNQgNpPA6ZCK0o4dpRYLBlQZlmI90H_B6SYJXJho60UI2kg6V_UtzX6e1rn5M-6-H6ykw5_dViXSDrBj3ofTVmipW5VsoTRcCD9LahfIEfAqhk8grSqhQ"
export MINIMAX_BASE_URL="https://api.minimaxi.com/anthropic"

cd "$(dirname "$0")/.."

MAX_RUNS=50
RUN=0

while [ $RUN -lt $MAX_RUNS ]; do
  echo "=== Run $((RUN + 1))/$MAX_RUNS ==="

  npx tsx scripts/extract-stable.ts

  # Check remaining
  REMAINING=$(npx tsx -e "
    import { PrismaClient } from '@prisma/client';
    const prisma = new PrismaClient();
    prisma.question.count({ where: { extractionStatus: 'PENDING' } })
      .then(n => { console.log(n); prisma.\$disconnect(); });
  ")

  if [ "$REMAINING" -eq 0 ]; then
    echo "All questions processed!"
    break
  fi

  echo "Remaining: $REMAINING"
  RUN=$((RUN + 1))

  # Short pause between runs
  sleep 2
done

echo "=== Complete ==="
