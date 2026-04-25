# 分析页扩展实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将分析页从 2 页签扩展为 3 页签，增加学习路径页签；练习记录和错题本迁移为练习统计页签内的模态弹窗；简化"我的"页面。

**Architecture:**
- 分析页新增学习路径页签，复用 LearningPathOverview 逻辑
- 练习统计页签增加入口按钮，点击打开模态弹窗
- 模态弹窗复用现有 history/mistakes 页面逻辑
- "我的"页面移除功能入口，设置默认展开
- API 支持 mode 参数区分练习记录和错题本数据

**Tech Stack:** Next.js 15, React 19, TypeScript, Framer Motion, Tailwind CSS

---

## 文件结构

```
components/
├── TabSwitcher.tsx                       # 修改：支持3个tab
├── AnalyzePage/
│   ├── GrowthAnalysisTab.tsx             # 不变
│   ├── LearningPathTab.tsx               # 新增
│   ├── PracticeStatsTab.tsx              # 修改
│   ├── HistoryModal.tsx                  # 新增
│   ├── MistakesModal.tsx                 # 新增
│   └── types.ts                          # 扩展
└── MePage.tsx                            # 简化

app/api/practice/history/route.ts          # 修改
```

---

## Task 1: API 调整 - practice/history 支持 mode 参数

**Files:**
- Modify: `app/api/practice/history/route.ts`

- [ ] **Step 1: 修改 API 路由支持 mode 参数**

```typescript
// GET /api/practice/history?mode=training
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const mode = searchParams.get('mode'); // 'training' | null

    // 构建查询条件
    const where: any = {
      userId: session.user.id,
      completedAt: { not: null },
    };

    // 仅在指定 mode 时过滤
    if (mode === 'training') {
      where.mode = 'training';
    }
    // mode 为 null 或其他值时返回全部记录（用于错题本）

    const attempts = await prisma.attempt.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        steps: {
          include: {
            questionStep: {
              include: {
                question: {
                  select: {
                    id: true,
                    type: true,
                    difficulty: true,
                    content: true,
                    answer: true,
                    hint: true,
                    knowledgePoints: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // 响应包含 mode 字段用于显示来源标签
    return NextResponse.json({
      attempts: attempts.map(attempt => ({
        ...attempt,
        steps: attempt.steps.map(step => ({
          ...step,
          // 确保 mode 可用于前端判断
        })),
      })),
    });
  } catch (error) {
    console.error('获取练习历史错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 测试 API**

```bash
# 测试全部记录
curl "http://localhost:3000/api/practice/history?limit=5"

# 测试仅训练记录
curl "http://localhost:3000/api/practice/history?mode=training&limit=5"
```

- [ ] **Step 3: Commit**

```bash
git add app/api/practice/history/route.ts
git commit -m "feat(api): add mode parameter to practice/history"
```

---

## Task 2: 扩展 TabSwitcher 支持 3 个 tab

**Files:**
- Modify: `components/TabSwitcher.tsx`

- [ ] **Step 1: 更新 TabSwitcher 类型支持 3 个 tab**

```typescript
// components/TabSwitcher.tsx
'use client';

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export type TabValue = 'growth' | 'path' | 'practice';

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
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let newIndex = index;
    if (e.key === 'ArrowRight') newIndex = (index + 1) % options.length;
    if (e.key === 'ArrowLeft') newIndex = (index - 1 + options.length) % options.length;
    if (e.key === 'Home') newIndex = 0;
    if (e.key === 'End') newIndex = options.length - 1;
    if (newIndex !== index) {
      e.preventDefault();
      onChange(options[newIndex].value);
    }
  };

  return (
    <div role="tablist" className="relative bg-surface-container-low rounded-full p-1 flex">
      {options.map((option, index) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isActive}
            aria-label={option.label}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-full text-sm font-display font-black relative z-10",
              "transition-colors duration-150",
              isActive ? "text-on-primary" : "text-on-surface-variant"
            )}
          >
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
export type { TabOption };
```

- [ ] **Step 2: Commit**

```bash
git add components/TabSwitcher.tsx
git commit -m "feat: extend TabSwitcher to support 3 tabs"
```

---

## Task 3: 创建 LearningPathTab 组件

**Files:**
- Create: `components/AnalyzePage/LearningPathTab.tsx`

- [ ] **Step 1: 创建 LearningPathTab 组件**

```typescript
// components/AnalyzePage/LearningPathTab.tsx
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import MaterialIcon from '../MaterialIcon';

interface RoadmapItem {
  nodeId: string;
  name: string;
  status: 'completed' | 'current' | 'pending';
  mastery: number;
  priority: number;
}

interface WeeklySummary {
  practicedKnowledgePoints: number;
  masteredCount: number;
  weakCount: number;
}

interface LearningPathTabProps {
  onNavigatePractice?: () => void;
}

export default function LearningPathTab({ onNavigatePractice }: LearningPathTabProps) {
  const [path, setPath] = useState<{ id: string; name: string; status: string; currentIndex: number } | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPath();
  }, []);

  const loadPath = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/learning-path', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      const data = await res.json();

      if (data.success) {
        setPath(data.data.path);
        setRoadmap(data.data.roadmap);
        setWeeklySummary(data.data.weeklySummary);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error('加载学习路径失败:', err);
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-medium text-on-surface-variant">加载中...</p>
      </div>
    );
  }

  if (error || !path) {
    return (
      <div className="bg-surface-container-low rounded-2xl p-6 text-center">
        <p className="text-on-surface-variant mb-4">{error || '没有找到学习路径'}</p>
        <button
          onClick={() => (window.location.href = '/assessment')}
          className="bg-primary text-on-primary rounded-full py-3 px-6 font-medium"
        >
          开始测评
        </button>
      </div>
    );
  }

  const currentItem = roadmap.find(item => item.status === 'current');
  const nextItem = roadmap.find(item => item.status === 'pending');
  const completedCount = roadmap.filter(item => item.status === 'completed').length;
  const totalCount = roadmap.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* 当前状态卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-container-low rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MaterialIcon icon="route" className="text-primary" style={{ fontSize: '20px' }} />
            <span className="font-bold text-on-surface">学习路径</span>
          </div>
          <span className="text-sm text-on-surface-variant">
            {completedCount}/{totalCount} 已完成
          </span>
        </div>

        {currentItem && (
          <p className="text-on-surface font-medium mb-1">{currentItem.name}</p>
        )}

        {nextItem && (
          <p className="text-sm text-on-surface-variant mb-3">
            下一个: {nextItem.name}
          </p>
        )}

        {/* 进度条 */}
        <div className="w-full bg-surface rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </motion.div>

      {/* 本周统计 */}
      {weeklySummary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="bg-surface-container-low rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{weeklySummary.practicedKnowledgePoints}</p>
            <p className="text-xs text-on-surface-variant">本周练习</p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-success">{weeklySummary.masteredCount}</p>
            <p className="text-xs text-on-surface-variant">已掌握</p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-warning">{weeklySummary.weakCount}</p>
            <p className="text-xs text-on-surface-variant">待加强</p>
          </div>
        </motion.div>
      )}

      {/* 路径可视化 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-surface-container-low rounded-2xl p-4"
      >
        <p className="text-sm font-medium text-on-surface mb-3">路径概览</p>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {roadmap.slice(0, 10).map((item, index) => (
            <div
              key={item.nodeId}
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                item.status === 'completed'
                  ? 'bg-success text-on-success'
                  : item.status === 'current'
                  ? 'bg-primary text-on-primary ring-2 ring-primary/30'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {index + 1}
            </div>
          ))}
          {roadmap.length > 10 && (
            <div className="flex-shrink-0 px-2 text-sm text-on-surface-variant">
              +{roadmap.length - 10}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/AnalyzePage/LearningPathTab.tsx
git commit -m "feat: add LearningPathTab component"
```

---

## Task 4: 修改 PracticeStatsTab 增加入口按钮

**Files:**
- Modify: `components/AnalyzePage/PracticeStatsTab.tsx`

- [ ] **Step 1: 添加模态状态和入口按钮**

在 PracticeStatsTab 中添加：

```typescript
interface PracticeStatsTabProps {
  overview: OverviewInner | undefined;
  trainingKnowledgeData: KnowledgeData[];
  timeline: TimelineData[];
  recommendations: RecommendationsData | null;
  selectedTrainingModule: KnowledgeData | null;
  setSelectedTrainingModule: (module: KnowledgeData | null) => void;
  onOpenHistory?: () => void;      // 新增
  onOpenMistakes?: () => void;     // 新增
}
```

在组件内添加两个入口按钮（放在成就解锁卡片后面）：

```tsx
{/* 练习记录和错题本入口 */}
<div className="grid grid-cols-2 gap-3">
  <button
    onClick={onOpenHistory}
    className="bg-surface-container-low rounded-2xl p-4 text-left hover:bg-surface-container transition-colors"
  >
    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
      <MaterialIcon icon="history" className="text-primary" style={{ fontSize: '22px' }} />
    </div>
    <p className="font-medium text-on-surface mb-1">练习记录</p>
    <p className="text-xs text-on-surface-variant">查看历史练习</p>
  </button>

  <button
    onClick={onOpenMistakes}
    className="bg-surface-container-low rounded-2xl p-4 text-left hover:bg-surface-container transition-colors"
  >
    <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center mb-3">
      <MaterialIcon icon="bookmark" className="text-on-secondary-container" style={{ fontSize: '22px' }} />
    </div>
    <p className="font-medium text-on-surface mb-1">错题本</p>
    <p className="text-xs text-on-surface-variant">查看错题收藏</p>
  </button>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add components/AnalyzePage/PracticeStatsTab.tsx
git commit -m "feat: add history and mistakes entry buttons to PracticeStatsTab"
```

---

## Task 5: 创建 HistoryModal 组件

**Files:**
- Create: `components/AnalyzePage/HistoryModal.tsx`

- [ ] **Step 1: 创建练习记录模态组件**

```typescript
// components/AnalyzePage/HistoryModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import MaterialIcon from '../MaterialIcon';

interface Attempt {
  id: string;
  mode: string;
  score: number;
  duration: number;
  completedAt: string | null;
  steps: Array<{
    stepNumber: number;
    isCorrect: boolean;
    duration: number;
  }>;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HistoryModal({ isOpen, onClose }: HistoryModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/practice/history?mode=training&limit=100');
      const data = await res.json();
      if (data.attempts) {
        setAttempts(data.attempts);
      }
    } catch (err) {
      console.error('加载练习记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '进行中';
    const date = new Date(dateStr);
    const now = new Date();
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* 模态内容 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="fixed inset-x-0 bottom-0 top-16 z-50 bg-surface rounded-t-3xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-outline-variant/10">
              <button onClick={onClose} className="p-2 -ml-2">
                <MaterialIcon icon="arrow_back" className="text-on-surface" style={{ fontSize: '24px' }} />
              </button>
              <h2 className="font-display font-bold text-on-surface">练习记录</h2>
              <button
                onClick={() => router.push('/practice')}
                className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium"
              >
                开始练习
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-4 py-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                  <p className="font-medium text-on-surface-variant">加载中...</p>
                </div>
              ) : attempts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center">
                    <MaterialIcon icon="history" className="text-on-surface-variant" style={{ fontSize: '40px' }} />
                  </div>
                  <p className="text-on-surface-variant">暂无练习记录</p>
                  <button
                    onClick={() => router.push('/practice')}
                    className="bg-primary text-on-primary rounded-full py-3 px-6 font-medium"
                  >
                    开始练习
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {attempts.map((attempt, index) => {
                    const correctCount = attempt.steps.filter(s => s.isCorrect).length;
                    const totalCount = attempt.steps.length;
                    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

                    return (
                      <motion.div
                        key={attempt.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-surface-container-low rounded-2xl p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-on-surface-variant">
                            {formatDate(attempt.completedAt)}
                          </span>
                          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                            accuracy >= 80 ? 'bg-primary-container text-on-primary-container' :
                            accuracy >= 60 ? 'bg-secondary-container text-on-secondary-container' :
                            'bg-error-container text-on-error-container'
                          }`}>
                            {accuracy}%
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-on-surface-variant">
                            正确: {correctCount}/{totalCount}
                          </span>
                          <span className="text-on-surface-variant">
                            时长: {formatDuration(attempt.duration)}
                          </span>
                          <span className="font-bold text-primary">{attempt.score}分</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/AnalyzePage/HistoryModal.tsx
git commit -m "feat: add HistoryModal component"
```

---

## Task 6: 创建 MistakesModal 组件

**Files:**
- Create: `components/AnalyzePage/MistakesModal.tsx`

- [ ] **Step 1: 创建错题本模态组件**

```typescript
// components/AnalyzePage/MistakesModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import MaterialIcon from '../MaterialIcon';

interface Mistake {
  id: string;
  questionId: string;
  question: {
    id: string;
    type: string;
    difficulty: number;
    content: any;
    answer: string;
    hint: string;
    knowledgePoints: string;
  };
  userAnswer: string;
  isCorrect: boolean;
  createdAt: string;
  mode: 'diagnostic' | 'training';
}

interface GroupedMistake {
  questionId: string;
  question: Mistake['question'];
  mistakeCount: number;
  latestAnswer: string;
  latestAt: string;
  mistakes: Mistake[];
}

interface MistakesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MistakesModal({ isOpen, onClose }: MistakesModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groupedMistakes, setGroupedMistakes] = useState<GroupedMistake[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadMistakes();
    }
  }, [isOpen]);

  const loadMistakes = async () => {
    setLoading(true);
    try {
      // 获取所有记录（不限制 mode）
      const res = await fetch('/api/practice/history?limit=100');
      const data = await res.json();

      if (data.attempts) {
        const allMistakes: Mistake[] = [];
        data.attempts.forEach((attempt: any) => {
          if (attempt.steps) {
            attempt.steps.forEach((step: any) => {
              if (!step.isCorrect) {
                allMistakes.push({
                  id: step.id,
                  questionId: step.questionStep?.questionId || step.questionStepId || '',
                  question: step.questionStep?.question || null,
                  userAnswer: step.userAnswer || '',
                  isCorrect: step.isCorrect,
                  createdAt: attempt.completedAt || new Date().toISOString(),
                  mode: attempt.mode as 'diagnostic' | 'training',
                });
              }
            });
          }
        });

        // 按题目ID分组
        const grouped = new Map<string, GroupedMistake>();
        allMistakes.forEach((mistake) => {
          const key = mistake.questionId || mistake.question?.id || mistake.id;
          if (!grouped.has(key)) {
            grouped.set(key, {
              questionId: key,
              question: mistake.question,
              mistakeCount: 1,
              latestAnswer: mistake.userAnswer,
              latestAt: mistake.createdAt,
              mistakes: [mistake],
            });
          } else {
            const existing = grouped.get(key)!;
            existing.mistakeCount++;
            if (new Date(mistake.createdAt) > new Date(existing.latestAt)) {
              existing.latestAnswer = mistake.userAnswer;
              existing.latestAt = mistake.createdAt;
            }
            existing.mistakes.push(mistake);
          }
        });

        const sorted = Array.from(grouped.values()).sort(
          (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
        );
        setGroupedMistakes(sorted);
      }
    } catch (err) {
      console.error('加载错题失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const getQuestionContent = (content: any) => {
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        return parsed.title || parsed.description || content;
      } catch {
        return content;
      }
    }
    return content?.title || content?.description || '题目';
  };

  const getModeLabel = (mode: 'diagnostic' | 'training') => {
    return mode === 'diagnostic' ? '诊断测评' : '日常练习';
  };

  const getModeStyle = (mode: 'diagnostic' | 'training') => {
    return mode === 'diagnostic'
      ? 'bg-warning-container text-on-warning-container'
      : 'bg-secondary-container text-on-secondary-container';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* 模态内容 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="fixed inset-x-0 bottom-0 top-16 z-50 bg-surface rounded-t-3xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-outline-variant/10">
              <button onClick={onClose} className="p-2 -ml-2">
                <MaterialIcon icon="arrow_back" className="text-on-surface" style={{ fontSize: '24px' }} />
              </button>
              <h2 className="font-display font-bold text-on-surface">错题本</h2>
              <button
                onClick={() => router.push('/practice')}
                className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium"
              >
                开始练习
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-4 py-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                  <p className="font-medium text-on-surface-variant">加载中...</p>
                </div>
              ) : groupedMistakes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center">
                    <MaterialIcon icon="bookmark" className="text-on-surface-variant" style={{ fontSize: '40px' }} />
                  </div>
                  <p className="text-on-surface-variant">暂无错题记录</p>
                  <p className="text-sm text-on-surface-variant">继续练习，巩固薄弱知识点</p>
                  <button
                    onClick={() => router.push('/practice')}
                    className="bg-primary text-on-primary rounded-full py-3 px-6 font-medium"
                  >
                    开始练习
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedMistakes.map((grouped, index) => {
                    const latestMistake = grouped.mistakes[grouped.mistakes.length - 1];
                    return (
                      <motion.div
                        key={grouped.questionId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-surface-container-low rounded-2xl p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-error-container flex items-center justify-center flex-shrink-0 mt-1 relative">
                            <MaterialIcon icon="close" className="text-on-error-container" style={{ fontSize: '18px' }} />
                            {grouped.mistakeCount > 1 && (
                              <span className="absolute -top-1 -right-1 w-5 h-5 bg-error text-on-error text-xs font-bold rounded-full flex items-center justify-center">
                                {grouped.mistakeCount}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-on-surface mb-2 break-words">
                              {getQuestionContent(grouped.question?.content)}
                            </p>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-on-surface-variant">
                                你的答案: <span className="text-error font-medium">{grouped.latestAnswer || '空'}</span>
                              </span>
                              {grouped.question?.answer && (
                                <span className="text-on-surface-variant">
                                  正确答案: <span className="text-primary font-medium">{grouped.question.answer}</span>
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              {/* 来源标签 */}
                              <span className={`text-xs px-2 py-1 rounded-full ${getModeStyle(latestMistake.mode)}`}>
                                [{getModeLabel(latestMistake.mode)}]
                              </span>
                              <span className="text-xs px-2 py-1 rounded-full bg-surface-container text-on-surface-variant">
                                {formatDate(grouped.latestAt)}
                              </span>
                              {grouped.question?.knowledgePoints && (
                                <span className="text-xs px-2 py-1 rounded-full bg-secondary-container text-on-secondary-container">
                                  {(() => {
                                    try {
                                      const kp = JSON.parse(grouped.question.knowledgePoints);
                                      return Array.isArray(kp) ? kp[0] : kp;
                                    } catch {
                                      return '知识点';
                                    }
                                  })()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/AnalyzePage/MistakesModal.tsx
git commit -m "feat: add MistakesModal component"
```

---

## Task 7: 更新 AnalyzePage 集成新组件

**Files:**
- Modify: `components/AnalyzePage.tsx`

- [ ] **Step 1: 添加 import 和状态**

```typescript
// 新增 import
import LearningPathTab from './AnalyzePage/LearningPathTab';
import HistoryModal from './AnalyzePage/HistoryModal';
import MistakesModal from './AnalyzePage/MistakesModal';

// 新增状态
const [showHistoryModal, setShowHistoryModal] = useState(false);
const [showMistakesModal, setShowMistakesModal] = useState(false);
```

- [ ] **Step 2: 更新 TabSwitcher 配置**

```tsx
<TabSwitcher
  options={[
    { value: 'growth', label: '成长分析' },
    { value: 'path', label: '学习路径' },
    { value: 'practice', label: '练习统计' },
  ]}
  value={activeTab}
  onChange={setActiveTab}
/>
```

- [ ] **Step 3: 添加学习路径页签内容**

```tsx
{activeTab === 'path' && (
  <LearningPathTab />
)}
```

- [ ] **Step 4: 更新练习统计页签**

```tsx
<PracticeStatsTab
  overview={overview?.overview}
  trainingKnowledgeData={trainingKnowledgeData}
  timeline={timeline}
  recommendations={recommendations}
  selectedTrainingModule={selectedTrainingModule}
  setSelectedTrainingModule={setSelectedTrainingModule}
  onOpenHistory={() => setShowHistoryModal(true)}
  onOpenMistakes={() => setShowMistakesModal(true)}
/>
```

- [ ] **Step 5: 添加模态组件**

```tsx
<HistoryModal
  isOpen={showHistoryModal}
  onClose={() => setShowHistoryModal(false)}
/>

<MistakesModal
  isOpen={showMistakesModal}
  onClose={() => setShowMistakesModal(false)}
/>
```

- [ ] **Step 6: Commit**

```bash
git add components/AnalyzePage.tsx
git commit -m "feat: integrate new tabs and modals into AnalyzePage"
```

---

## Task 8: 简化 MePage

**Files:**
- Modify: `app/me/page.tsx`

- [ ] **Step 1: 移除不需要的 import 和状态**

移除：
- `LearningPathOverview` import
- `WeeklyReportDialog` import
- `showWeeklyReport` 状态

- [ ] **Step 2: 移除功能入口按钮**

移除"练习记录"、"错题本"、"设置"按钮

- [ ] **Step 3: 简化学习设置区域**

将 `settingsExpanded` 默认值改为 `true`：
```typescript
const [settingsExpanded, setSettingsExpanded] = useState(true);
```

移除展开/收起切换按钮，保持设置始终展开

- [ ] **Step 4: 移除周报弹窗**

删除 `<WeeklyReportDialog />` 组件及其相关逻辑

- [ ] **Step 5: 最终页面结构**

```tsx
<div className="flex flex-col h-full">
  <div className="flex-1 px-6 py-8">
    {/* 用户信息卡片 */}
    <div className="bg-surface-container-low rounded-[2rem] p-6 mb-6">
      {/* 用户信息... */}
    </div>

    {/* 学习设置（始终展开） */}
    <LearningSettings onRefresh={refreshSettings} embedded={true} />

    {/* 退出登录 */}
    <button onClick={logout}>退出登录</button>
  </div>

  <BottomNavigation />
</div>
```

- [ ] **Step 6: Commit**

```bash
git add app/me/page.tsx
git commit -m "refactor: simplify MePage to focus on learning settings"
```

---

## Task 9: 清理旧页面（可选）

如果决定不再使用旧的 history/mistakes 页面：

- [ ] **Option: 重定向或删除旧页面**

```bash
# 可选：添加 redirect 或删除旧页面
# app/me/history/page.tsx
# app/me/mistakes/page.tsx
```

---

## 验证清单

- [ ] API mode 参数正常工作
- [ ] TabSwitcher 显示 3 个页签
- [ ] 学习路径页签正确显示数据
- [ ] 练习统计页签显示入口按钮
- [ ] 练习记录模态正确显示历史（仅训练）
- [ ] 错题本模态正确显示错题（含来源标签）
- [ ] "我的"页面设置默认展开
- [ ] "我的"页面无多余入口
- [ ] 底部导航在模态打开时保持不变
