#!/usr/bin/env tsx

/**
 * Stable extraction with better error handling and checkpointing
 */

import { PrismaClient } from '@prisma/client';
import { ComplexityExtractor } from '../lib/qie/complexity-extractor';
import { writeFileSync, appendFileSync, existsSync } from 'fs';

const CHECKPOINT_FILE = '/tmp/extract-checkpoint.txt';
const LOG_FILE = '/tmp/extract-stable.log';

function log(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  console.log(msg);
  appendFileSync(LOG_FILE, line);
}

function saveCheckpoint(processed: string[]) {
  writeFileSync(CHECKPOINT_FILE, processed.join('\n'));
}

function loadCheckpoint(): string[] {
  if (!existsSync(CHECKPOINT_FILE)) return [];
  const content = require('fs').readFileSync(CHECKPOINT_FILE, 'utf-8');
  return content.split('\n').filter(Boolean);
}

async function main() {
  log('=== Stable Extraction ===');

  const prisma = new PrismaClient();
  const extractor = new ComplexityExtractor();
  const processed = loadCheckpoint();
  log(`Resume from checkpoint: ${processed.length} already processed`);

  // Get pending questions (excluding already processed)
  const questions = await prisma.question.findMany({
    where: {
      extractionStatus: 'PENDING',
      id: { notIn: processed.length > 0 ? processed : undefined },
    },
    select: { id: true, content: true },
    take: 100,  // Process in batches of 100
    orderBy: { createdAt: 'desc' },
  });

  log(`Found ${questions.length} questions to process`);

  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    let content: any;

    try {
      content = JSON.parse(q.content);
    } catch {
      log(`SKIP ${q.id}: invalid JSON content`);
      processed.push(q.id);
      continue;
    }

    try {
      const result = await extractor.extract(q.id, content);

      await prisma.$executeRaw`
        UPDATE "Question"
        SET "cognitiveLoad" = ${result.features.cognitiveLoad},
            "reasoningDepth" = ${result.features.reasoningDepth},
            "complexity" = ${result.features.complexity},
            "extractionStatus" = 'SUCCESS',
            "featuresExtractedAt" = datetime('now'),
            "extractionModel" = 'gemma-4-31b-it-v1'
        WHERE id = ${q.id}
      `;

      successCount++;
      processed.push(q.id);

      // Save checkpoint every 10 questions
      if (successCount % 10 === 0) {
        saveCheckpoint(processed);
        const elapsed = (Date.now() - startTime) / 1000;
        const eta = (elapsed / (i + 1)) * (questions.length - i - 1);
        log(`Progress: ${i + 1}/${questions.length} | Success: ${successCount} | Errors: ${errorCount} | ETA: ${Math.round(eta / 60)}min`);
      }
    } catch (error: unknown) {
      errorCount++;
      const message = error instanceof Error ? error.message : String(error);
      log(`ERROR ${q.id.substring(0, 6)}: ${message.substring(0, 50)}`);

      // Continue after error
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Small delay
    if (i < questions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  log(`=== Batch Complete ===`);
  log(`Time: ${Math.round(elapsed / 60)}min | Success: ${successCount} | Errors: ${errorCount}`);

  // Save final checkpoint
  saveCheckpoint(processed);

  // Check remaining
  const remaining = await prisma.question.count({ where: { extractionStatus: 'PENDING' } });
  log(`Remaining pending: ${remaining}`);

  await prisma.$disconnect();
}

main().catch(console.error);
