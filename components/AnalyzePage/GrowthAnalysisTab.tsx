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
  PathAdjustmentRecommendation,
} from './types';

interface GrowthAnalysisTabProps {
  overview: OverviewInner | null | undefined;
  knowledgeData: KnowledgeData[];
  recommendations: RecommendationsData | null;
  selectedModule: KnowledgeData | null;
  setSelectedModule: (module: KnowledgeData | null) => void;
  currentScore: number;
  onCalibration: () => void;
  onRecommendationAction?: (type: string, data?: unknown) => void;
}

const GrowthAnalysisTab: React.FC<GrowthAnalysisTabProps> = ({
  overview,
  knowledgeData,
  recommendations,
  selectedModule,
  setSelectedModule,
  currentScore,
  onCalibration,
  onRecommendationAction,
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
      {recommendations?.message ? (
        // 无诊断测评数据，显示引导卡片
        <section className="space-y-4">
          <div className="bg-surface-container-low rounded-[2rem] p-8 text-center">
            <MaterialIcon icon="assessment" className="text-primary mx-auto mb-4" style={{ fontSize: '48px' }} />
            <h3 className="text-xl font-display font-black text-on-surface mb-2">
              {recommendations.message.title}
            </h3>
            <p className="text-on-surface-variant mb-6">{recommendations.message.subtitle}</p>
            {recommendations.message.primaryAction && (
              <button
                onClick={() => {
                  if (recommendations.message?.primaryAction?.action.startsWith('/')) {
                    window.location.href = recommendations.message.primaryAction.action;
                  }
                }}
                className="bg-primary text-on-primary rounded-full py-3 px-6 font-medium"
              >
                {recommendations.message.primaryAction.text}
              </button>
            )}
          </div>
        </section>
      ) : recommendations?.recommendations && recommendations.recommendations.length > 0 ? (
        // AI 个性化路径建议（重新设计）
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-display font-black text-on-surface">AI 学习建议</h3>
            {recommendations.overallStatusLabel && (
              <span className={cn(
                "text-xs px-3 py-1 rounded-full font-bold",
                recommendations.overallStatus === 'on_track' && "bg-success-container text-on-success-container",
                recommendations.overallStatus === 'behind' && "bg-error-container text-on-error-container",
                recommendations.overallStatus === 'ahead' && "bg-primary-container text-on-primary-container",
                recommendations.overallStatus === 'stagnant' && "bg-warning-container text-on-warning-container"
              )}>
                {recommendations.overallStatusLabel}
              </span>
            )}
          </div>

          {/* 核心洞察卡片 - 说清楚现状和机会 */}
          {recommendations.scoreGapAnalysis && (
            <div className={cn(
              "relative overflow-hidden rounded-3xl p-6",
              recommendations.scoreGapAnalysis.percentage >= 70
                ? "bg-gradient-to-br from-primary/10 to-primary-container/20"
                : "bg-gradient-to-br from-warning/10 to-error/10"
            )}>
              {/* 装饰背景 */}
              <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-primary/5 blur-3xl"></div>

              <div className="relative">
                {/* 洞察标题 */}
                <div className="flex items-center gap-2 mb-3">
                  <MaterialIcon
                    icon={recommendations.scoreGapAnalysis.percentage >= 70 ? "trending_up" : "lightbulb"}
                    className={recommendations.scoreGapAnalysis.percentage >= 70 ? "text-primary" : "text-warning"}
                    style={{ fontSize: '20px' }}
                  />
                  <span className="text-sm font-bold text-primary">
                    {recommendations.scoreGapAnalysis.percentage >= 70 ? "表现分析" : "提升空间"}
                  </span>
                </div>

                {/* 核心数字 */}
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-5xl font-display font-black text-on-surface">
                    {recommendations.scoreGapAnalysis.diagnosticScore}
                  </span>
                  <span className="text-lg text-on-surface-variant">当前水平</span>
                  <span className="ml-auto flex items-baseline gap-1">
                    <span className="text-xl font-display font-black text-on-surface-variant">
                      {recommendations.scoreGapAnalysis.targetScore - recommendations.scoreGapAnalysis.diagnosticScore}
                    </span>
                    <span className="text-sm text-on-surface-variant">分差距</span>
                  </span>
                </div>

                {/* 进度条 */}
                <div className="h-3 bg-surface-variant/20 rounded-full overflow-hidden mb-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${recommendations.scoreGapAnalysis.percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      recommendations.scoreGapAnalysis.percentage >= 90 ? "bg-success" :
                      recommendations.scoreGapAnalysis.percentage >= 70 ? "bg-primary" :
                      "bg-warning"
                    )}
                  />
                </div>

                {/* 具体洞察说明 */}
                <p className="text-sm text-on-surface leading-relaxed">
                  {recommendations.scoreGapAnalysis.percentage >= 90 ? (
                    <>你已经掌握了核心知识点，继续深化练习可以稳定保持优势。</>
                  ) : recommendations.scoreGapAnalysis.percentage >= 70 ? (
                    <>基础扎实，但部分知识点还需加强。建议每天专注2-3个薄弱点，2周内可突破目标。</>
                  ) : (
                    <>当前水平与目标差距较大，需要系统性地补齐基础。建议从最高优先级的知识点开始逐个突破。</>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* 路径调整建议 - 可执行的行动方案 */}
          <div className="space-y-3">
            {recommendations.recommendations.map((rec, index) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-surface rounded-2xl p-5 border border-outline-variant/20"
              >
                {/* 建议头部 */}
                <div className="flex items-start gap-4 mb-4">
                  {/* 行动图标 */}
                  <div className={cn(
                    "shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center",
                    rec.type === 'regenerate_path' && "bg-gradient-to-br from-error/20 to-error/5 text-error",
                    rec.type === 'add_weak_points' && "bg-gradient-to-br from-warning/20 to-warning/5 text-warning",
                    rec.type === 'continue_current' && "bg-gradient-to-br from-success/20 to-success/5 text-success",
                    rec.type === 'broaden_scope' && "bg-gradient-to-br from-primary/20 to-primary/5 text-primary"
                  )}>
                    <MaterialIcon
                      icon={
                        rec.type === 'regenerate_path' ? 'auto_awesome' :
                        rec.type === 'add_weak_points' ? 'school' :
                        rec.type === 'continue_current' ? 'check_circle' :
                        'explore'
                      }
                      style={{ fontSize: '24px' }}
                    />
                  </div>

                  <div className="flex-1">
                    <h4 className="font-bold text-on-surface mb-1">{rec.title}</h4>
                    <p className="text-sm text-on-surface-variant">{rec.description}</p>
                  </div>
                </div>

                {/* 原因和预期 */}
                {rec.reason && (
                  <div className="bg-surface-container-low rounded-xl p-3 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <MaterialIcon icon="info" className="text-on-surface-variant" style={{ fontSize: '14px' }} />
                      <span className="text-xs font-medium text-on-surface-variant">为什么建议这样做</span>
                    </div>
                    <p className="text-sm text-on-surface">{rec.reason}</p>
                  </div>
                )}

                {/* 具体薄弱知识点标签 */}
                {rec.type === 'add_weak_points' && rec.actionData?.weakPointNames && rec.actionData.weakPointNames.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {rec.actionData.weakPointNames.map((name, idx) => (
                      <span key={idx} className="text-xs px-3 py-1 bg-warning-container text-on-warning-container rounded-full font-medium">
                        {name}
                      </span>
                    ))}
                  </div>
                )}

                {rec.impact && (
                  <div className="flex items-center gap-2 mb-4">
                    <MaterialIcon icon="bolt" className="text-success" style={{ fontSize: '16px' }} />
                    <span className="text-sm text-success">{rec.impact}</span>
                  </div>
                )}

                {/* 行动按钮 */}
                {rec.actionable && onRecommendationAction && (
                  <button
                    onClick={() => onRecommendationAction(rec.type, rec.actionData)}
                    className={cn(
                      "w-full py-3 rounded-xl font-medium transition-all",
                      rec.type === 'regenerate_path' && "bg-error text-on-error hover:bg-error/90 active:scale-[0.98]",
                      rec.type === 'add_weak_points' && "bg-warning text-on-warning hover:bg-warning/90 active:scale-[0.98]",
                      rec.type === 'continue_current' && "bg-success text-on-success hover:bg-success/90 active:scale-[0.98]",
                      rec.type === 'broaden_scope' && "bg-primary text-on-primary hover:bg-primary/90 active:scale-[0.98]"
                    )}
                  >
                    立即执行 →
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default GrowthAnalysisTab;
