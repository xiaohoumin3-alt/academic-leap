# 分析页页签重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 将分析页的"学情解构"内容拆分为两个页签（成长分析/练习统计），使用 iOS Segmented Control 样式切换

**架构:** 在 AnalyzePage 中添加页签状态管理，提取两个页签组件，复用现有数据加载逻辑

**技术栈:** React, TypeScript, Tailwind CSS, Framer Motion

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `components/TabSwitcher.tsx` | 创建 | 页签切换器组件 |
| `components/AnalyzePage/GrowthAnalysisTab.tsx` | 创建 | 成长分析页签内容 |
| `components/AnalyzePage/PracticeStatsTab.tsx` | 创建 | 练习统计页签内容 |
| `components/AnalyzePage.tsx` | 修改 | 集成页签切换，重构布局 |

---

## Task 1: 创建 TabSwitcher 组件

**文件:**
- 创建: `components/TabSwitcher.tsx`

- [ ] **Step 1: 创建组件文件和基础结构**

```typescript
// components/TabSwitcher.tsx
import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export type TabValue = 'growth' | 'practice';

export interface TabOption {
  value: TabValue;
  label: string;
}

interface TabSwitcherProps {
  options: TabOption[];
  value: TabValue;
  onChange: (value: TabValue) => void;
}

const TabSwitcher: React.FC<TabSwitcherProps> = ({ options, value, onChange }) => {
  return (
    <div className="relative bg-surface-container-low rounded-full p-1 flex">
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-full text-sm font-display font-black transition-all relative z-10",
              isActive ? "text-on-primary" : "text-on-surface-variant"
            )}
          >
            {option.label}
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-primary rounded-full"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TabSwitcher;
```

- [ ] **Step 2: 提交组件**

```bash
git add components/TabSwitcher.tsx
git commit -m "feat: add TabSwitcher component with iOS-style segmented control"
```

---

## Task 2: 创建 GrowthAnalysisTab 组件

**文件:**
- 创建: `components/AnalyzePage/GrowthAnalysisTab.tsx`
- 参考: `components/AnalyzePage.tsx:291-463`（诊断测评相关内容）

- [ ] **Step 1: 创建组件文件和类型定义**

```typescript
// components/AnalyzePage/GrowthAnalysisTab.tsx
import React from 'react';
import { motion } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '../../lib/utils';
import MaterialIcon from '../MaterialIcon';
import { StartingScoreCalibrationCard } from '../StartingScoreCalibrationCard';

// 复用 AnalyzePage 中的类型定义
interface KnowledgeData {
  knowledgePoint: string;
  mastery: number;
  stability?: number;
  status?: 'high' | 'medium' | 'low';
}

interface DiagnosticAttempt {
  id: string;
  score: number;
  completedAt: string;
}

interface OverviewInner {
  totalAttempts: number;
  averageScore: number;
  lowestScore: number;
  diagnosticAttempts: DiagnosticAttempt[];
  diagnosticDataReliability: 'high' | 'medium' | 'low';
  diagnosticVolatilityRange: number;
  needsCalibration: boolean;
  calibratedStartingScore: number | null;
  startingScoreCalibrated: boolean;
}

interface RecommendationsData {
  recommendations?: Array<{
    type: 'practice' | 'review' | 'challenge' | 'tip';
    title: string;
    description: string;
  }>;
}

interface GrowthAnalysisTabProps {
  overview: OverviewInner;
  knowledgeData: KnowledgeData[];
  recommendations: RecommendationsData;
  selectedModule: KnowledgeData | null;
  setSelectedModule: (module: KnowledgeData | null) => void;
  currentScore: number;
  onCalibration: () => void;
}

const GrowthAnalysisTab: React.FC<GrowthAnalysisTabProps> = ({
  overview,
  knowledgeData,
  recommendations,
  selectedModule,
  setSelectedModule,
  currentScore,
  onCalibration,
}) => {
  // 计算成长故事数据
  const diagnosticAttempts = overview?.diagnosticAttempts || [];
  const firstScore = diagnosticAttempts.length > 0
    ? diagnosticAttempts[0].score
    : null;
  const latestScore = diagnosticAttempts.length > 0
    ? diagnosticAttempts[diagnosticAttempts.length - 1].score
    : null;
  const growth = (firstScore !== null && latestScore !== null && firstScore !== latestScore)
    ? latestScore - firstScore
    : null;

  return (
    <div className="space-y-8">
      {/* 起始分校准提示 */}
      {overview?.needsCalibration && overview?.calibratedStartingScore && (
        <StartingScoreCalibrationCard
          originalLowestScore={overview.lowestScore}
          newStartingScore={overview.calibratedStartingScore}
          currentScore={currentScore}
          onConfirm={onCalibration}
          onDismiss={() => {}}
        />
      )}

      {/* 成长轨迹 */}
      <section className="bg-surface-container-lowest rounded-[2rem] p-8 relative overflow-hidden ambient-shadow">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-gradient-to-br from-primary/10 to-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center justify-between mb-4 relative z-10">
          <h3 className="text-xl font-display font-black text-on-surface">成长轨迹</h3>
          <span className="text-[10px] px-3 py-1 bg-warning-container text-on-warning-container rounded-full font-bold">
            真实水平
          </span>
        </div>

        {firstScore === null || latestScore === null ? (
          <div className="text-center py-8">
            <p className="text-on-surface-variant">完成诊断测评后查看成长轨迹</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-center gap-6 mb-6 relative z-10">
              <div className="text-center">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">首次</p>
                <p className="text-3xl font-display font-black text-on-surface-variant">{firstScore}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-0.5 bg-surface-variant"></div>
                <MaterialIcon icon="chevron_right" className="text-outline-variant" style={{ fontSize: '20px' }} />
                <div className="w-12 h-0.5 bg-surface-variant"></div>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-primary uppercase mb-1">最近</p>
                <p className="text-4xl font-display font-black text-primary">{latestScore}</p>
              </div>
            </div>

            {growth !== null && growth !== 0 && (
              <div className="flex items-center justify-center gap-2 relative z-10">
                <div className={`flex items-center gap-1 px-4 py-2 rounded-full ${
                  growth > 0 ? 'bg-success/20' : 'bg-error/20'
                }`}>
                  <MaterialIcon
                    icon={growth > 0 ? 'trending_up' : 'trending_down'}
                    className={growth > 0 ? 'text-success' : 'text-error'}
                    style={{ fontSize: '18px' }}
                  />
                  <span className={`text-base font-display font-black ${
                    growth > 0 ? 'text-success' : 'text-error'
                  }`}>
                    {growth > 0 ? '+' : ''}{growth}分
                  </span>
                </div>
              </div>
            )}

            <p className="text-center text-xs text-on-surface-variant mt-4">
              测评分数对比 · 真实反映学习进步
            </p>
          </>
        )}
      </section>

      {/* 数据可信度和波动范围 */}
      <section className="grid grid-cols-2 gap-6">
        <div className="bg-surface-container-lowest rounded-[2rem] p-6 ambient-shadow">
          <div className="flex items-center gap-3 mb-3">
            <MaterialIcon icon="verified" className="text-primary" style={{ fontSize: '20px' }} />
            <h4 className="text-sm font-bold text-on-surface-variant">数据可信度</h4>
          </div>
          <p className="text-lg font-display font-black text-primary">
            {overview?.diagnosticDataReliability === 'high' ? '高'
             : overview?.diagnosticDataReliability === 'medium' ? '中'
             : overview?.diagnosticDataReliability ? '低' : '-'}
            {overview?.diagnosticDataReliability && ` (${diagnosticAttempts.length}次诊断测评)`}
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-[2rem] p-6 ambient-shadow">
          <div className="flex items-center gap-3 mb-3">
            <MaterialIcon icon="show_chart" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
            <h4 className="text-sm font-bold text-on-surface-variant">波动范围</h4>
          </div>
          <p className="text-lg font-display font-black text-on-surface">
            ±{overview?.diagnosticVolatilityRange ?? '-'} 分
          </p>
        </div>
      </section>

      {/* 知识掌握矩阵 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-display font-black text-on-surface">知识掌握矩阵</h3>
          <span className="text-xs font-bold text-on-surface-variant">点击查看详情</span>
        </div>

        {!knowledgeData || knowledgeData.length === 0 ? (
          <div className="bg-surface-container-low rounded-3xl p-6 text-center">
            <MaterialIcon icon="school" className="text-on-surface-variant mx-auto mb-2" style={{ fontSize: '48px' }} />
            <p className="text-on-surface-variant">开始练习后将显示知识点掌握情况</p>
          </div>
        ) : (
          <>
            <div className="bg-surface-container-low rounded-3xl p-6">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={knowledgeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                    <XAxis
                      dataKey="knowledgePoint"
                      tick={{ fill: 'currentColor', fontSize: 12 }}
                      stroke="currentColor"
                      strokeOpacity={0.5}
                    />
                    <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} stroke="currentColor" strokeOpacity={0.5} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-surface-container)',
                        border: '1px solid var(--color-outline-variant)',
                        borderRadius: '12px',
                      }}
                    />
                    <Bar
                      dataKey="mastery"
                      radius={[8, 8, 0, 0]}
                      fill="var(--color-primary)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {knowledgeData.map((item, index) => (
                <motion.button
                  key={item.knowledgePoint}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedModule(item)}
                  className={cn(
                    "p-4 rounded-2xl text-left transition-all",
                    selectedModule?.knowledgePoint === item.knowledgePoint
                      ? "bg-primary-container text-on-primary-container scale-105"
                      : "bg-surface-container hover:bg-surface-container-high"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">{item.knowledgePoint}</span>
                    <span className="text-lg font-display font-black">{item.mastery}%</span>
                  </div>
                  <div className="h-2 bg-surface-variant/30 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-current"
                      initial={{ width: 0 }}
                      animate={{ width: `${item.mastery}%` }}
                      transition={{ delay: index * 0.05 + 0.2, duration: 0.5 }}
                    />
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* AI 学习建议 */}
      {recommendations?.recommendations && recommendations.recommendations.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-xl font-display font-black text-on-surface">AI 学习建议</h3>
          <div className="space-y-3">
            {recommendations.recommendations.slice(0, 3).map((rec, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-surface-container-low rounded-2xl p-5 flex items-start gap-4"
              >
                <div className={cn(
                  "p-2 rounded-full",
                  rec.type === 'practice' && "bg-error-container text-on-error-container",
                  rec.type === 'review' && "bg-warning-container text-on-warning-container",
                  rec.type === 'challenge' && "bg-success-container text-on-success-container",
                  rec.type === 'tip' && "bg-tertiary-container text-on-tertiary-container"
                )}>
                  {rec.type === 'practice' && <MaterialIcon icon="gps_fixed" style={{ fontSize: '20px' }} />}
                  {rec.type === 'review' && <MaterialIcon icon="history" style={{ fontSize: '20px' }} />}
                  {rec.type === 'challenge' && <MaterialIcon icon="bolt" style={{ fontSize: '20px' }} />}
                  {rec.type === 'tip' && <MaterialIcon icon="info" style={{ fontSize: '20px' }} />}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-on-surface mb-1">{rec.title}</h4>
                  <p className="text-sm text-on-surface-variant">{rec.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default GrowthAnalysisTab;
```

- [ ] **Step 2: 提交组件**

```bash
git add components/AnalyzePage/GrowthAnalysisTab.tsx
git commit -m "feat: add GrowthAnalysisTab component"
```

---

## Task 3: 创建 PracticeStatsTab 组件

**文件:**
- 创建: `components/AnalyzePage/PracticeStatsTab.tsx`
- 参考: `components/AnalyzePage.tsx:466-671`（练习相关内容）

- [ ] **Step 1: 创建组件文件**

```typescript
// components/AnalyzePage/PracticeStatsTab.tsx
import React from 'react';
import { motion } from 'motion/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { cn } from '../../lib/utils';
import MaterialIcon from '../MaterialIcon';

interface KnowledgeData {
  knowledgePoint: string;
  mastery: number;
  stability?: number;
  status?: 'high' | 'medium' | 'low';
}

interface OverviewInner {
  trainingAvgScore: number;
  trainingCount: number;
  trainingQuestions: number;
  trainingCorrectRate: number;
  trainingMinutes: number;
}

interface RecommendationsData {
  insights?: {
    achievements?: Array<{
      name: string;
      description: string;
    }>;
  };
}

interface PracticeStatsTabProps {
  overview: OverviewInner;
  trainingKnowledgeData: KnowledgeData[];
  timeline: Array<{ date: string; count: number; avgScore: number }>;
  recommendations: RecommendationsData;
  selectedTrainingModule: KnowledgeData | null;
  setSelectedTrainingModule: (module: KnowledgeData | null) => void;
}

const PracticeStatsTab: React.FC<PracticeStatsTabProps> = ({
  overview,
  trainingKnowledgeData,
  timeline,
  recommendations,
  selectedTrainingModule,
  setSelectedTrainingModule,
}) => {
  const getPracticeStats = () => ({
    avgScore: overview?.trainingAvgScore || 0,
    correctRate: overview?.trainingCorrectRate || 0,
    totalQuestions: overview?.trainingQuestions || 0,
    totalMinutes: overview?.trainingMinutes || 0,
  });

  const stats = getPracticeStats();

  return (
    <div className="space-y-8">
      {/* 练习状态 */}
      <section className="bg-surface-container-lowest rounded-[2rem] p-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-display font-black text-on-surface">练习状态</h3>
          <span className="text-[10px] px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full font-bold">
            日常巩固
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-surface-container rounded-2xl">
            <p className="text-2xl font-display font-black text-secondary">
              {stats.correctRate > 0 ? stats.correctRate + '%' : '-'}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1">正确率</p>
          </div>
          <div className="text-center p-4 bg-surface-container rounded-2xl">
            <p className="text-2xl font-display font-black text-secondary">
              {stats.totalQuestions > 0 ? stats.totalQuestions : '-'}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1">总题数</p>
          </div>
          <div className="text-center p-4 bg-surface-container rounded-2xl">
            <p className="text-2xl font-display font-black text-secondary">
              {stats.totalMinutes > 0 ? stats.totalMinutes : '-'}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1">分钟</p>
          </div>
        </div>
      </section>

      {/* 本周练习趋势 */}
      <section className="space-y-4">
        <h3 className="text-xl font-display font-black text-on-surface">本周练习趋势</h3>
        {!timeline || timeline.length === 0 ? (
          <div className="bg-surface-container-low rounded-3xl p-6 text-center">
            <MaterialIcon icon="timeline" className="text-on-surface-variant mx-auto mb-2" style={{ fontSize: '48px' }} />
            <p className="text-on-surface-variant">开始练习后将显示练习趋势</p>
          </div>
        ) : (
          <div className="bg-surface-container-low rounded-3xl p-6">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => new Date(date).toLocaleDateString('zh-CN', { weekday: 'short' })}
                    tick={{ fill: 'currentColor', fontSize: 10 }}
                    stroke="currentColor"
                    strokeOpacity={0.5}
                  />
                  <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} stroke="currentColor" strokeOpacity={0.5} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface-container)',
                      border: '1px solid var(--color-outline-variant)',
                      borderRadius: '12px',
                    }}
                    labelFormatter={(date) => new Date(date).toLocaleDateString('zh-CN', { weekday: 'long' })}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    stroke="var(--color-primary)"
                    strokeWidth={3}
                    dot={{ fill: 'var(--color-primary)', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* 知识练习分布 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-display font-black text-on-surface">知识练习分布</h3>
          <span className="text-xs font-bold text-on-surface-variant">点击查看详情</span>
        </div>

        {!trainingKnowledgeData || trainingKnowledgeData.length === 0 ? (
          <div className="bg-surface-container-low rounded-3xl p-6 text-center">
            <MaterialIcon icon="school" className="text-on-surface-variant mx-auto mb-2" style={{ fontSize: '48px' }} />
            <p className="text-on-surface-variant">开始练习后将显示知识点掌握情况</p>
          </div>
        ) : (
          <>
            <div className="bg-surface-container-low rounded-3xl p-6">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trainingKnowledgeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                    <XAxis dataKey="knowledgePoint" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value) => [`${value}%`, '掌握度']}
                      contentStyle={{ borderRadius: '12px', border: 'none' }}
                    />
                    <Bar
                      dataKey="mastery"
                      fill="var(--color-secondary)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {trainingKnowledgeData.map((item, index) => (
                <motion.button
                  key={item.knowledgePoint}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedTrainingModule(item)}
                  className={cn(
                    "p-4 rounded-2xl text-left transition-all",
                    selectedTrainingModule?.knowledgePoint === item.knowledgePoint
                      ? "bg-secondary-container text-on-secondary-container scale-105"
                      : "bg-surface-container hover:bg-surface-container-high"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">{item.knowledgePoint}</span>
                    <span className="text-lg font-display font-black">{item.mastery}%</span>
                  </div>
                  <div className="w-full bg-surface-variant rounded-full h-1.5">
                    <div
                      className="bg-secondary rounded-full h-1.5"
                      style={{ width: `${item.mastery}%` }}
                    />
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 成就解锁 */}
      {recommendations?.insights?.achievements && recommendations.insights.achievements.length > 0 && (
        <section className="bg-gradient-to-br from-tertiary to-tertiary-container rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl"></div>
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-on-tertiary-container uppercase tracking-widest mb-1">成就解锁</p>
            <h3 className="text-xl font-display font-black text-on-tertiary-container leading-tight">
              获得"{recommendations.insights.achievements[0].name}"勋章！
            </h3>
            <p className="text-[10px] text-on-tertiary-container/60 mt-1">{recommendations.insights.achievements[0].description}</p>
          </div>
        </section>
      )}
    </div>
  );
};

export default PracticeStatsTab;
```

- [ ] **Step 2: 提交组件**

```bash
git add components/AnalyzePage/PracticeStatsTab.tsx
git commit -m "feat: add PracticeStatsTab component"
```

---

## Task 4: 重构 AnalyzePage 主组件

**文件:**
- 修改: `components/AnalyzePage.tsx`

- [ ] **Step 1: 添加页签状态和导入新组件**

在文件顶部添加导入：
```typescript
import TabSwitcher, { TabValue } from './TabSwitcher';
import GrowthAnalysisTab from './AnalyzePage/GrowthAnalysisTab';
import PracticeStatsTab from './AnalyzePage/PracticeStatsTab';
```

在组件内添加页签状态（在 `useState` 声明区域）：
```typescript
const [activeTab, setActiveTab] = useState<TabValue>('growth');
```

- [ ] **Step 2: 替换页面标题下方的内容为页签切换器**

找到第 258-263 行（Page Header 和 Legend），在 Legend 后面添加页签切换器：

```typescript
{/* Legend */}
<div className="flex items-center gap-4 px-4 py-3 bg-surface-container-low rounded-2xl border border-outline-variant/10">
  {/* ... 保持现有内容 ... */}
</div>

{/* 页签切换器 - 新增 */}
<div className="mt-4">
  <TabSwitcher
    options={[
      { value: 'growth', label: '成长分析' },
      { value: 'practice', label: '练习统计' },
    ]}
    value={activeTab}
    onChange={setActiveTab}
  />
</div>
```

- [ ] **Step 3: 删除原有的上下段内容，替换为页签内容**

找到第 278-672 行（上段和下段内容），替换为：

```typescript
{/* 起始分校准提示 - 移除，已集成到 GrowthAnalysisTab */}

{/* 页签内容区域 */}
{activeTab === 'growth' ? (
  <GrowthAnalysisTab
    overview={overview?.overview}
    knowledgeData={knowledgeData}
    recommendations={recommendations}
    selectedModule={selectedModule}
    setSelectedModule={setSelectedModule}
    currentScore={currentScore ?? overview?.overview?.averageScore ?? 0}
    onCalibration={handleCalibration}
  />
) : (
  <PracticeStatsTab
    overview={overview?.overview}
    trainingKnowledgeData={trainingKnowledgeData}
    timeline={timeline}
    recommendations={recommendations}
    selectedTrainingModule={selectedTrainingModule}
    setSelectedTrainingModule={setSelectedTrainingModule}
  />
)}
```

- [ ] **Step 4: 验证类型检查**

```bash
npx tsc --noEmit
```

预期：无类型错误

- [ ] **Step 5: 提交重构**

```bash
git add components/AnalyzePage.tsx
git commit -m "refactor: integrate tab switcher into AnalyzePage"
```

---

## Task 5: 验证功能

- [ ] **Step 1: 启动开发服务器**

```bash
pnpm dev
```

- [ ] **Step 2: 手动测试清单**

访问 http://localhost:3000/analyze 并验证：

- [ ] 页面默认显示"成长分析"页签
- [ ] 页签切换器样式正确（iOS Segmented Control）
- [ ] 切换到"练习统计"页签显示正确内容
- [ ] 切换回"成长分析"页签显示正确内容
- [ ] 成长分析页签包含：校准提示（如需）、成长轨迹、数据可信度/波动范围、知识掌握矩阵、AI建议
- [ ] 练习统计页签包含：练习状态、本周练习趋势、知识练习分布、成就解锁
- [ ] 底部"继续今日训练"按钮在两个页签都显示
- [ ] 点击知识点卡片后切换页签，选中状态保持

- [ ] **Step 3: 修复发现的问题（如有）**

```bash
# 如有修复，提交
git add .
git commit -m "fix: ..."
```

---

## Task 6: 清理和收尾

- [ ] **Step 1: 删除未使用的辅助函数**

`getGrowthStoryData` 和 `getPracticeStats` 函数现在已内联到子组件中，从 AnalyzePage 中删除它们（约第 151-180 行）。

- [ ] **Step 2: 最终验证**

```bash
npx tsc --noEmit
pnpm build  # 或 pnpm dev 检查运行时
```

- [ ] **Step 3: 提交清理**

```bash
git add components/AnalyzePage.tsx
git commit -m "refactor: remove unused helper functions"
```

---

## 完成标准

- [ ] 两个页签内容正确显示
- [ ] 页签切换流畅，无网络请求
- [ ] 类型检查通过
- [ ] 知识点选中状态在页签切换后保持
- [ ] 底部按钮在两个页签都可见
