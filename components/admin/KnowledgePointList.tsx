'use client';

import { useState, useEffect } from 'react';

interface KnowledgePoint {
  id: string;
  name: string;
  weight: number;
  inAssess: boolean;
  status: string;
  concept: { id: string; name: string; weight: number };
}

interface Concept {
  id: string;
  name: string;
  category: string | null;
  weight: number;
}

interface KnowledgePointListProps {
  chapterId: string;
  canEdit: boolean;
  canDelete: boolean;
}

export default function KnowledgePointList({ chapterId, canEdit, canDelete }: KnowledgePointListProps) {
  const [points, setPoints] = useState<KnowledgePoint[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', conceptId: '', weight: 0 });

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/knowledge-points?chapterId=${chapterId}`).then(r => r.json()),
      fetch('/api/admin/concepts').then(r => r.json())
    ]).then(([pointsData, conceptsData]) => {
      if (pointsData.success) setPoints(pointsData.data);
      if (conceptsData.success) setConcepts(conceptsData.data);
    }).finally(() => setLoading(false));
  }, [chapterId]);

  const handleCreate = async () => {
    const res = await fetch('/api/admin/knowledge-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, chapterId, inAssess: true, status: 'active' })
    });
    if (res.ok) {
      const data = await res.json();
      setPoints([...points, data.data]);
      setShowModal(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除?')) return;
    await fetch(`/api/admin/knowledge-points/${id}`, { method: 'DELETE' });
    setPoints(points.filter(p => p.id !== id));
  };

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-on-surface">知识点管理</h3>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-bold"
          >
            新建知识点
          </button>
        )}
      </div>

      <div className="bg-surface-container rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-on-surface-variant uppercase">
              <th className="p-4 text-left">名称</th>
              <th className="p-4 text-left">概念</th>
              <th className="p-4 text-left">权重</th>
              <th className="p-4 text-left">状态</th>
              {canDelete && <th className="p-4 text-right">操作</th>}
            </tr>
          </thead>
          <tbody>
            {points.map(p => (
              <tr key={p.id} className="border-t border-outline-variant/10">
                <td className="p-4 font-bold text-on-surface">{p.name}</td>
                <td className="p-4 text-on-surface-variant">{p.concept.name}</td>
                <td className="p-4">
                  <span className="text-primary">{p.weight > 0 ? p.weight : p.concept.weight}</span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    p.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-surface text-on-surface-variant'
                  }`}>
                    {p.status}
                  </span>
                </td>
                {canDelete && (
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-error hover:underline"
                    >
                      删除
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {points.length === 0 && (
        <div className="text-center py-8 text-on-surface-variant">
          暂无知识点，请点击"新建知识点"添加
        </div>
      )}

      {/* 创建弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-96">
            <h4 className="font-bold mb-4">新建知识点</h4>
            <div className="space-y-3">
              <input
                placeholder="知识点名称"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full p-2 rounded-lg bg-surface-container text-on-surface"
              />
              <select
                value={form.conceptId}
                onChange={e => setForm({ ...form, conceptId: e.target.value })}
                className="w-full p-2 rounded-lg bg-surface-container text-on-surface"
              >
                <option value="">选择概念...</option>
                {concepts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (权重: {c.weight})
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="权重 (0=使用概念权重)"
                value={form.weight}
                onChange={e => setForm({ ...form, weight: parseInt(e.target.value) || 0 })}
                className="w-full p-2 rounded-lg bg-surface-container text-on-surface"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-full bg-surface-container">取消</button>
              <button
                onClick={handleCreate}
                className="flex-1 py-2 rounded-full bg-primary text-on-primary"
                disabled={!form.name || !form.conceptId}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
