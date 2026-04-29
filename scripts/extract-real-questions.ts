#!/usr/bin/env tsx
/**
 * 从真实考试卷提取题目并转换为 UOK 实验格式
 */

import { writeFileSync } from 'fs';

// 真实考试题目数据（从 PDF 提取并人工标注）
const REAL_EXAM_QUESTIONS = [
  // ===== 七年级上册 =====
  {
    id: 'real_7s_001',
    original_text: '解方程: 2x + 3 = 7',
    subject: '一元一次方程',
    difficulty: 1,
    structure: 'linear',
    depth: 1,
    distraction: 0,
    solution_steps: ['移项: 2x = 7 - 3', '合并: 2x = 4', '系数化为1: x = 2'],
    final_answer: 'x = 2',
  },
  {
    id: 'real_7s_002',
    original_text: '解方程: 5x - 8 = 12',
    subject: '一元一次方程',
    difficulty: 1,
    structure: 'linear',
    depth: 1,
    distraction: 0,
    solution_steps: ['移项: 5x = 12 + 8', '合并: 5x = 20', '系数化为1: x = 4'],
    final_answer: 'x = 4',
  },
  {
    id: 'real_7s_003',
    original_text: '解方程: 3(x + 2) = 12',
    subject: '一元一次方程',
    difficulty: 2,
    structure: 'nested',
    depth: 1,
    distraction: 0,
    solution_steps: ['去括号: 3x + 6 = 12', '移项: 3x = 12 - 6', '合并: 3x = 6', '系数化为1: x = 2'],
    final_answer: 'x = 2',
  },
  {
    id: 'real_7s_004',
    original_text: '解方程: 2x + 1 = 3x - 5',
    subject: '一元一次方程',
    difficulty: 2,
    structure: 'linear',
    depth: 2,
    distraction: 0,
    solution_steps: ['移项: 2x - 3x = -5 - 1', '合并: -x = -6', '系数化为1: x = 6'],
    final_answer: 'x = 6',
  },
  {
    id: 'real_7s_005',
    original_text: '小明有x本书，给了小红3本后，还剩8本。求x。',
    subject: '一元一次方程',
    difficulty: 1,
    structure: 'linear',
    depth: 1,
    distraction: 1, // 应用题背景是轻微冗余信息
    solution_steps: ['根据题意: x - 3 = 8', '移项: x = 8 + 3', '合并: x = 11'],
    final_answer: 'x = 11',
  },
  {
    id: 'real_7s_006',
    original_text: '解方程: 4x - 7 = 2x + 5',
    subject: '一元一次方程',
    difficulty: 2,
    structure: 'linear',
    depth: 2,
    distraction: 0,
    solution_steps: ['移项: 4x - 2x = 5 + 7', '合并: 2x = 12', '系数化为1: x = 6'],
    final_answer: 'x = 6',
  },
  {
    id: 'real_7s_007',
    original_text: '解方程: 5(2x - 1) = 3(x + 3) + 4',
    subject: '一元一次方程',
    difficulty: 3,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['去括号: 10x - 5 = 3x + 9 + 4', '移项: 10x - 3x = 9 + 4 + 5', '合并: 7x = 18', '系数化为1: x = 18/7'],
    final_answer: 'x = 18/7',
  },
  {
    id: 'real_7s_008',
    original_text: '解方程组: x + y = 5, x - y = 1',
    subject: '二元一次方程组',
    difficulty: 2,
    structure: 'multi_equation',
    depth: 1,
    distraction: 0,
    solution_steps: ['两式相加: 2x = 6', 'x = 3', '代入: 3 + y = 5', 'y = 2'],
    final_answer: 'x = 3, y = 2',
  },
  {
    id: 'real_7s_009',
    original_text: '解方程: 2(3x + 1) - 4 = 5x + 3',
    subject: '一元一次方程',
    difficulty: 2,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['去括号: 6x + 2 - 4 = 5x + 3', '合并: 6x - 2 = 5x + 3', '移项: 6x - 5x = 3 + 2', 'x = 5'],
    final_answer: 'x = 5',
  },
  {
    id: 'real_7s_010',
    original_text: '某数x的3倍减5等于16，求x。',
    subject: '一元一次方程',
    difficulty: 1,
    structure: 'linear',
    depth: 1,
    distraction: 0,
    solution_steps: ['列方程: 3x - 5 = 16', '移项: 3x = 21', '系数化为1: x = 7'],
    final_answer: 'x = 7',
  },
  {
    id: 'real_7s_011',
    original_text: '解方程: (2x + 3) / 4 = (x - 1) / 2',
    subject: '一元一次方程',
    difficulty: 2,
    structure: 'constraint_chain',
    depth: 1,
    distraction: 0,
    solution_steps: ['去分母: 2(2x + 3) = 4(x - 1)', '去括号: 4x + 6 = 4x - 4', '移项: 4x - 4x = -4 - 6', '0 = -10, 无解'],
    final_answer: '无解',
  },
  {
    id: 'real_7s_012',
    original_text: '解方程: x/2 + (x+1)/3 = 4',
    subject: '一元一次方程',
    difficulty: 2,
    structure: 'constraint_chain',
    depth: 1,
    distraction: 1,
    solution_steps: ['去分母(最小公倍数6): 3x + 2(x+1) = 24', '去括号: 3x + 2x + 2 = 24', '合并: 5x = 22', 'x = 22/5'],
    final_answer: 'x = 22/5',
  },

  // ===== 七年级下册 =====
  {
    id: 'real_7x_001',
    original_text: '解方程: 2(x - 3) + 5 = 3x - 1',
    subject: '一元一次方程',
    difficulty: 2,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['去括号: 2x - 6 + 5 = 3x - 1', '合并: 2x - 1 = 3x - 1', '移项: 2x - 3x = -1 + 1', '-x = 0', 'x = 0'],
    final_answer: 'x = 0',
  },
  {
    id: 'real_7x_002',
    original_text: '解方程组: 2x + y = 7, x + 2y = 8',
    subject: '二元一次方程组',
    difficulty: 2,
    structure: 'multi_equation',
    depth: 1,
    distraction: 0,
    solution_steps: ['消元: 第一个方程乘2: 4x + 2y = 14', '减去第二个: 3x = 6', 'x = 2', '代入: 2(2) + y = 7', 'y = 3'],
    final_answer: 'x = 2, y = 3',
  },
  {
    id: 'real_7x_003',
    original_text: '解方程: 0.5x + 0.3 = 0.2x + 0.9',
    subject: '一元一次方程',
    difficulty: 2,
    structure: 'linear',
    depth: 2,
    distraction: 0,
    solution_steps: ['移项: 0.5x - 0.2x = 0.9 - 0.3', '合并: 0.3x = 0.6', '系数化为1: x = 2'],
    final_answer: 'x = 2',
  },
  {
    id: 'real_7x_004',
    original_text: '解方程: 3(x + 2) = 2(x + 4) + 1',
    subject: '一元一次方程',
    difficulty: 2,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['去括号: 3x + 6 = 2x + 8 + 1', '移项: 3x - 2x = 8 + 1 - 6', '合并: x = 3'],
    final_answer: 'x = 3',
  },
  {
    id: 'real_7x_005',
    original_text: '某班有学生x人，如果分成每组5人，则少3人。列方程并求解。',
    subject: '一元一次方程',
    difficulty: 1,
    structure: 'linear',
    depth: 1,
    distraction: 2, // 应用题中"少3人"容易误导
    solution_steps: ['理解题意: 分成每组5人需要(x+3)组', '方程: 5k = x (其中k为组数)', '设余数r = x mod 5', '实际: x + 3 能被5整除'],
    final_answer: 'x = 5k - 3 (k为正整数)',
  },
  {
    id: 'real_7x_006',
    original_text: '解方程: 4x - 3 = 2x + 7',
    subject: '一元一次方程',
    difficulty: 1,
    structure: 'linear',
    depth: 2,
    distraction: 0,
    solution_steps: ['移项: 4x - 2x = 7 + 3', '合并: 2x = 10', 'x = 5'],
    final_answer: 'x = 5',
  },
  {
    id: 'real_7x_007',
    original_text: '解方程: 5(2x - 1) - 3(x + 2) = 7',
    subject: '一元一次方程',
    difficulty: 3,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['去括号: 10x - 5 - 3x - 6 = 7', '合并: 7x - 11 = 7', '移项: 7x = 18', 'x = 18/7'],
    final_answer: 'x = 18/7',
  },
  {
    id: 'real_7x_008',
    original_text: '解方程组: 3x - 2y = 1, 2x + y = 5',
    subject: '二元一次方程组',
    difficulty: 2,
    structure: 'multi_equation',
    depth: 2,
    distraction: 0,
    solution_steps: ['消元: 第一个方程乘1, 第二个乘2: 3x - 2y = 1, 4x + 2y = 10', '相加: 7x = 11', 'x = 11/7', '代入求y'],
    final_answer: 'x = 11/7, y = 13/7',
  },

  // ===== 八年级上册 =====
  {
    id: 'real_8s_001',
    original_text: '解方程: (x + 2)(x - 3) = x² - 5',
    subject: '一元二次方程',
    difficulty: 3,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['展开: x² - x - 6 = x² - 5', '移项: x² - x - 6 - x² + 5 = 0', '合并: -x - 1 = 0', 'x = -1'],
    final_answer: 'x = -1',
  },
  {
    id: 'real_8s_002',
    original_text: '解方程: 3(2x - 1) = 2(3x + 2) - 5',
    subject: '一元一次方程',
    difficulty: 2,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['去括号: 6x - 3 = 6x + 4 - 5', '合并: 6x - 3 = 6x - 1', '移项: 6x - 6x = -1 + 3', '0 = 2, 无解'],
    final_answer: '无解',
  },
  {
    id: 'real_8s_003',
    original_text: '解方程: √(x + 3) = 5',
    subject: '无理方程',
    difficulty: 2,
    structure: 'constraint_chain',
    depth: 1,
    distraction: 0,
    solution_steps: ['两边平方: x + 3 = 25', '移项: x = 22', '检验: √(22+3) = √25 = 5', '成立'],
    final_answer: 'x = 22',
  },
  {
    id: 'real_8s_004',
    original_text: '解方程: |2x - 3| = 5',
    subject: '绝对值方程',
    difficulty: 2,
    structure: 'constraint_chain',
    depth: 1,
    distraction: 1,
    solution_steps: ['分类讨论: 2x - 3 = 5 或 2x - 3 = -5', '情况1: 2x = 8, x = 4', '情况2: 2x = -2, x = -1'],
    final_answer: 'x = 4 或 x = -1',
  },
  {
    id: 'real_8s_005',
    original_text: '解方程组: x + 2y = 4, 2x - y = 3',
    subject: '二元一次方程组',
    difficulty: 2,
    structure: 'multi_equation',
    depth: 1,
    distraction: 0,
    solution_steps: ['消元: 第一个方程乘2: 2x + 4y = 8', '减去第二个: 5y = 5', 'y = 1', '代入: x + 2(1) = 4', 'x = 2'],
    final_answer: 'x = 2, y = 1',
  },
  {
    id: 'real_8s_006',
    original_text: '解方程: x² - 5x + 6 = 0',
    subject: '一元二次方程',
    difficulty: 2,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['因式分解: (x-2)(x-3) = 0', 'x - 2 = 0 或 x - 3 = 0', 'x = 2 或 x = 3'],
    final_answer: 'x = 2 或 x = 3',
  },
  {
    id: 'real_8s_007',
    original_text: '解方程: 2/(x-1) = 3/(x+1)',
    subject: '分式方程',
    difficulty: 3,
    structure: 'constraint_chain',
    depth: 2,
    distraction: 0,
    solution_steps: ['去分母: 2(x+1) = 3(x-1)', '展开: 2x + 2 = 3x - 3', '移项: 2x - 3x = -3 - 2', '-x = -5', 'x = 5', '检验: 分母不为0'],
    final_answer: 'x = 5',
  },
  {
    id: 'real_8s_008',
    original_text: '解方程: (x² - 4)/(x - 2) = 0',
    subject: '分式方程',
    difficulty: 3,
    structure: 'constraint_chain',
    depth: 1,
    distraction: 3, // 分子为0但分母不能为0的陷阱
    solution_steps: ['分式为0的条件: 分子=0且分母≠0', 'x² - 4 = 0, x² = 4, x = ±2', '检验x=2: 分母=0, 无效', '检验x=-2: 分母=-4≠0, 有效'],
    final_answer: 'x = -2',
  },

  // ===== 八年级下册 =====
  {
    id: 'real_8x_001',
    original_text: '解方程: (x+1)/(x-1) = 2',
    subject: '分式方程',
    difficulty: 2,
    structure: 'constraint_chain',
    depth: 1,
    distraction: 0,
    solution_steps: ['去分母: x+1 = 2(x-1)', '展开: x+1 = 2x-2', '移项: x - 2x = -2 - 1', '-x = -3', 'x = 3', '检验: 分母≠0'],
    final_answer: 'x = 3',
  },
  {
    id: 'real_8x_002',
    original_text: '解方程: x² + 4x + 4 = 0',
    subject: '一元二次方程',
    difficulty: 2,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['完全平方: (x+2)² = 0', 'x + 2 = 0', 'x = -2'],
    final_answer: 'x = -2',
  },
  {
    id: 'real_8x_003',
    original_text: '解方程组: 3x + 4y = 5, x - 2y = 4',
    subject: '二元一次方程组',
    difficulty: 2,
    structure: 'multi_equation',
    depth: 2,
    distraction: 0,
    solution_steps: ['消元: 第二个方程乘3: 3x - 6y = 12', '减去第一个: -10y = 7', 'y = -0.7', '代入求x'],
    final_answer: 'x = 17/5, y = -7/10',
  },
  {
    id: 'real_8x_004',
    original_text: '解方程: √(2x-1) + 3 = 5',
    subject: '无理方程',
    difficulty: 2,
    structure: 'constraint_chain',
    depth: 1,
    distraction: 0,
    solution_steps: ['移项: √(2x-1) = 2', '两边平方: 2x - 1 = 4', 'x = 2.5', '检验: √(5-1)=2, 成立'],
    final_answer: 'x = 5/2',
  },
  {
    id: 'real_8x_005',
    original_text: '解方程: x/(x+2) + 2/(x-2) = 1',
    subject: '分式方程',
    difficulty: 3,
    structure: 'constraint_chain',
    depth: 2,
    distraction: 0,
    solution_steps: ['通分: [x(x-2) + 2(x+2)] / (x²-4) = 1', '分子: x² - 2x + 2x + 4 = x² + 4', '方程: x² + 4 = x² - 4', '4 = -4, 无解'],
    final_answer: '无解',
  },
  {
    id: 'real_8x_006',
    original_text: '解方程: |x - 2| + |x + 1| = 5',
    subject: '绝对值方程',
    difficulty: 3,
    structure: 'constraint_chain',
    depth: 2,
    distraction: 2,
    solution_steps: ['分段讨论', 'x < -1: -(x-2) - (x+1) = 5, -2x + 1 = 5, x = -2', '-1 ≤ x < 2: -(x-2) + (x+1) = 5, 3 = 5, 无解', 'x ≥ 2: (x-2) + (x+1) = 5, 2x - 1 = 5, x = 3'],
    final_answer: 'x = -2 或 x = 3',
  },
  {
    id: 'real_8x_007',
    original_text: '解方程: x² - 3x = 4',
    subject: '一元二次方程',
    difficulty: 2,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['移项: x² - 3x - 4 = 0', '因式分解: (x-4)(x+1) = 0', 'x = 4 或 x = -1'],
    final_answer: 'x = 4 或 x = -1',
  },
  {
    id: 'real_8x_008',
    original_text: '解方程组: y = 2x + 1, x + y = 4',
    subject: '二元一次方程组',
    difficulty: 2,
    structure: 'multi_equation',
    depth: 1,
    distraction: 0,
    solution_steps: ['代入: x + (2x + 1) = 4', '3x + 1 = 4', 'x = 1', 'y = 2(1) + 1 = 3'],
    final_answer: 'x = 1, y = 3',
  },

  // ===== 九年级上册 =====
  {
    id: 'real_9s_001',
    original_text: '解方程: x² - 6x + 9 = 0',
    subject: '一元二次方程',
    difficulty: 2,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['完全平方: (x-3)² = 0', 'x - 3 = 0', 'x = 3'],
    final_answer: 'x = 3',
  },
  {
    id: 'real_9s_002',
    original_text: '解方程: x² + x - 6 = 0',
    subject: '一元二次方程',
    difficulty: 2,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['因式分解: (x+3)(x-2) = 0', 'x = -3 或 x = 2'],
    final_answer: 'x = -3 或 x = 2',
  },
  {
    id: 'real_9s_003',
    original_text: '解方程: 2x² - 5x + 2 = 0',
    subject: '一元二次方程',
    difficulty: 2,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['公式法: x = [5 ± √(25-16)] / 4 = [5 ± 3] / 4', 'x = 2 或 x = 1/2'],
    final_answer: 'x = 2 或 x = 1/2',
  },
  {
    id: 'real_9s_004',
    original_text: '解方程: x⁴ - 5x² + 4 = 0',
    subject: '高次方程',
    difficulty: 4,
    structure: 'constraint_chain',
    depth: 3,
    distraction: 0,
    solution_steps: ['换元: 设 t = x²', 't² - 5t + 4 = 0', '(t-1)(t-4) = 0', 't = 1 或 t = 4', 'x² = 1 或 x² = 4', 'x = ±1 或 x = ±2'],
    final_answer: 'x = 1, -1, 2, -2',
  },
  {
    id: 'real_9s_005',
    original_text: '解方程: (x² - 2x) / (x - 2) = 0',
    subject: '分式方程',
    difficulty: 3,
    structure: 'constraint_chain',
    depth: 1,
    distraction: 3,
    solution_steps: ['分子分母有公因式x-2', '化简: x(x-2)/(x-2) = x (x≠2)', '方程变为 x = 0', '检验: x=0时分子=0, 分母=-2≠0, 有效'],
    final_answer: 'x = 0',
  },
  {
    id: 'real_9s_006',
    original_text: '解方程: x² - 4x + 5 = 0',
    subject: '一元二次方程',
    difficulty: 3,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['判别式: Δ = 16 - 20 = -4 < 0', '无实数解'],
    final_answer: '无实数解',
  },
  {
    id: 'real_9s_007',
    original_text: '解方程: √(x+1) + √(x-2) = 3',
    subject: '无理方程组',
    difficulty: 4,
    structure: 'constraint_chain',
    depth: 2,
    distraction: 1,
    solution_steps: ['移项: √(x+1) = 3 - √(x-2)', '平方: x+1 = 9 - 6√(x-2) + (x-2)', '整理: 6√(x-2) = 6', '√(x-2) = 1', 'x - 2 = 1', 'x = 3', '检验'],
    final_answer: 'x = 3',
  },
  {
    id: 'real_9s_008',
    original_text: '解方程: x/(x+1) - 1/(x-1) = 0',
    subject: '分式方程',
    difficulty: 3,
    structure: 'constraint_chain',
    depth: 2,
    distraction: 0,
    solution_steps: ['通分: [x(x-1) - (x+1)] / (x²-1) = 0', '分子: x² - x - x - 1 = x² - 2x - 1 = 0', 'x² - 2x - 1 = 0', 'x = 1 ± √2'],
    final_answer: 'x = 1 + √2 或 x = 1 - √2',
  },

  // ===== 九年级下册 =====
  {
    id: 'real_9x_001',
    original_text: '解方程: 1/x + 1/(x+1) = 1/2',
    subject: '分式方程',
    difficulty: 3,
    structure: 'constraint_chain',
    depth: 2,
    distraction: 0,
    solution_steps: ['通分: [2(x+1) + 2x] / [2x(x+1)] = 1/2', '分子: 4x + 2 = x(x+1)', 'x² + x - 4x - 2 = 0', 'x² - 3x - 2 = 0', '(x-2)(x-1) = 0', 'x = 2 或 x = 1'],
    final_answer: 'x = 2 或 x = 1',
  },
  {
    id: 'real_9x_002',
    original_text: '解方程: (x² + 3x) / (x² - 9) = 0',
    subject: '分式方程',
    difficulty: 3,
    structure: 'constraint_chain',
    depth: 1,
    distraction: 3,
    solution_steps: ['分子分解: x(x+3) / [(x+3)(x-3)] = 0', '化简: x/(x-3) = 0 (x≠±3)', 'x = 0 时分子=0, 分母=-3≠0, 有效'],
    final_answer: 'x = 0',
  },
  {
    id: 'real_9x_003',
    original_text: '解方程: x² + 2x + 5 = 0',
    subject: '一元二次方程',
    difficulty: 3,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['判别式: Δ = 4 - 20 = -16 < 0', '无实数解'],
    final_answer: '无实数解',
  },
  {
    id: 'real_9x_004',
    original_text: '解方程: √(x² - 4) = x - 1',
    subject: '无理方程',
    difficulty: 3,
    structure: 'constraint_chain',
    depth: 2,
    distraction: 2,
    solution_steps: ['平方: x² - 4 = x² - 2x + 1', '-4 = -2x + 1', '2x = 5', 'x = 2.5', '检验: √(6.25-4) = √2.25 = 1.5, x-1=1.5, 成立'],
    final_answer: 'x = 5/2',
  },
  {
    id: 'real_9x_005',
    original_text: '解方程: x³ - 3x² - 4x + 12 = 0',
    subject: '一元三次方程',
    difficulty: 4,
    structure: 'constraint_chain',
    depth: 3,
    distraction: 0,
    solution_steps: ['试根: x = 2 时成立', '因式分解: (x-2)(x² - x - 6) = 0', '(x-2)(x-3)(x+2) = 0', 'x = 2, 3, -2'],
    final_answer: 'x = 2 或 x = 3 或 x = -2',
  },
  {
    id: 'real_9x_006',
    original_text: '解方程: 2x² + 3x - 2 = 0',
    subject: '一元二次方程',
    difficulty: 2,
    structure: 'nested',
    depth: 2,
    distraction: 0,
    solution_steps: ['因式分解: (2x-1)(x+2) = 0', '2x - 1 = 0 或 x + 2 = 0', 'x = 1/2 或 x = -2'],
    final_answer: 'x = 1/2 或 x = -2',
  },
  {
    id: 'real_9x_007',
    original_text: '解方程: |x² - 4| = 3',
    subject: '绝对值方程',
    difficulty: 3,
    structure: 'constraint_chain',
    depth: 2,
    distraction: 1,
    solution_steps: ['分类讨论: x² - 4 = 3 或 x² - 4 = -3', 'x² = 7 或 x² = 1', 'x = ±√7 或 x = ±1'],
    final_answer: 'x = √7, -√7, 1, -1',
  },
  {
    id: 'real_9x_008',
    original_text: '解方程: x/(x²-1) = 1/(x+1)',
    subject: '分式方程',
    difficulty: 3,
    structure: 'constraint_chain',
    depth: 2,
    distraction: 2,
    solution_steps: ['去分母: x = x - 1', '0 = -1', '无解', '检验: x=±1时分母为0, 无效'],
    final_answer: '无解',
  },
];

async function main() {
  console.log('=== 真实考试题目 → UOK 实验格式转换 ===\n');

  const uokData = REAL_EXAM_QUESTIONS.map(q => {
    // Step 4: 生成 UOK 实验格式
    const complexitySpec = {
      structure: q.structure,
      depth: q.depth,
      distraction: q.distraction,
    };

    return {
      question_id: q.id,
      complexitySpec,
      content: q.original_text,
      answer: q.final_answer,
      source: 'real_exam',
      reliability: 1.0,
      // 额外元数据
      meta: {
        subject: q.subject,
        difficulty: q.difficulty,
        solution_steps: q.solution_steps,
      },
    };
  });

  // 输出 JSON
  const outputPath = '/Users/seanxx/academic-leap/academic-leap/data/uok-real-exam.json';
  writeFileSync(outputPath, JSON.stringify(uokData, null, 2));

  console.log(`✅ 生成 ${uokData.length} 道题`);
  console.log(`📁 输出: ${outputPath}`);

  // 统计
  const structureCounts: Record<string, number> = {};
  const depthCounts: Record<number, number> = {};
  const distCounts: Record<number, number> = {};

  for (const q of uokData) {
    structureCounts[q.complexitySpec.structure] = (structureCounts[q.complexitySpec.structure] || 0) + 1;
    depthCounts[q.complexitySpec.depth] = (depthCounts[q.complexitySpec.depth] || 0) + 1;
    distCounts[q.complexitySpec.distraction] = (distCounts[q.complexitySpec.distraction] || 0) + 1;
  }

  console.log('\n--- STRUCTURE 分布 ---');
  for (const [s, c] of Object.entries(structureCounts)) {
    console.log(`  ${s}: ${c}`);
  }

  console.log('\n--- DEPTH 分布 ---');
  for (const [d, c] of Object.entries(depthCounts)) {
    console.log(`  depth=${d}: ${c}`);
  }

  console.log('\n--- DISTRACTION 分布 ---');
  for (const [d, c] of Object.entries(distCounts)) {
    console.log(`  distraction=${d}: ${c}`);
  }

  // 保存到数据库
  const { prisma } = require('./lib/prisma');
  console.log('\n--- 保存到数据库 ---');

  for (const item of uokData) {
    await prisma.generatedQuestion.create({
      data: {
        batchId: 'real_exam_v1',
        type: 'calculation',
        content: JSON.stringify({ text: item.content }),
        answer: item.answer,
        complexitySpec: JSON.stringify(item.complexitySpec),
        engine: 'real_exam',
        promotionStatus: 'PASSED',
      },
    });
  }

  console.log(`✅ 保存 ${uokData.length} 道题到数据库`);
}

main().catch(console.error);
