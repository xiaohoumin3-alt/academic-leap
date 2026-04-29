import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

async function runExtraction() {
  'use server';
  // Trigger extraction in background
  const { spawn } = require('child_process');
  spawn('npx', ['tsx', 'scripts/extract-stable.ts'], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
  }).unref();
  revalidatePath('/admin/complexity');
}

async function resetCheckpoints() {
  'use server';
  const fs = require('fs');
  try {
    fs.unlinkSync('/tmp/extract-checkpoint.txt');
  } catch {}
  revalidatePath('/admin/complexity');
}

async function markAllPending() {
  'use server';
  await prisma.question.updateMany({
    where: { extractionStatus: { in: ['FAILED', 'SUCCESS'] } },
    data: {
      extractionStatus: 'PENDING',
      cognitiveLoad: null,
      reasoningDepth: null,
      complexity: null,
      featuresExtractedAt: null,
    },
  });
  revalidatePath('/admin/complexity');
}

export async function ExtractionActions() {
  const stats = await prisma.question.groupBy({
    by: ['extractionStatus'],
    _count: true,
  });

  const pending = stats.find(s => s.extractionStatus === 'PENDING')?._count || 0;
  const processing = stats.find(s => s.extractionStatus === 'PROCESSING')?._count || 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">提取操作</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{pending}</div>
          <div className="text-sm text-gray-600">待提取</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{processing}</div>
          <div className="text-sm text-gray-600">处理中</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">
            使用 MiniMax API 代理服务
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <form action={runExtraction}>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={pending === 0}
          >
            开始提取 (后台运行)
          </button>
        </form>

        <form action={resetCheckpoints}>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            重置检查点
          </button>
        </form>

        <form action={markAllPending}>
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            全部重置
          </button>
        </form>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        <p>• 提取在后台运行，可以关闭此页面</p>
        <p>• 检查点每 10 题自动保存</p>
        <p>• 查看日志: tail -f /tmp/extract-stable.log</p>
      </div>
    </div>
  );
}
