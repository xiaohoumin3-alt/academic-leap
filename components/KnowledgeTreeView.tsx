// components/KnowledgeTreeView.tsx
'use client';

import { useState } from 'react';
import MaterialIcon from './MaterialIcon';

interface KnowledgePoint {
  id: string;
  name: string;
  conceptId: string;
  conceptName: string;
  enabled: boolean;
}

interface Chapter {
  id: string;
  chapterNumber: number;
  chapterName: string;
  enabled: boolean;
  knowledgePoints: KnowledgePoint[];
}

interface KnowledgeTreeViewProps {
  chapters: Chapter[];
  onToggle: (nodeId: string, nodeType: 'chapter' | 'point', enabled: boolean) => void;
  expandable?: boolean;
  weights?: Record<string, number>;
  onWeightChange?: (kpId: string, weight: number) => void;
}

export default function KnowledgeTreeView({
  chapters,
  onToggle,
  expandable = false,
  weights = {},
  onWeightChange,
}: KnowledgeTreeViewProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(chapters.slice(0, 3).map(c => c.id)) // 默认展开前3个
  );

  const toggleChapter = (chapterId: string) => {
    if (expandable) {
      setExpandedChapters(prev => {
        const next = new Set(prev);
        if (next.has(chapterId)) {
          next.delete(chapterId);
        } else {
          next.add(chapterId);
        }
        return next;
      });
    }
  };

  const toggleExpandAll = () => {
    if (expandedChapters.size === chapters.length) {
      setExpandedChapters(new Set());
    } else {
      setExpandedChapters(new Set(chapters.map(c => c.id)));
    }
  };

  return (
    <div className="space-y-2">
      {expandable && (
        <button
          onClick={toggleExpandAll}
          className="text-sm text-primary font-medium mb-4"
        >
          {expandedChapters.size === chapters.length ? '收起全部' : '展开全部'}
        </button>
      )}

      {chapters.map((chapter) => {
        const isExpanded = expandedChapters.has(chapter.id);
        const allPointsEnabled = chapter.knowledgePoints.every(p => p.enabled);
        const somePointsEnabled = chapter.knowledgePoints.some(p => p.enabled);

        return (
          <div key={chapter.id} className="bg-surface-container-low rounded-2xl overflow-hidden">
            <button
              onClick={() => toggleChapter(chapter.id)}
              className="w-full p-4 flex items-center gap-3"
            >
              <MaterialIcon
                icon={isExpanded ? 'expand_more' : 'chevron_right'}
                className="text-on-surface-variant"
                style={{ fontSize: '20px' }}
              />
              <input
                type="checkbox"
                checked={allPointsEnabled}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = somePointsEnabled && !allPointsEnabled;
                  }
                }}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggle(chapter.id, 'chapter', e.target.checked);
                }}
                className="w-5 h-5 rounded"
              />
              <span className="flex-1 text-left font-medium text-on-surface">
                第{chapter.chapterNumber}章 {chapter.chapterName}
              </span>
              <span className="text-sm text-on-surface-variant">
                {chapter.knowledgePoints.filter(p => p.enabled).length}/{chapter.knowledgePoints.length}
              </span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-2">
                {chapter.knowledgePoints.map((point) => (
                  <div
                    key={point.id}
                    className="flex items-center gap-3 p-3 bg-surface rounded-xl"
                  >
                    <div className="w-5" /> {/* spacer */}
                    <input
                      type="checkbox"
                      checked={point.enabled}
                      onChange={(e) => {
                        onToggle(point.id, 'point', e.target.checked);
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="flex-1 text-sm text-on-surface">
                      {point.name}
                    </span>
                    <span className="text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded-full">
                      {point.conceptName}
                    </span>
                    {onWeightChange && (
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-on-surface-variant">权重</span>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="0.5"
                          value={weights[point.id] ?? 3}
                          onChange={(e) => {
                            onWeightChange(point.id, parseFloat(e.target.value));
                          }}
                          className="w-16 h-1.5 bg-surface-container-high rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${((weights[point.id] ?? 3) - 1) / 4 * 100}%, var(--color-surface-container-high) ${((weights[point.id] ?? 3) - 1) / 4 * 100}%, var(--color-surface-container-high) 100%)`
                          }}
                        />
                        <span className="text-xs text-on-surface-variant w-4 text-center">
                          {weights[point.id] ?? 3}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
