import React from 'react';
import { motion } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '../../lib/utils';
import MaterialIcon from '../MaterialIcon';
import { StartingScoreCalibrationCard } from '../StartingScoreCalibrationCard';
import type {
  KnowledgeData,
  OverviewInner,
  RecommendationsData,
} from './types';

interface GrowthAnalysisTabProps {
  overview: OverviewInner | null | undefined;
  knowledgeData: KnowledgeData[];
  recommendations: RecommendationsData | null;
  selectedModule: KnowledgeData | null;
  setSelectedModule: (module: KnowledgeData | null) => void;
  currentScore: number;
  onCalibration: () => void;
}

const GrowthAnalysisTab: React.FC<GrowthAnalysisTabProps> = ({
  overview,
  knowledgeData,
  recommendations,
  selectedModule,
  setSelectedModule,
  currentScore,
  onCalibration,
}) => {
  // 计算成长故事数据
  const diagnosticAttempts = overview?.diagnosticAttempts || [];
  const firstScore = diagnosticAttempts.length > 0
    ? diagnosticAttempts[0].score
    : null;
  const latestScore = diagnosticAttempts.length > 0
    ? diagnosticAttempts[diagnosticAttempts.length - 1].score
    : null;
  const growth = (firstScore !== null && latestScore !== null && firstScore !== latestScore)
    ? latestScore - firstScore
    : null;

  return (
    <div className="space-y-8">
      {/* 起始分校准提示 */}
      {overview?.needsCalibration && overview?.calibratedStartingScore && (
        <StartingScoreCalibrationCard
          originalLowestScore={overview.lowestScore ?? 0}
          newStartingScore={overview.calibratedStartingScore}
          currentScore={currentScore}
          onConfirm={onCalibration}
          onDismiss={() => {}}
        />
      )}

      {/* 成长轨迹 */}
      <section className="bg-surface-container-lowest rounded-[2rem] p-8 relative overflow-hidden ambient-shadow">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-gradient-to-br from-primary/10 to-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center justify-between mb-4 relative z-10">
          <h3 className="text-xl font-display font-black text-on-surface">成长轨迹</h3>
          <span className="text-[10px] px-3 py-1 bg-warning-container text-on-warning-container rounded-full font-bold">
            真实水平
          </span>
        </div>

        {firstScore === null || latestScore === null ? (
          <div className="text-center py-8">
            <p className="text-on-surface-variant">完成诊断测评后查看成长轨迹</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-center gap-6 mb-6 relative z-10">
              <div className="text-center">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">首次</p>
                <p className="text-3xl font-display font-black text-on-surface-variant">{firstScore}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-0.5 bg-surface-variant"></div>
                <MaterialIcon icon="chevron_right" className="text-outline-variant" style={{ fontSize: '20px' }} />
                <div className="w-12 h-0.5 bg-surface-variant"></div>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-primary uppercase mb-1">最近</p>
                <p className="text-4xl font-display font-black text-primary">{latestScore}</p>
              </div>
            </div>

            {growth !== null && growth !== 0 && (
              <div className="flex items-center justify-center gap-2 relative z-10">
                <div className={`flex items-center gap-1 px-4 py-2 rounded-full ${
                  growth > 0 ? 'bg-success/20' : 'bg-error/20'
                }`}>
                  <MaterialIcon
                    icon={growth > 0 ? 'trending_up' : 'trending_down'}
                    className={growth > 0 ? 'text-success' : 'text-error'}
                    style={{ fontSize: '18px' }}
                  />
                  <span className={`text-base font-display font-black ${
                    growth > 0 ? 'text-success' : 'text-error'
                  }`}>
                    {growth > 0 ? '+' : ''}{growth}分
                  </span>
                </div>
              </div>
            )}

            <p className="text-center text-xs text-on-surface-variant mt-4">
              测评分数对比 · 真实反映学习进步
            </p>
          </>
        )}
      </section>

      {/* 数据可信度和波动范围 */}
      <section className="grid grid-cols-2 gap-6">
        <div className="bg-surface-container-lowest rounded-[2rem] p-6 ambient-shadow">
          <div className="flex items-center gap-3 mb-3">
            <MaterialIcon icon="verified" className="text-primary" style={{ fontSize: '20px' }} />
            <h4 className="text-sm font-bold text-on-surface-variant">数据可信度</h4>
          </div>
          <p className="text-lg font-display font-black text-primary">
            {overview?.diagnosticDataReliability === 'high' ? '高'
             : overview?.diagnosticDataReliability === 'medium' ? '中'
             : overview?.diagnosticDataReliability ? '低' : '-'}
            {overview?.diagnosticDataReliability && ` (${diagnosticAttempts.length}次诊断测评)`}
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-[2rem] p-6 ambient-shadow">
          <div className="flex items-center gap-3 mb-3">
            <MaterialIcon icon="show_chart" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
            <h4 className="text-sm font-bold text-on-surface-variant">波动范围</h4>
          </div>
          <p className="text-lg font-display font-black text-on-surface">
            ±{overview?.diagnosticVolatilityRange ?? '-'} 分
          </p>
        </div>
      </section>

      {/* 知识掌握矩阵 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-display font-black text-on-surface">知识掌握矩阵</h3>
          <span className="text-xs font-bold text-on-surface-variant">点击查看详情</span>
        </div>

        {!knowledgeData || knowledgeData.length === 0 ? (
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

      {/* AI 学习建议 */}
      {recommendations?.recommendations && recommendations.recommendations.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-xl font-display font-black text-on-surface">AI 学习建议</h3>
          <div className="space-y-3">
            {recommendations.recommendations.slice(0, 3).map((rec, index) => (
              <motion.div
                key={`${rec.type}-${rec.title}`}
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
                  {rec.type === 'practice' && <MaterialIcon icon="gps_fixed" style={{ fontSize: '20px' }} />}
                  {rec.type === 'review' && <MaterialIcon icon="history" style={{ fontSize: '20px' }} />}
                  {rec.type === 'challenge' && <MaterialIcon icon="bolt" style={{ fontSize: '20px' }} />}
                  {rec.type === 'tip' && <MaterialIcon icon="info" style={{ fontSize: '20px' }} />}
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
    </div>
  );
};

export default GrowthAnalysisTab;
