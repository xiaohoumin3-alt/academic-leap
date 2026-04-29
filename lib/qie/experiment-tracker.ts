/**
 * UOK Experiment Tracker
 *
 * 对照实验数据记录 - 不影响现有流程
 * 记录：UOK 预测 vs Random 预测 vs 实际结果
 */

export interface ExperimentEntry {
  timestamp: number;
  questionId: string;
  topic: string;

  // UOK 推荐
  uokPrediction: number;
  uokComplexity: number;

  // Random 对照
  randomPrediction: number;
  randomComplexity: number;

  // 实际结果
  isCorrect: boolean;

  // 学生状态
  masteryBefore: number;
  masteryAfter: number;
}

class ExperimentTracker {
  private entries: ExperimentEntry[] = [];
  private enabled = false;

  enable() {
    this.enabled = true;
    console.log('🧪 UOK Experiment Tracker ENABLED');
  }

  disable() {
    this.enabled = false;
    console.log('🧪 UOK Experiment Tracker DISABLED');
  }

  record(entry: ExperimentEntry) {
    if (!this.enabled) return;

    this.entries.push(entry);
    console.log('🧪 Recorded:', {
      uok: `${Math.round(entry.uokPrediction * 100)}%`,
      random: `${Math.round(entry.randomPrediction * 100)}%`,
      actual: entry.isCorrect ? '✅' : '❌',
    });
  }

  /**
   * 输出统计数据到 console
   */
  report() {
    if (this.entries.length === 0) {
      console.log('🧪 No experiment data yet');
      return;
    }

    const n = this.entries.length;

    // 命中率
    const uokHits = this.entries.filter(e => e.isCorrect).length;
    const randomHits = this.entries.filter(e => {
      return e.randomPrediction >= 0.5 ? e.isCorrect : !e.isCorrect;
    }).length;

    // 平均预测概率
    const avgUokPred = this.entries.reduce((s, e) => s + e.uokPrediction, 0) / n;
    const avgRandomPred = this.entries.reduce((s, e) => s + e.randomPrediction, 0) / n;

    // 掌握度提升
    const masteryGain = this.entries.reduce((s, e) => s + (e.masteryAfter - e.masteryBefore), 0) / n;

    // 复杂度分布
    const uokComplexities = this.entries.map(e => e.uokComplexity);
    const randomComplexities = this.entries.map(e => e.randomComplexity);

    console.log(`
╔══════════════════════════════════════════════════════════╗
║           🧪 UOK 对照实验报告 (N=${n})                    ║
╠══════════════════════════════════════════════════════════╣
║  命中率对比                                                 ║
║  • UOK:       ${Math.round(uokHits / n * 100).toString().padStart(6)}% (${uokHits}/${n})                      ║
║  • Random:    ${Math.round(randomHits / n * 100).toString().padStart(6)}% (${randomHits}/${n})                      ║
║  • 差值:       ${(Math.round((uokHits / n - randomHits / n) * 100)).toString().padStart(6)}%                              ║
╠══════════════════════════════════════════════════════════╣
║  预测置信度                                                 ║
║  • UOK 平均:  ${Math.round(avgUokPred * 100).toString().padStart(6)}%                             ║
║  • Random:    ${Math.round(avgRandomPred * 100).toString().padStart(6)}%                             ║
╠══════════════════════════════════════════════════════════╣
║  学习效果                                                   ║
║  • 掌握度提升: ${masteryGain > 0 ? '+' : ''}${Math.round(masteryGain * 100).toString().padStart(5)}%                          ║
╠══════════════════════════════════════════════════════════╣
║  复杂度分布                                                 ║
║  • UOK:       ${this.formatComplexity(uokComplexities)}                          ║
║  • Random:    ${this.formatComplexity(randomComplexities)}                          ║
╚══════════════════════════════════════════════════════════╝
    `);
  }

  private formatComplexity(values: number[]): string {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return `[${min.toFixed(2)} ~ ${avg.toFixed(2)} ~ ${max.toFixed(2)}]`;
  }

  getEntries(): ExperimentEntry[] {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
    console.log('🧪 Experiment data cleared');
  }
}

// Singleton
export const experimentTracker = new ExperimentTracker();

// 开发环境自动启用
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  experimentTracker.enable();

  // console 快捷命令
  (window as any).uokReport = () => experimentTracker.report();
  (window as any).uokClear = () => experimentTracker.clear();
  console.log('💡 输入 uokReport() 查看实验报告');
}
