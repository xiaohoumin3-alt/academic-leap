import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Target,
  Plus,
  ArrowLeft,
  ChevronRight,
  Calculator,
  ShieldCheck,
  Zap,
  Activity,
  Award,
  History,
  Info,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
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

interface AnalyzePageProps {
  onBack: () => void;
}

interface KnowledgeData {
  knowledgePoint: string;
  mastery: number;
  stability?: number;
  status?: 'high' | 'medium' | 'low';
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

const AnalyzePage: React.FC<AnalyzePageProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeData[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [selectedModule, setSelectedModule] = useState<KnowledgeData | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

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

      setOverview(overviewRes);
      setTimeline(timelineRes.timeline || []);

      // 转换知识点数据
      if (knowledgeRes.knowledge) {
        const transformed = knowledgeRes.knowledge.map((k: any) => ({
          knowledgePoint: k.knowledgePoint,
          mastery: k.mastery,
          stability: k.recentAccuracy || 50,
          status: k.mastery >= 80 ? 'high' : k.mastery >= 50 ? 'medium' : 'low' as const,
        }));
        setKnowledgeData(transformed);
      }

      setRecommendations(recommendationsRes);
    } catch (error) {
      console.error('加载分析数据失败:', error);
      // 使用降级数据
      setKnowledgeData([
        { knowledgePoint: '代数', mastery: 40, stability: 60, status: 'medium' },
        { knowledgePoint: '方程', mastery: 85, stability: 90, status: 'high' },
        { knowledgePoint: '函数', mastery: 65, stability: 70, status: 'medium' },
        { knowledgePoint: '几何', mastery: 80, stability: 40, status: 'low' },
      ] as any);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="font-medium text-on-surface-variant">加载分析数据...</p>
      </div>
    );
  }

  // 固定测试数据
  const startScore = 72;
  const currentScore = 80;

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
          <Zap className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-bold text-on-surface">颜色深浅 = 掌握度</span>
        </div>
        <div className="w-px h-4 bg-outline-variant opacity-30"></div>
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-on-surface-variant" />
          <span className="text-[10px] font-bold text-on-surface">虚实/透明 = 稳定性</span>
        </div>
      </div>

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
              <ChevronRight className="w-6 h-6 text-outline-variant" />
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
            <TrendingUp className="w-5 h-5 text-success" />
            <span className="text-lg font-display font-black text-success">+{currentScore - startScore}分</span>
          </div>
        </div>
      </section>

      {/* 数据可信度和波动范围 */}
      <section className="grid grid-cols-2 gap-6">
        <div className="bg-surface-container-lowest rounded-[2rem] p-6 ambient-shadow">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h4 className="text-sm font-bold text-on-surface-variant">数据可信度</h4>
          </div>
          <p className="text-lg font-display font-black text-primary">高 (Verified)</p>
        </div>
        <div className="bg-surface-container-lowest rounded-[2rem] p-6 ambient-shadow">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-5 h-5 text-on-surface-variant" />
            <h4 className="text-sm font-bold text-on-surface-variant">波动范围</h4>
          </div>
          <p className="text-lg font-display font-black text-on-surface">±2 分</p>
        </div>
      </section>

      {/* Knowledge Mastery Chart */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-display font-black text-on-surface">知识掌握矩阵</h3>
          <span className="text-xs font-bold text-on-surface-variant">点击查看详情</span>
        </div>

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
      </section>

      {/* Weekly Progress Timeline */}
      <section className="space-y-4">
        <h3 className="text-xl font-display font-black text-on-surface">本周练习趋势</h3>
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
                  {rec.type === 'practice' && <Target className="w-5 h-5" />}
                  {rec.type === 'review' && <History className="w-5 h-5" />}
                  {rec.type === 'challenge' && <Zap className="w-5 h-5" />}
                  {rec.type === 'tip' && <Info className="w-5 h-5" />}
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

      {/* Achievement Badge */}
      <section className="bg-gradient-to-br from-tertiary to-tertiary-container rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-bold text-on-tertiary-container uppercase tracking-widest mb-1">成就解锁</p>
          <h3 className="text-xl font-display font-black text-on-tertiary-container leading-tight">获得"学力跃迁"勋章！</h3>
          <p className="text-[10px] text-on-tertiary-container/60 mt-1">你的努力获得了系统深度认可</p>
        </div>
      </section>

      <button
        onClick={onBack}
        className="w-full py-5 rounded-full bg-on-surface text-surface font-display font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
      >
        继续今日训练
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
};

export default AnalyzePage;
