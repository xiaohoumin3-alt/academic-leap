import React from 'react';
import { motion } from 'motion/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { cn } from '../../lib/utils';
import MaterialIcon from '../MaterialIcon';
import type {
  KnowledgeData,
  OverviewInner,
  RecommendationsData,
  TimelineData,
} from './types';

interface PracticeStatsTabProps {
  overview: OverviewInner | null | undefined;
  trainingKnowledgeData: KnowledgeData[];
  timeline: TimelineData[];
  recommendations: RecommendationsData | null;
  selectedTrainingModule: KnowledgeData | null;
  setSelectedTrainingModule: (module: KnowledgeData | null) => void;
  onOpenHistory?: () => void;
  onOpenMistakes?: () => void;
}

const PracticeStatsTab: React.FC<PracticeStatsTabProps> = ({
  overview,
  trainingKnowledgeData,
  timeline,
  recommendations,
  selectedTrainingModule,
  setSelectedTrainingModule,
  onOpenHistory,
  onOpenMistakes,
}) => {
  const getPracticeStats = () => ({
    avgScore: overview?.trainingAvgScore || 0,
    correctRate: overview?.trainingCorrectRate || 0,
    totalQuestions: overview?.trainingQuestions || 0,
    totalMinutes: overview?.trainingMinutes || 0,
  });

  const stats = getPracticeStats();

  return (
    <div className="space-y-8">
      {/* 练习状态 */}
      <section className="bg-surface-container-lowest rounded-[2rem] p-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-display font-black text-on-surface">练习状态</h3>
          <span className="text-[10px] px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full font-bold">
            日常巩固
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-surface-container rounded-2xl">
            <p className="text-2xl font-display font-black text-secondary">
              {stats.correctRate > 0 ? stats.correctRate + '%' : '-'}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1">正确率</p>
          </div>
          <div className="text-center p-4 bg-surface-container rounded-2xl">
            <p className="text-2xl font-display font-black text-secondary">
              {stats.totalQuestions > 0 ? stats.totalQuestions : '-'}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1">总题数</p>
          </div>
          <div className="text-center p-4 bg-surface-container rounded-2xl">
            <p className="text-2xl font-display font-black text-secondary">
              {stats.totalMinutes > 0 ? stats.totalMinutes : '-'}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1">分钟</p>
          </div>
        </div>
      </section>

      {/* 本周练习趋势 */}
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

      {/* 知识练习分布 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-display font-black text-on-surface">知识练习分布</h3>
          <span className="text-xs font-bold text-on-surface-variant">点击查看详情</span>
        </div>

        {!trainingKnowledgeData || trainingKnowledgeData.length === 0 ? (
          <div className="bg-surface-container-low rounded-3xl p-6 text-center">
            <MaterialIcon icon="school" className="text-on-surface-variant mx-auto mb-2" style={{ fontSize: '48px' }} />
            <p className="text-on-surface-variant">开始练习后将显示知识点掌握情况</p>
          </div>
        ) : (
          <>
            <div className="bg-surface-container-low rounded-3xl p-6">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trainingKnowledgeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                    <XAxis dataKey="knowledgePoint" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value) => [`${value}%`, '掌握度']}
                      contentStyle={{ borderRadius: '12px', border: 'none' }}
                    />
                    <Bar
                      dataKey="mastery"
                      fill="var(--color-secondary)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {trainingKnowledgeData.map((item) => (
                <motion.button
                  key={item.knowledgePoint}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedTrainingModule(item)}
                  className={cn(
                    "p-4 rounded-2xl text-left transition-all",
                    selectedTrainingModule?.knowledgePoint === item.knowledgePoint
                      ? "bg-secondary-container text-on-secondary-container scale-105"
                      : "bg-surface-container hover:bg-surface-container-high"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">{item.knowledgePoint}</span>
                    <span className="text-lg font-display font-black">{item.mastery}%</span>
                  </div>
                  <div className="w-full bg-surface-variant rounded-full h-1.5">
                    <div
                      className="bg-secondary rounded-full h-1.5"
                      style={{ width: `${item.mastery}%` }}
                    />
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 成就解锁 */}
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

      {/* 练习记录和错题本入口 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onOpenHistory}
          className="bg-surface-container-low rounded-2xl p-4 text-left hover:bg-surface-container transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <MaterialIcon icon="history" className="text-primary" style={{ fontSize: '22px' }} />
          </div>
          <p className="font-medium text-on-surface mb-1">练习记录</p>
          <p className="text-xs text-on-surface-variant">查看历史练习</p>
        </button>

        <button
          onClick={onOpenMistakes}
          className="bg-surface-container-low rounded-2xl p-4 text-left hover:bg-surface-container transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center mb-3">
            <MaterialIcon icon="bookmark" className="text-on-secondary-container" style={{ fontSize: '22px' }} />
          </div>
          <p className="font-medium text-on-surface mb-1">错题本</p>
          <p className="text-xs text-on-surface-variant">查看错题收藏</p>
        </button>
      </div>
    </div>
  );
};

export default PracticeStatsTab;
