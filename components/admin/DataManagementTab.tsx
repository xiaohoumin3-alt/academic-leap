'use client';

import { useState } from 'react';
import TextbookList from './TextbookList';
import ChapterTreeEditor from './ChapterTreeEditor';
import KnowledgePointList from './KnowledgePointList';

type DataSubTab = 'textbooks' | 'chapters' | 'points';

interface DataManagementTabProps {
  canEdit: boolean;
  canDelete: boolean;
}

export default function DataManagementTab({ canEdit, canDelete }: DataManagementTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<DataSubTab>('textbooks');
  const [selectedTextbook, setSelectedTextbook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* 子标签导航 */}
      <div className="flex gap-2">
        <button
          onClick={() => { setActiveSubTab('textbooks'); setSelectedChapter(null); }}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
            activeSubTab === 'textbooks'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant'
          }`}
        >
          教材管理
        </button>
        <button
          onClick={() => setActiveSubTab('chapters')}
          disabled={!selectedTextbook}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all disabled:opacity-50 ${
            activeSubTab === 'chapters'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant'
          }`}
        >
          章节管理
        </button>
        <button
          onClick={() => setActiveSubTab('points')}
          disabled={!selectedChapter}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all disabled:opacity-50 ${
            activeSubTab === 'points'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant'
          }`}
        >
          知识点管理
        </button>
      </div>

      {/* 子页面 */}
      {activeSubTab === 'textbooks' && (
        <TextbookList onSelect={setSelectedTextbook} canEdit={canEdit} />
      )}
      {activeSubTab === 'chapters' && selectedTextbook && (
        <ChapterTreeEditor
          textbookId={selectedTextbook}
          onSelect={setSelectedChapter}
          canEdit={canEdit}
        />
      )}
      {activeSubTab === 'points' && selectedChapter && (
        <KnowledgePointList chapterId={selectedChapter} canEdit={canEdit} canDelete={canDelete} />
      )}
    </div>
  );
}
