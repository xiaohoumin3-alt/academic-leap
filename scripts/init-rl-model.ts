#!/usr/bin/env tsx
import { prisma } from '../lib/prisma.js';
import { RLModelStore } from '../lib/rl/persistence/model-store.js';

async function main() {
  const store = new RLModelStore(prisma);

  // Check if model exists
  const existing = await prisma.rLModelVersion.findFirst({
    where: { status: 'DEPLOYED' }
  });

  if (existing) {
    console.log('Model already deployed:', existing.version);
    return;
  }

  // Create and deploy initial model
  const version = `v1.0.0-${Date.now()}`;
  console.log('Creating model:', version);

  const modelId = await store.createModel({
    version,
    bucketSize: 0.5,
    priorAlpha: 1,
    priorBeta: 1
  });

  await prisma.rLModelVersion.update({
    where: { id: modelId },
    data: {
      status: 'DEPLOYED',
      trainedAt: new Date()
    }
  });

  console.log('Model deployed:', modelId);
}

main().catch(console.error);
