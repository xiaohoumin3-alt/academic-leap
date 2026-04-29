import { prisma } from '@/lib/prisma';

export async function ComplexityStats() {
  const [pending, success, failed, avgResult, distribution] = await Promise.all([
    prisma.question.count({ where: { extractionStatus: 'PENDING' } }),
    prisma.question.count({ where: { extractionStatus: 'SUCCESS' } }),
    prisma.question.count({ where: { extractionStatus: 'FAILED' } }),
    prisma.question.aggregate({
      where: { extractionStatus: 'SUCCESS', cognitiveLoad: { not: null } },
      _avg: {
        cognitiveLoad: true,
        reasoningDepth: true,
        complexity: true,
      },
    }),
    prisma.$queryRaw`
      SELECT
        CASE
          WHEN complexity < 0.3 THEN 'low'
          WHEN complexity < 0.7 THEN 'medium'
          ELSE 'high'
        END as level,
        COUNT(*) as count
      FROM "Question"
      WHERE "extractionStatus" = 'SUCCESS'
      GROUP BY level
    `,
  ]);

  const total = pending + success + failed;
  const stats = avgResult._avg;

  const dist = distribution as Array<{ level: string; count: bigint }>;
  const distMap = Object.fromEntries(dist.map(d => [d.level, Number(d.count)]));

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-3xl font-bold text-blue-600">{total}</div>
        <div className="text-gray-600 mt-1">总题目数</div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-3xl font-bold text-green-600">{success}</div>
        <div className="text-gray-600 mt-1">已提取特征</div>
        <div className="text-sm text-gray-500 mt-2">
          占比 {total > 0 ? ((success / total) * 100).toFixed(1) : 0}%
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-3xl font-bold text-yellow-600">{pending}</div>
        <div className="text-gray-600 mt-1">待提取</div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-3xl font-bold text-red-600">{failed}</div>
        <div className="text-gray-600 mt-1">提取失败</div>
      </div>

      <div className="md:col-span-4 bg-white rounded-lg shadow p-6 mt-4">
        <h3 className="text-lg font-semibold mb-4">平均特征值</h3>
        <div className="grid grid-cols-3 gap-8">
          <div>
            <div className="text-sm text-gray-600">认知负荷 (cognitiveLoad)</div>
            <div className="text-2xl font-bold mt-1">{stats?.cognitiveLoad?.toFixed(3) || '-'}</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${((stats?.cognitiveLoad || 0) * 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600">推理深度 (reasoningDepth)</div>
            <div className="text-2xl font-bold mt-1">{stats?.reasoningDepth?.toFixed(3) || '-'}</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${((stats?.reasoningDepth || 0) * 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600">综合复杂度 (complexity)</div>
            <div className="text-2xl font-bold mt-1">{stats?.complexity?.toFixed(3) || '-'}</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-purple-600 h-2 rounded-full"
                style={{ width: `${((stats?.complexity || 0) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="md:col-span-4 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">复杂度分布</h3>
        <div className="flex items-end gap-4 h-40">
          <div className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-green-500 rounded-t-lg"
              style={{ height: `${(distMap.low || 0) / Math.max(success, 1) * 100}%`, minHeight: '20px' }}
            />
            <div className="text-sm mt-2">低 ({distMap.low || 0})</div>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-yellow-500 rounded-t-lg"
              style={{ height: `${(distMap.medium || 0) / Math.max(success, 1) * 100}%`, minHeight: '20px' }}
            />
            <div className="text-sm mt-2">中 ({distMap.medium || 0})</div>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-red-500 rounded-t-lg"
              style={{ height: `${(distMap.high || 0) / Math.max(success, 1) * 100}%`, minHeight: '20px' }}
            />
            <div className="text-sm mt-2">高 ({distMap.high || 0})</div>
          </div>
        </div>
      </div>
    </div>
  );
}
