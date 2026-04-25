/**
 * 预览引擎 - 根据教材和题库内容生成预览数据
 * 支持知识点、骨架、模板的多层级预览
 */

import type { TextbookChapter, QuestionSample } from './types';

/**
 * 知识点预览
 */
export interface KnowledgePointPreview {
  id: string;
  name: string;
  weight: number;
  parentChapter: string;
}

/**
 * 骨架预览
 */
export interface SkeletonPreview {
  id: string;
  stepType: string;
  name: string;
  usageCount: number;
  status: 'new' | 'existing' | 'conflict';
}

/**
 * 模板预览
 */
export interface TemplatePreview {
  id: string;
  name: string;
  knowledgePoint: string;
  skeletonIds: string[];
  difficultyConfig: { level: number };
}

/**
 * 预览结果
 */
export interface PreviewResult {
  knowledgePoints: KnowledgePointPreview[];
  skeletons: SkeletonPreview[];
  templates: TemplatePreview[];
  conflicts: Array<{ type: string; message: string }>;
}

/**
 * 生成预览数据
 * @param textbook - 教材解析结果，包含章节和知识点信息
 * @param questions - 题库解析结果，包含题目示例
 * @returns 预览结果，包含知识点、骨架、模板及冲突信息
 */
export function generatePreview(
  textbook: { chapters: TextbookChapter[] } | null,
  questions: QuestionSample[] | null
): PreviewResult {
  const knowledgePoints: KnowledgePointPreview[] = [];
  const skeletons: SkeletonPreview[] = [];
  const templates: TemplatePreview[] = [];
  const conflicts: Array<{ type: string; message: string }> = [];

  // 从教材生成知识点预览
  if (textbook) {
    textbook.chapters.forEach((chapter) => {
      chapter.knowledgePoints.forEach((kp, idx) => {
        knowledgePoints.push({
          id: `kp-${chapter.number}-${idx + 1}`,
          name: kp.name,
          weight: kp.weight,
          parentChapter: chapter.name
        });
      });
    });
  }

  // 从题库生成骨架和模板预览
  if (questions) {
    const stepTypeCount: Record<string, number> = {};

    questions.forEach((q, idx) => {
      stepTypeCount[q.stepType] = (stepTypeCount[q.stepType] || 0) + 1;

      templates.push({
        id: `template-${idx + 1}`,
        name: q.knowledgePoint,
        knowledgePoint: q.knowledgePoint,
        skeletonIds: [q.stepType.toLowerCase()],
        difficultyConfig: { level: q.difficulty }
      });
    });

    // 汇总骨架统计
    Object.entries(stepTypeCount).forEach(([stepType, count]) => {
      skeletons.push({
        id: stepType.toLowerCase(),
        stepType,
        name: stepType.replace(/_/g, ' '),
        usageCount: count,
        status: 'new'
      });
    });
  }

  return { knowledgePoints, skeletons, templates, conflicts };
}