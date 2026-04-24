'use client';

import { useState, useEffect } from 'react';
import MaterialIcon from './MaterialIcon';

interface WeeklyReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmRecalibrate?: (includeStale: boolean) => void;
}

interface StaleKnowledgeItem {
  nodeId: string;
  name: string;
  lastPractice: string;
  mastery: number;
}

interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  summary: {
    practicedCount: number;
    masteredCount: number;
    weakCount: number;
  };
  staleKnowledge: StaleKnowledgeItem[];
  recommendations: {
    toReview: string[];
    toLearn: string[];
  };
}

export default function WeeklyReportDialog({
  isOpen,
  onClose,
  onConfirmRecalibrate
}: WeeklyReportDialogProps) {
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadReport();
    }
  }, [isOpen]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/learning-path/weekly-report');
      const data = await res.json();

      if (data.success) {
        setReportData(data.data);
      }
    } catch (error) {
      console.error('加载周报失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalibrate = async (includeStale: boolean) => {
    setRecalibrating(true);
    try {
      const res = await fetch('/api/learning-path/recalibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeStale })
      });
      const data = await res.json();

      if (data.success) {
        onConfirmRecalibrate?.(includeStale);
        onClose();
      }
    } catch (error) {
      console.error('重组失败:', error);
    } finally {
      setRecalibrating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-low rounded-[2rem] p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MaterialIcon icon="calendar_today" className="text-primary" style={{ fontSize: '22px' }} />
            </div>
            <h3 className="font-bold text-on-surface">本周学习报告</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface hover:bg-surface-container-high flex items-center justify-center"
          >
            <MaterialIcon icon="close" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : reportData ? (
          <>
            {/* 本周统计 */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-surface rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-primary">{reportData.summary.practicedCount}</p>
                <p className="text-xs text-on-surface-variant">练习知识点</p>
              </div>
              <div className="bg-surface rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-success">{reportData.summary.masteredCount}</p>
                <p className="text-xs text-on-surface-variant">已掌握</p>
              </div>
              <div className="bg-surface rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-warning">{reportData.summary.weakCount}</p>
                <p className="text-xs text-on-surface-variant">待加强</p>
              </div>
            </div>

            {/* 久未复习 */}
            {reportData.staleKnowledge.length > 0 && (
              <div className="bg-surface rounded-xl p-4 mb-6">
                <h4 className="font-medium text-on-surface mb-3 flex items-center gap-2">
                  <MaterialIcon icon="history" className="text-warning" style={{ fontSize: '18px' }} />
                  久未复习
                </h4>
                <div className="space-y-2">
                  {reportData.staleKnowledge.map(item => {
                    const daysSince = Math.floor(
                      (Date.now() - new Date(item.lastPractice).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div key={item.nodeId} className="flex items-center justify-between text-sm">
                        <span className="text-on-surface">{item.name}</span>
                        <span className="text-on-surface-variant">
                          {daysSince}天前 · 掌握度{Math.round(item.mastery * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            {reportData.staleKnowledge.length > 0 && (
              <div className="space-y-3">
                <button
                  onClick={() => handleRecalibrate(true)}
                  disabled={recalibrating}
                  className="w-full py-3 rounded-xl font-medium bg-primary text-on-primary disabled:opacity-50 transition-colors"
                >
                  {recalibrating ? '处理中...' : '加入复习队列并重组路径'}
                </button>
                <button
                  onClick={() => handleRecalibrate(false)}
                  disabled={recalibrating}
                  className="w-full py-3 rounded-xl font-medium bg-surface text-on-surface-variant disabled:opacity-50 transition-colors"
                >
                  仅重组路径（不含复习）
                </button>
                <button
                  onClick={onClose}
                  disabled={recalibrating}
                  className="w-full py-3 rounded-xl font-medium text-on-surface-variant disabled:opacity-50 transition-colors"
                >
                  稍后提醒
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
