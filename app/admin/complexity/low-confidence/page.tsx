import { Suspense } from 'react';
import { LowConfidenceList } from './low-confidence-list';

export default function LowConfidencePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">低置信度审核</h1>
        <p className="text-gray-600 mt-2">审核需要人工确认的题目特征提取结果</p>
      </div>

      <Suspense fallback={<div>加载中...</div>}>
        <LowConfidenceList />
      </Suspense>
    </div>
  );
}
