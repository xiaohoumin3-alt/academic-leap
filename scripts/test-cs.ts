#!/usr/bin/env tsx
import { validateCS } from '../lib/rl/validation/cs.js';
import { prisma } from '../lib/prisma.js';

async function main() {
  const result = await validateCS(prisma);
  console.log(`CS: ${result.cs.toFixed(4)}`);
  console.log(`Pass: ${result.pass}`);

  if (!result.pass) {
    console.error('CS below threshold 0.85');
    process.exit(1);
  }
}

main().catch(console.error);
