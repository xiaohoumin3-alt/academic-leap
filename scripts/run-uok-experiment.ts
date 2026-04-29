/**
 * UOK Experiment Runner Script
 *
 * 独立脚本 - 直接运行实验验证，无需 Next.js 服务器
 *
 * 运行: npx tsx scripts/run-uok-experiment.ts
 */

import { runExperimentValidation, exportToCSV, exportToJSON } from '../lib/qie/experiment-validator';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🔬 UOK 实验验证启动...\n');

  try {
    // 运行实验
    const { report, data, exportData } = await runExperimentValidation();

    // 输出报告
    console.log('\n' + '='.repeat(60));
    console.log('实验完成！生成数据文件...\n');

    // 保存 JSON
    const jsonPath = join(process.cwd(), 'uok-experiment-results.json');
    writeFileSync(jsonPath, exportToJSON(exportData));
    console.log(`✅ JSON: ${jsonPath}`);

    // 保存 CSV
    const csvPath = join(process.cwd(), 'uok-experiment-results.csv');
    writeFileSync(csvPath, exportToCSV(exportData));
    console.log(`✅ CSV: ${csvPath}`);

    // 保存报告
    const reportPath = join(process.cwd(), 'uok-experiment-report.txt');
    writeFileSync(reportPath, report);
    console.log(`✅ Report: ${reportPath}`);

    console.log(`\n📊 总计 ${exportData.length} 条实验记录`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 实验运行失败:', error);
    process.exit(1);
  }
}

main();
