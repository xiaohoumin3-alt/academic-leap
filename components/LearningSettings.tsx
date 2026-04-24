// components/LearningSettings.tsx
'use client';

import { useState, useEffect } from 'react';
import MaterialIcon from './MaterialIcon';
import KnowledgeTreeView from './KnowledgeTreeView';
import SemesterDialog from './SemesterDialog';
import { userApi } from '@/lib/api';

interface LearningSettingsProps {
  onRefresh?: () => void;
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

export default function LearningSettings({ onRefresh }: LearningSettingsProps) {
  const [settings, setSettings] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [treeData, setTreeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 教材选择状态
  const [showTextbookSelector, setShowTextbookSelector] = useState(false);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [grades, setGrades] = useState<number[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedTextbookId, setSelectedTextbookId] = useState<string | null>(null);

  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingTextbookId, setPendingTextbookId] = useState<string | null>(null);

  // 学期设置对话框
  const [showSemesterDialog, setShowSemesterDialog] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, progressRes] = await Promise.all([
        userApi.getSettings(),
        userApi.getProgress()
      ]);

      if (settingsRes.data) {
        setSettings(settingsRes.data);

        // 如果有教材ID，加载知识树
        if (settingsRes.data.selectedTextbookId) {
          const treeRes = await userApi.getKnowledgeTree(false);
          if (treeRes.data) {
            setTreeData(treeRes.data);
          } else {
            setShowTextbookSelector(true);
            await loadTextbooks();
          }
        } else {
          setShowTextbookSelector(true);
          await loadTextbooks();
        }
      } else {
        setShowTextbookSelector(true);
        await loadTextbooks();
      }

      if (progressRes.data) {
        setProgress(progressRes.data.progress);
        setProgressMessage(progressRes.data.progressMessage || '');
      }
    } catch (error) {
      console.error('加载设置失败:', error);
      setShowTextbookSelector(true);
      await loadTextbooks();
    } finally {
      setLoading(false);
    }
  };

  const loadTextbooks = async () => {
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
    }
  };

  const filteredTextbooks = textbooks.filter(tb => {
    if (selectedGrade && tb.grade !== selectedGrade) return false;
    if (selectedSubject && tb.subject !== selectedSubject) return false;
    return true;
  });

  const handleCancelEdit = () => {
    setIsEditing(false);
    setShowWarning(false);
    setPendingTextbookId(null);
    // 重置选择器状态
    setSelectedGrade(null);
    setSelectedSubject(null);
    setSelectedTextbookId(null);
  };

  const handleEnterEditMode = () => {
    setIsEditing(true);
    // 预填当前设置
    if (settings) {
      setSelectedGrade(settings.grade ?? null);
      setSelectedSubject(settings.selectedSubject ?? null);
      setSelectedTextbookId(settings.selectedTextbookId ?? null);
    }
    // 加载教材列表（如果还没有）
    if (textbooks.length === 0) {
      loadTextbooks();
    }
  };

  const handleSaveTextbook = async () => {
    if (!selectedTextbookId) return;

    // 如果是编辑模式且选择了不同的教材，显示警告
    if (settings?.selectedTextbookId &&
        settings.selectedTextbookId !== selectedTextbookId &&
        !showWarning) {
      setPendingTextbookId(selectedTextbookId);
      setShowWarning(true);
      return;
    }

    setSaving(true);
    try {
      const result = await userApi.updateSettings({
        grade: selectedGrade ?? undefined,
        selectedSubject: selectedSubject ?? undefined,
        selectedTextbookId,
      });

      // 检查更新是否成功
      if (!result.success) {
        console.error('保存教材设置失败:', result.error);
        // 如果是用户不存在错误，可能需要重新登录或注册
        if (result.error?.includes('未登录') || result.error?.includes('不存在')) {
          // 显示错误提示
          alert('登录已过期，请重新登录');
        }
        return;
      }

      await loadSettings();
      setShowTextbookSelector(false);
      setIsEditing(false);  // 退出编辑模式
      setShowWarning(false);
      setPendingTextbookId(null);
      onRefresh?.();
    } catch (error) {
      console.error('保存教材设置失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmTextbookChange = async () => {
    if (!pendingTextbookId) return;

    setSaving(true);
    try {
      const result = await userApi.updateSettings({
        grade: selectedGrade ?? undefined,
        selectedSubject: selectedSubject ?? undefined,
        selectedTextbookId: pendingTextbookId,
      });

      if (!result.success) {
        console.error('保存教材设置失败:', result.error);
        return;
      }

      await loadSettings();
      setIsEditing(false);
      setShowWarning(false);
      setPendingTextbookId(null);
      onRefresh?.();
    } catch (error) {
      console.error('保存教材设置失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyRecommend = async () => {
    setSaving(true);
    try {
      const res = await userApi.recommend();
      if (res.data?.executed) {
        await loadSettings();
        onRefresh?.();
      }
    } catch (error) {
      console.error('应用推荐失败:', error);
      alert('推荐失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (nodeId: string, nodeType: 'chapter' | 'point', enabled: boolean) => {
    try {
      await userApi.toggleKnowledge({
        nodeId,
        nodeType,
        enabled,
        cascade: nodeType === 'chapter',
      });
      await loadSettings();
      onRefresh?.();
    } catch (error) {
      console.error('切换失败:', error);
    }
  };

  const handleProgressChange = async (value: number) => {
    setProgress(value);
    try {
      await userApi.updateSettings({ studyProgress: value });
      onRefresh?.();
    } catch (error) {
      console.error('保存进度失败:', error);
    }
  };

  const handleSaveSemester = async (start: Date, end: Date) => {
    try {
      await userApi.updateSettings({
        semesterStart: start.toISOString().split('T')[0],
        semesterEnd: end.toISOString().split('T')[0],
      });
      await loadSettings();
      onRefresh?.();
    } catch (error) {
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  // 教材选择器
  if (showTextbookSelector || isEditing) {
    return (
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '22px' }} />
            </div>
            <h3 className="font-bold text-on-surface">
              {isEditing ? '更改学习教材' : '选择学习教材'}
            </h3>
          </div>
          {(isEditing || settings?.selectedTextbookId) && (
            <button
              onClick={handleCancelEdit}
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              取消
            </button>
          )}
        </div>

        <p className="text-sm text-on-surface-variant mb-6">
          {isEditing ? '请选择新的年级和科目' : '请选择您的年级和科目，我们将为您推荐合适的学习内容'}
        </p>

        {/* 年级选择 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-on-surface mb-2">年级</label>
          <div className="flex flex-wrap gap-2">
            {grades.map(grade => (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedGrade === grade
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface text-on-surface-variant'
                }`}
              >
                {grade}年级
              </button>
            ))}
          </div>
        </div>

        {/* 科目选择 */}
        {selectedGrade && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-on-surface mb-2">科目</label>
            <div className="flex flex-wrap gap-2">
              {subjects.map(subject => (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedSubject === subject
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface text-on-surface-variant'
                  }`}
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 教材选择 */}
        {selectedGrade && selectedSubject && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-on-surface mb-2">教材版本</label>
            <div className="space-y-2">
              {filteredTextbooks.map(tb => (
                <button
                  key={tb.id}
                  onClick={() => setSelectedTextbookId(tb.id)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    selectedTextbookId === tb.id
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
                    {selectedTextbookId === tb.id && (
                      <MaterialIcon icon="check_circle" className="text-primary" style={{ fontSize: '24px' }} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 确认按钮 */}
        <button
          onClick={handleSaveTextbook}
          disabled={!selectedTextbookId || saving}
          className="w-full bg-primary text-on-primary rounded-full py-4 font-medium disabled:opacity-50 transition-all"
        >
          {saving ? '保存中...' : '确认选择'}
        </button>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <p className="text-center text-on-surface-variant">加载中...</p>
      </div>
    );
  }

  // 如果没有知识树数据，显示加载或错误状态
  if (!treeData) {
    return (
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '22px' }} />
          </div>
          <h3 className="font-bold text-on-surface">学习设置</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-on-surface-variant mb-4">无法加载知识树数据</p>
          <button
            onClick={() => {
              setShowTextbookSelector(true);
              loadTextbooks();
            }}
            className="bg-primary text-on-primary rounded-full py-4 px-8 font-medium"
          >
            重新选择教材
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '22px' }} />
            </div>
            <h3 className="font-bold text-on-surface">学习设置</h3>
          </div>
          {!isEditing && settings?.selectedTextbookId && (
            <button
              onClick={handleEnterEditMode}
              className="w-10 h-10 rounded-full bg-surface hover:bg-surface-container-high flex items-center justify-center transition-colors"
              aria-label="编辑设置"
            >
              <MaterialIcon icon="edit" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
            </button>
          )}
        </div>

        {/* 设置摘要 */}
        <div className="bg-surface rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-on-surface-variant">
              {settings?.grade}年级 · {settings?.selectedSubject}
            </span>
            <span className="text-sm text-on-surface-variant">
              {treeData?.enabledCount || 0}/{treeData?.totalCount || 0} 知识点
            </span>
          </div>

          {/* 学习进度 */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-on-surface-variant">学习进度</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">{progress}%</span>
                  {progressMessage && (
                    <span className="text-xs text-on-surface-variant">({progressMessage})</span>
                  )}
                </div>
              </div>
              <div className="w-full bg-surface-container rounded-full h-2">
                <div
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => setShowSemesterDialog(true)}
              className="px-3 py-2 rounded-lg bg-surface hover:bg-surface-container-high text-sm text-on-surface-variant transition-colors"
            >
              设置学期
            </button>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={handleApplyRecommend}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-medium bg-primary text-on-primary disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <MaterialIcon icon="auto_awesome" style={{ fontSize: '18px' }} />
            {saving ? '应用中...' : '应用推荐'}
          </button>
        </div>

        {/* 知识点树 - 始终显示 */}
        {treeData ? (
          <KnowledgeTreeView
            chapters={treeData.chapters}
            onToggle={handleToggle}
            expandable={true}
          />
        ) : (
          <div className="text-center py-8 text-on-surface-variant">
            加载知识点树中...
          </div>
        )}
      </div>

      {/* 学期设置对话框 */}
      <SemesterDialog
        isOpen={showSemesterDialog}
        onClose={() => setShowSemesterDialog(false)}
        onSave={handleSaveSemester}
        currentStart={settings?.semesterStart ? new Date(settings.semesterStart) : undefined}
        currentEnd={settings?.semesterEnd ? new Date(settings.semesterEnd) : undefined}
      />

      {/* 警告对话框 */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-low rounded-[2rem] p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center">
                <MaterialIcon icon="warning" className="text-on-error-container" style={{ fontSize: '22px' }} />
              </div>
              <h3 className="font-bold text-on-surface">确认更换教材？</h3>
            </div>

            <p className="text-on-surface-variant mb-6">
              更换教材将清空当前的知识点选择，需要重新勾选学习内容。
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWarning(false);
                  setPendingTextbookId(null);
                }}
                className="flex-1 py-3 rounded-xl font-medium bg-surface text-on-surface-variant transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmTextbookChange}
                disabled={saving}
                className="flex-1 py-3 rounded-xl font-medium bg-error text-on-error-container disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : '继续'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
