// Simple verification script using built lib
const { UOK } = require('../lib/qie/index.js');

function generateSyntheticData() {
  const questions = [];

  // Simple questions (complexity 0.1-0.25)
  const simpleContents = [
    '计算 1 + 1',
    '计算 2 × 3',
    '求 10 的平方',
    '计算 15 - 7',
    '求 100 ÷ 4',
  ];

  for (let i = 0; i < simpleContents.length; i++) {
    questions.push({
      id: `simple_${i}`,
      content: simpleContents[i],
      topics: ['math'],
      complexity: 0.1 + Math.random() * 0.15,
      attempts: generateAttempts(0.7, 20),
    });
  }

  // Complex questions (complexity 0.5-1.0)
  const complexContents = [
    '证明: 如果 a² = b², 则 a = b 或 a = -b',
    '推导: (a+b)³ 的展开式',
    '分析: 二次函数 y = ax² + bx + c 的顶点坐标',
    '计算并证明: 已知三角形三边长, 求其面积',
    '综合: 结合几何与代数方法求解复杂应用题',
  ];

  for (let i = 0; i < complexContents.length; i++) {
    questions.push({
      id: `complex_${i}`,
      content: complexContents[i],
      topics: ['math'],
      complexity: 0.5 + Math.random() * 0.5,
      attempts: generateAttempts(0.5, 3),
    });
  }

  return questions;
}

function generateAttempts(baseRate, count) {
  const attempts = [];
  for (let i = 0; i < count; i++) {
    attempts.push(Math.random() < baseRate);
  }
  return attempts;
}

function trainUOK(allQuestions) {
  const uok = new UOK();

  // Encode all questions first
  for (const q of allQuestions) {
    uok.encodeQuestion({
      id: q.id,
      content: q.content,
      topics: q.topics,
    });
  }

  // Train on simple questions only (complexity < 0.3)
  for (const q of allQuestions) {
    if (q.complexity < 0.3) {
      for (const correct of q.attempts) {
        uok.encodeAnswer('student1', q.id, correct);
      }
    }
  }

  return uok;
}

function calculateBaselineAccuracy(uok, testQuestions, studentId) {
  let correct = 0;
  let total = 0;

  for (const q of testQuestions) {
    if (q.attempts.length === 0) continue;

    const actual = q.attempts[q.attempts.length - 1] ? 1 : 0;
    const ctx = { difficulty: 0.5, complexity: q.complexity };
    const prediction = uok.predict(studentId, q.id, ctx);

    if (Math.round(prediction) === actual) {
      correct++;
    }
    total++;
  }

  return { correct, total };
}

function calculateTransferAccuracy(uok, testQuestions, trainQuestions, studentId) {
  let correct = 0;
  let total = 0;

  // Find the simplest question from training set as reference
  const refQuestion = trainQuestions.reduce((best, q) =>
    q.complexity < best.complexity ? q : best
  );

  for (const q of testQuestions) {
    if (q.attempts.length === 0) continue;

    const actual = q.attempts[q.attempts.length - 1] ? 1 : 0;
    const prediction = uok.predictWithComplexityTransfer(
      studentId,
      refQuestion.id,
      q.id
    );

    if (Math.round(prediction) === actual) {
      correct++;
    }
    total++;
  }

  return { correct, total };
}

async function verifyCTGMultiUser(numStudents = 10) {
  console.log(`\n=== Multi-User CTG Verification (${numStudents} students) ===\n`);

  // Reset global weights
  UOK.resetGlobalWeights();

  // Use a single UOK instance (weights are shared globally anyway)
  const uok = new UOK();

  // Generate shared question bank
  const allQuestions = generateSyntheticData();
  for (const q of allQuestions) {
    uok.encodeQuestion({
      id: q.id,
      content: q.content,
      topics: q.topics,
    });
  }

  const trainQuestions = allQuestions.filter(q => q.complexity < 0.3);
  const testQuestions = allQuestions.filter(q => q.complexity >= 0.3);

  console.log(`Train questions: ${trainQuestions.length}`);
  console.log(`Test questions: ${testQuestions.length}`);

  const results = [];

  // Simulate each student
  for (let i = 0; i < numStudents; i++) {
    const studentId = `student_${i}`;

    // Train this student on simple questions
    for (const q of trainQuestions) {
      for (const correct of q.attempts.slice(0, 5)) {
        uok.encodeAnswer(studentId, q.id, correct);
      }
    }

    // Calculate baseline and transfer accuracy
    const baseline = calculateBaselineAccuracy(uok, testQuestions, studentId);
    const transfer = calculateTransferAccuracy(uok, testQuestions, trainQuestions, studentId);

    const Acc_baseline = baseline.correct / baseline.total;
    const Acc_transfer = transfer.correct / transfer.total;
    const CTG = Acc_transfer - Acc_baseline;

    results.push({ studentId, Acc_baseline, Acc_transfer, CTG, testCount: testQuestions.length });

    console.log(`${studentId}: CTG = ${CTG.toFixed(4)}`);
  }

  // Aggregate results
  const avgCTG = results.reduce((sum, r) => sum + r.CTG, 0) / numStudents;
  const winRate = results.filter(r => r.CTG > 0).length / numStudents;

  // Show final global weights
  const finalWeights = uok.getComplexityTransferWeights();
  console.log(`\n=== Final Global Weights ===`);
  console.log(`cognitiveLoad: ${finalWeights.cognitiveLoad.toFixed(4)}`);
  console.log(`reasoningDepth: ${finalWeights.reasoningDepth.toFixed(4)}`);
  console.log(`complexity: ${finalWeights.complexity.toFixed(4)}`);

  // Check numerical stability
  console.log(`\n=== Numerical Stability Check ===`);
  console.log(`Weights sum: ${(finalWeights.cognitiveLoad + finalWeights.reasoningDepth + finalWeights.complexity).toFixed(4)}`);
  console.log(`All weights > 0: ${finalWeights.cognitiveLoad > 0 && finalWeights.reasoningDepth > 0 && finalWeights.complexity > 0}`);
  console.log(`No NaN/Inf: ${Number.isFinite(finalWeights.cognitiveLoad) && Number.isFinite(finalWeights.reasoningDepth) && Number.isFinite(finalWeights.complexity)}`);

  return {
    summary: {
      CTG: avgCTG,
      CTG_avg: avgCTG,
      winRate,
      totalStudents: numStudents,
      totalTests: numStudents * testQuestions.length,
    },
    perStudent: results,
    verdict: avgCTG > 0 ? 'SUCCESS' : 'FAILURE',
    finalWeights,
  };
}

async function main() {
  console.log('=== QIE v2.1 Global Shared Weights Verification ===\n');

  const multiUserResult = await verifyCTGMultiUser(10);

  console.log('\n=== Multi-User Results ===');
  console.log(`CTG (avg): ${multiUserResult.summary.CTG.toFixed(4)}`);
  console.log(`Win Rate: ${(multiUserResult.summary.winRate * 100).toFixed(1)}%`);
  console.log(`\nVerdict: ${multiUserResult.verdict}`);

  console.log('\n=== Conclusion ===');
  if (multiUserResult.summary.CTG > 0 && multiUserResult.summary.winRate > 0.5) {
    console.log('✓ Global Shared Weights successfully lifts Win Rate above 50%');
    if (multiUserResult.summary.winRate > 0.8) {
      console.log('✓✓ Target achieved: Win Rate > 80%');
    } else {
      console.log('⚠ Win Rate is positive but below 80% target');
    }
  } else {
    console.log('✗ Global Shared Weights did not improve Win Rate');
  }

  // Check if weights evolved from initial values
  const initialWeights = { cognitiveLoad: 0.2, reasoningDepth: 0.3, complexity: 0.5 };
  const weightsChanged =
    Math.abs(multiUserResult.finalWeights.cognitiveLoad - initialWeights.cognitiveLoad) > 0.01 ||
    Math.abs(multiUserResult.finalWeights.reasoningDepth - initialWeights.reasoningDepth) > 0.01 ||
    Math.abs(multiUserResult.finalWeights.complexity - initialWeights.complexity) > 0.01;

  console.log(`\nWeights evolved: ${weightsChanged ? 'Yes ✓' : 'No ✗'}`);

  return multiUserResult;
}

main().catch(console.error);
