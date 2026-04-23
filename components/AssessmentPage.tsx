'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MaterialIcon from './MaterialIcon';
import { assessmentApi, type Question as ApiQuestion } from '@/lib/api';

// 使用API返回的Question类型
type Question = Omit<ApiQuestion, 'steps' | 'knowledgePoints' | 'hint'> & {
  knowledgePoint: string;
  stepCount: number;
};

interface AssessmentPageProps {
  onBack: () => void;
  retry?: boolean; // 重新测评模式
}

const AssessmentPage: React.FC<AssessmentPageProps> = ({ onBack, retry = false }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Array<{ knowledgePoint: string; isCorrect: boolean; duration: number }>>([]);

  useEffect(() => {
    startAssessment();
  }, []);

  const startAssessment = async () => {
    try {
      // 传递retry参数
      const response = await assessmentApi.start(retry ? { retry: true } : undefined);
      // 检查 alreadyCompleted，但重新测评模式跳过此检查
      if (response.data?.alreadyCompleted && !retry) {
        alert('您已完成初始测评');
        router.push('/');
        return;
      }
      // 检查数据完整性
      if (response.success && response.data?.questions && response.data?.attemptId) {
        const questions = response.data.questions.map(q => ({
          id: q.id,
          type: q.type,
          difficulty: q.difficulty,
          content: q.content,
          knowledgePoint: (q as any).knowledgePoint || '综合',
          stepCount: (q as any).stepCount || 1,
        }));
        if (questions.length === 0) {
          throw new Error('没有可用的题目');
        }
        setQuestions(questions as Question[]);
        setAttemptId(response.data.attemptId);
      } else {
        throw new Error(response.error || '开始测评失败');
      }
    } catch (error: any) {
      console.error('开始测评失败:', error);
      if (error.message?.includes('未登录') || error.message?.includes('401')) {
        alert('请先登录');
        router.push('/login');
        return;
      }
      alert('开始测评失败，请重试');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async (isCorrect: boolean) => {
    const duration = Date.now() - startTime;

    // 记录答案
    const currentQuestion = questions[currentIndex];
    setAnswers(prev => [
      ...prev,
      {
        knowledgePoint: currentQuestion.knowledgePoint,
        isCorrect,
        duration,
      },
    ]);

    if (currentIndex < questions.length - 1) {
      // 下一题
      setCurrentIndex(prev => prev + 1);
      setUserAnswer('');
      setStartTime(Date.now());
    } else {
      // 完成测评
      await finishAssessment();
    }
  };

  const finishAssessment = async () => {
    setSubmitting(true);
    try {
      if (!attemptId) {
        throw new Error('缺少测评ID');
      }

      const response = await assessmentApi.finish({
        attemptId,
        answers,
      });

      if (response.success && response.data) {
        // 跳转到结果页
        const resultData = encodeURIComponent(JSON.stringify(response.data));
        router.push(`/assessment/result?data=${resultData}`);
      } else {
        throw new Error(response.error || '提交失败');
      }
    } catch (error) {
      console.error('提交测评失败:', error);
      alert('提交失败，请重试');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-medium text-on-surface-variant">准备题目中...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-on-surface-variant">没有可用的测评题目</p>
        <button onClick={onBack} className="text-primary font-medium">
          返回
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 顶部导航 */}
      <header className="flex items-center px-4 py-4 border-b border-surface-variant/20">
        <button onClick={onBack} className="p-2 -ml-2">
          <MaterialIcon icon="close" className="text-on-surface-variant" style={{ fontSize: '24px' }} />
        </button>
        <div className="flex-1 ml-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-on-surface">
              第 {currentIndex + 1} / {questions.length} 题
            </span>
            <span className="text-xs text-on-surface-variant">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-surface-container-highest rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* 题目区域 */}
      <div className="flex-1 px-6 py-6 overflow-y-auto">
        <div className="bg-surface-container-low rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              {currentQuestion.knowledgePoint}
            </span>
            <span className="text-xs text-on-surface-variant">
              难度等级 {currentQuestion.difficulty}
            </span>
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-4">
            {currentQuestion.content?.title || currentQuestion.content?.description || '计算题'}
          </h2>
          {currentQuestion.content?.context && (
            <p className="text-sm text-on-surface-variant mb-4">
              {currentQuestion.content.context}
            </p>
          )}
        </div>

        {/* 答题区域 */}
        <div className="bg-surface-container-low rounded-2xl p-6">
          <label className="block text-sm font-medium text-on-surface mb-2">
            请输入答案
          </label>
          <input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="输入你的答案..."
            className="w-full px-4 py-3 bg-surface-container-highest rounded-xl border-2 border-transparent focus:border-primary outline-none text-on-surface"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && userAnswer.trim()) {
                // 需要添加答案验证逻辑
                handleSubmitAnswer(true); // 暂时默认正确
              }
            }}
          />
          <p className="text-xs text-on-surface-variant mt-2">
            按 Enter 键提交答案
          </p>
        </div>

        {/* 提示 */}
        <div className="mt-6 p-4 bg-tertiary-container/10 rounded-2xl">
          <div className="flex items-start gap-3">
            <MaterialIcon icon="info" className="text-tertiary" style={{ fontSize: '20px' }} />
            <div>
              <p className="text-sm font-medium text-on-surface">答题提示</p>
              <p className="text-xs text-on-surface-variant mt-1">
                认真计算，确保答案准确。提交后无法返回修改。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="px-6 py-4 bg-surface-container-highest border-t border-surface-variant/20 flex gap-3">
        <button
          onClick={() => handleSubmitAnswer(false)}
          disabled={!userAnswer.trim() || submitting}
          className="flex-1 bg-error-container text-on-error-container rounded-xl py-4 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          不会/不确定
        </button>
        <button
          onClick={() => handleSubmitAnswer(true)}
          disabled={!userAnswer.trim() || submitting}
          className="flex-1 bg-primary text-on-primary rounded-xl py-4 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {currentIndex < questions.length - 1 ? '下一题' : '完成测评'}
        </button>
      </div>
    </div>
  );
};

export default AssessmentPage;
