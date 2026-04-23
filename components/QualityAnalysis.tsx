'use client';

import React, { useState } from 'react';
import MaterialIcon from './MaterialIcon';
import { motion } from 'motion/react';

interface QualityCheckProps {
  onRunCheck?: (type: string) => void;
}

const QualityAnalysis: React.FC<QualityCheckProps> = ({ onRunCheck }) => {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({
    infinite_solution: { status: 'pending', issues: [] },
    duplicate: { status: 'pending', issues: [] },
    symbol_conflict: { status: 'pending', issues: [] }
  });

  const checks = [
    {
      id: 'infinite_solution',
      title: '无限解检测',
      description: '检测方程模板是否可能产生 0=0 或恒等式的情况',
      icon: 'science',
      severity: 'high'
    },
    {
      id: 'duplicate',
      title: '冗余题检测',
      description: '检测语义重复度 > 0.9 的自动生成题',
      icon: 'content_copy',
      severity: 'medium'
    },
    {
      id: 'symbol_conflict',
      title: '符号冲突检测',
      description: '检查分数与除法符号的显示冲突',
      icon: 'warning',
      severity: 'low'
    }
  ];

  const runCheck = async (checkId: string) => {
    setRunning(checkId);
    setResults(prev => ({
      ...prev,
      [checkId]: { status: 'running', issues: [] }
    }));

    // 模拟检测过程
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 模拟结果
    const mockResults: Record<string, any> = {
      infinite_solution: {
        status: 'passed',
        issues: []
      },
      duplicate: {
        status: 'warning',
        issues: [
          { templateId: 'tpl_001', similarity: 0.92, desc: '一元一次方程与线性方程高度相似' },
          { templateId: 'tpl_005', similarity: 0.88, desc: '几何求角与角度计算可能重复' }
        ]
      },
      symbol_conflict: {
        status: 'passed',
        issues: []
      }
    };

    setResults(prev => ({
      ...prev,
      [checkId]: mockResults[checkId as keyof typeof mockResults]
    }));
    setRunning(null);
  };

  const runAllChecks = async () => {
    for (const check of checks) {
      await runCheck(check.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'bg-primary/10 text-primary';
      case 'warning': return 'bg-tertiary-container/10 text-tertiary';
      case 'error': return 'bg-error-container/10 text-error';
      case 'running': return 'bg-secondary-container/10 text-secondary';
      default: return 'bg-surface-variant/10 text-on-surface-variant';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'passed': return '通过';
      case 'warning': return '警告';
      case 'error': return '错误';
      case 'running': return '检测中...';
      default: return '待检测';
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-display font-black text-on-surface">质量分析</h3>
          <p className="text-sm text-on-surface-variant mt-1">自动检测模板中的常见问题</p>
        </div>
        <button
          onClick={runAllChecks}
          disabled={running !== null}
          className="px-6 py-3 bg-primary text-on-primary rounded-full font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {running ? (
            <>
              <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              检测中...
            </>
          ) : (
            <>
              <MaterialIcon icon="play_arrow" className="w-5 h-5" />
              运行全部检测
            </>
          )}
        </button>
      </div>

      {/* 检测卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {checks.map((check) => {
          const result = results[check.id];
          return (
            <motion.div
              key={check.id}
              whileHover={{ scale: 1.02 }}
              className={`bg-surface-container-lowest rounded-2xl p-6 border-2 transition-all ${
                result?.status === 'warning' ? 'border-tertiary/30' :
                result?.status === 'error' ? 'border-error/30' :
                result?.status === 'passed' ? 'border-primary/30' :
                'border-transparent'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  result?.status === 'warning' ? 'bg-tertiary-container' :
                  result?.status === 'error' ? 'bg-error-container' :
                  'bg-primary/10'
                }`}>
                  <MaterialIcon
                    icon={check.icon}
                    className={`w-6 h-6 ${
                      result?.status === 'warning' ? 'text-on-tertiary-container' :
                      result?.status === 'error' ? 'text-on-error' :
                      'text-primary'
                    }`}
                  />
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${getStatusColor(result?.status || 'pending')}`}>
                  {getStatusLabel(result?.status || 'pending')}
                </span>
              </div>

              <h4 className="font-display font-bold text-on-surface mb-2">{check.title}</h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">{check.description}</p>

              {result?.issues && result.issues.length > 0 && (
                <div className="mt-4 space-y-2">
                  {result.issues.map((issue: any, i: number) => (
                    <div key={i} className="bg-tertiary-container/10 rounded-xl p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-tertiary">{issue.templateId}</span>
                        <span className="text-xs text-on-surface-variant">{issue.similarity}% 相似</span>
                      </div>
                      <p className="text-xs text-on-surface-variant">{issue.desc}</p>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => runCheck(check.id)}
                disabled={running === check.id}
                className="w-full mt-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {running === check.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-on-surface border-t-transparent rounded-full animate-spin" />
                    检测中...
                  </>
                ) : (
                  <>
                    <MaterialIcon icon="refresh" className="w-4 h-4" />
                    重新检测
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* 检测统计 */}
      <div className="bg-surface-container-lowest rounded-2xl p-6">
        <h4 className="font-bold text-on-surface mb-4">检测统计</h4>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-display font-black text-primary">{Object.values(results).filter(r => r.status === 'passed').length}</p>
            <p className="text-xs text-on-surface-variant">通过</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-display font-black text-tertiary">{Object.values(results).filter(r => r.status === 'warning').length}</p>
            <p className="text-xs text-on-surface-variant">警告</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-display font-black text-error">{Object.values(results).filter(r => r.status === 'error').length}</p>
            <p className="text-xs text-on-surface-variant">错误</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-display font-black text-on-surface-variant">{Object.values(results).filter(r => r.issues?.length > 0).reduce((sum, r) => sum + r.issues.length, 0)}</p>
            <p className="text-xs text-on-surface-variant">发现问题</p>
          </div>
        </div>
      </div>

      {/* 导出报告 */}
      <div className="flex justify-end">
        <button className="px-6 py-3 bg-surface-container-low rounded-full font-bold flex items-center gap-2 hover:bg-surface-container-high transition-colors">
          <MaterialIcon icon="download" className="w-5 h-5" />
          导出检测报告
        </button>
      </div>
    </div>
  );
};

export default QualityAnalysis;
