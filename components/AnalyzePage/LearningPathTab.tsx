'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import MaterialIcon from '../MaterialIcon';
import { RecommendationsData } from './types';

interface RoadmapItem {
  nodeId: string;
  name: string;
  status: 'completed' | 'current' | 'pending';
  mastery: number;
  priority: number;
}

interface WeeklySummary {
  // 练习维度 (来自 Attempt 表)
  practiceSessions: number;
  practicedKnowledgePoints: number;
  totalPracticeMinutes: number;
  // 路径维度 (来自 roadmap 计算)
  masteredInPath: number;
  currentInPath: number;
  pendingInPath: number;
  // 本周进步 (对比上周)
  progress: {
    newMastered: number;
    masteryDelta: number;
  };
}

interface HistoryPath {
  id: string;
  name: string;
  type: string;
  status: string;
  generatedAt: string;
  completedAt: string | null;
  snapshot: {
    totalNodes: number;
    initialWeakCount: number;
  };
  result: {
    finalMastery: number;
    daysSpent: number;
  } | null;
}

interface HistoryComparison {
  avgDaysToComplete: number;
  bestPath: string | null;
  improvementTrend: 'up' | 'down' | 'stable';
  totalPaths: number;
  completedPaths: number;
}

export default function LearningPathTab() {
  const [path, setPath] = useState<{ id: string; name: string; status: string; currentIndex: number; generatedAt?: string } | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullPath, setShowFullPath] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState<{ paths: HistoryPath[]; comparison: HistoryComparison | null } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showUpdateMenu, setShowUpdateMenu] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null);

  useEffect(() => {
    loadPath();
  }, []);

  // 当页面重新获得焦点时，刷新学习路径数据
  // 这确保了从练习页面返回后能看到最新的掌握度
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadPath();
      }
    };

    const handleFocus = () => {
      loadPath();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const loadPath = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/learning-path', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      const data = await res.json();

      if (data.success) {
        setPath(data.data.path);
        setRoadmap(data.data.roadmap);
        setWeeklySummary(data.data.weeklySummary);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error('加载学习路径失败:', err);
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/learning-path/history');
      const data = await res.json();

      if (data.success) {
        setHistoryData(data.data);
      }
    } catch (err) {
      console.error('加载路径历史失败:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 当打开历史模态框时加载数据
  useEffect(() => {
    if (showHistoryModal && !historyData) {
      loadHistory();
    }
  }, [showHistoryModal]);

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 0.9) return 'text-success';
    if (mastery >= 0.7) return 'text-primary';
    if (mastery >= 0.5) return 'text-warning';
    return 'text-error';
  };

  const getMasteryLabel = (mastery: number) => {
    if (mastery >= 0.9) return '已掌握';
    if (mastery >= 0.7) return '良好';
    if (mastery >= 0.5) return '学习中';
    return '待加强';
  };

  // 计算距离上次测评的天数
  const getDaysSinceLastAssessment = (): number | null => {
    if (!path?.generatedAt) return null;
    const days = Math.floor((Date.now() - new Date(path.generatedAt).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  // 选项1: 重新测评
  const handleReassess = () => {
    setShowUpdateMenu(false);
    window.location.href = '/assessment?mode=update-path';
  };

  // 选项2: 调整范围（跳转到知识点选择页面）
  const handleAdjustScope = () => {
    setShowUpdateMenu(false);
    window.location.href = '/console?tab=knowledge';
  };

  // 选项3: 刷新优先级（仅重新排序）
  const handleRefreshPriority = async () => {
    setUpdateLoading(true);
    setShowUpdateMenu(false);
    try {
      const res = await fetch('/api/learning-path/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (data.success) {
        // 重新加载路径数据
        await loadPath();
      } else {
        console.error('刷新路径失败:', data.error);
      }
    } catch (err) {
      console.error('刷新路径失败:', err);
    } finally {
      setUpdateLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-medium text-on-surface-variant">加载中...</p>
      </div>
    );
  }

  if (error || !path) {
    return (
      <div className="bg-surface-container-low rounded-2xl p-6 text-center">
        <p className="text-on-surface-variant mb-4">{error || '没有找到学习路径'}</p>
        <button
          onClick={() => (window.location.href = '/assessment')}
          className="bg-primary text-on-primary rounded-full py-3 px-6 font-medium"
        >
          开始测评
        </button>
      </div>
    );
  }

  const currentItem = roadmap.find(item => item.status === 'current');
  const completedCount = roadmap.filter(item => item.status === 'completed').length;
  const totalCount = roadmap.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* 当前状态卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-container-low rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MaterialIcon icon="route" className="text-primary" style={{ fontSize: '20px' }} />
            <span className="font-bold text-on-surface">学习路径</span>
            <span className="text-xs text-on-surface-variant ml-2">({path.name})</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="text-xs text-primary flex items-center gap-1"
            >
              <MaterialIcon icon="history" style={{ fontSize: '16px' }} />
              历史路径
            </button>
            <button
              onClick={() => setShowUpdateMenu(!showUpdateMenu)}
              disabled={updateLoading}
              className="text-xs text-primary flex items-center gap-1 px-2 py-1 rounded-full hover:bg-primary/10 disabled:opacity-50"
            >
              <MaterialIcon icon="refresh" style={{ fontSize: '14px' }} />
              更新路径
            </button>
            <span className="text-sm text-on-surface-variant">
              {completedCount}/{totalCount} 已完成
            </span>
          </div>
        </div>

        {currentItem && (
          <div className="flex items-center gap-2 mb-2">
            <MaterialIcon icon="play_circle" className="text-primary" style={{ fontSize: '16px' }} />
            <span className="text-on-surface font-medium">{currentItem.name}</span>
            <span className={`text-xs ${getMasteryColor(currentItem.mastery)}`}>
              ({Math.round(currentItem.mastery * 100)}%)
            </span>
          </div>
        )}

        {/* 进度条 */}
        <div className="w-full bg-surface rounded-full h-2 mt-3">
          <div
            className="bg-primary rounded-full h-2 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </motion.div>

      {/* 路径进度统计 */}
      {weeklySummary && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-3"
          >
            <div className="bg-surface-container-low rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-success">{weeklySummary.masteredInPath}</p>
              <p className="text-xs text-on-surface-variant">已掌握</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{weeklySummary.currentInPath}</p>
              <p className="text-xs text-on-surface-variant">进行中</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-warning">{weeklySummary.pendingInPath}</p>
              <p className="text-xs text-on-surface-variant">待学习</p>
            </div>
          </motion.div>

          {/* 本周进步 */}
          {weeklySummary.progress && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-surface-container-low rounded-xl p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <MaterialIcon icon="trending_up" className="text-success" style={{ fontSize: '20px' }} />
                <span className="text-sm text-on-surface">本周进步</span>
              </div>
              <div className="flex items-center gap-4">
                {weeklySummary.progress.newMastered > 0 && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-success">+{weeklySummary.progress.newMastered}</p>
                    <p className="text-xs text-on-surface-variant">新掌握</p>
                  </div>
                )}
                {weeklySummary.progress.masteryDelta !== 0 && (
                  <div className="text-center">
                    <p className={`text-lg font-bold ${weeklySummary.progress.masteryDelta > 0 ? 'text-success' : 'text-error'}`}>
                      {weeklySummary.progress.masteryDelta > 0 ? '+' : ''}{Math.round(weeklySummary.progress.masteryDelta * 100)}%
                    </p>
                    <p className="text-xs text-on-surface-variant">平均掌握度</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* 路径概览 - 可视化 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-surface-container-low rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-on-surface">路径概览</p>
          <button
            onClick={() => setShowFullPath(!showFullPath)}
            className="text-xs text-primary flex items-center gap-1"
          >
            <MaterialIcon icon={showFullPath ? 'expand_less' : 'expand_more'} style={{ fontSize: '16px' }} />
            {showFullPath ? '收起' : '查看全部'}
          </button>
        </div>

        <AnimatePresence>
          {showFullPath ? (
            /* 完整列表视图 */
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 max-h-64 overflow-y-auto"
            >
              {roadmap.map((item, index) => {
                const isExpanded = expandedIndex === index;
                return (
                  <motion.div
                    key={item.nodeId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    {/* 节点头部 - 点击展开 */}
                    <div
                      onClick={() => setExpandedIndex(isExpanded ? null : index)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        item.status === 'current'
                          ? 'bg-primary/10 border border-primary/30 shadow-sm'
                          : 'hover:bg-surface-container-highest'
                      } ${isExpanded ? 'ring-2 ring-primary/20' : ''}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          item.status === 'completed'
                            ? 'bg-success text-on-success shadow-sm'
                            : item.status === 'current'
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-medium ${getMasteryColor(item.mastery)}`}>
                            {getMasteryLabel(item.mastery)} · {Math.round(item.mastery * 100)}%
                          </span>
                          {item.priority >= 7 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-error/10 text-error font-medium">
                              重点
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {item.status === 'current' && (
                          <MaterialIcon icon="play_arrow" className="text-primary" style={{ fontSize: '18px' }} />
                        )}
                        {item.status === 'completed' && (
                          <MaterialIcon icon="check_circle" className="text-success" style={{ fontSize: '18px' }} />
                        )}
                        <MaterialIcon
                          icon={isExpanded ? 'expand_less' : 'expand_more'}
                          className="text-on-surface-variant"
                          style={{ fontSize: '20px' }}
                        />
                      </div>
                    </div>

                    {/* 展开详情 */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 ml-10 p-3 bg-surface-container rounded-lg space-y-3"
                        >
                          {/* 掌握度进度条 */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-on-surface-variant">掌握度</span>
                              <span className={`text-xs font-bold ${getMasteryColor(item.mastery)}`}>
                                {Math.round(item.mastery * 100)}%
                              </span>
                            </div>
                            <div className="w-full bg-surface-container-highest rounded-full h-2">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${item.mastery * 100}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                className={`h-2 rounded-full ${
                                  item.mastery >= 0.9
                                    ? 'bg-success'
                                    : item.mastery >= 0.7
                                    ? 'bg-primary'
                                    : item.mastery >= 0.5
                                    ? 'bg-warning'
                                    : 'bg-error'
                                }`}
                              />
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // 跳转到练习页面，带上知识点ID
                                window.location.href = `/practice?knowledgePointId=${item.nodeId}`;
                              }}
                              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 active:scale-95 transition-all"
                            >
                              <MaterialIcon icon="play_circle" style={{ fontSize: '18px' }} />
                              开始练习
                            </button>
                            {item.mastery < 0.9 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // 查看知识点详情
                                  window.location.href = `/knowledge?id=${item.nodeId}`;
                                }}
                                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-surface-container-highest text-on-surface rounded-lg text-sm font-medium hover:bg-surface-container active:scale-95 transition-all"
                              >
                                <MaterialIcon icon="school" style={{ fontSize: '18px' }} />
                                查看学习
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            /* 简化圆点视图 - 可点击切换到完整列表并展开 */
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
              {roadmap.slice(0, 15).map((item, index) => (
                <div
                  key={item.nodeId}
                  title={`${item.name} (${getMasteryLabel(item.mastery)}, ${Math.round(item.mastery * 100)}%)`}
                  onClick={() => {
                    setShowFullPath(true);
                    setExpandedIndex(index);
                  }}
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-all hover:scale-110 active:scale-95 ${
                    item.status === 'completed'
                      ? 'bg-success text-on-success shadow-sm'
                      : item.status === 'current'
                      ? 'bg-primary text-on-primary ring-2 ring-primary/30 shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  {index + 1}
                </div>
              ))}
              {roadmap.length > 15 && (
                <div
                  className="flex-shrink-0 px-2 text-sm text-on-surface-variant cursor-pointer hover:text-primary"
                  onClick={() => setShowFullPath(true)}
                >
                  +{roadmap.length - 15}
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 历史路径模态框 */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-container-high rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between">
                <h2 className="text-lg font-bold text-on-surface">学习路径历史</h2>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 rounded-full hover:bg-surface-container-highest"
                >
                  <MaterialIcon icon="close" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto flex-1">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : historyData && historyData.paths.length > 0 ? (
                  <>
                    {/* Comparison Stats */}
                    {historyData.comparison && (
                      <div className="mb-4 p-3 bg-surface-container-low rounded-xl">
                        <p className="text-xs text-on-surface-variant mb-2">统计概览</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-lg font-bold text-primary">{historyData.comparison.totalPaths}</p>
                            <p className="text-xs text-on-surface-variant">总路径数</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-success">{historyData.comparison.completedPaths}</p>
                            <p className="text-xs text-on-surface-variant">已完成</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-info">
                              {historyData.comparison.avgDaysToComplete > 0
                                ? `${historyData.comparison.avgDaysToComplete}天`
                                : '-'}
                            </p>
                            <p className="text-xs text-on-surface-variant">平均耗时</p>
                          </div>
                        </div>
                        {historyData.comparison.improvementTrend !== 'stable' && (
                          <div className="mt-2 pt-2 border-t border-outline-variant/20 flex items-center gap-2">
                            <MaterialIcon
                              icon={historyData.comparison.improvementTrend === 'up' ? 'trending_up' : 'trending_down'}
                              className={historyData.comparison.improvementTrend === 'up' ? 'text-success' : 'text-error'}
                              style={{ fontSize: '16px' }}
                            />
                            <span className="text-xs text-on-surface">
                              {historyData.comparison.improvementTrend === 'up'
                                ? '你的学习效果在提升'
                                : '需要加强练习'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Path List */}
                    <div className="space-y-2">
                      {historyData.paths.map((p, index) => (
                        <div
                          key={p.id}
                          className={`p-3 rounded-xl border ${
                            p.status === 'active'
                              ? 'border-primary/30 bg-primary/5'
                              : 'border-outline-variant/20 bg-surface-container-low'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-on-surface">{p.name}</p>
                              <p className="text-xs text-on-surface-variant">
                                {new Date(p.generatedAt).toLocaleDateString('zh-CN')}
                              </p>
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                p.status === 'active'
                                  ? 'bg-primary text-on-primary'
                                  : p.status === 'completed'
                                  ? 'bg-success text-on-success'
                                  : 'bg-surface-container text-on-surface-variant'
                              }`}
                            >
                              {p.status === 'active' ? '进行中' : p.status === 'completed' ? '已完成' : '已归档'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                            <span>{p.snapshot.totalNodes} 个知识点</span>
                            {p.result && (
                              <>
                                <span>掌握度 {Math.round(p.result.finalMastery * 100)}%</span>
                                <span>{p.result.daysSpent} 天完成</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <MaterialIcon icon="history" className="text-on-surface-variant mx-auto mb-2" style={{ fontSize: '48px' }} />
                    <p className="text-on-surface-variant">暂无历史路径</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 更新路径选项菜单 */}
      <AnimatePresence>
        {showUpdateMenu && (
          <>
            {/* 遮罩层 - 增强对比度 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowUpdateMenu(false)}
            />
            {/* 菜单 - 使用更实心的背景 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="fixed z-50 right-6 top-20 w-72 bg-surface rounded-2xl shadow-2xl border border-outline/50 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between">
                <h3 className="font-bold text-on-surface">更新学习路径</h3>
                <button
                  onClick={() => setShowUpdateMenu(false)}
                  className="p-1 rounded-full hover:bg-surface-container-highest"
                >
                  <MaterialIcon icon="close" className="text-on-surface-variant" style={{ fontSize: '18px' }} />
                </button>
              </div>

              {/* Options */}
              <div className="p-2">
                {/* 选项1: 重新测评 */}
                <button
                  onClick={handleReassess}
                  disabled={updateLoading}
                  className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-surface-container-highest transition-colors disabled:opacity-50 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MaterialIcon icon="edit_note" className="text-primary" style={{ fontSize: '20px' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface">重新测评</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      完成测评后，AI会重新生成学习路径
                    </p>
                    {path?.generatedAt && (
                      <p className="text-xs text-on-surface-variant mt-1">
                        上次测评：{getDaysSinceLastAssessment() === 0 ? '今天' : `${getDaysSinceLastAssessment()}天前`}
                      </p>
                    )}
                  </div>
                  <MaterialIcon icon="chevron_right" className="text-on-surface-variant" style={{ fontSize: '18px' }} />
                </button>

                {/* 选项2: 调整范围 */}
                <button
                  onClick={handleAdjustScope}
                  disabled={updateLoading}
                  className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-surface-container-highest transition-colors disabled:opacity-50 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                    <MaterialIcon icon="tune" className="text-secondary" style={{ fontSize: '20px' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface">调整学习范围</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      增删知识点，重新规划学习路径
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      当前：{totalCount} 个知识点
                    </p>
                  </div>
                  <MaterialIcon icon="chevron_right" className="text-on-surface-variant" style={{ fontSize: '18px' }} />
                </button>

                {/* 选项3: 刷新优先级 */}
                <button
                  onClick={handleRefreshPriority}
                  disabled={updateLoading}
                  className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-surface-container-highest transition-colors disabled:opacity-50 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0">
                    <MaterialIcon icon="refresh" className="text-tertiary" style={{ fontSize: '20px' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface">刷新优先级</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      根据最新练习情况调整顺序
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      不改变学习内容
                    </p>
                  </div>
                  {updateLoading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-tertiary border-t-transparent animate-spin" />
                  ) : (
                    <MaterialIcon icon="chevron_right" className="text-on-surface-variant" style={{ fontSize: '18px' }} />
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}