'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import MaterialIcon from '../MaterialIcon';

interface ComplexityStats {
  pending: number;
  success: number;
  failed: number;
  avgCognitiveLoad: number;
  avgReasoningDepth: number;
  avgComplexity: number;
}

interface ComplexityAdminPanelProps {
  canEdit: boolean;
}

export default function ComplexityAdminPanel({ canEdit }: ComplexityAdminPanelProps) {
  const [stats, setStats] = useState<ComplexityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadStats();
    // Poll every 5 seconds for updates
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/complexity/status');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load complexity stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExtraction = async () => {
    if (!canEdit) return;
    setExtracting(true);
    try {
      const res = await fetch('/api/admin/complexity/batch-extract', { method: 'POST' });
      if (res.ok) {
        setToast({ msg: '提取任务已在后台启动', type: 'success' });
        loadStats();
      } else {
        const data = await res.json();
        setToast({ msg: data.error || '启动提取失败', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to start extraction:', error);
      setToast({ msg: '启动提取失败', type: 'error' });
    } finally {
      setExtracting(false);
    }
  };

  const handleReset = async () => {
    if (!canEdit || !confirm('确定将所有已提取的题目重置为待提取状态？')) return;
    try {
      const res = await fetch('/api/admin/complexity/reset', { method: 'POST' });
      if (res.ok) {
        setToast({ msg: '重置成功', type: 'success' });
        loadStats();
      } else {
        const data = await res.json();
        setToast({ msg: data.error || '重置失败', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to reset:', error);
      setToast({ msg: '重置失败', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const total = (stats?.pending || 0) + (stats?.success || 0) + (stats?.failed || 0);
  const coverage = total > 0 ? ((stats?.success || 0) / total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl shadow-lg font-bold text-sm",
          toast.type === 'success' ? "bg-primary text-on-primary" : "bg-error text-on-error"
        )}>
          {toast.msg}
        </div>
      )}
      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest rounded-[2rem] p-6">
          <div className="text-3xl font-display font-black text-primary">{total}</div>
          <div className="text-sm text-on-surface-variant mt-1">总题目数</div>
        </div>

        <div className="bg-surface-container-lowest rounded-[2rem] p-6">
          <div className="text-3xl font-display font-black text-primary">{stats?.success || 0}</div>
          <div className="text-sm text-on-surface-variant mt-1">已提取特征</div>
          <div className="text-xs text-on-surface-variant/60 mt-2">
            覆盖率 {coverage.toFixed(1)}%
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-[2rem] p-6">
          <div className="text-3xl font-display font-black text-tertiary">{stats?.pending || 0}</div>
          <div className="text-sm text-on-surface-variant mt-1">待提取</div>
        </div>

        <div className="bg-surface-container-lowest rounded-[2rem] p-6">
          <div className="text-3xl font-display font-black text-error">{stats?.failed || 0}</div>
          <div className="text-sm text-on-surface-variant mt-1">提取失败</div>
        </div>
      </div>

      {/* 平均特征值 */}
      <div className="bg-surface-container-lowest rounded-[2.5rem] p-8">
        <h3 className="text-lg font-display font-black text-on-surface mb-6">平均特征值</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MaterialIcon icon="psychology" className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-on-surface-variant">认知负荷</span>
            </div>
            <div className="text-2xl font-display font-black text-on-surface">
              {stats?.avgCognitiveLoad?.toFixed(3) || '-'}
            </div>
            <div className="w-full bg-surface-container rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(stats?.avgCognitiveLoad || 0) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <MaterialIcon icon="account_tree" className="w-4 h-4 text-secondary" />
              <span className="text-sm font-bold text-on-surface-variant">推理深度</span>
            </div>
            <div className="text-2xl font-display font-black text-on-surface">
              {stats?.avgReasoningDepth?.toFixed(3) || '-'}
            </div>
            <div className="w-full bg-surface-container rounded-full h-2 mt-2">
              <div
                className="bg-secondary h-2 rounded-full transition-all"
                style={{ width: `${(stats?.avgReasoningDepth || 0) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <MaterialIcon icon="show_chart" className="w-4 h-4 text-tertiary" />
              <span className="text-sm font-bold text-on-surface-variant">综合复杂度</span>
            </div>
            <div className="text-2xl font-display font-black text-on-surface">
              {stats?.avgComplexity?.toFixed(3) || '-'}
            </div>
            <div className="w-full bg-surface-container rounded-full h-2 mt-2">
              <div
                className="bg-tertiary h-2 rounded-full transition-all"
                style={{ width: `${(stats?.avgComplexity || 0) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 操作区 */}
      <div className="bg-surface-container-lowest rounded-[2.5rem] p-8">
        <h3 className="text-lg font-display font-black text-on-surface mb-6">提取操作</h3>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleStartExtraction}
            disabled={!canEdit || extracting || (stats?.pending || 0) === 0}
            className={cn(
              "px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2 transition-all",
              "bg-primary text-on-primary",
              "hover:scale-105 active:scale-95",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            )}
          >
            <MaterialIcon icon="play_arrow" className="w-4 h-4" />
            {extracting ? '提取中...' : '开始提取'}
          </button>

          <button
            onClick={handleReset}
            disabled={!canEdit}
            className={cn(
              "px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2 transition-all",
              "bg-error-container text-on-error-container",
              "hover:scale-105 active:scale-95",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            )}
          >
            <MaterialIcon icon="refresh" className="w-4 h-4" />
            全部重置
          </button>
        </div>

        <div className="mt-4 p-4 bg-surface-container-low rounded-2xl text-xs text-on-surface-variant/80">
          <p>• 提取在后台运行，可以关闭此页面</p>
          <p>• 检查点每 10 题自动保存</p>
          <p>• 使用 MiniMax API 代理服务</p>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="bg-surface-container-lowest rounded-[2.5rem] p-8">
        <h3 className="text-lg font-display font-black text-on-surface mb-6">快捷入口</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/admin/complexity?tab=weights"
            className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center">
              <MaterialIcon icon="tune" className="w-5 h-5 text-on-primary-container" />
            </div>
            <div>
              <div className="font-bold text-on-surface">权重监控</div>
              <div className="text-xs text-on-surface-variant">查看和调整复杂度权重</div>
            </div>
          </a>

          <a
            href="/admin/complexity?tab=review"
            className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center">
              <MaterialIcon icon="fact_check" className="w-5 h-5 text-on-secondary-container" />
            </div>
            <div>
              <div className="font-bold text-on-surface">低置信度审核</div>
              <div className="text-xs text-on-surface-variant">审核需要人工确认的题目</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
