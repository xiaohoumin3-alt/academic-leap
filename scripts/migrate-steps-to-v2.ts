/**
 * 数据迁移脚本：题目步骤从 v1 协议迁移到 v2 协议
 *
 * 功能：
 * 1. 查询所有 v1 协议的 QuestionStep
 * 2. 从 question.stepTypes 获取步骤类型
 * 3. 构造 v1 StepProtocol 对象
 * 4. 使用 migrateStepToV2 转换为 v2
 * 5. 更新数据库存储 v2 格式
 *
 * 使用方法：
 * npx tsx scripts/migrate-steps-to-v2.ts        # 执行迁移
 * npx tsx scripts/migrate-steps-to-v2.ts --dry   # 预览模式
 * npx tsx scripts/migrate-steps-to-v2.ts --limit 100  # 限制数量
 */

import { prisma } from '../lib/prisma';
import { migrateStepToV2 } from '../lib/question-engine/migrate';
import { StepProtocol, StepType } from '../lib/question-engine/protocol';

// CLI 参数
const isDryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

// 日志格式化
function log(message: string, ...args: any[]) {
  console.log(`[${new Date().toISOString()}] ${message}`, ...args);
}

// StepType 字符串到枚举的映射
// 注意: StepType 枚举值是小写字符串，所以直接使用
const STEP_TYPE_MAPPING: Record<string, StepType> = {
  // 二次函数
  'compute_vertex_x': 'compute_vertex_x' as StepType,
  'compute_vertex_y': 'compute_vertex_y' as StepType,
  'final_coordinate': 'final_coordinate' as StepType,
  'compute_value': 'compute_value' as StepType,

  // 勾股定理
  'pythagorean_c_square': 'pythagorean_c_square' as StepType,
  'pythagorean_c': 'pythagorean_c' as StepType,

  // 一元一次方程
  'solve_linear_equation': 'solve_linear_equation' as StepType,

  // 概率统计
  'compute_probability': 'compute_probability' as StepType,

  // 二次根式
  'compute_sqrt': 'compute_sqrt' as StepType,
  'simplify_sqrt': 'simplify_sqrt' as StepType,
  'sqrt_property': 'sqrt_property' as StepType,
  'sqrt_mixed': 'sqrt_mixed' as StepType,

  // 三角形判定
  'verify_right_angle': 'verify_right_angle' as StepType,

  // 四边形判定
  'verify_parallelogram': 'verify_parallelogram' as StepType,
  'verify_rectangle': 'verify_rectangle' as StepType,
  'verify_rhombus': 'verify_rhombus' as StepType,
  'verify_square': 'verify_square' as StepType,

  // 一元二次方程
  'identify_quadratic': 'identify_quadratic' as StepType,
  'solve_direct_root': 'solve_direct_root' as StepType,
  'solve_complete_square': 'solve_complete_square' as StepType,
  'solve_quadratic_formula': 'solve_quadratic_formula' as StepType,
  'solve_factorize': 'solve_factorize' as StepType,
  'quadratic_application': 'quadratic_application' as StepType,

  // 数据分析
  'compute_mean': 'compute_mean' as StepType,
  'compute_median': 'compute_median' as StepType,
  'compute_mode': 'compute_mode' as StepType,
  'compute_variance': 'compute_variance' as StepType,
  'compute_stddev': 'compute_stddev' as StepType,

  // 四边形性质计算
  'compute_rect_property': 'compute_rect_property' as StepType,
  'compute_rhombus_property': 'compute_rhombus_property' as StepType,
  'compute_square_property': 'compute_square_property' as StepType,
};

/**
 * 映射数据库中的步骤类型字符串到 StepType 枚举
 */
function mapStepTypeString(stepTypeString: string): StepType | null {
  if (!stepTypeString) return null;

  const normalized = stepTypeString.toLowerCase().trim();

  // 直接匹配
  if (STEP_TYPE_MAPPING[normalized]) {
    return STEP_TYPE_MAPPING[normalized];
  }

  // 尝试匹配枚举值本身
  const upper = normalized.toUpperCase();
  if (Object.values(StepType).includes(upper as StepType)) {
    return upper as StepType;
  }

  return null;
}

/**
 * 检测是否为 v2 协议
 */
function isV2Protocol(step: { type: string | null; answer: string }): boolean {
  if (step.type === 'v2') return true;
  try {
    const answer = JSON.parse(step.answer);
    return 'expectedAnswer' in answer;
  } catch {
    return false;
  }
}

interface MigrationResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ stepId: string; questionId: string; error: string }>;
}

async function migrateStepsToV2(): Promise<MigrationResult> {
  const result: MigrationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

  log('='.repeat(60));
  log('v1 到 v2 协议迁移脚本');
  log(`模式: ${isDryRun ? '🔍 预览（不实际修改）' : '✏️  实际执行'}`);
  if (limit) log(`限制数量: ${limit}`);
  log('='.repeat(60));

  // 1. 统计概览
  log('\n📊 步骤 1: 统计分析...');

  const allSteps = await prisma.questionStep.findMany({
    select: {
      id: true,
      type: true,
      answer: true,
    },
  });

  const total = allSteps.length;
  const v2Count = allSteps.filter(s => isV2Protocol(s)).length;
  const v1Count = total - v2Count;

  log(`  总步骤数: ${total}`);
  log(`  v2 协议: ${v2Count} ✅`);
  log(`  v1 协议: ${v1Count} 🔄`);

  if (v1Count === 0) {
    log('\n✅ 没有需要迁移的步骤');
    return result;
  }

  // 2. 获取需要迁移的步骤
  log('\n🔄 步骤 2: 获取待迁移步骤...');

  const stepsToMigrate = await prisma.questionStep.findMany({
    where: {
      id: { notIn: allSteps.filter(s => isV2Protocol(s)).map(s => s.id) },
    },
    include: {
      question: {
        select: { params: true, stepTypes: true },
      },
    },
    take: limit,
    orderBy: { stepNumber: 'asc' },
  });

  log(`  获取到 ${stepsToMigrate.length} 个待迁移步骤`);

  // 3. 执行迁移
  log('\n🔄 步骤 3: 执行迁移...');

  let processed = 0;
  const progressInterval = setInterval(() => {
    log(`  进度: ${processed}/${stepsToMigrate.length} (${Math.round(processed / stepsToMigrate.length * 100)}%)`);
  }, 5000);

  for (const step of stepsToMigrate) {
    processed++;

    try {
      // 解析 params 和 stepTypes
      const params = JSON.parse(step.question.params || '{}');
      const stepTypes = JSON.parse(step.question.stepTypes || '[]');

      // 从 stepTypes 数组获取当前步骤的类型
      const stepTypeString = stepTypes[step.stepNumber - 1];

      // 映射到 StepType 枚举
      const stepType = mapStepTypeString(stepTypeString);

      if (!stepType) {
        // 尝试从 expression 或 hint 推断类型
        log(`  ⚠️ 跳过（无法确定类型）: ${step.id} - ${stepTypeString || 'unknown'}`);
        result.skipped++;
        continue;
      }

      // 从 inputType 和 keyboard 推断
      const inputType = step.inputType ?? 'numeric';
      const keyboard = step.keyboard ?? 'numeric';

      // 构造 v1 StepProtocol
      const v1Step: StepProtocol = {
        stepId: `s${step.stepNumber}`,
        type: stepType,
        inputType: inputType as any,
        keyboard: keyboard as any,
        answerType: 'number' as any,
        tolerance: step.tolerance ?? undefined,
        ui: {
          instruction: step.expression,
          inputTarget: '',
          inputHint: step.hint || '',
        },
      };

      // 迁移到 v2
      const v2Step = migrateStepToV2(v1Step, params);

      // 构建完整的 v2 格式数据
      const v2Data = {
        type: 'v2',
        answerMode: v2Step.answerMode,
        expectedAnswer: v2Step.expectedAnswer,
        options: v2Step.options,
        ui: {
          instruction: step.expression,
          hint: step.hint || '',
          inputPlaceholder: v2Step.ui?.inputPlaceholder || '',
        },
        keyboard: v2Step.keyboard ? {
          type: v2Step.keyboard.type,
          extraKeys: v2Step.keyboard.extraKeys || [],
        } : undefined,
      };

      if (!isDryRun) {
        await prisma.questionStep.update({
          where: { id: step.id },
          data: {
            answer: JSON.stringify(v2Data),
            type: 'v2',
          },
        });
      }

      result.success++;
      if (processed % 10 === 0) {
        log(`  ✅ 已迁移 ${processed}/${stepsToMigrate.length}`);
      }
    } catch (error) {
      result.failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({
        stepId: step.id,
        questionId: step.questionId,
        error: errorMessage,
      });
      log(`  ❌ 迁移失败: ${step.id} - ${errorMessage}`);
    }
  }

  clearInterval(progressInterval);

  // 4. 验证
  log('\n✅ 步骤 4: 验证结果...');

  if (!isDryRun) {
    const sampleIds = stepsToMigrate.slice(0, 10).map(s => s.id);
    const verifiedSteps = await prisma.questionStep.findMany({
      where: { id: { in: sampleIds } },
      select: { id: true, type: true, answer: true },
    });

    const verifiedV2 = verifiedSteps.filter(s => isV2Protocol(s)).length;
    log(`  抽样验证: ${verifiedV2}/${verifiedSteps.length} 已转为 v2`);
  }

  return result;
}

// 运行迁移
migrateStepsToV2()
  .then((result) => {
    log('\n' + '='.repeat(60));
    log('📈 迁移结果汇总');
    log('='.repeat(60));
    log(`  成功: ${result.success}`);
    log(`  失败: ${result.failed}`);
    log(`  跳过: ${result.skipped}`);

    if (result.errors.length > 0) {
      log('\n❌ 失败详情 (前10条):');
      result.errors.slice(0, 10).forEach(({ stepId, error }) => {
        log(`  - ${stepId}: ${error}`);
      });
      if (result.errors.length > 10) {
        log(`  ... 还有 ${result.errors.length - 10} 条失败记录`);
      }
    }

    log('='.repeat(60));

    if (isDryRun) {
      log('\n🔍 预览模式：以上是预期的迁移结果');
      log('    运行时不带 --dry 将实际执行迁移');
    }

    log('\n迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移失败:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
