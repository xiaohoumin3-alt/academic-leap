#!/usr/bin/env tsx
import { QuestionGenerator } from '../lib/qie/generator/generator';
import type { ComplexitySpec } from '../lib/qie/generator/types';

async function main() {
  const generator = new QuestionGenerator();

  console.log('Testing question generation\n');

  const testSpecs: ComplexitySpec[] = [
    { structure: 'linear', depth: 1, distraction: 0 },
    { structure: 'linear', depth: 1, distraction: 1 },
    { structure: 'linear', depth: 2, distraction: 0 },
    { structure: 'nested', depth: 2, distraction: 0 },
    { structure: 'nested', depth: 2, distraction: 1 },
    { structure: 'nested', depth: 3, distraction: 0 },
    { structure: 'multi_equation', depth: 2, distraction: 0 },
    { structure: 'constraint_chain', depth: 2, distraction: 0 },
  ];

  let i = 1;
  let passed = 0;
  let failed = 0;

  for (const spec of testSpecs) {
    try {
      const result = await generator.generate(spec);
      const content = JSON.parse(result.content);

      console.log(`${i}. Complexity: ${spec.structure}/${spec.depth}/${spec.distraction}`);
      console.log(`   Question: ${content.text}`);
      console.log(`   Answer: ${result.answer}`);
      console.log(`   Engine: ${result.engine}\n`);

      // Basic validation
      if (!content.text || content.text.length === 0) {
        console.error(`   FAIL: Empty question text`);
        failed++;
      } else if (!result.answer || result.answer.length === 0) {
        console.error(`   FAIL: Empty answer`);
        failed++;
      } else {
        passed++;
      }
      i++;
    } catch (error) {
      console.error(`${i}. FAIL: ${JSON.stringify(spec)}`, error);
      failed++;
      i++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
