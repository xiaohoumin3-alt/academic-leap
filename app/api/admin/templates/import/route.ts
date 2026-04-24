import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 解析 CSV 为数组
 */
function parseCSV(csv: string): Array<{template_id: string; knowledge_point_id: string}> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  // 解析表头
  const headerLine = lines[0];
  const headerMatch = [...headerLine.matchAll(/("([^"]*)"|([^,]+))/g)];
  const headers = headerMatch.map(m => (m[2] || m[3] || '').trim());

  const templateIdIdx = headers.indexOf('template_id');
  const knowledgePointIdIdx = headers.indexOf('knowledge_point_id');

  if (templateIdIdx === -1) {
    throw new Error('CSV 格式错误：缺少 template_id 列');
  }

  const rows: Array<{template_id: string; knowledge_point_id: string}> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 简单 CSV 解析
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values[templateIdIdx]) {
      rows.push({
        template_id: values[templateIdIdx],
        knowledge_point_id: knowledgePointIdIdx >= 0 ? values[knowledgePointIdIdx] : ''
      });
    }
  }

  return rows;
}

/**
 * POST /api/admin/templates/import
 *
 * 从 CSV 导入模板与知识点的关联关系
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: '请上传文件'
      }, { status: 400 });
    }

    const csv = await file.text();
    const rows = parseCSV(csv);

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      if (!row.template_id) {
        skipped++;
        continue;
      }

      // 验证模板存在
      const template = await prisma.template.findUnique({
        where: { id: row.template_id }
      });

      if (!template) {
        skipped++;
        continue;
      }

      // 验证知识点存在（如果提供了）
      if (row.knowledge_point_id) {
        const kp = await prisma.knowledgePoint.findUnique({
          where: { id: row.knowledge_point_id }
        });

        if (!kp) {
          skipped++;
          continue;
        }
      }

      // 更新关联
      await prisma.template.update({
        where: { id: row.template_id },
        data: {
          knowledgeId: row.knowledge_point_id || null
        }
      });

      updated++;
    }

    return NextResponse.json({
      success: true,
      data: { total: rows.length, updated, skipped }
    });

  } catch (error) {
    console.error('导入失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '导入失败'
    }, { status: 500 });
  }
}
