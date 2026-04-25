'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'motion/react';
import MaterialIcon from './MaterialIcon';
import { StartingScoreCalibrationCard } from './StartingScoreCalibrationCard';
import { BottomNavigation } from './BottomNavigation';
import TabSwitcher, { TabValue } from './TabSwitcher';
import GrowthAnalysisTab from './AnalyzePage/GrowthAnalysisTab';
import LearningPathTab from './AnalyzePage/LearningPathTab';
import PracticeStatsTab from './AnalyzePage/PracticeStatsTab';
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
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showMistakesModal, setShowMistakesModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

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

      // Extract recommendations data from ApiResponse
      setRecommendations(recommendationsRes as any);
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

      <button
        onClick={onBack}
        className="w-full py-5 rounded-full bg-on-surface text-surface font-display font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
      >
        继续今日训练
        <MaterialIcon icon="chevron_right" className="" style={{ fontSize: '24px' }} />
      </button>
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
