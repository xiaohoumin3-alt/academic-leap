import { prisma } from '@/lib/prisma';

export async function WeightMonitor() {
  const questions = await prisma.question.findMany({
    where: {
      extractionStatus: 'SUCCESS',
      complexity: { not: null },
    },
    select: {
      cognitiveLoad: true,
      reasoningDepth: true,
      complexity: true,
    },
    take: 5000,
  });

  // Calculate correlation and weights
  const n = questions.length;
  if (n === 0) {
    return <div className="text-gray-500">暂无数据</div>;
  }

  // Means
  const avgCog = questions.reduce((s, q) => s + (q.cognitiveLoad || 0), 0) / n;
  const avgRea = questions.reduce((s, q) => s + (q.reasoningDepth || 0), 0) / n;
  const avgCom = questions.reduce((s, q) => s + (q.complexity || 0), 0) / n;

  // Covariance
  let covCogCom = 0;
  let covReaCom = 0;
  let varCog = 0;
  let varRea = 0;

  for (const q of questions) {
    const diffCog = (q.cognitiveLoad || 0) - avgCog;
    const diffRea = (q.reasoningDepth || 0) - avgRea;
    const diffCom = (q.complexity || 0) - avgCom;

    covCogCom += diffCog * diffCom;
    covReaCom += diffRea * diffCom;
    varCog += diffCog * diffCog;
    varRea += diffRea * diffRea;
  }

  covCogCom /= n;
  covReaCom /= n;
  varCog /= n;
  varRea /= n;

  // Correlation coefficients
  const corrCog = varCog > 0 ? covCogCom / Math.sqrt(varCog) : 0;
  const corrRea = varRea > 0 ? covReaCom / Math.sqrt(varRea) : 0;

  // Normalize to weights (sum = 1)
  const totalAbs = Math.abs(corrCog) + Math.abs(corrRea);
  const weightCog = totalAbs > 0 ? Math.abs(corrCog) / totalAbs : 0.5;
  const weightRea = totalAbs > 0 ? Math.abs(corrRea) / totalAbs : 0.5;

  return (
    <div className="space-y-6">
      {/* Correlation Analysis */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">相关性分析</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-gray-600">认知负荷相关性</div>
            <div className="text-3xl font-bold mt-1">{corrCog.toFixed(3)}</div>
            <div className={`text-sm mt-1 ${corrCog > 0.3 ? 'text-green-600' : corrCog > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
              {corrCog > 0.3 ? '强正相关' : corrCog > 0 ? '弱正相关' : '负相关'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">推理深度相关性</div>
            <div className="text-3xl font-bold mt-1">{corrRea.toFixed(3)}</div>
            <div className={`text-sm mt-1 ${corrRea > 0.3 ? 'text-green-600' : corrRea > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
              {corrRea > 0.3 ? '强正相关' : corrRea > 0 ? '弱正相关' : '负相关'}
            </div>
          </div>
        </div>
      </div>

      {/* Weight Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">权重分布</h3>
        <div className="flex items-center gap-4 h-8">
          <div
            className="bg-blue-500 h-full rounded-l-lg flex items-center justify-center text-white text-sm font-medium"
            style={{ width: `${weightCog * 100}%` }}
          >
            {weightCog > 0.15 && `${(weightCog * 100).toFixed(0)}%`}
          </div>
          <div
            className="bg-green-500 h-full rounded-r-lg flex items-center justify-center text-white text-sm font-medium"
            style={{ width: `${weightRea * 100}%` }}
          >
            {weightRea > 0.15 && `${(weightRea * 100).toFixed(0)}%`}
          </div>
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>认知负荷</span>
          <span>推理深度</span>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">统计摘要</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-600">样本数量</div>
            <div className="font-semibold">{n}</div>
          </div>
          <div>
            <div className="text-gray-600">平均认知负荷</div>
            <div className="font-semibold">{avgCog.toFixed(3)}</div>
          </div>
          <div>
            <div className="text-gray-600">平均推理深度</div>
            <div className="font-semibold">{avgRea.toFixed(3)}</div>
          </div>
          <div>
            <div className="text-gray-600">平均综合复杂度</div>
            <div className="font-semibold">{avgCom.toFixed(3)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
