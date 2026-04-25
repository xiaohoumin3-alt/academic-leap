'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import MaterialIcon from './MaterialIcon';
import { StartingScoreCalibrationCard } from './StartingScoreCalibrationCard';
import { BottomNavigation } from './BottomNavigation';
import TabSwitcher, { TabValue } from './TabSwitcher';
import GrowthAnalysisTab from './AnalyzePage/GrowthAnalysisTab';
import PracticeStatsTab from './AnalyzePage/PracticeStatsTab';
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
      // 可以在这里添加用户提示
      alert('校准失败: ' + (error instanceof Error ? error.message : '未知错误'));
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

      {/* 起始分校准提示 */}
      {overview?.overview?.needsCalibration && overview?.overview?.calibratedStartingScore && (
        <StartingScoreCalibrationCard
          originalLowestScore={overview.overview.lowestScore}
          newStartingScore={overview.overview.calibratedStartingScore}
          currentScore={currentScore ?? overview?.overview?.averageScore ?? 0}
          onConfirm={handleCalibration}
          onDismiss={() => {
            // 用户选择保持现状，不再提示（可选：记录到本地存储）
          }}
        />
      )}

      {/* 页签切换器 */}
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

      <button
        onClick={onBack}
        className="w-full py-5 rounded-full bg-on-surface text-surface font-display font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
      >
        继续今日训练
        <MaterialIcon icon="chevron_right" className="" style={{ fontSize: '24px' }} />
      </button>
    </div>
    <BottomNavigation />
    </>
  );
};

export default AnalyzePage;
