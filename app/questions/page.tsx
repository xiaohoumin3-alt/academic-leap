'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import MaterialIcon from '@/components/MaterialIcon';
import { BottomNavigation } from '@/components/BottomNavigation';
import { cn } from '@/lib/utils';
import ComplexityBadge from '@/components/ComplexityBadge';

interface Question {
  id: string;
  type: string;
  difficulty: number;
  content: { title: string; description: string; context: string };
  cognitiveLoad?: number;
  reasoningDepth?: number;
  complexity?: number;
  knowledgePoints: string[];
}

interface FilterState {
  complexityMin: number;
  complexityMax: number;
  cognitiveLoadMin: number;
  hasComplexity: boolean;
}

export default function QuestionsPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    complexityMin: 0,
    complexityMax: 1,
    cognitiveLoadMin: 0,
    hasComplexity: false,
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/questions?limit=100');
      const data = await res.json();
      if (data.success) {
        setQuestions(data.questions || []);
      }
    } catch (error) {
      console.error('加载题目失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredQuestions = questions.filter(q => {
    if (filters.hasComplexity && q.complexity === undefined) return false;
    if (q.complexity !== undefined) {
      if (q.complexity < filters.complexityMin || q.complexity > filters.complexityMax) return false;
    }
    if (filters.cognitiveLoadMin > 0 && q.cognitiveLoad !== undefined) {
      if (q.cognitiveLoad < filters.cognitiveLoadMin) return false;
    }
    return true;
  });

  const handleStartPractice = (questionId: string) => {
    router.push(`/practice?questionId=${questionId}`);
  };

  const handleBack = () => {
    router.push('/');
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-surface">
        <button onClick={handleBack} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
          <MaterialIcon icon="arrow_back" className="text-on-surface-variant" style={{ fontSize: '24px' }} />
        </button>

        <h1 className="text-lg font-bold text-on-surface">题目列表</h1>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'p-2 rounded-full transition-colors',
            showFilters ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-container-high'
          )}
        >
          <MaterialIcon icon="tune" className="" style={{ fontSize: '24px' }} />
        </button>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant">
              <div className="space-y-3">
                {/* 综合复杂度范围 */}
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">综合复杂度: {filters.complexityMin.toFixed(1)} - {filters.complexityMax.toFixed(1)}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={filters.complexityMin}
                      onChange={(e) => setFilters({ ...filters, complexityMin: parseFloat(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs text-on-surface-variant w-8">{filters.complexityMin.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={filters.complexityMax}
                      onChange={(e) => setFilters({ ...filters, complexityMax: parseFloat(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs text-on-surface-variant w-8">{filters.complexityMax.toFixed(1)}</span>
                  </div>
                </div>

                {/* 最低认知负荷 */}
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">最低认知负荷: {filters.cognitiveLoadMin.toFixed(1)}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={filters.cognitiveLoadMin}
                    onChange={(e) => setFilters({ ...filters, cognitiveLoadMin: parseFloat(e.target.value) })}
                    className="w-full mt-1"
                  />
                </div>

                {/* 只显示已提取特征的题目 */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasComplexity"
                    checked={filters.hasComplexity}
                    onChange={(e) => setFilters({ ...filters, hasComplexity: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="hasComplexity" className="text-xs font-medium text-on-surface-variant">
                    只显示已提取特征的题目
                  </label>
                </div>

                {/* 重置按钮 */}
                <button
                  onClick={() => setFilters({
                    complexityMin: 0,
                    complexityMax: 1,
                    cognitiveLoadMin: 0,
                    hasComplexity: false,
                  })}
                  className="w-full py-2 bg-tertiary-container text-on-tertiary-container rounded-full text-sm font-medium"
                >
                  重置筛选
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="px-4 py-2 bg-surface-container-low border-b border-outline-variant">
        <p className="text-xs text-on-surface-variant">
          显示 {filteredQuestions.length} / {questions.length} 题
        </p>
      </div>

      {/* Question List */}
      <div className="flex-1 overflow-auto p-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MaterialIcon icon="search_off" className="text-on-surface-variant" style={{ fontSize: '48px' }} />
            <p className="mt-4 text-on-surface-variant">没有符合条件的题目</p>
            <button
              onClick={() => setFilters({
                complexityMin: 0,
                complexityMax: 1,
                cognitiveLoadMin: 0,
                hasComplexity: false,
              })}
              className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium"
            >
              清除筛选条件
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((question, index) => (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-surface-container-low rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-on-surface truncate">
                      {question.content.title}
                    </h3>
                    <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">
                      {question.content.description || question.content.context}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {question.knowledgePoints.slice(0, 2).map((kp, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-full">
                          {kp}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <ComplexityBadge
                      features={{
                        cognitiveLoad: question.cognitiveLoad,
                        reasoningDepth: question.reasoningDepth,
                        complexity: question.complexity,
                      }}
                      compact
                    />
                    <button
                      onClick={() => handleStartPractice(question.id)}
                      className="px-3 py-1.5 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      练习
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
