#!/usr/bin/env tsx

import { ComplexityExtractor } from '../lib/qie/complexity-extractor';

async function test() {
  const extractor = new ComplexityExtractor();
  const result = await extractor.extract('test-1', { title: '测试', description: '化简 √50' });
  console.log('Result:', JSON.stringify(result, null, 2));
}

test().catch(console.error);
