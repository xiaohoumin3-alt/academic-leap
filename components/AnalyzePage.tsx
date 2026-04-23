import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useSession } from 'next-auth/react';
import { cn } from '../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { analyticsApi } from '../lib/api';
import MaterialIcon from './MaterialIcon';
import { StartingScoreCalibrationCard } from './StartingScoreCalibrationCard';

interface AnalyzePageProps {
  onBack: () => void;
}

interface KnowledgeData {
  knowledgePoint: string;
  mastery: number;
  stability?: number;
  status?: 'high' | 'medium' | 'low';
}

interface OverviewInner {
  totalAttempts: number;
  completedAttempts: number;
  averageScore: number;
  lowestScore: number;
  totalMinutes: number;
  completionRate: number;
  dataReliability: 'high' | 'medium' | 'low';
  volatilityRange: number;
  initialAssessmentCompleted: boolean;
  initialAssessmentScore: number;
  // Calibration fields
  needsCalibration: boolean;
  calibratedStartingScore: number | null;
  startingScoreCalibrated: boolean;
  // Stats for "My" page
  totalQuestions: number;
  correctRate: number;
}

interface OverviewData {
  overview: OverviewInner;
  dailyData: Array<{ date: string; count: number; avgScore: number }>;
  topKnowledge: Array<{ knowledgePoint: string; mastery: number }>;
  success?: boolean;
  error?: string;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

const AnalyzePage: React.FC<AnalyzePageProps> = ({ onBack }) => {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeData[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [selectedModule, setSelectedModule] = useState<KnowledgeData | null>(null);

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

      setRecommendations(recommendationsRes);
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

  // 加载状态
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-medium text-on-surface-variant">加载分析数据...</p>
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

  // 使用真实数据
  const currentScore = overview?.overview?.averageScore || 0;
  const startScore = overview?.overview?.startingScoreCalibrated && overview?.overview?.calibratedStartingScore
    ? overview.overview.calibratedStartingScore
    : overview?.overview?.lowestScore ?? currentScore;

  return (
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
          currentScore={currentScore}
          onConfirm={handleCalibration}
          onDismiss={() => {
            // 用户选择保持现状，不再提示（可选：记录到本地存储）
          }}
        />
      )}

      {/* Score Improvement Summary */}
      <section className="bg-surface-container-lowest rounded-[2rem] p-8 relative overflow-hidden ambient-shadow">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-gradient-to-br from-primary/10 to-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-baseline justify-between gap-4 relative z-10">
          <div>
            <h3 className="text-xl font-display font-black text-on-surface mb-4">成绩提升</h3>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">起始</p>
                <p className="text-2xl font-display font-black text-on-surface-variant">{startScore}</p>
              </div>
              <MaterialIcon icon="chevron_right" className="text-outline-variant" style={{ fontSize: '24px' }} />
              <div className="text-center">
                <p className="text-[10px] font-bold text-primary uppercase">当前</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-display font-black text-primary">{currentScore}</span>
                  <span className="text-sm font-bold text-primary">分</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-6 py-3 bg-success/20 rounded-full">
            <MaterialIcon icon="trending_up" className="text-success" style={{ fontSize: '20px' }} />
            <span className="text-lg font-display font-black text-success">+{currentScore - startScore}分</span>
          </div>
        </div>
      </section>

      {/* 数据可信度和波动范围 */}
      <section className="grid grid-cols-2 gap-6">
        <div className="bg-surface-container-lowest rounded-[2rem] p-6 ambient-shadow">
          <div className="flex items-center gap-3 mb-3">
            <MaterialIcon icon="verified" className="text-primary" style={{ fontSize: '20px' }} />
            <h4 className="text-sm font-bold text-on-surface-variant">数据可信度</h4>
          </div>
          <p className="text-lg font-display font-black text-primary">
            {overview?.overview?.dataReliability === 'high' ? '高'
             : overview?.overview?.dataReliability === 'medium' ? '中'
             : overview?.overview?.dataReliability ? '低' : '-'}
            {overview?.overview?.dataReliability && ` (${overview.overview.totalAttempts}次练习)`}
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-[2rem] p-6 ambient-shadow">
          <div className="flex items-center gap-3 mb-3">
            <MaterialIcon icon="show_chart" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
            <h4 className="text-sm font-bold text-on-surface-variant">波动范围</h4>
          </div>
          <p className="text-lg font-display font-black text-on-surface">
            ±{overview?.overview?.volatilityRange ?? '-'} 分
          </p>
        </div>
      </section>

      {/* Knowledge Mastery Chart */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-display font-black text-on-surface">知识掌握矩阵</h3>
          <span className="text-xs font-bold text-on-surface-variant">点击查看详情</span>
        </div>

        {/* 空数据状态 */}
        {(!knowledgeData || knowledgeData.length === 0) ? (
          <div className="bg-surface-container-low rounded-3xl p-6 text-center">
            <MaterialIcon icon="school" className="text-on-surface-variant mx-auto mb-2" style={{ fontSize: '48px' }} />
            <p className="text-on-surface-variant">开始练习后将显示知识点掌握情况</p>
          </div>
        ) : (
          <>
            <div className="bg-surface-container-low rounded-3xl p-6">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={knowledgeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                    <XAxis
                      dataKey="knowledgePoint"
                      tick={{ fill: 'currentColor', fontSize: 12 }}
                      stroke="currentColor"
                      strokeOpacity={0.5}
                    />
                    <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} stroke="currentColor" strokeOpacity={0.5} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-surface-container)',
                        border: '1px solid var(--color-outline-variant)',
                        borderRadius: '12px',
                      }}
                    />
                    <Bar
                      dataKey="mastery"
                      radius={[8, 8, 0, 0]}
                      fill="var(--color-primary)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Knowledge Items */}
        <div className="grid grid-cols-2 gap-3">
          {knowledgeData.map((item, index) => (
            <motion.button
              key={item.knowledgePoint}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setSelectedModule(item)}
              className={cn(
                "p-4 rounded-2xl text-left transition-all",
                selectedModule?.knowledgePoint === item.knowledgePoint
                  ? "bg-primary-container text-on-primary-container scale-105"
                  : "bg-surface-container hover:bg-surface-container-high"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">{item.knowledgePoint}</span>
                <span className="text-lg font-display font-black">{item.mastery}%</span>
              </div>
              <div className="h-2 bg-surface-variant/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-current"
                  initial={{ width: 0 }}
                  animate={{ width: `${item.mastery}%` }}
                  transition={{ delay: index * 0.05 + 0.2, duration: 0.5 }}
                />
              </div>
            </motion.button>
          ))}
        </div>
          </>
        )}
      </section>

      {/* Weekly Progress Timeline */}
      <section className="space-y-4">
        <h3 className="text-xl font-display font-black text-on-surface">本周练习趋势</h3>
        {!timeline || timeline.length === 0 ? (
          <div className="bg-surface-container-low rounded-3xl p-6 text-center">
            <MaterialIcon icon="timeline" className="text-on-surface-variant mx-auto mb-2" style={{ fontSize: '48px' }} />
            <p className="text-on-surface-variant">开始练习后将显示练习趋势</p>
          </div>
        ) : (
          <div className="bg-surface-container-low rounded-3xl p-6">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString('zh-CN', { weekday: 'short' })}
                  tick={{ fill: 'currentColor', fontSize: 10 }}
                  stroke="currentColor"
                  strokeOpacity={0.5}
                />
                <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} stroke="currentColor" strokeOpacity={0.5} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-container)',
                    border: '1px solid var(--color-outline-variant)',
                    borderRadius: '12px',
                  }}
                  labelFormatter={(date) => new Date(date).toLocaleDateString('zh-CN', { weekday: 'long' })}
                />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  dot={{ fill: 'var(--color-primary)', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}
      </section>

      {/* AI Recommendations */}
      {recommendations?.recommendations && recommendations.recommendations.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-xl font-display font-black text-on-surface">AI 学习建议</h3>
          <div className="space-y-3">
            {recommendations.recommendations.slice(0, 3).map((rec: any, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-surface-container-low rounded-2xl p-5 flex items-start gap-4"
              >
                <div className={cn(
                  "p-2 rounded-full",
                  rec.type === 'practice' && "bg-error-container text-on-error-container",
                  rec.type === 'review' && "bg-warning-container text-on-warning-container",
                  rec.type === 'challenge' && "bg-success-container text-on-success-container",
                  rec.type === 'tip' && "bg-tertiary-container text-on-tertiary-container"
                )}>
                  {rec.type === 'practice' && <MaterialIcon icon="gps_fixed" className="" style={{ fontSize: '20px' }} />}
                  {rec.type === 'review' && <MaterialIcon icon="history" className="" style={{ fontSize: '20px' }} />}
                  {rec.type === 'challenge' && <MaterialIcon icon="bolt" className="" style={{ fontSize: '20px' }} />}
                  {rec.type === 'tip' && <MaterialIcon icon="info" className="" style={{ fontSize: '20px' }} />}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-on-surface mb-1">{rec.title}</h4>
                  <p className="text-sm text-on-surface-variant">{rec.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Achievement Badge - 只在有成就时显示 */}
      {recommendations?.insights?.achievements && recommendations.insights.achievements.length > 0 && (
        <section className="bg-gradient-to-br from-tertiary to-tertiary-container rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl"></div>
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-on-tertiary-container uppercase tracking-widest mb-1">成就解锁</p>
            <h3 className="text-xl font-display font-black text-on-tertiary-container leading-tight">
              获得"{recommendations.insights.achievements[0].name}"勋章！
            </h3>
            <p className="text-[10px] text-on-tertiary-container/60 mt-1">{recommendations.insights.achievements[0].description}</p>
          </div>
        </section>
      )}

      <button
        onClick={onBack}
        className="w-full py-5 rounded-full bg-on-surface text-surface font-display font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
      >
        继续今日训练
        <MaterialIcon icon="chevron_right" className="" style={{ fontSize: '24px' }} />
      </button>
    </div>
  );
};

export default AnalyzePage;
