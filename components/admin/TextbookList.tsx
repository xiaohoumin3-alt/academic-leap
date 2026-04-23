'use client';

import { useState, useEffect } from 'react';

interface Textbook {
  id: string;
  name: string;
  publisher: string | null;
  grade: number;
  subject: string;
  year: string | null;
  status: string;
  _count: { chapters: number };
}

interface TextbookListProps {
  onSelect: (id: string | null) => void;
  canEdit: boolean;
}

export default function TextbookList({ onSelect, canEdit }: TextbookListProps) {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', publisher: '', grade: 8, subject: '数学', year: '2024' });
  const subjects = ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];

  useEffect(() => {
    fetch('/api/admin/textbooks')
      .then(res => res.json())
      .then(data => {
        if (data.success) setTextbooks(data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const res = await fetch('/api/admin/textbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      const data = await res.json();
      setTextbooks([...textbooks, data.data]);
      setShowModal(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-on-surface">教材库</h3>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-bold"
          >
            新建教材
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {textbooks.map(t => (
          <div
            key={t.id}
            className="bg-surface-container rounded-2xl p-4 cursor-pointer hover:bg-surface-container-high transition-colors"
            onClick={() => onSelect(t.id)}
          >
            <div className="flex justify-between">
              <div>
                <p className="font-bold text-on-surface">{t.name}</p>
                <p className="text-sm text-on-surface-variant">{t.grade}年级 · {t.subject}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-on-surface-variant">{t._count.chapters} 章节</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {textbooks.length === 0 && (
        <div className="text-center py-8 text-on-surface-variant">
          暂无教材，请点击"新建教材"添加
        </div>
      )}

      {/* 创建弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-96">
            <h4 className="font-bold mb-4">新建教材</h4>
            <div className="space-y-3">
              <input
                placeholder="教材名称"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full p-2 rounded-lg bg-surface-container text-on-surface"
              />
              <input
                placeholder="出版社"
                value={form.publisher}
                onChange={e => setForm({ ...form, publisher: e.target.value })}
                className="w-full p-2 rounded-lg bg-surface-container text-on-surface"
              />
              <input
                type="number"
                placeholder="年级"
                value={form.grade}
                onChange={e => setForm({ ...form, grade: parseInt(e.target.value) })}
                className="w-full p-2 rounded-lg bg-surface-container text-on-surface"
              />
              <select
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
                className="w-full p-2 rounded-lg bg-surface-container text-on-surface"
              >
                {subjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                placeholder="年份"
                value={form.year}
                onChange={e => setForm({ ...form, year: e.target.value })}
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