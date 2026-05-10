'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import MaterialIcon from '../MaterialIcon';

export interface KnowledgePointWithDetails {
  id: string;
  name: string;
  description?: string;
  weight: number;
  inAssess: boolean;
  status: string;
  concept: { id: string; name: string; weight: number };
  textbook?: { id: string; name: string };
  chapter?: { id: string; name: string };
}

export interface Question {
  id: string;
  type: string;
  difficulty: number;
  cognitiveLoad: number | null;
  reasoningDepth: number | null;
  extractionStatus: string;
  createdAt: string;
}

interface KnowledgePointDetailProps {
  kp: KnowledgePointWithDetails;
  chapterPath: string;
  onClose: () => void;
  onRefresh: () => void;
  onGenerate: (kpId: string) => Promise<void>;
}

export default function KnowledgePointDetail({
  kp,
  chapterPath,
  onClose,
  onRefresh,
  onGenerate,
}: KnowledgePointDetailProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 生成状态信息（与后端一致）
  type GenerationStatus = 'pending' | 'in_progress' | 'completed' | 'failed'
  const [genStatus, setGenStatus] = useState<GenerationStatus | null>(null);
  const [genProgress, setGenProgress] = useState<Record<string, number>>({});
  const [genError, setGenError] = useState<string | null>(null);
  const [actualQuestionCount, setActualQuestionCount] = useState<number>(0);

  const loadQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/knowledge-points/${kp.id}/questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.data?.questions || []);
      } else {
        setToast({ msg: '加载题目失败', type: 'error' });
      }
    } catch {
      setToast({ msg: '加载题目失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [kp.id]);

  const loadGenerationStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/question-generation/status/${kp.id}`);
      if (res.ok) {
        const data = await res.json();
        setGenStatus(data.data.status);
        setGenProgress(data.data.progress || {});
        setGenError(data.data.error);
        setActualQuestionCount(data.data.actualQuestionCount || 0);
      }
    } catch {
      // 静默失败，不影响主流程
    }
  }, [kp.id]);

  // 计算当前题目状态统计
  const stats = {
    total: questions.length,
    completed: questions.filter(q => q.extractionStatus === 'SUCCESS' || q.extractionStatus === 'FALLBACK').length,
    pending: questions.filter(q => q.extractionStatus === 'PENDING').length,
    failed: questions.filter(q => q.extractionStatus === 'FAILED').length,
  };
  const hasInProgress = stats.pending > 0;

  // 轮询：有进行中的题目或正在生成时，每5秒自动刷新
  // 注意：只有 'in_progress' 才是真正在生成，'pending' 表示等待生成
  const isGenerating = genStatus === 'in_progress';
  useEffect(() => {
    if ((hasInProgress || isGenerating) && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        loadQuestions();
        loadGenerationStatus();
      }, 5000);
    }
    if (!hasInProgress && !isGenerating && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [hasInProgress, isGenerating, loadQuestions, loadGenerationStatus]);

  useEffect(() => {
    setLoading(true);
    loadQuestions();
    loadGenerationStatus();
  }, [loadQuestions, loadGenerationStatus]);

  // Auto-hide toast (10秒让用户有时间看清楚)
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Focus input when editing
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerate(kp.id);
      setToast({ msg: '题目生成任务已提交，正在后台处理...', type: 'success' });
      onRefresh();
      // 立即刷新一次，然后让轮询机制接管
      await loadQuestions();
      await loadGenerationStatus();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '生成失败';
      setToast({ msg: `生成失败：${errorMsg}`, type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleStartEdit = (q: Question) => {
    // 编辑功能已禁用 - complexity字段已移除，使用cognitiveLoad和reasoningDepth
    // 如需编辑，请使用专门的复杂度管理页面
    setToast({ msg: '请使用复杂度管理页面编辑认知负荷和推理深度', type: 'error' });
  };

  const getTypeName = (type: string) => {
    const names: Record<string, string> = {
      fill_blank: '填空题',
      choice: '选择题',
      solution: '解答题',
    };
    return names[type] || type;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'SUCCESS') {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-success/10 text-success">已提取</span>;
    }
    if (status === 'PENDING') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-warning/10 text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
          处理中
        </span>
      );
    }
    if (status === 'FAILED') {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-error/10 text-error">失败</span>;
    }
    if (status === 'FALLBACK') {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-info/10 text-info">已提取(默认)</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs bg-surface-container text-on-surface-variant">{status}</span>;
  };

  return (
    <div className="bg-surface-container-low rounded-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl shadow-lg font-bold text-sm",
          toast.type === 'success' ? "bg-success text-on-success" : "bg-error text-on-error"
        )}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-surface-container-high border-b border-outline-variant/10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <MaterialIcon icon="auto_awesome" className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-xs text-on-surface-variant">{chapterPath}</div>
            <div className="font-bold text-on-surface">{kp.name}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-container-low transition-colors flex items-center justify-center"
        >
          <MaterialIcon icon="close" className="w-4 h-4 text-on-surface-variant" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Description */}
        {kp.description && (
          <div className="p-4 bg-surface-container-low rounded-xl">
            <div className="text-xs text-on-surface-variant mb-1">描述</div>
            <div className="text-sm text-on-surface">{kp.description}</div>
          </div>
        )}

        {/* 生成进度 - 只在有实际内容时显示 */}
        {(isGenerating || genError || (Object.keys(genProgress).length > 0 && genStatus !== 'pending')) && (
          <div className={cn(
            "p-4 rounded-xl border",
            genError ? "bg-error/5 border-error/20" : "bg-info/5 border-info/20"
          )}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MaterialIcon icon={
                  genError ? "error" :
                  genStatus === 'completed' ? "check_circle" :
                  genStatus === 'failed' ? "error" :
                  "autorenew"
                } className={cn(
                  "w-4 h-4",
                  genError || genStatus === 'failed' ? "text-error" :
                  genStatus === 'completed' ? "text-success" : "text-info animate-spin"
                )} />
                <span className="text-sm font-bold">
                  {genError ? '生成出错' :
                   genStatus === 'completed' ? '生成完成' :
                   genStatus === 'failed' ? '生成失败' :
                   '正在生成题目...'}
                </span>
              </div>
              {Object.keys(genProgress).length > 0 && (
                <span className="text-xs text-on-surface-variant">
                  共 {actualQuestionCount} 题
                </span>
              )}
            </div>

            {genError && (
              <div className="text-sm text-error mt-1">{genError}</div>
            )}

            {!genError && Object.keys(genProgress).length > 0 && (
              <div className="grid grid-cols-6 gap-2 mt-2">
                {Object.entries(genProgress)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([level, count]) => (
                  <div key={level} className="text-center p-2 bg-surface-container-low rounded">
                    <div className="text-xs text-on-surface-variant">Lv.{level}</div>
                    <div className="text-lg font-bold text-primary">{count}</div>
                  </div>
                ))}
              </div>
            )}

            {!genError && Object.keys(genProgress).length === 0 && isGenerating && (
              <div className="text-sm text-on-surface-variant">正在初始化生成任务...</div>
            )}
          </div>
        )}

        {/* Questions Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h4 className="font-bold text-on-surface">
              关联题目 <span className="text-primary">({questions.length})</span>
            </h4>
            {hasInProgress && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning/10 text-warning animate-pulse">
                <span className="w-2 h-2 rounded-full bg-warning animate-ping" />
                生成中 {stats.pending} 道处理中 / {stats.completed} 已完成
              </span>
            )}
            {!hasInProgress && stats.total > 0 && (
              <span className="text-xs text-on-surface-variant">
                {stats.completed} 已完成{stats.failed > 0 ? ` / ${stats.failed} 失败` : ''}
              </span>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || hasInProgress}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all",
              "bg-primary text-on-primary",
              "hover:scale-105 active:scale-95",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            )}
          >
            <MaterialIcon icon={hasInProgress ? "hourglass_top" : generating ? "hourglass_empty" : "add"} className={cn("w-4 h-4", hasInProgress && "animate-spin")} />
            {hasInProgress ? '生成中...' : generating ? '提交中...' : '生成题目'}
          </button>
        </div>

        {/* Questions List */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant bg-surface-container-low rounded-xl">
            <MaterialIcon icon="inbox" className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>暂无关联题目</p>
            <p className="text-xs mt-1">点击"生成题目"为此知识点创建题目</p>
          </div>
        ) : (
          <div className="bg-surface-container-low rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-on-surface-variant uppercase border-b border-outline-variant/10">
                  <th className="p-3 text-left">难度</th>
                  <th className="p-3 text-left">类型</th>
                  <th className="p-3 text-left">认知负荷 / 推理深度</th>
                  <th className="p-3 text-left">状态</th>
                  <th className="p-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {questions.slice(0, 10).map(q => (
                  <tr key={q.id} className="border-t border-outline-variant/10 hover:bg-surface-container transition-colors">
                    <td className="p-3 text-sm font-bold text-on-surface">{q.difficulty}</td>
                    <td className="p-3 text-sm text-on-surface-variant">{getTypeName(q.type)}</td>
                    <td className="p-3">
                      <span className="text-xs text-on-surface-variant">
                        CL: {(q.cognitiveLoad ?? 0).toFixed(2)} / RD: {(q.reasoningDepth ?? 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3">{getStatusBadge(q.extractionStatus)}</td>
                    <td className="p-3">
                      <span className="text-xs text-on-surface-variant">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {questions.length > 10 && (
              <div className="p-3 text-center text-xs text-on-surface-variant bg-surface-container-low border-t border-outline-variant/10">
                还有 {questions.length - 10} 道题目...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
