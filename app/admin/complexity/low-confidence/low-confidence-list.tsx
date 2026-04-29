import { prisma } from '@/lib/prisma';

async function updateFeature(id: string, field: string, value: number) {
  'use server';
  await prisma.question.update({
    where: { id },
    data: { [field]: value },
  });
}

async function markReviewed(id: string) {
  'use server';
  await prisma.question.update({
    where: { id },
    data: { extractionStatus: 'REVIEWED' },
  });
}

export async function LowConfidenceList() {
  // Get questions where features might need review:
  // 1. High complexity but low individual scores (inconsistent)
  // 2. Very low or very high scores (outliers)
  const questions = await prisma.question.findMany({
    where: {
      extractionStatus: 'SUCCESS',
      complexity: { not: null },
    },
    select: {
      id: true,
      content: true,
      cognitiveLoad: true,
      reasoningDepth: true,
      complexity: true,
    },
    take: 100,
    orderBy: { complexity: 'desc' },
  });

  // Flag questions that need review
  const flagged = questions.filter(q => {
    const cog = q.cognitiveLoad || 0;
    const rea = q.reasoningDepth || 0;
    const com = q.complexity || 0;

    // Flag if inconsistency: high complexity but low individual scores
    if (com > 0.8 && (cog < 0.5 || rea < 0.5)) return true;

    // Flag if extreme values
    if (com > 0.95 || com < 0.05) return true;

    // Flag if large gap between individual scores
    if (Math.abs(cog - rea) > 0.5) return true;

    return false;
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">
            需要审核: <span className="font-bold text-red-600">{flagged.length}</span> 题
          </span>
          <span className="text-sm text-gray-500">
            已扫描: {questions.length} 题
          </span>
        </div>
      </div>

      {flagged.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          没有需要审核的题目
        </div>
      ) : (
        <div className="space-y-4">
          {flagged.map((q) => {
            let contentPreview = '';
            try {
              const parsed = JSON.parse(q.content);
              contentPreview = parsed.question?.text || parsed.text || q.content.substring(0, 100);
            } catch {
              contentPreview = q.content.substring(0, 100);
            }

            const cog = q.cognitiveLoad || 0;
            const rea = q.reasoningDepth || 0;
            const com = q.complexity || 0;

            // Determine reason for flag
            let reason = '';
            if (com > 0.95) reason = '极高复杂度';
            else if (com < 0.05) reason = '极低复杂度';
            else if (com > 0.8 && (cog < 0.5 || rea < 0.5)) reason = '不一致: 高综合但低分项';
            else if (Math.abs(cog - rea) > 0.5) reason = '分项差距过大';

            return (
              <div key={q.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="text-sm text-red-600 font-medium mb-1">
                      {reason}
                    </div>
                    <div className="text-gray-800">
                      {contentPreview}
                      {contentPreview.length >= 100 && '...'}
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-2xl font-bold">{com.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">综合复杂度</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-600">认知负荷</div>
                    <div className="text-lg font-semibold">{cog.toFixed(3)}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-600">推理深度</div>
                    <div className="text-lg font-semibold">{rea.toFixed(3)}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-600">综合复杂度</div>
                    <div className="text-lg font-semibold">{com.toFixed(3)}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => markReviewed(q.id)}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    标记已审核
                  </button>
                  <button
                    onClick={() => {
                      const newVal = prompt('输入新的认知负荷 (0-1):', cog.toFixed(3));
                      if (newVal) updateFeature(q.id, 'cognitiveLoad', parseFloat(newVal));
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    修改认知负荷
                  </button>
                  <button
                    onClick={() => {
                      const newVal = prompt('输入新的推理深度 (0-1):', rea.toFixed(3));
                      if (newVal) updateFeature(q.id, 'reasoningDepth', parseFloat(newVal));
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    修改推理深度
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
