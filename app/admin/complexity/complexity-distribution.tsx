import { prisma } from '@/lib/prisma';

export async function ComplexityDistribution() {
  const questions = await prisma.question.findMany({
    where: { extractionStatus: 'SUCCESS' },
    select: { complexity: true },
  });

  // Create histogram buckets
  const buckets = 10;
  const histogram = Array(buckets).fill(0);

  for (const q of questions) {
    if (q.complexity !== null) {
      const bucketIndex = Math.min(Math.floor(q.complexity * buckets), buckets - 1);
      histogram[bucketIndex]++;
    }
  }

  const maxCount = Math.max(...histogram, 1);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">复杂度分布直方图</h3>
      <div className="flex items-end gap-1 h-48">
        {histogram.map((count, i) => {
          const rangeStart = (i / buckets).toFixed(1);
          const rangeEnd = ((i + 1) / buckets).toFixed(1);
          const height = (count / maxCount) * 100;

          return (
            <div key={i} className="flex-1 flex flex-col items-center group">
              <div className="w-full bg-blue-500 rounded-t relative min-h-[4px]" style={{ height: `${height}%` }}>
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {count} 题
                </div>
              </div>
              <div className="text-xs mt-2 text-gray-600 rotate-45 origin-bottom-left h-4">
                {rangeStart}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-between text-sm text-gray-600">
        <span>低复杂度 (0.0)</span>
        <span>高复杂度 (1.0)</span>
      </div>
    </div>
  );
}
