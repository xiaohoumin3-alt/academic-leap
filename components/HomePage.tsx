'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import MaterialIcon from './MaterialIcon';
import { BottomNavigation } from './BottomNavigation';
import { analyticsApi } from '@/lib/api';
import OnboardingGuide from './OnboardingGuide';

interface HomePageProps {
  onStart: () => void;
  onAssess: (retry?: boolean) => void;
  onOpenConsole: () => void;
}

interface AssessmentStatus {
  initialAssessmentCompleted: boolean;
  initialAssessmentScore?: number;
  currentLevel?: number;
  currentScore?: number;
}

const HomePage: React.FC<HomePageProps> = ({ onStart, onAssess, onOpenConsole }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AssessmentStatus | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      // 获取用户概览数据
      const overviewRes = await analyticsApi.getOverview();
      // 兼容两种格式：ApiResponse包装 或 直接返回
      const overview = overviewRes.data?.overview || overviewRes.overview;
      if (overview) {
        // 检查是否需要设置教材（在测评之前必须设置教材）
        // 触发条件：没有完成测评 且 没有选择教材
        const needsOnboarding = !overview.initialAssessmentCompleted &&
                                !overview.selectedTextbookId;
        if (needsOnboarding) {
          setShowOnboarding(true);
        }

        setStatus({
          initialAssessmentCompleted: overview.initialAssessmentCompleted || overview.totalAttempts > 0,
          currentScore: overview.initialAssessmentScore || overview.averageScore || 0,
          currentLevel: 0,
        });
      }
    } catch (error: any) {
      console.error('获取状态失败:', error);
      // 如果是认证错误，跳转到登录页
      if (error.message?.includes('未登录') || error.message?.includes('401')) {
        window.location.href = '/login';
        return;
      }
      // 降级到localStorage判断
      const hasDonePractice = localStorage.getItem('hasDonePractice') === 'true';
      setStatus({
        initialAssessmentCompleted: hasDonePractice,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-medium text-on-surface-variant">加载中...</p>
      </div>
    );
  }

  // 新用户引导页
  if (!status?.initialAssessmentCompleted) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 px-6 py-12 flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '48px' }} />
            </div>
            <h1 className="text-3xl font-display font-black text-on-surface mb-3">
              欢迎来到学力跃迁
            </h1>
            <p className="text-on-surface-variant text-lg">
              通过10-15道题，精准定位你的真实水平
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full max-w-sm space-y-4 mb-12"
          >
            <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MaterialIcon icon="search" className="text-primary" style={{ fontSize: '24px' }} />
              </div>
              <div>
                <h3 className="font-bold text-on-surface">精准估分</h3>
                <p className="text-sm text-on-surface-variant">10-15题测出考试等效分±3分</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
                <MaterialIcon icon="target" className="text-on-secondary-container" style={{ fontSize: '24px' }} />
              </div>
              <div>
                <h3 className="font-bold text-on-surface">自适应练习</h3>
                <p className="text-sm text-on-surface-variant">AI推送+4%-8%难度题目，效率最大化</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-tertiary-container flex items-center justify-center shrink-0">
                <MaterialIcon icon="trending_up" className="text-on-tertiary-container" style={{ fontSize: '24px' }} />
              </div>
              <div>
                <h3 className="font-bold text-on-surface">量化提分</h3>
                <p className="text-sm text-on-surface-variant">复测评对比，看清楚进步了多少</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-sm space-y-4"
          >
            <button
              onClick={() => onAssess(false)}
              className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full py-5 px-6 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
            >
              <MaterialIcon icon="play_arrow" className="fill-on-primary" style={{ fontSize: '28px' }} />
              <span className="font-display font-bold text-lg">开始精准测评</span>
            </button>

            <p className="text-center text-sm text-on-surface-variant">
              10-15道题 · 约5分钟 · 精准定位薄弱点
            </p>
          </motion.div>
        </div>

        <BottomNavigation />
      </div>
    );
  }

  // 老用户首页 - 根据分数显示不同入口
  const currentScore = status?.currentScore ?? 0;

  // 根据分数判断下一步
  const getNextStep = () => {
    if (currentScore >= 90) {
      return {
        label: '提高难度重新测评',
        subLabel: '你已经超越当前难度',
        icon: 'trending_up',
        color: 'from-amber-500 to-orange-500',
        action: () => onAssess(true), // 重新测评
      };
    } else if (currentScore >= 60) {
      return {
        label: '开始练习',
        subLabel: '在心流区巩固进步',
        icon: 'play_circle',
        color: 'from-primary to-primary-container',
        action: onStart,
      };
    } else {
      return {
        label: '降低难度重新测评',
        subLabel: '当前难度对你太难',
        icon: 'trending_down',
        color: 'from-secondary to-tertiary',
        action: () => onAssess(true), // 重新测评
      };
    }
  };

  const nextStep = getNextStep();

  return (
    <>
      {showOnboarding && (
        <OnboardingGuide
          onComplete={() => {
            setShowOnboarding(false);
            fetchStatus(); // 刷新状态
          }}
        />
      )}

      <div className="flex flex-col h-full">
        <div className="flex-1 px-6 py-8 flex flex-col">
          {/* 顶部状态 - 等效分显示 */}
          <div className="text-center mb-6">
            <p className="text-sm text-on-surface-variant mb-2">当前等效分</p>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-5xl font-display font-black text-primary">
                {currentScore}
              </h1>
              <span className="text-xl text-on-surface-variant">分</span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">±3分波动区间</p>
          </div>

          {/* 主按钮 - 根据分数显示不同入口 */}
          <button
            onClick={nextStep.action}
            className={`w-full bg-gradient-to-r ${nextStep.color} text-on-primary rounded-[2rem] py-8 px-6 flex flex-col items-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl mb-4`}
          >
            <MaterialIcon icon={nextStep.icon} className="fill-on-primary" style={{ fontSize: '48px' }} />
            <span className="font-display font-black text-xl">{nextStep.label}</span>
            <span className="text-sm text-on-primary/80">{nextStep.subLabel}</span>
          </button>

          {/* 说明 */}
          <div className="bg-surface-container-low rounded-2xl p-4 mt-auto">
            <h3 className="font-bold text-on-surface mb-2 text-sm">学习原理</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              系统会推送<span className="text-primary font-medium">+4%-8%难度</span>的题目，
              让你处于"有点难但能做"的心流区，学习效率最高。
            </p>
          </div>
        </div>

        <BottomNavigation />
      </div>
    </>
  );
};

export default HomePage;
