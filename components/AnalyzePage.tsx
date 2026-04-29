'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import MaterialIcon from './MaterialIcon';
import { StartingScoreCalibrationCard } from './StartingScoreCalibrationCard';
import { BottomNavigation } from './BottomNavigation';
import TabSwitcher, { TabValue } from './TabSwitcher';
import GrowthAnalysisTab from './AnalyzePage/GrowthAnalysisTab';
import LearningPathTab from './AnalyzePage/LearningPathTab';
import PracticeStatsTab from './AnalyzePage/PracticeStatsTab';
import ComplexityOverview from './AnalyzePage/ComplexityOverview';
import HistoryModal from './AnalyzePage/HistoryModal';
import MistakesModal from './AnalyzePage/MistakesModal';
import { analyticsApi } from '../lib/api';
import type {
  KnowledgeData,
  OverviewInner,
  RecommendationsData,
  TimelineData,
} from './AnalyzePage/types';

interface AnalyzePageProps {
  onBack: () => void;
}

interface OverviewData {
  overview: OverviewInner;
  dailyData: TimelineData[];
  topKnowledge: Array<{ knowledgePoint: string; mastery: number }>;
  success?: boolean;
  error?: string;
}

const AnalyzePage: React.FC<AnalyzePageProps> = ({ onBack }) => {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeData[]>([]);
  const [trainingKnowledgeData, setTrainingKnowledgeData] = useState<KnowledgeData[]>([]);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null);
  const [selectedModule, setSelectedModule] = useState<KnowledgeData | null>(null);
  const [selectedTrainingModule, setSelectedTrainingModule] = useState<KnowledgeData | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>('growth');
  const [complexityStats, setComplexityStats] = useState<any>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showMistakesModal, setShowMistakesModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // 从 URL 读取 tab 参数
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['growth', 'path', 'practice'].includes(tabParam)) {
      setActiveTab(tabParam as TabValue);
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      setLoading(false);
      return;
    }
    loadAnalytics();
  }, [session, status]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // 并行加载所有数据
      const [overviewRes, knowledgeRes, timelineRes, recommendationsRes] = await Promise.all([
        analyticsApi.getOverview(),
        analyticsApi.getKnowledge(),
        analyticsApi.getTimeline(7),
        analyticsApi.getRecommendations(),
      ]);

      setOverview(overviewRes as OverviewData);
      setTimeline(timelineRes.timeline || []);

      // 转换知识点数据
      if (knowledgeRes.knowledge) {
        const transformed = knowledgeRes.knowledge.map((k: any) => ({
          knowledgePoint: k.knowledgePoint,
          mastery: k.mastery,
          stability: k.recentAccuracy,
          status: k.mastery >= 80 ? 'high' : k.mastery >= 50 ? 'medium' : 'low' as const,
        }));
        setKnowledgeData(transformed);
      }

      // 转换练习知识点数据
      if (overviewRes?.overview?.trainingKnowledgeMastery) {
        const trainingTransformed = overviewRes.overview.trainingKnowledgeMastery.map((k: any) => ({
          knowledgePoint: k.knowledgePoint,
          mastery: k.mastery,
          stability: k.recentAccuracy,
          status: k.mastery >= 80 ? 'high' : k.mastery >= 50 ? 'medium' : 'low' as const,
        }));
        setTrainingKnowledgeData(trainingTransformed);
      }

      // Extract recommendations data from ApiResponse (unwrap data field)
      if (recommendationsRes?.data) {
        setRecommendations(recommendationsRes.data as any);
      }

      // Load complexity stats
      try {
        const complexityRes = await fetch('/api/learning-path/recommend');
        if (complexityRes.ok) {
          const data = await complexityRes.json();
          if (data.data) {
            setComplexityStats({
              totalQuestions: data.data.totalQuestions,
              questionsWithFeatures: data.data.questionsWithFeatures,
              coverage: data.data.featureCoverage,
              averages: {
                complexity: data.data.averageComplexity,
                cognitiveLoad: data.data.averageCognitiveLoad,
                reasoningDepth: data.data.averageReasoningDepth,
              },
              distribution: { low: 0, medium: 0, high: 0 }, // Will be populated from API
            });
          }
        }
      } catch {
        // Complexity stats are optional, don't fail if unavailable
      }
    } catch (error) {
      console.error('加载分析数据失败:', error);
      // 不使用降级数据，保持空状态
    } finally {
      setLoading(false);
    }
  };

  const handleCalibration = async () => {
    try {
      const response = await fetch('/api/analytics/recalibrate', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '校准失败');
      }

      if (data.success) {
        // 重新加载数据
        await loadAnalytics();
      }
    } catch (error) {
      console.error('校准失败:', error);
      setToast({
        msg: '校准失败: ' + (error instanceof Error ? error.message : '未知错误'),
        type: 'error',
      });
    }
  };

  const handleRecommendationAction = async (type: string, data?: unknown) => {
    try {
      let response: Response;

      switch (type) {
        case 'regenerate_path':
          // 调用路径生成API，传递最新测评ID以获取薄弱知识点
          response = await fetch('/api/learning-path/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assessmentId: recommendations?.latestAssessmentId ?? undefined,
            }),
          });
          break;

        case 'add_weak_points':
          // 调用路径生成API添加薄弱知识点
          // 优先使用 assessmentId，如果没有则使用 targetNodeIds
          const actionData = data as { targetNodeIds?: string[]; assessmentId?: string | null };
          response = await fetch('/api/learning-path/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assessmentId: actionData.assessmentId ?? recommendations?.latestAssessmentId ?? undefined,
              userEdits: actionData.assessmentId ? undefined : {
                add: actionData.targetNodeIds ?? [],
              },
            }),
          });
          break;

        default:
          setToast({ msg: '未知操作类型', type: 'info' });
          return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '操作失败');
      }

      // 检查是否添加了所有请求的节点
      if (result.data?.stats) {
        const { requestedAddCount, matchedAddCount } = result.data.stats;
        if (requestedAddCount > 0 && matchedAddCount < requestedAddCount) {
          setToast({
            msg: `已添加${matchedAddCount}/${requestedAddCount}个薄弱知识点`,
            type: 'info',
          });
        } else {
          setToast({ msg: '操作成功', type: 'success' });
        }
      } else {
        setToast({ msg: '操作成功', type: 'success' });
      }

      // 导航到学习路径 Tab（在 analyze 页面内）
      setTimeout(() => router.push('/analyze?tab=path'), 500);

      // 重新加载数据
      await loadAnalytics();
    } catch (error) {
      console.error('执行建议操作失败:', error);
      setToast({
        msg: '操作失败: ' + (error instanceof Error ? error.message : '未知错误'),
        type: 'error',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-medium text-on-surface-variant">加载分析数据...</p>
      </div>
    );
  }

  // 未登录状态
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-6">
          <MaterialIcon icon="lock" className="text-on-surface-variant" style={{ fontSize: '48px' }} />
        </div>
        <h2 className="text-2xl font-display font-black text-on-surface mb-4">请先登录</h2>
        <p className="text-on-surface-variant mb-8">登录后可查看您的学习数据分析</p>
        <button
          onClick={onBack}
          className="px-8 py-4 bg-primary text-on-primary rounded-full font-display font-black text-lg active:scale-95 transition-all"
        >
          返回首页
        </button>
      </div>
    );
  }

  // 无数据状态
  const hasNoData = !overview?.overview?.totalAttempts;
  if (hasNoData) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-6">
          <MaterialIcon icon="analytics" className="text-on-surface-variant" style={{ fontSize: '48px' }} />
        </div>
        <h2 className="text-2xl font-display font-black text-on-surface mb-4">暂无学习数据</h2>
        <p className="text-on-surface-variant mb-8">开始练习后将自动生成学习分析报告</p>
        <button
          onClick={onBack}
          className="px-8 py-4 bg-primary text-on-primary rounded-full font-display font-black text-lg active:scale-95 transition-all"
        >
          开始练习
        </button>
      </div>
    );
  }

  // 使用真实数据 - 基于诊断测评计算当前分数
  const diagnosticAttempts = overview?.overview?.diagnosticAttempts || [];
  const currentScore = diagnosticAttempts.length > 0
    ? diagnosticAttempts[diagnosticAttempts.length - 1].score
    : null;

  return (
    <>
    <div className="px-6 pt-4 pb-32 space-y-8 bg-surface no-scrollbar">
      {/* Page Header */}
      <div className="mb-4">
        <h2 className="text-4xl font-display font-black text-on-surface tracking-tight mb-2">学情解构</h2>
        <p className="text-sm font-medium text-on-surface-variant opacity-70">深度解析掌握度与稳定性，锚定知识盲区。</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3 bg-surface-container-low rounded-2xl border border-outline-variant/10">
        <div className="flex items-center gap-2">
          <MaterialIcon icon="bolt" className="text-primary" style={{ fontSize: '12px' }} />
          <span className="text-[10px] font-bold text-on-surface">颜色深浅 = 掌握度</span>
        </div>
        <div className="w-px h-4 bg-outline-variant opacity-30"></div>
        <div className="flex items-center gap-2">
          <MaterialIcon icon="show_chart" className="text-on-surface-variant" style={{ fontSize: '12px' }} />
          <span className="text-[10px] font-bold text-on-surface">虚实/透明 = 稳定性</span>
        </div>
      </div>

      {/* 页签切换器 */}
      <div className="mt-4">
        <TabSwitcher
          options={[
            { value: 'growth', label: '成长分析' },
            { value: 'path', label: '学习路径' },
            { value: 'practice', label: '练习统计' },
            { value: 'complexity', label: '复杂度分析' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* 页签内容区域 */}
      {activeTab === 'growth' && (
        <GrowthAnalysisTab
          overview={overview?.overview}
          knowledgeData={knowledgeData}
          recommendations={recommendations}
          selectedModule={selectedModule}
          setSelectedModule={setSelectedModule}
          currentScore={currentScore ?? overview?.overview?.averageScore ?? 0}
          onCalibration={handleCalibration}
          onRecommendationAction={handleRecommendationAction}
        />
      )}
      {activeTab === 'path' && <LearningPathTab />}
      {activeTab === 'practice' && (
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
      )}
      {activeTab === 'complexity' && (
        <div className="space-y-6">
          <ComplexityOverview
            stats={complexityStats}
            onExplore={() => router.push('/admin/complexity')}
          />
          <div className="bg-surface-container-low rounded-[2rem] p-6">
            <h3 className="text-lg font-bold text-on-surface mb-4">复杂度推荐</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              基于题目复杂度特征的智能推荐，帮助选择最适合当前水平的题目。
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-xs text-blue-600 mb-1">认知负荷</div>
                <div className="text-sm text-blue-700">
                  题目所需的注意力资源和工作记忆
                </div>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="text-xs text-purple-600 mb-1">推理深度</div>
                <div className="text-sm text-purple-700">
                  解决问题需要的逻辑推理步骤
                </div>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 col-span-2">
                <div className="text-xs text-orange-600 mb-1">综合复杂度</div>
                <div className="text-sm text-orange-700">
                  认知负荷和推理深度的加权组合，全面评估题目难度
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* 模态组件 */}
    <HistoryModal
      isOpen={showHistoryModal}
      onClose={() => setShowHistoryModal(false)}
    />
    <MistakesModal
      isOpen={showMistakesModal}
      onClose={() => setShowMistakesModal(false)}
    />

    <BottomNavigation />

    {/* Toast 通知 */}
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 24, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] bg-on-surface text-surface px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold border border-white/10"
          onAnimationComplete={() => {
            setTimeout(() => setToast(null), 3000);
          }}
        >
          <MaterialIcon
            icon={toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
            className={`w-5 h-5 ${toast.type === 'success' ? 'text-primary' : toast.type === 'error' ? 'text-error' : 'text-info'}`}
          />
          {toast.msg}
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default AnalyzePage;
