'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
                              {/* 来源标签 - 关键功能 */}
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
