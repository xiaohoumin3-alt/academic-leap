/**
 * 测评结果分层指导
 */
export interface GuidanceConfig { score: number; userGrade: number; targetScore: number; }
export interface GuidanceResult {
  level: 1 | 2 | 3 | 4 | 5;
  diagnosis: string; title: string; message: string;
  nextActions: Array<{ type: string; title: string; description: string; action: string; }>;
  practiceConfig: { difficulty: number; hintEnabled: boolean; encouragementMode: boolean; previewMode?: boolean; challengeMode?: boolean; };
  primaryButton: { label: string; action: string; style: 'primary' | 'success' | 'warning'; };
}
export function getGradeDifficultyRange(grade: number) {
  if (grade <= 3) return { min: 1, max: 2 };
  if (grade <= 6) return { min: 1, max: 3 };
  if (grade <= 9) return { min: 2, max: 4 };
  return { min: 3, max: 5 };
}
export function getAssessmentStartLevel(grade: number, targetScore: number) {
  if (grade <= 3) return 1;
  if (grade <= 6) return 2;
  if (grade <= 9) return 3;
  if (grade >= 10 && targetScore >= 90) return 4;
  if (grade >= 10 && targetScore >= 80) return 3;
  return 2;
}
function getScoreLevel(score: number) {
  if (score >= 90) return 5; if (score >= 75) return 4; if (score >= 60) return 3; if (score >= 40) return 2; return 1;
}
export function generateGuidance(config: GuidanceConfig): GuidanceResult {
  const { score, userGrade } = config;
  const level = getScoreLevel(score);
  const titles: Record<number, string> = { 1: '重新出发', 2: '加油追赶', 3: '稳扎稳打', 4: '优秀表现', 5: '超越期待' };
  const messages: Record<number, string> = { 1: '每个人都是从不会到会的，你也可以！', 2: '别灰心，每天进步一点点', 3: '稳扎稳打，你会越来越好', 4: '表现优秀！继续保持这个势头', 5: '继续保持！你是学习标兵' };
  return { level, diagnosis: getDiagnosis(level, userGrade), title: titles[level], message: messages[level], nextActions: getNextActions(level), practiceConfig: getPracticeConfig(level, userGrade), primaryButton: getPrimaryButton(level) };
}
function getDiagnosis(level: number, userGrade: number) {
  const g = userGrade <= 3 ? '小学低年级' : userGrade <= 6 ? '小学高年级' : userGrade <= 9 ? '初中' : '高中';
  const d: Record<number, string> = { 5: `你的水平已经远超当前${g}要求，已经掌握了核心知识。`, 4: `你的水平已经超前于当前${g}，表现非常出色。`, 3: `你的水平达到了当前${g}的标准要求，继续保持。`, 2: '你还有进步空间，需要重点加强薄弱环节。', 1: '基础需要加强，但这正是进步的开始，不要放弃。' };
  return d[level];
}
function getPracticeConfig(level: number, userGrade: number) {
  const base = userGrade <= 3 ? 1 : userGrade <= 6 ? 2 : 3;
  const configs: Record<number, GuidanceResult['practiceConfig']> = {
    5: { difficulty: Math.min(5, base + 2), hintEnabled: false, encouragementMode: false, challengeMode: true },
    4: { difficulty: Math.min(5, base + 1), hintEnabled: false, encouragementMode: false, previewMode: true },
    3: { difficulty: base, hintEnabled: true, encouragementMode: false },
    2: { difficulty: Math.max(1, base - 1), hintEnabled: true, encouragementMode: true },
    1: { difficulty: 1, hintEnabled: true, encouragementMode: true }
  };
  return configs[level];
}
function getPrimaryButton(level: number) {
  const btns: Record<number, GuidanceResult['primaryButton']> = {
    5: { label: '挑战超纲内容', action: 'challenge', style: 'success' },
    4: { label: '预习下一学年', action: 'preview', style: 'success' },
    3: { label: '开始巩固练习', action: 'practice', style: 'primary' },
    2: { label: '针对性补强', action: 'strengthen', style: 'warning' },
    1: { label: '从基础开始', action: 'start', style: 'warning' }
  };
  return btns[level];
}
function getNextActions(level: number) {
  const actions: Record<number, GuidanceResult['nextActions']> = {
    5: [{ type: 'challenge', title: '挑战超纲内容', description: '你已经掌握了当前年级的核心知识', action: '解锁竞赛基础题库' }, { type: 'teach', title: '成为小老师', description: '尝试讲解题目加深理解', action: '生成讲解要点清单' }],
    4: [{ type: 'preview', title: '预习下一学年', description: '你已经很好地掌握了当前知识', action: '生成下学年预习路径' }, { type: 'depth', title: '深入理解', description: '不只是会做题，要理解原理', action: '学习知识点拓展讲解' }],
    3: [{ type: 'consolidate', title: '巩固已学', description: '确保基础扎实', action: '每日10分钟基础题练习' }, { type: 'improve', title: '适度提升', description: '逐步挑战更高难度', action: '每周增加进阶题' }],
    2: [{ type: 'weakness', title: '针对性补强', description: '找出薄弱知识点重点练习', action: '查看薄弱点分析' }, { type: 'foundation', title: '回归基础', description: '回顾基础概念', action: '观看知识点讲解' }],
    1: [{ type: 'start', title: '从最简单的开始', description: '不要着急，从最基础的开始', action: '开始Level 1入门练习' }, { type: 'encourage', title: '每天一个小目标', description: '每天完成5道基础题', action: '设定每日目标' }]
  };
  return actions[level];
}
export function getTargetStrategy(currentScore: number, targetScore: number) {
  const gap = targetScore - currentScore;
  if (gap <= 0) return { status: 'achieved', message: '恭喜！你已达到目标分数！', nextGoal: '保持并继续挑战' };
  if (gap <= 10) return { status: 'close', message: `离目标还差${gap}分，继续加油！`, dailyTarget: 5, estimatedDays: Math.ceil(gap * 2) };
  if (gap <= 30) return { status: 'medium', message: `离目标差${gap}分，需要持续练习`, dailyTarget: 10, estimatedDays: Math.ceil(gap * 1.5) };
  return { status: 'far', message: `离目标差${gap}分，需要长期规划`, dailyTarget: 15, estimatedDays: Math.ceil(gap * 1.2) };
}
