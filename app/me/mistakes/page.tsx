'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import MaterialIcon from '../../../components/MaterialIcon';

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
}

interface GroupedMistake {
  questionId: string;
  question: Mistake['question'];
  mistakeCount: number;
  latestAnswer: string;
  latestAt: string;
  mistakes: Mistake[];
}

export default function MistakesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groupedMistakes, setGroupedMistakes] = useState<GroupedMistake[]>([]);

  useEffect(() => {
    // 获取所有练习记录中的错题
    fetch('/api/practice/history?limit=100')
      .then(async res => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.attempts) {
          // 提取所有错题
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
              // 更新为最新的答案和时间
              if (new Date(mistake.createdAt) > new Date(existing.latestAt)) {
                existing.latestAnswer = mistake.userAnswer;
                existing.latestAt = mistake.createdAt;
              }
              existing.mistakes.push(mistake);
            }
          });

          // 按最新错误时间排序
          const sorted = Array.from(grouped.values()).sort(
            (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
          );
          setGroupedMistakes(sorted);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

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

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-4 bg-surface-container-highest">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <MaterialIcon icon="arrow_back" style={{ fontSize: '24px' }} />
        </button>
        <h1 className="text-xl font-display font-bold">错题本</h1>
      </header>

      {/* Content */}
      <div className="flex-1 px-6 py-4 overflow-auto">
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
              className="mt-4 bg-primary text-on-primary rounded-full py-3 px-6 font-medium"
            >
              开始练习
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedMistakes.map((grouped, index) => (
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
                      <span className="text-xs px-2 py-1 rounded-full bg-surface-container text-on-surface-variant">
                        {formatDate(grouped.latestAt)}
                      </span>
                      {grouped.mistakeCount > 1 && (
                        <span className="text-xs px-2 py-1 rounded-full bg-error-container text-on-error-container">
                          错了 {grouped.mistakeCount} 次
                        </span>
                      )}
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
            ))}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-container-highest border-t border-surface-variant/20 px-6 py-3 flex justify-around items-center">
        <button onClick={() => router.push('/')} className="flex flex-col items-center gap-1 px-4 py-2">
          <MaterialIcon icon="home" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          <span className="text-xs font-medium text-on-surface-variant">首页</span>
        </button>
        <button onClick={() => router.push('/practice')} className="flex flex-col items-center gap-1 px-4 py-2">
          <MaterialIcon icon="my_location" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          <span className="text-xs font-medium text-on-surface-variant">练习</span>
        </button>
        <button onClick={() => router.push('/analyze')} className="flex flex-col items-center gap-1 px-4 py-2">
          <MaterialIcon icon="bar_chart" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          <span className="text-xs font-medium text-on-surface-variant">分析</span>
        </button>
        <button className="flex flex-col items-center gap-1 px-4 py-2">
          <MaterialIcon icon="person" className="text-primary" style={{ fontSize: '20px' }} />
          <span className="text-xs font-medium text-primary">我的</span>
        </button>
      </nav>
    </div>
  );
}
