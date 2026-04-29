/**
 * 收敛系统 v1.0 - CI 门禁测试
 *
 * 运行所有三个核心指标测试:
 * - DFI (Data Flow Integrity) ≥ 0.99
 * - LE (Learning Effectiveness) > 0.15
 * - CS (Convergence Stability) ≥ 0.85
 *
 * 任何指标失败即阻断 merge/deploy
 *
 * NOTE: Use lib/rl/validation/*.ts for actual validation implementations
 */

import { validateDFI } from '../lib/rl/validation/dfi';
import { validateLE } from '../lib/rl/validation/le';
import { validateCS } from '../lib/rl/validation/cs';
import { prisma } from '../lib/prisma.js';

interface ConvergenceResult {
  converged: boolean;
  dfi: { value: number; pass: boolean; target: number };
  le: { value: number; pass: boolean; target: number };
  cs: { value: number; pass: boolean; target: number };
  timestamp: string;
}

/**
 * 运行所有收敛测试
 */
export async function runConvergenceTests(options: {
  dfiSampleSize?: number;
  leWindowSize?: number;
  csMinRecommendations?: number;
  verbose?: boolean;
}): Promise<ConvergenceResult> {
  const {
    verbose = true,
  } = options;

  if (verbose) {
    console.log('\n' + '█'.repeat(60));
    console.log('🚀 收敛系统 v1.0 - CI 门禁测试');
    console.log('█'.repeat(60));
  }

  // 1. DFI 测试
  if (verbose) console.log('\n[1/3] DFI (Data Flow Integrity) 测试...');
  const dfiResult = await validateDFI(prisma);
  if (verbose) {
    console.log(`  DFI: ${(dfiResult.dfi * 100).toFixed(1)}% (目标: 99%)`);
    console.log(`  状态: ${dfiResult.pass ? '✅ 通过' : '❌ 失败'}`);
  }

  // 2. LE 测试
  if (verbose) console.log('\n[2/3] LE (Learning Effectiveness) 测试...');
  const leResult = await validateLE(prisma);
  if (verbose) {
    console.log(`  LE: ${(leResult.le * 100).toFixed(1)}% (目标: >15%)`);
    console.log(`  状态: ${leResult.pass ? '✅ 通过' : '❌ 失败'}`);
  }

  // 3. CS 测试
  if (verbose) console.log('\n[3/3] CS (Convergence Stability) 测试...');
  const csResult = await validateCS(prisma);
  if (verbose) {
    console.log(`  CS: ${(csResult.cs * 100).toFixed(1)}% (目标: ≥85%)`);
    console.log(`  状态: ${csResult.pass ? '✅ 通过' : '❌ 失败'}`);
  }

  // 汇总结果
  const result: ConvergenceResult = {
    converged:
      dfiResult.pass && leResult.pass && csResult.pass,
    dfi: {
      value: dfiResult.dfi,
      pass: dfiResult.pass,
      target: 0.99,
    },
    le: {
      value: leResult.le,
      pass: leResult.pass,
      target: 0.15,
    },
    cs: {
      value: csResult.cs,
      pass: csResult.pass,
      target: 0.85,
    },
    timestamp: new Date().toISOString(),
  };

  // 打印最终结果
  if (verbose) {
    console.log('\n' + '█'.repeat(60));
    console.log('📋 收敛测试汇总');
    console.log('█'.repeat(60));
    console.log(`\n  指标      实际值    目标值    状态`);
    console.log(`  ─────────────────────────────────`);
    console.log(
      `  DFI       ${(result.dfi.value * 100).toFixed(1)}%      ` +
        `${(result.dfi.target * 100).toFixed(0)}%      ` +
        `${result.dfi.pass ? '✅' : '❌'}`
    );
    console.log(
      `  LE        ${(result.le.value * 100).toFixed(1)}%      ` +
        `>${(result.le.target * 100).toFixed(0)}%      ` +
        `${result.le.pass ? '✅' : '❌'}`
    );
    console.log(
      `  CS        ${(result.cs.value * 100).toFixed(1)}%      ` +
        `≥${(result.cs.target * 100).toFixed(0)}%      ` +
        `${result.cs.pass ? '✅' : '❌'}`
    );
    console.log(`  ─────────────────────────────────`);

    if (result.converged) {
      console.log(`\n  ✅ 系统已收敛 - 可以 merge/deploy`);
      console.log(`  数据是通的 + 学生真的变好了 + 系统不乱变`);
    } else {
      console.log(`\n  🚫 系统未收敛 - 阻断 merge/deploy`);

      const failures: string[] = [];
      if (!result.dfi.pass) failures.push('DFI');
      if (!result.le.pass) failures.push('LE');
      if (!result.cs.pass) failures.push('CS');

      console.log(`  失败指标: ${failures.join(', ')}`);
    }

    console.log('\n' + '█'.repeat(60) + '\n');
  }

  return result;
}

/**
 * 输出 JSON 格式结果（用于 CI/CD）
 */
export async function runConvergenceTestsJSON(options: {
  dfiSampleSize?: number;
  leWindowSize?: number;
  csMinRecommendations?: number;
}): Promise<string> {
  const result = await runConvergenceTests({ ...options, verbose: false });

  const output = {
    version: '1.0',
    timestamp: result.timestamp,
    converged: result.converged,
    metrics: {
      dfi: {
        name: 'Data Flow Integrity',
        value: result.dfi.value,
        target: result.dfi.target,
        pass: result.dfi.pass,
      },
      le: {
        name: 'Learning Effectiveness',
        value: result.le.value,
        target: result.le.target,
        pass: result.le.pass,
      },
      cs: {
        name: 'Convergence Stability',
        value: result.cs.value,
        target: result.cs.target,
        pass: result.cs.pass,
      },
    },
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');

  if (json) {
    const output = await runConvergenceTestsJSON({});
    console.log(output);
    const parsed = JSON.parse(output);
    process.exit(parsed.converged ? 0 : 1);
  } else {
    const result = await runConvergenceTests({});
    process.exit(result.converged ? 0 : 1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
