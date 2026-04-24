'use client';

import { useState, useEffect } from 'react';
import MaterialIcon from './MaterialIcon';

interface LearningSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  settings: {
    grade?: number;
    selectedSubject?: string;
    selectedTextbookId?: string;
    targetScore?: number;
  } | null;
}

interface Textbook {
  id: string;
  name: string;
  grade: number;
  subject: string;
  year?: number;
  publisher?: string;
  _count: { chapters: number };
}

export default function LearningSettingsDialog({
  isOpen,
  onClose,
  onSave,
  settings,
}: LearningSettingsDialogProps) {
  const [grade, setGrade] = useState<number | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [textbookId, setTextbookId] = useState<string | null>(null);
  const [targetScore, setTargetScore] = useState<number>(90);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [grades, setGrades] = useState<number[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 初始化表单
  useEffect(() => {
    if (isOpen && settings) {
      setGrade(settings.grade ?? null);
      setSubject(settings.selectedSubject ?? null);
      setTextbookId(settings.selectedTextbookId ?? null);
      setTargetScore(settings.targetScore ?? 90);
    }
  }, [isOpen, settings]);

  // 加载教材列表
  useEffect(() => {
    if (isOpen) {
      loadTextbooks();
    }
  }, [isOpen]);

  const loadTextbooks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/textbooks');
      const data = await res.json();
      if (data.success) {
        setTextbooks(data.data.textbooks);
        setGrades(data.data.grades);
        setSubjects(data.data.subjects);
      }
    } catch (error) {
      console.error('加载教材列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTextbooks = textbooks.filter(tb => {
    if (grade && tb.grade !== grade) return false;
    if (subject && tb.subject !== subject) return false;
    return true;
  });

  const handleSave = async () => {
    if (!grade || !subject || !textbookId) {
      alert('请完整选择年级、科目和教材');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          selectedSubject: subject,
          selectedTextbookId: textbookId,
          targetScore,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onSave();
        onClose();
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-low rounded-[2rem] p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '22px' }} />
            </div>
            <h3 className="font-bold text-on-surface">学习设置</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface hover:bg-surface-container-high flex items-center justify-center transition-colors"
          >
            <MaterialIcon icon="close" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* 年级选择 */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">年级</label>
              <div className="flex flex-wrap gap-2">
                {grades.map(g => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      grade === g
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface text-on-surface-variant'
                    }`}
                  >
                    {g}年级
                  </button>
                ))}
              </div>
            </div>

            {/* 科目选择 */}
            {grade && (
              <div>
                <label className="block text-sm font-medium text-on-surface mb-2">科目</label>
                <div className="flex flex-wrap gap-2">
                  {subjects.map(subj => (
                    <button
                      key={subj}
                      onClick={() => setSubject(subj)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        subject === subj
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface text-on-surface-variant'
                      }`}
                    >
                      {subj}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 教材选择 */}
            {grade && subject && (
              <div>
                <label className="block text-sm font-medium text-on-surface mb-2">教材版本</label>
                <div className="space-y-2">
                  {filteredTextbooks.map(tb => (
                    <button
                      key={tb.id}
                      onClick={() => setTextbookId(tb.id)}
                      className={`w-full p-4 rounded-xl text-left transition-all ${
                        textbookId === tb.id
                          ? 'bg-primary-container border-2 border-primary'
                          : 'bg-surface border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-on-surface">{tb.name}</p>
                          <p className="text-sm text-on-surface-variant">
                            {tb.grade}年级 · {tb.subject} · {tb._count.chapters}个章节
                          </p>
                        </div>
                        {textbookId === tb.id && (
                          <MaterialIcon icon="check_circle" className="text-primary" style={{ fontSize: '24px' }} />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 目标分数 */}
            {textbookId && (
              <div>
                <label className="block text-sm font-medium text-on-surface mb-2">目标分数</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={targetScore}
                  onChange={(e) => setTargetScore(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl bg-surface border-2 border-transparent focus:border-primary outline-none text-on-surface"
                />
              </div>
            )}

            {/* 保存按钮 */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-3 rounded-xl font-medium bg-surface text-on-surface-variant transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !grade || !subject || !textbookId}
                className="flex-1 py-3 rounded-xl font-medium bg-primary text-on-primary disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
