'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MaterialIcon from '@/components/MaterialIcon';

interface GuidanceData {
  level: 1 | 2 | 3 | 4 | 5;
  diagnosis: string;
  title: string;
  message: string;
  nextActions: Array<{
    type: string;
    title: string;
    description: string;
    action: string;
  }>;
  practiceConfig: {
    difficulty: number;
    hintEnabled: boolean;
    encouragementMode: boolean;
  };
  primaryButton: {
    label: string;
    action: string;
    style: 'primary' | 'success' | 'warning';
  };
}

interface TargetStrategy {
  status: string;
  message: string;
  dailyTarget?: number;
  estimatedDays?: number;
}

interface AssessmentResultData {
  score: number;
  range?: string;
  rangeLow?: number;
  rangeHigh?: number;
  knowledgeLevels?: Record<string, string>;
  weakKnowledgePoints?: string[];
  masteredKnowledgePoints?: string[];
  recommendedDifficulty?: number;
  message?: string;
  guidance?: GuidanceData;
  targetStrategy?: TargetStrategy;
  // ExerciseResult 兼容字段
  correctCount?: number;
  totalCount?: number;
  difficultyLevel?: number;
}

const AssessmentResultContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AssessmentResultData | null>(null);
  const [fetchingAnalysis, setFetchingAnalysis] = useState(false);
  const isRetry = searchParams.get('retry') === 'true';
  const initialDifficulty = parseInt(searchParams.get('difficulty') || '3', 10);
  const attemptId = searchParams.get('attemptId');

  useEffect(() => {
    const loadAssessmentResult = async () => {
      // 如果有 attemptId，调用完整分析API
      if (attemptId) {
        try {
          setFetchingAnalysis(true);
          const response = await fetch('/api/assessment/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attemptId,
              answers: [] // 答题记录已在服务端通过 practiceApi.submit 保存
            }),
          });
          const data = await response.json();
          if (data.success && data.data) {
            setResult(data.data);
          } else {
            console.error('获取测评分析失败:', data.error);
            // 降级：使用URL传递的数据
            loadFallbackData();
          }
        } catch (e) {
          console.error('调用测评分析API失败:', e);
          loadFallbackData();
        } finally {
          setLoading(false);
          setFetchingAnalysis(false);
        }
      } else {
        // 降级：使用URL传递的数据
        loadFallbackData();
      }
    };

    const loadFallbackData = () => {
      const data = searchParams.get('data');
      if (data) {
        try {
          setResult(JSON.parse(decodeURIComponent(data)));
        } catch (e) {
          console.error('解析结果失败:', e);
        }
      }
      setLoading(false);
    };

    loadAssessmentResult();
  }, [searchParams, router, attemptId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-medium text-on-surface-variant">生成报告中...</p>
      </div>
    );
  }

  if (!result) return null;

  const getLevelColor = (level?: number) => {
    switch (level) {
      case 5: return { bg: 'from-green-500 to-emerald-600', badge: 'bg-green-100 text-green-700' };
      case 4: return { bg: 'from-blue-500 to-cyan-600', badge: 'bg-blue-100 text-blue-700' };
      case 3: return { bg: 'from-primary to-primary-container', badge: 'bg-primary-container text-on-primary-container' };
      case 2: return { bg: 'from-yellow-500 to-orange-500', badge: 'bg-yellow-100 text-yellow-700' };
      case 1: return { bg: 'from-orange-500 to-red-500', badge: 'bg-orange-100 text-orange-700' };
      default: return { bg: 'from-primary to-primary-container', badge: 'bg-primary-container text-on-primary-container' };
    }
  };

  const getScoreLabel = (score: number) => {
    if (isRetry) {
      if (score >= 90) return 'Level 7 挑战成功';
      if (score >= 75) return 'Level 6 挑战成功';
      if (score >= 60) return 'Level 5 稳步提升';
      if (score >= 40) return 'Level 4 需继续努力';
      return 'Level 3 重新出发';
    }
    if (score >= 90) return '天才挑战者';
    if (score >= 75) return '进阶能手';
    if (score >= 60) return '稳步提升';
    if (score >= 40) return '需要努力';
    return '重新出发';
  };

  const { bg, badge } = getLevelColor(result.guidance?.level);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-primary/5 to-background">
      <header className="flex items-center px-4 py-4">
        <button onClick={() => router.push('/')} className="p-2 -ml-2">
          <MaterialIcon icon="arrow_back" className="text-on-surface" style={{ fontSize: '24px' }} />
        </button>
        <h1 className="text-lg font-bold text-on-surface ml-2">{isRetry ? '复评结果' : '测评结果'}</h1>
      </header>

      <div className="flex-1 px-6 py-4 overflow-y-auto">
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-36 h-36 rounded-full bg-gradient-to-br ${bg} shadow-xl mb-4`}>
            <div className="text-center">
              <p className="text-5xl font-black text-white">{result.score}</p>
              <p className="text-xs text-white/70">分</p>
            </div>
          </div>

          {result.guidance && (
            <span className={`inline-block px-4 py-1 rounded-full text-sm font-bold mb-3 ${badge}`}>
              {result.guidance.title}
            </span>
          )}

          <h2 className="text-2xl font-bold text-on-surface mb-1">
            {getScoreLabel(result.score)}
          </h2>
          <p className="text-sm text-on-surface-variant">
            波动区间：{result.range} 分
          </p>

          {result.guidance && (
            <p className="text-sm text-on-surface-variant mt-3 max-w-xs mx-auto">
              {result.guidance.diagnosis}
            </p>
          )}
        </div>

        {result.targetStrategy && result.targetStrategy.status !== 'achieved' && (
          <div className="bg-surface-container-low rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MaterialIcon icon="flag" className="text-primary" style={{ fontSize: '20px' }} />
              <span className="font-bold text-on-surface">目标进度</span>
            </div>
            <p className="text-sm text-on-surface-variant">{result.targetStrategy.message}</p>
            {result.targetStrategy.estimatedDays && (
              <p className="text-xs text-on-surface-variant mt-1">
                预计 {result.targetStrategy.estimatedDays} 天达成
              </p>
            )}
          </div>
        )}

        {/* 只在降级模式下（没有完整guidance数据）才显示练习统计 */}
        {!result.guidance && (
          <div className="bg-surface-container-low rounded-2xl p-4 mb-4">
            <h3 className="font-bold text-on-surface mb-3 flex items-center gap-2">
              <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '20px' }} />
              练习统计
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-on-surface">正确率</span>
                <span className="text-sm font-bold text-primary">
                  {result.correctCount || 0}/{result.totalCount || 0}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-on-surface">难度</span>
                <span className="text-sm font-bold text-secondary">
                  Level {result.difficultyLevel || initialDifficulty}
                </span>
              </div>
            </div>
          </div>
        )}

        {!!result.weakKnowledgePoints?.length && (
          <div className="bg-error-container/10 rounded-2xl p-4 mb-4">
            <h3 className="font-bold text-on-surface mb-2 flex items-center gap-2">
              <MaterialIcon icon="priority_high" className="text-error" style={{ fontSize: '20px' }} />
              需要重点加强
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.weakKnowledgePoints?.map(kp => (
                <span key={kp} className="text-xs bg-error-container text-on-error-container px-3 py-1 rounded-full">
                  {kp}
                </span>
              ))}
            </div>
          </div>
        )}

        {!!result.masteredKnowledgePoints?.length && (
          <div className="bg-primary-container/10 rounded-2xl p-4 mb-4">
            <h3 className="font-bold text-on-surface mb-2 flex items-center gap-2">
              <MaterialIcon icon="check_circle" className="text-primary" style={{ fontSize: '20px' }} />
              已掌握
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.masteredKnowledgePoints?.map(kp => (
                <span key={kp} className="text-xs bg-primary-container text-on-primary-container px-3 py-1 rounded-full">
                  {kp}
                </span>
              ))}
            </div>
          </div>
        )}

        {result.guidance && result.guidance.nextActions.length > 0 && (
          <div className="bg-surface-container-low rounded-2xl p-4 mb-4">
            <h3 className="font-bold text-on-surface mb-3 flex items-center gap-2">
              <MaterialIcon icon="lightbulb" className="text-primary" style={{ fontSize: '20px' }} />
              推荐下一步
            </h3>
            <div className="space-y-3">
              {result.guidance.nextActions.slice(0, 2).map((action, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    result.guidance!.level >= 4 ? 'bg-green-100' :
                    result.guidance!.level >= 3 ? 'bg-blue-100' : 'bg-yellow-100'
                  }`}>
                    <MaterialIcon
                      icon={action.type === 'challenge' ? 'rocket' : action.type === 'preview' ? 'school' : 'play_arrow'}
                      className={result.guidance!.level >= 4 ? 'text-green-600' : result.guidance!.level >= 3 ? 'text-blue-600' : 'text-yellow-600'}
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface">{action.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{action.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.guidance && (
          <div className={`rounded-2xl p-4 ${
            result.guidance.level >= 4 ? 'bg-green-50' :
            result.guidance.level >= 3 ? 'bg-blue-50' : 'bg-yellow-50'
          }`}>
            <p className="text-sm text-center text-on-surface">{result.guidance.message}</p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-surface-container-highest border-t border-surface-variant/20">
        <button
          onClick={() => router.push('/practice')}
          className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full py-4 px-6 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
        >
          <MaterialIcon icon="play_arrow" className="fill-on-primary" style={{ fontSize: '24px' }} />
          <span className="font-display font-bold text-lg">
            {result.guidance?.primaryButton?.label || '开始练习'}
          </span>
        </button>
      </div>
    </div>
  );
};

const AssessmentResultPage: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-medium text-on-surface-variant">加载中...</p>
      </div>
    }>
      <AssessmentResultContent />
    </Suspense>
  );
};

export default AssessmentResultPage;
