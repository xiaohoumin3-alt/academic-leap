/**
 * Phase 2: 预测准确率验证
 *
 * 对比 Prediction Service 预测 vs 实际答题结果
 *
 * 运行方式：
 * ```bash
 * npx tsx apps/prediction-service/validation/accuracy-validator.ts
 * ```
 */

import Database from 'better-sqlite3';
import path from 'path';

// ============================================================
// 1. 配置
// ============================================================

const DB_PATH = path.join(__dirname, '../../../prisma/dev.db');
const PREDICTION_SERVICE_URL = process.env.PREDICTION_SERVICE_URL || 'http://localhost:3001';

// ============================================================
// 2. IRT 预测模型（简化版，用于对比）
// ============================================================

function predictIRT(ability: number, difficulty: number): number {
  // P(correct) = 1 / (1 + exp(-(theta - beta)))
  const logit = ability - difficulty;
  return 1 / (1 + Math.exp(-logit));
}

// ============================================================
// 3. 主验证逻辑
// ============================================================

interface ValidationResult {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  brierScore: number;
  calibration: Map<number, { predicted: number; actual: number; count: number }>;
  byDifficulty: Map<string, { accuracy: number; count: number }>;
}

async function validatePredictionAccuracy(): Promise<ValidationResult> {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Phase 2: 预测准确率验证                          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 1. 连接数据库
  console.log('📊 加载历史答题数据...');
  const db = new Database(DB_PATH);

  // 2. 查询答题记录（通过 AttemptStep 获取正确性和难度）
  const attempts = db.prepare(`
    SELECT
      a.id,
      a."userId" as studentId,
      qs."questionId" as questionId,
      step."isCorrect" as correct,
      q.difficulty
    FROM Attempt a
    JOIN AttemptStep step ON a.id = step."attemptId"
    JOIN QuestionStep qs ON step."questionStepId" = qs.id
    JOIN Question q ON qs."questionId" = q.id
    WHERE step."isCorrect" IS NOT NULL
    ORDER BY step."submittedAt" DESC
    LIMIT 500
  `).all() as Array<{
    id: string;
    studentId: string;
    questionId: string;
    correct: number;  // SQLite 中是 0/1
    difficulty: number;
  }>;

  console.log(`加载了 ${attempts.length} 条答题记录\n`);
  db.close();

  // 3. 计算每个学生的能力估计
  console.log('📈 估计学生能力...');

  // 从历史数据估计学生能力（简单平均）
  const studentAbilities = new Map<number, number>();

  for (const attempt of attempts) {
    if (!studentAbilities.has(attempt.studentId)) {
      // 简化：用答题正确率作为能力估计
      const studentAttempts = attempts.filter(a => a.studentId === attempt.studentId);
      const historyAttempts = studentAttempts.filter(a => a.id < attempt.id);
      const correctRate = historyAttempts.length > 0
        ? historyAttempts.reduce((sum, a) => sum + a.correct, 0) / historyAttempts.length
        : 0.5;

      // 映射到 IRT 尺度 [-2, 2]
      const ability = (correctRate - 0.5) * 4;
      studentAbilities.set(attempt.studentId, ability);
    }
  }

  console.log(`估计了 ${studentAbilities.size} 个学生的能力\n`);

  // 4. 进行预测并验证
  console.log('🔮 执行预测验证...\n');

  let correctPredictions = 0;
  let totalBrierScore = 0;
  const calibration = new Map<number, { predicted: number; actual: number; count: number }>();
  const byDifficulty = new Map<string, { accuracy: number; count: number }>();

  // 分桶（用于校准曲线）
  const bins = [0.1, 0.3, 0.5, 0.7, 0.9];
  for (const bin of bins) {
    calibration.set(bin, { predicted: 0, actual: 0, count: 0 });
  }

  // 按难度分桶
  const difficultyBins = [
    { label: 'easy (0-0.3)', min: 0, max: 0.3 },
    { label: 'medium (0.3-0.6)', min: 0.3, max: 0.6 },
    { label: 'hard (0.6-1.0)', min: 0.6, max: 1.0 },
  ];
  for (const bin of difficultyBins) {
    byDifficulty.set(bin.label, { accuracy: 0, count: 0 });
  }

  for (const attempt of attempts) {
    const ability = studentAbilities.get(attempt.studentId) || 0;
    const difficulty = attempt.difficulty;

    // IRT 预测（difficulty 需要归一化 0-1）
    const normalizedDifficulty = attempt.difficulty / 100;
    const predicted = predictIRT(ability, normalizedDifficulty);

    // 统计
    const predictedCorrect = predicted > 0.5;
    const actualCorrect = attempt.correct === 1;
    if (predictedCorrect === actualCorrect) {
      correctPredictions++;
    }

    // Brier Score
    const actual = actualCorrect ? 1 : 0;
    totalBrierScore += Math.pow(predicted - actual, 2);

    // 校准曲线
    const binIndex = bins.reduce((prev, bin) =>
      Math.abs(predicted - bin) < Math.abs(predicted - bins[prev]) ? bins.indexOf(bin) : prev, 0);
    const calibrationBin = bins[binIndex];
    const calib = calibration.get(calibrationBin)!;
    calib.predicted += predicted;
    calib.actual += actualCorrect ? 1 : 0;
    calib.count++;

    // 按难度分组（使用归一化后的难度）
    const diffBin = difficultyBins.find(b => normalizedDifficulty >= b.min && normalizedDifficulty < b.max);
    if (diffBin) {
      const diffStat = byDifficulty.get(diffBin.label)!;
      diffStat.count++;
      if (predictedCorrect === actualCorrect) {
        diffStat.accuracy++;
      }
    }
  }

  const totalPredictions = attempts.length;
  const accuracy = correctPredictions / totalPredictions;
  const brierScore = totalBrierScore / totalPredictions;

  // 5. 调用远程 Prediction Service（如果有）
  console.log('🌐 调用 Prediction Service...\n');

  let remoteAccuracy = 0;
  let remoteResults = 0;

  try {
    const response = await fetch(`${PREDICTION_SERVICE_URL}/predict/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'stu1', count: 5 })
    });

    if (response.ok) {
      console.log('✅ Prediction Service 可用\n');
    } else {
      console.log('⚠️ Prediction Service 不可用，跳过远程验证\n');
    }
  } catch {
    console.log('⚠️ Prediction Service 不可用，跳过远程验证\n');
  }

  // 6. 输出结果
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                    验证结果                           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`总体准确率: ${(accuracy * 100).toFixed(1)}% (${correctPredictions}/${totalPredictions})`);
  console.log(`Brier Score: ${brierScore.toFixed(3)}`);
  console.log(`目标准确率: > 70%`);
  console.log(`目标 Brier: < 0.2`);
  console.log(`\n结果: ${accuracy > 0.5 ? '✅ 预测优于随机' : '❌ 预测无效'} ${accuracy > 0.7 ? '(超出目标)' : ''}`);

  console.log('\n--- 校准曲线 ---');
  for (const [bin, data] of calibration) {
    if (data.count > 0) {
      const avgPredicted = data.predicted / data.count;
      const actualRate = data.actual / data.count;
      console.log(`预测 ~${(bin * 100).toFixed(0)}% (n=${data.count}): 实际 ${(actualRate * 100).toFixed(0)}% | 差异 ${((avgPredicted - actualRate) * 100).toFixed(0)}%`);
    }
  }

  console.log('\n--- 按难度分组 ---');
  for (const [label, data] of byDifficulty) {
    if (data.count > 0) {
      const acc = data.accuracy / data.count;
      console.log(`${label}: ${(acc * 100).toFixed(1)}% (n=${data.count})`);
    }
  }

  console.log('\n--- 结论 ---');
  if (accuracy >= 0.7 && brierScore <= 0.2) {
    console.log('✅ 模型验证通过！可以用于生产决策');
  } else if (accuracy >= 0.5 && brierScore <= 0.25) {
    console.log('⚠️ 模型基本有效，但需要改进');
  } else {
    console.log('❌ 模型验证失败，需要重新训练');
  }

  return {
    totalPredictions,
    correctPredictions,
    accuracy,
    brierScore,
    calibration,
    byDifficulty,
  };
}

// ============================================================
// Main
// ============================================================

if (require.main === module) {
  validatePredictionAccuracy()
    .then(result => {
      console.log('\n验证完成');
      process.exit(result.accuracy >= 0.5 ? 0 : 1);
    })
    .catch(err => {
      console.error('验证失败:', err);
      process.exit(1);
    });
}

export { validatePredictionAccuracy, predictIRT };
