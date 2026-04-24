// components/LearningSettings.tsx
'use client';

import { useState, useEffect } from 'react';
import MaterialIcon from './MaterialIcon';
import KnowledgeTreeView from './KnowledgeTreeView';
import { userApi } from '@/lib/api';

interface LearningSettingsProps {
  onRefresh?: () => void;
}

export default function LearningSettings({ onRefresh }: LearningSettingsProps) {
  const [mode, setMode] = useState<'smart' | 'manual'>('smart');
  const [settings, setSettings] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [treeData, setTreeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, treeRes] = await Promise.all([
        userApi.getSettings(),
        userApi.getKnowledgeTree(false),
      ]);
      if (settingsRes.data) setSettings(settingsRes.data);
      if (treeRes.data) {
        setTreeData(treeRes.data);
        setProgress(settingsRes.data?.studyProgress ?? 0);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRecommend = async () => {
    setSaving(true);
    try {
      const res = await userApi.recommend(false);
      if (res.data?.executed) {
        await loadSettings();
        onRefresh?.();
      }
    } catch (error) {
      console.error('应用推荐失败:', error);
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

  if (loading) {
    return (
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!settings || !treeData) {
    return (
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <p className="text-center text-on-surface-variant">请先完成学习设置</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low rounded-[2rem] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '22px' }} />
        </div>
        <h3 className="font-bold text-on-surface">学习设置</h3>
      </div>

      {/* 设置摘要 */}
      <div className="bg-surface rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-on-surface-variant">
            {settings.selectedGrade}年级 · {settings.selectedSubject}
          </span>
          <span className="text-sm text-on-surface-variant">
            {treeData.enabledCount}/{treeData.totalCount} 知识点
          </span>
        </div>
      </div>

      {/* 进度滑块 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-on-surface-variant">学习进度</span>
          <span className="text-sm font-medium text-primary">{progress}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={(e) => handleProgressChange(parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* 模式切换 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('smart')}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            mode === 'smart'
              ? 'bg-primary text-on-primary'
              : 'bg-surface text-on-surface-variant'
          }`}
        >
          智能推荐
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            mode === 'manual'
              ? 'bg-primary text-on-primary'
              : 'bg-surface text-on-surface-variant'
          }`}
        >
          手动勾选
        </button>
      </div>

      {/* 内容区域 */}
      {mode === 'smart' ? (
        <div className="text-center py-8">
          <p className="text-on-surface-variant mb-4">
            根据当前进度 ({progress}%) 推荐学习内容
          </p>
          <button
            onClick={handleApplyRecommend}
            disabled={saving}
            className="bg-primary text-on-primary rounded-full py-4 px-8 font-medium disabled:opacity-50"
          >
            {saving ? '应用中...' : '应用推荐'}
          </button>
        </div>
      ) : (
        <KnowledgeTreeView
          chapters={treeData.chapters}
          onToggle={handleToggle}
          expandable={true}
        />
      )}
    </div>
  );
}
