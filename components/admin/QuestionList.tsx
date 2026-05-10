'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import MaterialIcon from '../MaterialIcon';

interface Question {
  id: string;
  type: string;
  difficulty: number;
  cognitiveLoad: number | null;
  reasoningDepth: number | null;
  extractionStatus: string;
  createdAt: string;
}

interface QuestionListProps {
  canEdit: boolean;
}

export default function QuestionList({ canEdit }: QuestionListProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });

  // Filters
  const [knowledgePointId, setKnowledgePointId] = useState('');
  const [difficultyMin, setDifficultyMin] = useState('');
  const [difficultyMax, setDifficultyMax] = useState('');
  const [status, setStatus] = useState('');

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'cognitiveLoad' | 'reasoningDepth' | null>(null);
  const [editValue, setEditValue] = useState<number | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);

  // Batch extract
  const [extracting, setExtracting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 计算当前题目状态统计
  const stats = {
    total: questions.length,
    completed: questions.filter(q => q.extractionStatus === 'SUCCESS' || q.extractionStatus === 'FALLBACK').length,
    pending: questions.filter(q => q.extractionStatus === 'PENDING').length,
    failed: questions.filter(q => q.extractionStatus === 'FAILED').length,
  };
  const hasInProgress = stats.pending > 0;

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Focus input when editing
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());
      if (knowledgePointId) params.set('knowledgePointId', knowledgePointId);
      if (difficultyMin) params.set('difficultyMin', difficultyMin);
      if (difficultyMax) params.set('difficultyMax', difficultyMax);
      if (status) params.set('status', status);

      const res = await fetch(`/api/admin/questions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.data?.questions || []);
        setPagination(data.data?.pagination || pagination);
      } else {
        setToast({ msg: '加载题目失败', type: 'error' });
      }
    } catch {
      setToast({ msg: '加载题目失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, knowledgePointId, difficultyMin, difficultyMax, status]);

  // 轮询：有进行中的题目时，每5秒自动刷新
  useEffect(() => {
    if (hasInProgress && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        loadQuestions();
      }, 5000);
    }
    if (!hasInProgress && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [hasInProgress, loadQuestions]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleBatchExtract = async () => {
    setExtracting(true);
    try {
      const res = await fetch('/api/admin/complexity/batch-extract', { method: 'POST' });
      if (res.ok) {
        setToast({ msg: '批量提取任务已启动', type: 'success' });
        // Refresh after delay
        setTimeout(loadQuestions, 2000);
      } else {
        const data = await res.json();
        setToast({ msg: data.error?.message || '启动失败', type: 'error' });
      }
    } catch {
      setToast({ msg: '启动失败', type: 'error' });
    } finally {
      setExtracting(false);
    }
  };

  const handleStartEdit = (q: Question, field: 'cognitiveLoad' | 'reasoningDepth') => {
    setEditingId(q.id);
    setEditingField(field);
    setEditValue(q[field]);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingField || editValue === null || isSavingRef.current) return;

    // Validate value
    if (editValue < 0 || editValue > 1) {
      setToast({ msg: '值必须在 0-1 之间', type: 'error' });
      handleCancelEdit();
      return;
    }

    isSavingRef.current = true;
    try {
      const res = await fetch(`/api/admin/questions/${editingId}/${editingField}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: editValue }),
      });

      if (res.ok) {
        setQuestions(questions.map(q =>
          q.id === editingId ? { ...q, [editingField]: editValue } : q
        ));
        setToast({ msg: '已更新', type: 'success' });
      } else {
        setToast({ msg: '更新失败', type: 'error' });
      }
    } catch {
      setToast({ msg: '更新失败', type: 'error' });
    } finally {
      setEditingId(null);
      setEditingField(null);
      setEditValue(null);
      isSavingRef.current = false;
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingField(null);
    setEditValue(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
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
    if (status === 'SUCCESS') return <span className="px-2 py-0.5 rounded-full text-xs bg-success/10 text-success">已提取</span>;
    if (status === 'PENDING') return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-warning/10 text-warning">
        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
        处理中
      </span>
    );
    if (status === 'FAILED') return <span className="px-2 py-0.5 rounded-full text-xs bg-error/10 text-error">失败</span>;
    if (status === 'FALLBACK') return <span className="px-2 py-0.5 rounded-full text-xs bg-info/10 text-info">已提取(默认)</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-surface-container text-on-surface-variant">{status}</span>;
  };

  const clearFilters = () => {
    setKnowledgePointId('');
    setDifficultyMin('');
    setDifficultyMax('');
    setStatus('');
    setPagination(p => ({ ...p, page: 1 }));
  };

  return (
    <div className="space-y-6">
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-on-surface">题目管理</h3>
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
          onClick={handleBatchExtract}
          disabled={!canEdit || extracting || hasInProgress}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all",
            "bg-primary text-on-primary",
            "hover:scale-105 active:scale-95",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          )}
        >
          <MaterialIcon icon={hasInProgress ? "hourglass_top" : extracting ? "hourglass_empty" : "play_arrow"} className={cn("w-4 h-4", (hasInProgress || extracting) && "animate-spin")} />
          {hasInProgress ? '生成中...' : extracting ? '提交中...' : '批量提取复杂度'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-low rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-on-surface-variant">
          <MaterialIcon icon="filter_list" className="w-4 h-4" />
          筛选条件
          <button onClick={clearFilters} className={cn(
            "ml-auto text-primary hover:underline text-xs",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          )}>
            清除筛选
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="知识点ID"
            value={knowledgePointId}
            onChange={e => { setKnowledgePointId(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm"
          />
          <input
            type="number"
            placeholder="难度最小"
            value={difficultyMin}
            onChange={e => { setDifficultyMin(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm"
          />
          <input
            type="number"
            placeholder="难度最大"
            value={difficultyMax}
            onChange={e => { setDifficultyMax(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm"
          />
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm"
          >
            <option value="">全部状态</option>
            <option value="PENDING">待提取</option>
            <option value="SUCCESS">已提取</option>
            <option value="FAILED">失败</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-low rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">
            <MaterialIcon icon="inbox" className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-bold">暂无题目</p>
            <p className="text-sm mt-1">尝试调整筛选条件</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-on-surface-variant uppercase border-b border-outline-variant/10">
                  <th className="p-4 text-left">难度</th>
                  <th className="p-4 text-left">类型</th>
                  <th className="p-4 text-left">认知负荷</th>
                  <th className="p-4 text-left">推理深度</th>
                  <th className="p-4 text-left">状态</th>
                  <th className="p-4 text-left">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {questions.map(q => (
                  <tr key={q.id} className="border-t border-outline-variant/10 hover:bg-surface-container transition-colors">
                    <td className="p-4 text-sm font-bold text-on-surface">{q.difficulty}</td>
                    <td className="p-4 text-sm text-on-surface-variant">{getTypeName(q.type)}</td>
                    <td className="p-4">
                      {editingId === q.id && editingField === 'cognitiveLoad' ? (
                        <input
                          ref={editInputRef}
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={editValue ?? ''}
                          onChange={e => setEditValue(parseFloat(e.target.value) || null)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleSaveEdit}
                          className="w-20 px-2 py-1 text-sm rounded bg-surface-container text-on-surface"
                        />
                      ) : (
                        <span
                          onClick={() => canEdit && handleStartEdit(q, 'cognitiveLoad')}
                          className={cn(
                            "text-sm cursor-pointer hover:underline",
                            canEdit ? "text-primary" : "text-on-surface-variant"
                          )}
                        >
                          {q.cognitiveLoad?.toFixed(2) ?? '-'}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {editingId === q.id && editingField === 'reasoningDepth' ? (
                        <input
                          ref={editInputRef}
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={editValue ?? ''}
                          onChange={e => setEditValue(parseFloat(e.target.value) || null)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleSaveEdit}
                          className="w-20 px-2 py-1 text-sm rounded bg-surface-container text-on-surface"
                        />
                      ) : (
                        <span
                          onClick={() => canEdit && handleStartEdit(q, 'reasoningDepth')}
                          className={cn(
                            "text-sm cursor-pointer hover:underline",
                            canEdit ? "text-primary" : "text-on-surface-variant"
                          )}
                        >
                          {q.reasoningDepth?.toFixed(2) ?? '-'}
                        </span>
                      )}
                    </td>
                    <td className="p-4">{getStatusBadge(q.extractionStatus)}</td>
                    <td className="p-4 text-xs text-on-surface-variant">
                      {new Date(q.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t border-outline-variant/10">
              <span className="text-sm text-on-surface-variant">
                共 {pagination.total} 条，第 {pagination.page}/{pagination.totalPages} 页
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 rounded-full bg-surface-container text-sm disabled:opacity-50"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 rounded-full bg-surface-container text-sm disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
