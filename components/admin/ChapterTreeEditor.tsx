'use client';

import { useState, useEffect } from 'react';

interface Chapter {
  id: string;
  chapterNumber: number;
  chapterName: string;
  sectionNumber: number | null;
  sectionName: string | null;
  sort: number;
  _count: { knowledgePoints: number };
}

interface ChapterTreeEditorProps {
  textbookId: string;
  onSelect: (id: string | null) => void;
  canEdit: boolean;
}

export default function ChapterTreeEditor({ textbookId, onSelect, canEdit }: ChapterTreeEditorProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ chapterNumber: 1, chapterName: '' });

  useEffect(() => {
    fetch(`/api/admin/chapters?textbookId=${textbookId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setChapters(data.data);
      })
      .finally(() => setLoading(false));
  }, [textbookId]);

  const handleCreate = async () => {
    const res = await fetch('/api/admin/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, textbookId })
    });
    if (res.ok) {
      const data = await res.json();
      setChapters([...chapters, data.data]);
      setShowModal(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-on-surface">章节管理</h3>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-bold"
          >
            新建章节
          </button>
        )}
      </div>

      <div className="space-y-2">
        {chapters.map(ch => (
          <div
            key={ch.id}
            className="bg-surface-container rounded-xl p-4 cursor-pointer hover:bg-surface-container-high transition-colors"
            onClick={() => onSelect(ch.id)}
          >
            <div className="flex justify-between">
              <p className="font-bold text-on-surface">
                第{ch.chapterNumber}章 {ch.chapterName}
              </p>
              <span className="text-sm text-on-surface-variant">
                {ch._count.knowledgePoints} 知识点
              </span>
            </div>
          </div>
        ))}
      </div>

      {chapters.length === 0 && (
        <div className="text-center py-8 text-on-surface-variant">
          暂无章节，请点击"新建章节"添加
        </div>
      )}

      {/* 创建弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-96">
            <h4 className="font-bold mb-4">新建章节</h4>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="章节号"
                value={form.chapterNumber}
                onChange={e => setForm({ ...form, chapterNumber: parseInt(e.target.value) })}
                className="w-full p-2 rounded-lg bg-surface-container text-on-surface"
              />
              <input
                placeholder="章节名称"
                value={form.chapterName}
                onChange={e => setForm({ ...form, chapterName: e.target.value })}
                className="w-full p-2 rounded-lg bg-surface-container text-on-surface"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-full bg-surface-container">取消</button>
              <button onClick={handleCreate} className="flex-1 py-2 rounded-full bg-primary text-on-primary">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
