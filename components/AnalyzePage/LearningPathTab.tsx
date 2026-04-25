'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import MaterialIcon from '../MaterialIcon';

interface RoadmapItem {
  nodeId: string;
  name: string;
  status: 'completed' | 'current' | 'pending';
  mastery: number;
  priority: number;
}

interface WeeklySummary {
  practicedKnowledgePoints: number;
  masteredCount: number;
  weakCount: number;
}

export default function LearningPathTab() {
  const [path, setPath] = useState<{ id: string; name: string; status: string; currentIndex: number } | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPath();
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
          </div>
          <span className="text-sm text-on-surface-variant">
            {completedCount}/{totalCount} 已完成
          </span>
        </div>

        {currentItem && (
          <p className="text-on-surface font-medium mb-1">{currentItem.name}</p>
        )}

        {/* 进度条 */}
        <div className="w-full bg-surface rounded-full h-2 mt-3">
          <div
            className="bg-primary rounded-full h-2 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </motion.div>

      {/* 本周统计 */}
      {weeklySummary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="bg-surface-container-low rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{weeklySummary.practicedKnowledgePoints}</p>
            <p className="text-xs text-on-surface-variant">本周练习</p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-success">{weeklySummary.masteredCount}</p>
            <p className="text-xs text-on-surface-variant">已掌握</p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-warning">{weeklySummary.weakCount}</p>
            <p className="text-xs text-on-surface-variant">待加强</p>
          </div>
        </motion.div>
      )}

      {/* 路径可视化 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-surface-container-low rounded-2xl p-4"
      >
        <p className="text-sm font-medium text-on-surface mb-3">路径概览</p>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {roadmap.slice(0, 10).map((item, index) => (
            <div
              key={item.nodeId}
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                item.status === 'completed'
                  ? 'bg-success text-on-success'
                  : item.status === 'current'
                  ? 'bg-primary text-on-primary ring-2 ring-primary/30'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {index + 1}
            </div>
          ))}
          {roadmap.length > 10 && (
            <div className="flex-shrink-0 px-2 text-sm text-on-surface-variant">
              +{roadmap.length - 10}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}