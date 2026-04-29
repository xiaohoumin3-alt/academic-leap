#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { HybridExtractor } from '../lib/qie/rule-based-extractor';

const prisma = new PrismaClient();

async function testSingle() {
  console.log('Testing single extraction...\n');

  const extractor = new HybridExtractor();
  await extractor.init(true);  // use LLM

  // Get a pending question
  const question = await prisma.question.findFirst({
    where: { extractionStatus: 'PENDING' },
    select: { id: true, content: true },
  });

  if (!question) {
    console.log('No pending questions');
    return;
  }

  const content = JSON.parse(question.content);
  console.log('Question:', content.title || content.description?.substring(0, 50));

  const result = await extractor.extract(question.id, content);
  console.log('\nResult:');
  console.log('  cognitiveLoad:', result.features.cognitiveLoad);
  console.log('  reasoningDepth:', result.features.reasoningDepth);
  console.log('  complexity:', result.features.complexity);
  console.log('  confidence:', result.confidence);
  console.log('  reasoning:', result.reasoning?.substring(0, 100));

  // Update database
  await prisma.$executeRaw`
    UPDATE "Question"
    SET "cognitiveLoad" = ${result.features.cognitiveLoad},
        "reasoningDepth" = ${result.features.reasoningDepth},
        "complexity" = ${result.features.complexity},
        "extractionStatus" = 'SUCCESS',
        "featuresExtractedAt" = datetime('now'),
        "extractionModel" = 'gemma-4-31b-it-v1'
    WHERE id = ${question.id}
  `;
  console.log('\nUpdated database');

  await prisma.$disconnect();
}

testSingle().catch(console.error);
