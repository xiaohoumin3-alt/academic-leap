'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MaterialIcon from '@/components/MaterialIcon';

interface AdaptiveAction {
  type: 'enter_practice' | 'retry_diagnostic';
  nextDifficulty?: number;
  reason?: string;
}

interface AssessmentResultData {
  assessmentId?: string;  // 用于学习路径生成
  attemptId?: string;
  // 诊断决策
  accuracy?: number;
  adaptiveAction?: AdaptiveAction;
  // 等效分相关
  score: number;
  range?: string;
  rangeLow?: number;
  rangeHigh?: number;
  knowledgeLevels?: Record<string, string>;
  knowledgeData?: Record<string, number>;  // 原始等级数据（L0-L4）
  weakKnowledgePoints?: string[];
  masteredKnowledgePoints?: string[];
  untestedKnowledgePoints?: string[];  // 新增：未测试的知识点
  recommendedDifficulty?: number;
  // 题目详情
  questionResults?: any[];
}

const AssessmentResultContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AssessmentResultData | null>(null);
  const [fetchingAnalysis, setFetchingAnalysis] = useState(false);
  const [generatingPath, setGeneratingPath] = useState(false);
  const [pathGenerated, setPathGenerated] = useState(false);
  const [showQuestionDetails, setShowQuestionDetails] = useState(false);
  const [questionDetails, setQuestionDetails] = useState<any>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const isRetry = searchParams.get('retry') === 'true';
  const initialDifficulty = parseInt(searchParams.get('difficulty') || '3', 10);
  const attemptId = searchParams.get('attemptId');

  // 判断是否适合生成学习路径 (60-89分)
  const canGeneratePath = result && result.score >= 60 && result.score < 90;
  // 判断是否需要重新测评（根据 adaptiveAction）
  const needsRetry = result?.adaptiveAction?.type === 'retry_diagnostic';
  // 判断是否适合进入练习
  const canEnterPractice = result?.adaptiveAction?.type === 'enter_practice';

  useEffect(() => {
    const loadAssessmentResult = async () => {
      // 如果有 attemptId，调用完整分析API
      if (attemptId) {
        try {
          setFetchingAnalysis(true);

          // 从 URL 参数获取答案数据（诊断测评时通过 URL 传递）
          const answersParam = searchParams.get('answers');
          const questionIdsParam = searchParams.get('questionIds');
          const currentDifficultyParam = parseInt(searchParams.get('difficulty') || '6', 10);
          const frontendAccuracy = searchParams.get('accuracy') ? parseInt(searchParams.get('accuracy')!, 10) : undefined;

          let answers: (string | null)[] = [];
          let questionIds: string[] = [];

          if (answersParam && questionIdsParam) {
            try {
              answers = JSON.parse(decodeURIComponent(answersParam));
              questionIds = JSON.parse(decodeURIComponent(questionIdsParam));
            } catch (e) {
              console.error('解析答案数据失败:', e);
            }
          }

          const response = await fetch('/api/assessment/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attemptId,
              answers,
              questionIds,
              currentDifficulty: currentDifficultyParam,
              // 传递前端计算的 accuracy，避免重复计算导致不一致
              frontendAccuracy,
            }),
          });
          const data = await response.json();
          if (data.success && data.data) {
            setResult(data.data);
          } else {
            console.error('获取测评分析失败:', data.error);
          }
        } catch (e) {
          console.error('调用测评分析API失败:', e);
        } finally {
          setLoading(false);
          setFetchingAnalysis(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadAssessmentResult();
  }, [searchParams, router, attemptId]);

  // 获取详细的答题记录
  const fetchQuestionDetails = async () => {
    if (!attemptId || showQuestionDetails) return;

    setFetchingDetails(true);
    try {
      const response = await fetch(`/api/assessment/details?attemptId=${attemptId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setQuestionDetails(data.data);
        setShowQuestionDetails(true);
      } else {
        console.error('获取题目详情失败:', data.error);
        alert('获取题目详情失败');
      }
    } catch (error) {
      console.error('调用题目详情API失败:', error);
      alert('网络错误，请检查网络连接后重试');
    } finally {
      setFetchingDetails(false);
    }
  };

  // 生成学习路径并跳转到AI建议页面
  const handleGenerateLearningPath = async () => {
    setGeneratingPath(true);
    try {
      const res = await fetch('/api/learning-path/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId: result?.assessmentId })
      });
      const data = await res.json();

      if (data.success) {
        // 生成成功，跳转到学情解析-成长分析页面（AI建议）
        router.push('/analyze?tab=growth');
      } else {
        const errorMsg = data.error || data.details || '生成学习路径失败，请重试';
        alert(errorMsg);
      }
    } catch (error) {
      console.error('生成学习路径失败:', error);
      alert('网络错误，请检查网络连接后重试');
    } finally {
      setGeneratingPath(false);
    }
  };

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
      if (score >= 90) return '挑战成功';
      if (score >= 75) return '表现优秀';
      if (score >= 60) return '稳步提升';
      if (score >= 40) return '继续努力';
      return '重新出发';
    }
    if (score >= 90) return '表现优秀';
    if (score >= 75) return '进阶能手';
    if (score >= 60) return '稳步提升';
    if (score >= 40) return '需要努力';
    return '重新出发';
  };

  // 根据正确率获取颜色
  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return { bg: 'from-green-500 to-emerald-600', badge: 'bg-green-100 text-green-700' };
    if (accuracy >= 60) return { bg: 'from-primary to-primary-container', badge: 'bg-primary-container text-on-primary-container' };
    if (accuracy >= 40) return { bg: 'from-yellow-500 to-orange-500', badge: 'bg-yellow-100 text-yellow-700' };
    return { bg: 'from-orange-500 to-red-500', badge: 'bg-orange-100 text-orange-700' };
  };

  const accuracyColor = getAccuracyColor(result.accuracy || 0);

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
          {/* 正确率圆环 */}
          <div className={`inline-flex items-center justify-center w-36 h-36 rounded-full bg-gradient-to-br ${accuracyColor.bg} shadow-xl mb-4`}>
            <div className="text-center">
              <p className="text-5xl font-black text-white">{result.accuracy || 0}</p>
              <p className="text-xs text-white/70">%正确率</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-on-surface mb-1">
            {getScoreLabel(result.score)}
          </h2>
          <p className="text-sm text-on-surface-variant">
            等效分：{result.score} 分（波动区间：{result.range}）
          </p>

          {/* 诊断决策提示 */}
          {result.adaptiveAction && (
            <div className={`mt-3 px-4 py-2 rounded-full text-sm font-medium inline-block ${
              result.adaptiveAction.type === 'enter_practice'
                ? 'bg-green-100 text-green-700'
                : 'bg-warning/10 text-warning'
            }`}>
              {result.adaptiveAction.type === 'enter_practice'
                ? `难度合适，进入练习${result.adaptiveAction.reason ? `（${result.adaptiveAction.reason}）` : ''}`
                : `建议重新测评，难度调整为 ${result.adaptiveAction.nextDifficulty} 级`
              }
            </div>
          )}
        </div>

        {/* 诊断决策卡片 */}
        {result.adaptiveAction && (
          <div className={`rounded-2xl p-4 mb-4 ${
            result.adaptiveAction.type === 'enter_practice'
              ? 'bg-green-50 border-2 border-green-200'
              : 'bg-warning/10 border-2 border-warning/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <MaterialIcon
                icon={result.adaptiveAction.type === 'enter_practice' ? 'check_circle' : 'refresh'}
                className={result.adaptiveAction.type === 'enter_practice' ? 'text-green-600' : 'text-warning'}
                style={{ fontSize: '24px' }}
              />
              <span className="font-bold text-lg text-on-surface">
                {result.adaptiveAction.type === 'enter_practice' ? '适合进入练习' : '建议重新测评'}
              </span>
            </div>
            <p className="text-sm text-on-surface-variant">
              {result.adaptiveAction.type === 'enter_practice'
                ? `当前正确率 ${result.accuracy}% 处于目标区间 [60%, 90%)，可以开始针对性练习。${result.adaptiveAction.reason || ''}`
                : `当前正确率 ${result.accuracy}% 不在目标区间，建议调整难度后重新测评。${result.adaptiveAction.nextDifficulty ? `新难度：${result.adaptiveAction.nextDifficulty}级` : ''}`
              }
            </p>
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

        {/* 未测试的知识点 */}
        {!!result.untestedKnowledgePoints?.length && (
          <div className="bg-surface-container-low rounded-2xl p-4 mb-4">
            <h3 className="font-bold text-on-surface mb-2 flex items-center gap-2">
              <MaterialIcon icon="info" className="text-secondary" style={{ fontSize: '20px' }} />
              未测评（测评未涉及）
            </h3>
            <p className="text-xs text-on-surface-variant mb-2">
              这些知识点在本次测评中没有测试到，后续练习时会覆盖
            </p>
            <div className="flex flex-wrap gap-2">
              {result.untestedKnowledgePoints?.map(kp => (
                <span key={kp} className="text-xs bg-surface-container text-on-surface-variant px-3 py-1 rounded-full opacity-60">
                  {kp}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 显示答题详情按钮 - 仅练习模式有详细记录，诊断测评不保存 */}
        {/* 诊断模式不保存AttemptStep，所以暂时隐藏此功能 */}

        {/* 每道题的判题结果 */}
        {showQuestionDetails && questionDetails && questionDetails.questionResults && (
          <div className="bg-surface-container-low rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-on-surface flex items-center gap-2">
                <MaterialIcon icon="quiz" className="text-primary" style={{ fontSize: '20px' }} />
                题目详情
              </h3>
              <button
                onClick={() => setShowQuestionDetails(false)}
                className="text-sm text-primary hover:text-primary-dark"
              >
                收起
              </button>
            </div>

            {/* 总览统计 */}
            <div className="bg-surface rounded-xl p-3 mb-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-on-surface">{questionDetails.summary.totalQuestions}</p>
                  <p className="text-xs text-on-surface-variant">总题数</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">{questionDetails.summary.correctCount}</p>
                  <p className="text-xs text-on-surface-variant">正确</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-error">{questionDetails.summary.incorrectCount}</p>
                  <p className="text-xs text-on-surface-variant">错误</p>
                </div>
              </div>
              <div className="mt-3 text-center">
                <span className="text-lg font-bold text-primary">
                  正确率：{questionDetails.summary.correctRate}
                </span>
              </div>
            </div>

            {/* 题目列表 */}
            <div className="space-y-3">
              {questionDetails.questionResults.map((qr: any, index: number) => (
                <div
                  key={qr.id}
                  className={`p-3 rounded-xl ${
                    qr.isCorrect
                      ? 'bg-success/10 border border-success/20'
                      : 'bg-error/10 border border-error/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs text-on-surface-variant">第 {index + 1} 题</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${
                        qr.isCorrect ? 'text-success' : 'text-error'
                      }`}>
                        {qr.isCorrect ? '正确' : '错误'}
                      </span>
                      {qr.duration > 0 && (
                        <span className="text-xs text-on-surface-variant">
                          用时: {(qr.duration / 1000).toFixed(1)}秒
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-on-surface mb-2">{qr.content}</p>

                  {/* 选择题选项 */}
                  {qr.options && qr.options.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-on-surface-variant mb-1">选项：</p>
                      <div className="space-y-1">
                        {qr.options.map((option: string, i: number) => {
                          const isUserAnswer = qr.userAnswer === String.fromCharCode(65 + i); // A, B, C, D
                          const isCorrectAnswer = qr.correctAnswer === String.fromCharCode(65 + i);
                          return (
                            <div
                              key={i}
                              className={`text-xs p-2 rounded ${
                                isUserAnswer && isCorrectAnswer
                                  ? 'bg-success/20 border border-success/30'
                                  : isUserAnswer
                                  ? 'bg-error/20 border border-error/30'
                                  : isCorrectAnswer
                                  ? 'bg-success/10 border border-success/20'
                                  : 'bg-surface/50'
                              }`}
                            >
                              <span className="font-medium mr-2">
                                {String.fromCharCode(65 + i)}.
                              </span>
                              {option}
                              {isUserAnswer && (
                                <span className="ml-2 text-xs">
                                  {isCorrectAnswer ? '✓ 你的答案' : '✗ 你的答案'}
                                </span>
                              )}
                              {isCorrectAnswer && !isUserAnswer && (
                                <span className="ml-2 text-xs text-success">✓ 正确答案</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 填空题答案 */}
                  {(!qr.options || qr.options.length === 0) && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-on-surface-variant">你的答案：</span>
                        <span className={qr.isCorrect ? 'text-success' : 'text-error'}>
                          {qr.userAnswer || '(未作答)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">正确答案：</span>
                        <span className="text-success">{qr.correctAnswer}</span>
                      </div>
                    </div>
                  )}

                  {qr.knowledgePoints.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs text-on-surface-variant">知识点：</span>
                      {qr.knowledgePoints.map((kp: string, i: number) => (
                        <span key={i} className="text-xs bg-surface-container text-on-surface-variant px-2 py-0.5 rounded ml-1">
                          {kp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 知识点统计 */}
            {Object.keys(questionDetails.knowledgeStats).length > 0 && (
              <div className="mt-4 pt-4 border-t border-surface-variant/20">
                <h4 className="text-sm font-bold text-on-surface mb-2">知识点掌握情况</h4>
                <div className="space-y-2">
                  {Object.entries(questionDetails.knowledgeStats).map(([kp, stats]: [string, any]) => (
                    <div key={kp} className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant">{kp}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-surface/50 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              stats.rate >= 80 ? 'bg-success' :
                              stats.rate >= 60 ? 'bg-warning' : 'bg-error'
                            }`}
                            style={{ width: `${stats.rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold ${
                          stats.rate >= 80 ? 'text-success' :
                          stats.rate >= 60 ? 'text-warning' : 'text-error'
                        }">
                          {stats.rate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 学习路径生成引导 (60-89分) */}
        {canGeneratePath && !pathGenerated && (
          <div className="bg-surface-container-low rounded-2xl p-4 mb-4">
            <h3 className="font-bold text-on-surface mb-3 flex items-center gap-2">
              <MaterialIcon icon="route" className="text-primary" style={{ fontSize: '20px' }} />
              生成学习路径
            </h3>
            <p className="text-sm text-on-surface-variant mb-4">
              根据你的测评结果，系统可以为你生成一个个性化的学习路径，按优先级引导你逐一掌握薄弱知识点。
            </p>
            <button
              onClick={handleGenerateLearningPath}
              disabled={generatingPath}
              className="w-full py-3 rounded-xl font-medium bg-primary text-on-primary disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {generatingPath ? (
                <>
                  <div className="w-5 h-5 rounded-full border-2 border-on-primary border-t-transparent animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <MaterialIcon icon="auto_awesome" style={{ fontSize: '20px' }} />
                  一键生成学习路径
                </>
              )}
            </button>
          </div>
        )}

        {/* 学习路径生成成功 */}
        {canGeneratePath && pathGenerated && (
          <div className="bg-success/10 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MaterialIcon icon="check_circle" className="text-success" style={{ fontSize: '20px' }} />
              <h3 className="font-bold text-on-surface">学习路径已生成</h3>
            </div>
            <p className="text-sm text-on-surface-variant mb-3">
              系统已根据你的测评结果生成了个性化学习路径。
            </p>
            <button
              onClick={() => {
                router.push('/analyze?tab=path'); // 跳转到学习路径页签
              }}
              className="w-full py-3 rounded-xl font-medium bg-success text-on-success transition-colors flex items-center justify-center gap-2"
            >
              <MaterialIcon icon="route" style={{ fontSize: '20px' }} />
              查看学习路径
            </button>
          </div>
        )}

      </div>

      {/* 底部操作按钮 */}
      <div className="px-6 py-4 bg-surface-container-highest border-t border-surface-variant/20 space-y-3">
        {/* 重新测评按钮 */}
        {needsRetry && (
          <button
            onClick={() => router.push(`/assessment/diagnostic?retry=true&difficulty=${result.adaptiveAction?.nextDifficulty || initialDifficulty}`)}
            className="w-full bg-gradient-to-r from-warning to-orange-500 text-white rounded-full py-4 px-6 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
          >
            <MaterialIcon icon="refresh" className="fill-white" style={{ fontSize: '24px' }} />
            <span className="font-display font-bold text-lg">
              重新测评（新难度：{result.adaptiveAction?.nextDifficulty}级）
            </span>
          </button>
        )}

        {/* 开始练习按钮 */}
        <button
          onClick={() => router.push('/practice')}
          className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full py-4 px-6 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
        >
          <MaterialIcon icon="play_arrow" className="fill-on-primary" style={{ fontSize: '24px' }} />
          <span className="font-display font-bold text-lg">
            {canEnterPractice ? '开始练习' : '开始练习'}
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
