'use client';

import { useState, useEffect } from 'react';
import MaterialIcon from './MaterialIcon';
import {
  inferDefaultSemester,
  calculateProgress,
  formatDateForInput,
  parseDateInput
} from '@/lib/semester';

interface SemesterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (start: Date, end: Date) => Promise<void>;
  currentStart?: Date;
  currentEnd?: Date;
}

export default function SemesterDialog({
  isOpen,
  onClose,
  onSave,
  currentStart,
  currentEnd
}: SemesterDialogProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  // 初始化日期
  useEffect(() => {
    if (isOpen) {
      const defaultSemester = inferDefaultSemester();
      setStartDate(formatDateForInput(currentStart || defaultSemester.start));
      setEndDate(formatDateForInput(currentEnd || defaultSemester.end));
    }
  }, [isOpen, currentStart, currentEnd]);

  const handleSave = async () => {
    const start = parseDateInput(startDate);
    const end = parseDateInput(endDate);

    if (!start || !end) {
      alert('请输入有效的日期');
      return;
    }

    if (end <= start) {
      alert('结束日期必须晚于开始日期');
      return;
    }

    setSaving(true);
    try {
      await onSave(start, end);
      onClose();
    } catch (error) {
      console.error('保存学期失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 计算预览进度
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  const progressInfo = start && end ? calculateProgress(start, end) : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-low rounded-[2rem] p-6 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MaterialIcon icon="calendar_month" className="text-primary" style={{ fontSize: '22px' }} />
          </div>
          <h3 className="font-bold text-on-surface">设置学期</h3>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">
              学期开始
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface border-2 border-transparent focus:border-primary outline-none text-on-surface"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">
              学期结束
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface border-2 border-transparent focus:border-primary outline-none text-on-surface"
            />
          </div>

          {progressInfo && (
            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-on-surface-variant">当前进度</span>
                <span className="font-bold text-primary">{progressInfo.progress}%</span>
              </div>
              {progressInfo.message && (
                <p className="text-xs text-on-surface-variant">{progressInfo.message}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-medium bg-surface text-on-surface-variant transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-medium bg-primary text-on-primary disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
