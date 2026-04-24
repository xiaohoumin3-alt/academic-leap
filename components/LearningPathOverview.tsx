'use client';

import { useEffect, useState } from 'react';
import MaterialIcon from './MaterialIcon';

interface LearningPath {
  id: string;
  name: string;
  status: string;
  currentIndex: number;
}

interface RoadmapItem {
  nodeId: string;
  name: string;
  status: 'completed' | 'current' | 'pending';
  mastery: number;
  priority: number;
}

interface WeeklySummary {
  practicedCount: number;
  masteredCount: number;
  weakCount: number;
}

interface LearningPathOverviewProps {
  onEditPath?: () => void;
  onShowWeeklyReport?: () => void;
}

export default function LearningPathOverview({
  onEditPath,
  onShowWeeklyReport
}: LearningPathOverviewProps) {
  const [path, setPath] = useState<LearningPath | null>(null);
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
        headers: {
          'Cache-Control': 'no-store',
        },
      });
      const data = await res.json();

      if (data.success) {
        setPath(data.data.path);
        setRoadmap(data.data.roadmap);
        setWeeklySummary(data.data.weeklySummary);

        // Debug log
        const actualCompletedCount = data.data.roadmap?.filter((item: RoadmapItem) => item.status === 'completed').length || 0;
        console.log('[LearningPathOverview] Received data:', {
          roadmapLength: data.data.roadmap?.length,
          completedCount: actualCompletedCount,
          masteredCount: data.data.weeklySummary?.masteredCount,
        });
        console.log('[LearningPathOverview] roadmapItems:', data.data.roadmap?.map((item: RoadmapItem) => ({
          name: item.name,
          status: item.status,
          mastery: item.mastery
        })));
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
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !path) {
    return (
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="text-center py-8">
          <p className="text-on-surface-variant mb-4">{error || '没有找到学习路径'}</p>
          <button
            onClick={() => (window.location.href = '/assessment')}
            className="bg-primary text-on-primary rounded-full py-3 px-6 font-medium"
          >
            开始测评
          </button>
        </div>
      </div>
    );
  }

  const currentItem = roadmap.find(item => item.status === 'current');
  const nextItem = roadmap.find(item => item.status === 'pending');
  const completedCount = roadmap.filter(item => item.status === 'completed').length;
  const totalCount = roadmap.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="bg-surface-container-low rounded-[2rem] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MaterialIcon icon="route" className="text-primary" style={{ fontSize: '22px' }} />
          </div>
          <h3 className="font-bold text-on-surface">学习路径</h3>
        </div>
        <div className="flex gap-2">
          {onEditPath && (
            <button
              onClick={onEditPath}
              className="w-10 h-10 rounded-full bg-surface hover:bg-surface-container-high flex items-center justify-center transition-colors"
              aria-label="编辑路径"
            >
              <MaterialIcon icon="edit" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
            </button>
          )}
          {onShowWeeklyReport && (
            <button
              onClick={onShowWeeklyReport}
              className="w-10 h-10 rounded-full bg-surface hover:bg-surface-container-high flex items-center justify-center transition-colors"
              aria-label="周报"
            >
              <MaterialIcon icon="calendar_today" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
            </button>
          )}
        </div>
      </div>

      {/* 当前状态 */}
      <div className="bg-surface rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-on-surface-variant">当前位置</span>
          <span className="text-sm text-on-surface-variant">
            {completedCount}/{totalCount} 已完成
          </span>
        </div>

        {currentItem && (
          <p className="text-on-surface font-medium mb-2">{currentItem.name}</p>
        )}

        {nextItem && (
          <p className="text-sm text-on-surface-variant">
            下一个: {nextItem.name}
          </p>
        )}

        {/* 进度条 */}
        <div className="mt-3 w-full bg-surface-container rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 本周统计 */}
      {weeklySummary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{weeklySummary.practicedCount}</p>
            <p className="text-xs text-on-surface-variant">本周练习</p>
          </div>
          <div className="bg-surface rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-success">{weeklySummary.masteredCount}</p>
            <p className="text-xs text-on-surface-variant">已掌握</p>
          </div>
          <div className="bg-surface rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-warning">{weeklySummary.weakCount}</p>
            <p className="text-xs text-on-surface-variant">待加强</p>
          </div>
        </div>
      )}

      {/* 路径可视化 */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-on-surface">路径概览</span>
        </div>
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
      </div>
    </div>
  );
}
