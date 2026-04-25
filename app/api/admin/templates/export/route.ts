import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/templates/export
 *
 * 导出模板与知识点的关联关系为 CSV
 */
export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      where: {
        status: { not: 'draft' }
      },
      include: {
        knowledge: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // CSV 表头
    const headers = [
      'template_id',
      'template_name',
      'template_type',
      'concept_id',
      'concept_name'
    ];

    // CSV 行数据
    const escapeCSV = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows = templates.map(t => [
      escapeCSV(t.id),
      escapeCSV(t.name || ''),
      escapeCSV(t.type),
      escapeCSV(t.knowledgeId || ''),
      escapeCSV(t.knowledge?.name || '')
    ]);

    // 构建 CSV
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const filename = `template-knowledge-mapping-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error('导出失败:', error);
    return NextResponse.json({
      success: false,
      error: '导出失败'
    }, { status: 500 });
  }
}
