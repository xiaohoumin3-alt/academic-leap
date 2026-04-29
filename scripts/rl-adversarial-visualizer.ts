#!/usr/bin/env tsx
/**
 * 对抗式收敛验证器 - 可视化报告生成器
 *
 * 生成包含以下内容的HTML报告：
 * 1. LE/CS/Robustness over time
 * 2. 失败模式分布
 * 3. 疲劳累积曲线
 * 4. 推荐分布 vs 实际难度
 */

import { writeFile } from 'fs/promises';
import { AdversarialConvergenceSimulator, ADVERSARIAL_STUDENT_TYPES, ENVIRONMENT_CONFIGS } from './rl-adversarial-simulator';

interface AdversarialVisualizerConfig {
  studentType: keyof typeof ADVERSARIAL_STUDENT_TYPES;
  environmentType: keyof typeof ENVIRONMENT_CONFIGS;
  maxSessions: number;
  outputPath: string;
}

class AdversarialVisualizer {
  async generateReport(config: AdversarialVisualizerConfig): Promise<void> {
    const { studentType, environmentType, maxSessions, outputPath } = config;

    console.log(`\n📊 生成对抗式收敛验证报告...`);
    console.log(`  学生类型: ${studentType}`);
    console.log(`  环境类型: ${environmentType}`);
    console.log(`  会话数: ${maxSessions}`);
    console.log(`  输出: ${outputPath}\n`);

    const simulator = new AdversarialConvergenceSimulator(0.5);
    const metrics = await simulator.simulate(studentType, environmentType, maxSessions);
    const sessions = simulator.getSessions();

    const html = this.generateHTML(metrics, sessions, studentType, environmentType);

    await writeFile(outputPath, html);
    console.log(`✅ 报告已生成: ${outputPath}`);
  }

  private generateHTML(
    metrics: any,
    sessions: any[],
    studentType: string,
    environmentType: string
  ): string {
    const windowSize = 50;
    const leData: number[] = [];
    const accData: number[] = [];
    const thetaData: number[] = [];
    const fatigueData: number[] = [];

    for (let i = windowSize; i < sessions.length; i += 10) {
      const window = sessions.slice(i - windowSize, i);
      const avgLE = window.reduce((sum: number, s: any) => sum + s.leDelta, 0) / windowSize;
      const avgAcc = window.reduce((sum: number, s: any) => sum + s.postAccuracy, 0) / windowSize;
      const avgTheta = window.reduce((sum: number, s: any) => sum + s.studentTheta, 0) / windowSize;
      const avgFatigue = window.reduce((sum: number, s: any) => sum + s.fatigue, 0) / windowSize;

      leData.push(avgLE * 100);
      accData.push(avgAcc * 100);
      thetaData.push(avgTheta);
      fatigueData.push(avgFatigue * 100);
    }

    // 推荐分布
    const distMap = new Map<number, number>();
    for (const s of sessions) {
      const bucket = Math.round(s.recommendedDeltaC);
      distMap.set(bucket, (distMap.get(bucket) || 0) + 1);
    }

    const distLabels = Array.from(distMap.keys()).sort((a, b) => a - b);
    const distValues = distLabels.map(l => distMap.get(l) || 0);

    // 失败模式统计
    const failureModes = {
      normal: sessions.filter((s: any) => s.answerType === 'normal').length,
      fatigue: sessions.filter((s: any) => s.answerType === 'fatigue').length,
      noise: sessions.filter((s: any) => s.answerType === 'noise').length,
      random: sessions.filter((s: any) => s.answerType === 'random').length,
      adversarial: sessions.filter((s: any) => s.answerType === 'adversarial').length,
    };

    const failureLabels = Object.keys(failureModes);
    const failureValues = Object.values(failureModes);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>对抗式收敛验证报告 - ${studentType}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f7;
      color: #1d1d1f;
      line-height: 1.6;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 48px; font-weight: 700; margin-bottom: 10px; letter-spacing: -0.02em; }
    .subtitle { font-size: 21px; color: #6e6e73; margin-bottom: 40px; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      margin-left: 10px;
    }
    .badge.adversarial { background: #fee2e2; color: #991b1b; }
    .badge.environment { background: #dbeafe; color: #1e40af; }
    .card {
      background: white;
      border-radius: 20px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; }
    .metric {
      text-align: center;
      padding: 20px;
      border-radius: 12px;
      background: #f5f5f7;
    }
    .metric.pass { background: #d1fae5; }
    .metric.fail { background: #fee2e2; }
    .metric-label { font-size: 13px; color: #6e6e73; margin-bottom: 8px; }
    .metric-value { font-size: 32px; font-weight: 700; }
    .metric-target { font-size: 11px; color: #6e6e73; margin-top: 4px; }
    .chart-container { height: 300px; position: relative; }
    .converged { padding: 20px; border-radius: 12px; text-align: center; font-size: 24px; font-weight: 600; }
    .converged.yes { background: #d1fae5; color: #065f46; }
    .converged.no { background: #fee2e2; color: #991b1b; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    @media (max-width: 768px) {
      .two-col { grid-template-columns: 1fr; }
    }
    .failure-mode-bar {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    .failure-label { width: 100px; font-size: 14px; }
    .failure-bar { flex: 1; height: 24px; background: #f5f5f7; border-radius: 4px; overflow: hidden; }
    .failure-fill { height: 100%; transition: width 0.3s; }
    .failure-value { width: 60px; text-align: right; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      对抗式收敛验证报告
      <span class="badge adversarial">${studentType}</span>
      <span class="badge environment">${environmentType}</span>
    </h1>
    <p class="subtitle">会话数: ${metrics.sessions} | 验证系统在非理想环境下的鲁棒性</p>

    <div class="card">
      <div class="converged ${metrics.converged ? 'yes' : 'no'}">
        ${metrics.converged ? '✅ 系统在对抗环境下仍可收敛' : '🚫 系统在对抗环境下未收敛'}
      </div>
    </div>

    <div class="card">
      <div class="metrics">
        <div class="metric ${metrics.details.dfiPass ? 'pass' : 'fail'}">
          <div class="metric-label">DFI (数据链完整度)</div>
          <div class="metric-value">${(metrics.dfi * 100).toFixed(1)}%</div>
          <div class="metric-target">目标: ≥99%</div>
        </div>
        <div class="metric ${metrics.details.lePass ? 'pass' : 'fail'}">
          <div class="metric-label">LE (学习有效性)</div>
          <div class="metric-value">${(metrics.le * 100).toFixed(1)}%</div>
          <div class="metric-target">目标: ≥10%</div>
        </div>
        <div class="metric ${metrics.details.csPass ? 'pass' : 'fail'}">
          <div class="metric-label">CS (收敛稳定性)</div>
          <div class="metric-value">${(metrics.cs * 100).toFixed(1)}%</div>
          <div class="metric-target">目标: ≥70%</div>
        </div>
        <div class="metric ${metrics.details.robustnessPass ? 'pass' : 'fail'}">
          <div class="metric-label">Robustness (鲁棒性)</div>
          <div class="metric-value">${(metrics.robustness * 100).toFixed(1)}%</div>
          <div class="metric-target">目标: ≥60%</div>
        </div>
        <div class="metric">
          <div class="metric-label">学生能力提升</div>
          <div class="metric-value">${metrics.studentImprovement >= 0 ? '+' : ''}${metrics.studentImprovement.toFixed(2)}</div>
          <div class="metric-target">${metrics.details.initialStudentTheta.toFixed(2)} → ${metrics.details.finalStudentTheta.toFixed(2)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">最终疲劳值</div>
          <div class="metric-value">${(metrics.details.finalFatigue * 100).toFixed(0)}%</div>
          <div class="metric-target">影响答题准确率</div>
        </div>
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <h3>学习有效性 (LE) 随时间变化</h3>
        <div class="chart-container">
          <canvas id="leChart"></canvas>
        </div>
      </div>

      <div class="card">
        <h3>学生准确率随时间变化</h3>
        <div class="chart-container">
          <canvas id="accChart"></canvas>
        </div>
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <h3>学生能力 (Theta) 随时间变化</h3>
        <div class="chart-container">
          <canvas id="thetaChart"></canvas>
        </div>
      </div>

      <div class="card">
        <h3>疲劳累积曲线</h3>
        <div class="chart-container">
          <canvas id="fatigueChart"></canvas>
        </div>
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <h3>题目难度推荐分布</h3>
        <div class="chart-container">
          <canvas id="distChart"></canvas>
        </div>
      </div>

      <div class="card">
        <h3>失败模式分布</h3>
        <div class="chart-container">
          <canvas id="failureChart"></canvas>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>失败模式详情</h3>
      <div style="margin-top: 20px;">
        ${this.generateFailureModeBars(metrics.failureModes, sessions.length)}
      </div>
    </div>
  </div>

  <script>
    // LE Chart
    new Chart(document.getElementById('leChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(leData.map((_, i) => i * 10))},
        datasets: [{
          label: 'LE (%)',
          data: ${JSON.stringify(leData)},
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100 }
        },
        plugins: {
          annotation: {
            annotations: {
              line1: {
                type: 'line',
                yMin: 10,
                yMax: 10,
                borderColor: '#10b981',
                borderWidth: 2,
                borderDash: [5, 5]
              }
            }
          }
        }
      }
    });

    // Accuracy Chart
    new Chart(document.getElementById('accChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(accData.map((_, i) => i * 10))},
        datasets: [{
          label: '准确率 (%)',
          data: ${JSON.stringify(accData)},
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });

    // Theta Chart
    new Chart(document.getElementById('thetaChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(thetaData.map((_, i) => i * 10))},
        datasets: [{
          label: 'Theta (能力值)',
          data: ${JSON.stringify(thetaData)},
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: -3, max: 3 }
        }
      }
    });

    // Fatigue Chart
    new Chart(document.getElementById('fatigueChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(fatigueData.map((_, i) => i * 10))},
        datasets: [{
          label: '疲劳值 (%)',
          data: ${JSON.stringify(fatigueData)},
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });

    // Distribution Chart
    new Chart(document.getElementById('distChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(distLabels)},
        datasets: [{
          label: '推荐次数',
          data: ${JSON.stringify(distValues)},
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: '#10b981',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });

    // Failure Mode Chart
    new Chart(document.getElementById('failureChart'), {
      type: 'doughnut',
      data: {
        labels: ${JSON.stringify(failureLabels)},
        datasets: [{
          data: ${JSON.stringify(failureValues)},
          backgroundColor: [
            '#10b981', // normal - green
            '#f59e0b', // fatigue - orange
            '#8b5cf6', // noise - purple
            '#ef4444', // random - red
            '#991b1b', // adversarial - dark red
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    });
  </script>
</body>
</html>`;
  }

  private generateFailureModeBars(failureModes: any, total: number): string {
    const modes = [
      { key: 'normal', label: '正常答题', color: '#10b981' },
      { key: 'fatigue', label: '疲劳答题', color: '#f59e0b' },
      { key: 'noise', label: '噪声干扰', color: '#8b5cf6' },
      { key: 'random', label: '随机点击', color: '#ef4444' },
      { key: 'adversarial', label: '对抗行为', color: '#991b1b' },
    ];

    return modes.map(mode => {
      const count = failureModes[mode.key + 'Answers'] || failureModes[mode.key] || 0;
      const pct = (count / total * 100).toFixed(1);
      return `
        <div class="failure-mode-bar">
          <div class="failure-label">${mode.label}</div>
          <div class="failure-bar">
            <div class="failure-fill" style="width: ${pct}%; background: ${mode.color};"></div>
          </div>
          <div class="failure-value">${pct}%</div>
        </div>
      `;
    }).join('');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const studentType = (args[0] as keyof typeof ADVERSARIAL_STUDENT_TYPES) || 'noisy_student';
  const environmentType = (args[1] as keyof typeof ENVIRONMENT_CONFIGS) || 'stable';
  const maxSessions = parseInt(args[2]) || 1000;
  const outputPath = args[3] || 'rl-adversarial-report.html';

  const visualizer = new AdversarialVisualizer();
  await visualizer.generateReport({ studentType, environmentType, maxSessions, outputPath });
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { AdversarialVisualizer };
export type { AdversarialVisualizerConfig };
