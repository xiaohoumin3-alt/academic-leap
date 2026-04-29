#!/usr/bin/env tsx
import { validateDFI } from '../lib/rl/validation/dfi.js';
import { prisma } from '../lib/prisma.js';

async function main() {
  const result = await validateDFI(prisma);
  console.log(`DFI: ${result.dfi.toFixed(4)}`);
  console.log(`Pass: ${result.pass}`);

  if (!result.pass) {
    console.error('DFI gaps:', result.gaps);
    process.exit(1);
  }
}

main().catch(console.error);
