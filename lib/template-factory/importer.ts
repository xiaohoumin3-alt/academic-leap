/**
 * 导入引擎 - 将预览数据写入数据库
 */

import { prisma } from '@/lib/prisma';
import type { PreviewResult } from './preview-engine';

export interface ImportOptions {
  createKnowledgePoints: boolean;
  createSkeletons: boolean;
  createTemplates: boolean;
}

export interface ImportResults {
  knowledgePoints: number;
  skeletons: number;
  templates: number;
}

/**
 * 从预览数据导入到数据库
 * 所有操作在事务中执行，确保原子性
 */
export async function importFromPreview(
  preview: PreviewResult,
  options: ImportOptions
): Promise<ImportResults> {
  const results: ImportResults = {
    knowledgePoints: 0,
    skeletons: 0,
    templates: 0
  };

  // 使用事务确保原子性
  await prisma.$transaction(async (tx) => {
    // 导入骨架（pending状态）
    if (options.createSkeletons) {
      for (const skeleton of preview.skeletons) {
        await tx.skeleton.upsert({
          where: { id: skeleton.id },
          update: {},
          create: {
            id: skeleton.id,
            stepType: skeleton.stepType,
            name: skeleton.name,
            config: {},
            status: 'pending',
            source: 'ai_generated'
          }
        });
        results.skeletons++;
      }
    }

    // 导入模板
    if (options.createTemplates) {
      // 获取或创建默认admin
      let admin = await tx.admin.findFirst();
      if (!admin) {
        const user = await tx.user.findFirst();
        if (user) {
          admin = await tx.admin.create({
            data: {
              userId: user.id,
              role: 'admin'
            }
          });
        }
      }

      if (admin) {
        for (const template of preview.templates) {
          await tx.template.upsert({
            where: { id: template.id },
            update: {
              skeletonIds: JSON.stringify(template.skeletonIds)
            },
            create: {
              id: template.id,
              name: template.name,
              type: 'calculation',
              templateKey: template.id,
              structure: { type: 'default' },
              params: { default: true },
              steps: [],
              skeletonIds: JSON.stringify(template.skeletonIds),
              source: 'ai_generated',
              status: 'production',
              createdBy: admin.id
            }
          });
          results.templates++;
        }
      }
    }
  });

  return results;
}