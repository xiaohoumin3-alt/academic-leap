/**
 * Generate synthetic test data for validation
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || '/Users/seanxx/academic-leap/academic-leap/prisma/dev.db';

async function generateTestData() {
  console.log('📊 生成测试数据...\n');

  const db = new Database(DB_PATH);

  // Get existing users and questions
  const users = db.prepare('SELECT id FROM "User"').all() as { id: string }[];
  const questionSteps = db.prepare(`
    SELECT qs.id, qs."questionId", q.difficulty
    FROM "QuestionStep" qs
    JOIN "Question" q ON qs."questionId" = q.id
    LIMIT 100
  `).all() as { id: string; questionId: string; difficulty: number }[];

  console.log(`找到 ${users.length} 个用户, ${questionSteps.length} 个题目步骤`);

  if (users.length === 0 || questionSteps.length === 0) {
    console.log('错误: 没有用户或题目数据');
    process.exit(1);
  }

  // Insert synthetic attempts
  const insertAttempt = db.prepare(`
    INSERT INTO "Attempt" (id, "userId", mode, score, duration, "startedAt", "completedAt")
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStep = db.prepare(`
    INSERT INTO "AttemptStep" (id, "attemptId", "questionStepId", "stepNumber", "userAnswer", "isCorrect", duration, "submittedAt")
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Generate 200 synthetic attempts
  let attemptCount = 0;
  let stepCount = 0;

  for (let i = 0; i < 200; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const attemptId = `test-attempt-${Date.now()}-${i}`;

    // Generate 2-5 steps per attempt
    const numSteps = 2 + Math.floor(Math.random() * 4);
    const shuffledSteps = [...questionSteps].sort(() => Math.random() - 0.5).slice(0, numSteps);

    try {
      insertAttempt.run(
        attemptId,
        user.id,
        'practice',
        Math.floor(Math.random() * 100),
        Math.floor(1000 + Math.random() * 10000),
        new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        new Date().toISOString()
      );
      attemptCount++;

      for (let j = 0; j < shuffledSteps.length; j++) {
        const step = shuffledSteps[j];

        // Simulate correct/incorrect based on question difficulty (higher difficulty = lower accuracy)
        const random = Math.random();
        const isCorrect = random > (step.difficulty / 10); // Difficulty 2-8 -> ~60-80% accuracy

        insertStep.run(
          `test-step-${attemptId}-${j}`,
          attemptId,
          step.id,
          j + 1,
          isCorrect ? 'correct' : 'incorrect',
          isCorrect ? 1 : 0,
          1000 + Math.floor(Math.random() * 5000),
          new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
        );
        stepCount++;
      }
    } catch (e) {
      // Skip if duplicate
    }
  }

  console.log(`\n生成了 ${attemptCount} 个尝试, ${stepCount} 个步骤\n`);
  db.close();
}

// ============================================================
// Main
// ============================================================

if (require.main === module) {
  generateTestData()
    .then(() => {
      console.log('测试数据生成完成');
      process.exit(0);
    })
    .catch(err => {
      console.error('生成失败:', err);
      process.exit(1);
    });
}

export { generateTestData };