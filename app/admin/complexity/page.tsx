import { Suspense } from 'react';
import { ComplexityStats } from './complexity-stats';
import { ComplexityDistribution } from './complexity-distribution';
import { ExtractionActions } from './extraction-actions';

export default function ComplexityPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">题目特征管理</h1>
        <p className="text-gray-600 mt-2">查看和管理题目复杂度特征提取状态</p>
      </div>

      <Suspense fallback={<div>加载中...</div>}>
        <ComplexityStats />
      </Suspense>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<div>加载分布图...</div>}>
          <ComplexityDistribution />
        </Suspense>
      </div>

      <div className="mt-8">
        <Suspense fallback={<div>加载操作...</div>}>
          <ExtractionActions />
        </Suspense>
      </div>
    </div>
  );
}
