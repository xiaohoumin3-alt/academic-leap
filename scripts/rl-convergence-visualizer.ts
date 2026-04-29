#!/usr/bin/env tsx
/**
 * RL收敛验证器 - 可视化生成器
 *
 * 生成HTML报告，包含：
 * 1. LE over time 图表
 * 2. CS over time 图表
 * 3. 推荐分布热力图
 */

import { writeFile } from 'fs/promises';
import { ConvergenceSimulator } from './rl-convergence-simulator';
import { STUDENT_TYPES } from './rl-convergence-simulator';

interface VisualizerConfig {
  studentType: keyof typeof STUDENT_TYPES;
  maxSessions: number;
  outputPath: string;
}

class ConvergenceVisualizer {
  async generateReport(config: VisualizerConfig): Promise<void> {
    const { studentType, maxSessions, outputPath } = config;

    console.log(`\n📊 生成收敛验证报告...`);
    console.log(`  学生类型: ${studentType}`);
    console.log(`  会话数: ${maxSessions}`);
    console.log(`  输出: ${outputPath}\n`);

    // 运行模拟
    const simulator = new ConvergenceSimulator(0.5);
    const metrics = await simulator.simulate(studentType, maxSessions);
    const sessions = simulator.getSessions();

    // 生成HTML报告
    const html = this.generateHTML(metrics, sessions, studentType);

    await writeFile(outputPath, html);
    console.log(`✅ 报告已生成: ${outputPath}`);
  }

  private generateHTML(metrics: any, sessions: any[], studentType: string): string {
    // 计算滑动窗口指标
    const windowSize = 50;
    const leData: number[] = [];
    const accData: number[] = [];
    const thetaData: number[] = [];

    for (let i = windowSize; i < sessions.length; i += 10) {
      const window = sessions.slice(i - windowSize, i);
      const avgLE = window.reduce((sum, s) => sum + s.leDelta, 0) / windowSize;
      const avgAcc = window.reduce((sum, s) => sum + s.postAccuracy, 0) / windowSize;
      const avgTheta = window.reduce((sum, s) => sum + s.studentTheta, 0) / windowSize;

      leData.push(avgLE * 100);
      accData.push(avgAcc * 100);
      thetaData.push(avgTheta);
    }

    // 生成推荐分布
    const distMap = new Map<number, number>();
    for (const s of sessions) {
      const bucket = Math.round(s.recommendedDeltaC);
      distMap.set(bucket, (distMap.get(bucket) || 0) + 1);
    }

    const distLabels = Array.from(distMap.keys()).sort((a, b) => a - b);
    const distValues = distLabels.map(l => distMap.get(l) || 0);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RL收敛验证报告 - ${studentType}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f7;
      color: #1d1d1f;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 48px; font-weight: 700; margin-bottom: 10px; letter-spacing: -0.02em; }
    .subtitle { font-size: 21px; color: #6e6e73; margin-bottom: 40px; }
    .card {
      background: white;
      border-radius: 20px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .metric {
      text-align: center;
      padding: 20px;
      border-radius: 12px;
      background: #f5f5f7;
    }
    .metric.pass { background: #d1fae5; }
    .metric.fail { background: #fee2e2; }
    .metric-label { font-size: 14px; color: #6e6e73; margin-bottom: 8px; }
    .metric-value { font-size: 36px; font-weight: 700; }
    .metric-target { font-size: 12px; color: #6e6e73; margin-top: 4px; }
    .chart-container { height: 300px; position: relative; }
    .converged { padding: 20px; border-radius: 12px; text-align: center; font-size: 24px; font-weight: 600; }
    .converged.yes { background: #d1fae5; color: #065f46; }
    .converged.no { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>RL收敛验证报告</h1>
    <p class="subtitle">学生类型: ${studentType} | 会话数: ${metrics.sessions}</p>

    <div class="card">
      <div class="converged ${metrics.converged ? 'yes' : 'no'}">
        ${metrics.converged ? '✅ 系统已收敛' : '🚫 系统未收敛'}
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
          <div class="metric-target">目标: >15%</div>
        </div>
        <div class="metric ${metrics.details.csPass ? 'pass' : 'fail'}">
          <div class="metric-label">CS (收敛稳定性)</div>
          <div class="metric-value">${(metrics.cs * 100).toFixed(1)}%</div>
          <div class="metric-target">目标: ≥85%</div>
        </div>
        <div class="metric">
          <div class="metric-label">学生能力提升</div>
          <div class="metric-value">${metrics.studentImprovement >= 0 ? '+' : ''}${metrics.studentImprovement.toFixed(2)}</div>
          <div class="metric-target">${metrics.details.initialStudentTheta.toFixed(2)} → ${metrics.details.finalStudentTheta.toFixed(2)}</div>
        </div>
      </div>
    </div>

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

    <div class="card">
      <h3>学生能力 (Theta) 随时间变化</h3>
      <div class="chart-container">
        <canvas id="thetaChart"></canvas>
      </div>
    </div>

    <div class="card">
      <h3>题目难度推荐分布</h3>
      <div class="chart-container">
        <canvas id="distChart"></canvas>
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
                yMin: 15,
                yMax: 15,
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
  </script>
</body>
</html>`;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const studentType = (args[0] as keyof typeof STUDENT_TYPES) || 'normal_student';
  const maxSessions = parseInt(args[1]) || 1000;
  const outputPath = args[2] || 'rl-convergence-report.html';

  const visualizer = new ConvergenceVisualizer();
  await visualizer.generateReport({ studentType, maxSessions, outputPath });
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { ConvergenceVisualizer };
export type { VisualizerConfig };
