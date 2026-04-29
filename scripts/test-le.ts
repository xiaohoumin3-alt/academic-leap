#!/usr/bin/env tsx
import { validateLE } from '../lib/rl/validation/le.js';
import { prisma } from '../lib/prisma.js';

async function main() {
  const result = await validateLE(prisma);
  console.log(`LE: ${result.le.toFixed(4)}`);
  console.log(`Pass: ${result.pass}`);
  console.log(`CI95: [${(result.le - 1.96 * result.confidence / Math.sqrt(result.sampleSize || 1)).toFixed(4)}, ${(result.le + 1.96 * result.confidence / Math.sqrt(result.sampleSize || 1)).toFixed(4)}]`);

  if (!result.pass) {
    console.error('LE below threshold 0.15');
    process.exit(1);
  }
}

main().catch(console.error);
