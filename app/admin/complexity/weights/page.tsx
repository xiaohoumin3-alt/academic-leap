import { Suspense } from 'react';
import { WeightMonitor } from './weight-monitor';

export default function WeightsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">特征权重监控</h1>
        <p className="text-gray-600 mt-2">监控各特征对综合复杂度的贡献度</p>
      </div>

      <Suspense fallback={<div>加载中...</div>}>
        <WeightMonitor />
      </Suspense>
    </div>
  );
}
