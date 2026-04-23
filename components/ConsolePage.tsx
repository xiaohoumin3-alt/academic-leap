'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MaterialIcon from './MaterialIcon';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useKnowledgePoints, useTemplates, useDifficultyMatrix, useWeightValidation, useAdminUser } from '@/lib/hooks/useAdminData';
import TemplateEditor from './TemplateEditor';
import QualityAnalysis from './QualityAnalysis';
import DataManagementTab from './admin/DataManagementTab';

interface ConsolePageProps {
  onExit: () => void;
}

type Tab = 'dashboard' | 'template' | 'difficulty' | 'data' | 'quality' | 'config';

const ConsolePage: React.FC<ConsolePageProps> = ({ onExit }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('data');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Admin User for permissions
  const { user: adminUser, canEdit, canDelete } = useAdminUser();

  // Knowledge Points Data
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{ subject?: string; status?: string; search?: string }>({});
  const { data: knowledgePoints, loading: kpLoading, total: kpTotal, refetch: kpRefetch, create, update, remove } = useKnowledgePoints(page, 20, filters);

  // Weight Validation
  const { isValid: weightValid, total: weightTotal, validate: validateWeight } = useWeightValidation();

  // Difficulty Matrix
  const { levels, anomalies, loading: diffLoading } = useDifficultyMatrix();

  // Templates
  const { data: templates, loading: tplLoading, refetch: tplRefetch } = useTemplates();

  // Edit Modal
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  // Template Editor
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const totalScore = knowledgePoints.filter((k: any) => k.inAssess).reduce((acc: number, curr: any) => acc + curr.weight, 0);

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsProcessing(false);
    showToast(msg, type);
  };

  const handleSaveKnowledge = async () => {
    setIsProcessing(true);
    try {
      if (editingItem?.id) {
        await update(editingItem.id, editForm);
        showToast('知识点已更新', 'success');
      } else {
        await create(editForm);
        showToast('知识点已创建', 'success');
      }
      setEditingItem(null);
      setEditForm({});
      kpRefetch();
    } catch (error: any) {
      showToast(error.message || '操作失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteKnowledge = async (id: string, name: string) => {
    if (!confirm(`确定要删除知识点"${name}"吗？`)) return;
    setIsProcessing(true);
    try {
      await remove(id);
      showToast('知识点已删除', 'success');
      kpRefetch();
    } catch (error: any) {
      showToast(error.message || '删除失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleAssess = async (item: any) => {
    setIsProcessing(true);
    try {
      await update(item.id, { inAssess: !item.inAssess });
      showToast('测评参与状态已更新', 'success');
      kpRefetch();
      validateWeight();
    } catch (error: any) {
      showToast(error.message || '操作失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Menu items based on role
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'editor', 'viewer'] },
    { id: 'template', label: '模板编辑器', icon: 'edit', roles: ['admin', 'editor'] },
    { id: 'difficulty', label: '难度校准', icon: 'trending_up', roles: ['admin', 'editor'] },
    { id: 'data', label: '知识点管理', icon: 'storage', roles: ['admin', 'editor', 'viewer'] },
    { id: 'quality', label: '质量分析', icon: 'verified_user', roles: ['admin', 'editor', 'viewer'] },
    { id: 'config', label: '分数地图', icon: 'hub', roles: ['admin', 'editor'] },
  ].filter(item => adminUser && item.roles.includes(adminUser.role));

  const renderContent = () => {
    switch (activeTab) {
      case 'data':
        return (
          <DataManagementTab canEdit={canEdit} canDelete={canDelete} />
        );
      case 'template':
        return editingTemplate ? (
          <TemplateEditor
            template={editingTemplate}
            onSave={(data) => {
              showToast('模板已保存', 'success');
              setEditingTemplate(null);
              tplRefetch();
            }}
            onCancel={() => setEditingTemplate(null)}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 bg-surface-container-lowest rounded-[2.5rem] p-6 overflow-y-auto max-h-[calc(100vh-250px)]">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-display font-black text-on-surface">模板列表 ({templates.length})</h4>
                <button
                  onClick={() => setEditingTemplate({})}
                  className="px-3 py-1.5 bg-primary text-on-primary rounded-full text-xs font-bold flex items-center gap-1"
                >
                  <MaterialIcon icon="add" className="w-3 h-3" />
                  新建
                </button>
              </div>
              <div className="space-y-3">
                {tplLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-center text-on-surface-variant py-8">暂无模板</p>
                ) : (
                  templates.map((t: any) => (
                    <div
                      key={t.id}
                      onClick={() => setEditingTemplate(t)}
                      className="p-4 rounded-3xl border bg-surface-container-low border-transparent hover:bg-surface-container-high cursor-pointer transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-black text-primary uppercase">{t.type}</span>
                        <span className="text-[10px] font-mono opacity-30">v{t.version}</span>
                      </div>
                      <p className="font-bold text-on-surface">{t.name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase",
                          t.status === 'production' ? "bg-primary/10 text-primary" :
                          t.status === 'staging' ? "bg-secondary/10 text-secondary" :
                          "bg-surface-variant text-on-surface-variant"
                        )}>{t.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-8 bg-surface-container-lowest rounded-[2.5rem] p-8">
              <div className="flex items-center justify-center h-64 text-on-surface-variant">
                <div className="text-center">
                  <MaterialIcon icon="edit_note" className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="font-bold">模板编辑器</p>
                  <p className="text-sm opacity-60 mt-2">选择左侧模板进行编辑或新建模板</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'difficulty':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-surface-container-lowest rounded-[2.5rem] p-8">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h4 className="text-xl font-display font-black text-on-surface">难度校准矩阵</h4>
                    <p className="text-xs text-on-surface-variant/60 mt-1">实时监控各级别准确率，及时发现异常断层</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-on-surface-variant/40 tracking-widest uppercase">Target: 60-80%</span>
                    <button
                      onClick={async () => {
                        showToast('AI 正在分析数据...', 'info');
                        await handleAction('调参建议已生成', 'success');
                      }}
                      className="px-4 py-2 bg-secondary text-on-secondary-container rounded-full text-sm font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
                    >
                      <MaterialIcon icon="auto_awesome" className="w-4 h-4" />
                      AI 调参建议
                    </button>
                  </div>
                </div>

                {diffLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {levels.map((row) => (
                      <div
                        key={row.level}
                        className={cn(
                          "grid grid-cols-6 gap-4 px-8 py-5 items-center rounded-3xl transition-all",
                          row.accuracy < 40 ? "bg-error-container/10 border-l-4 border-error" :
                          row.accuracy < 60 ? "bg-tertiary-container/10 border-l-4 border-tertiary" :
                          "bg-surface-container-low/40"
                        )}
                      >
                        <div className="font-display font-black text-xl text-on-surface">L{row.level}</div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-on-surface-variant">Accuracy</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-on-surface">{row.accuracy}%</span>
                            <div className="flex-1 h-1.5 bg-surface-variant rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", row.accuracy > 70 ? "bg-primary" : row.accuracy > 40 ? "bg-tertiary" : "bg-error")}
                                style={{ width: `${row.accuracy}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-on-surface-variant">Avg Time</span>
                          <span className="text-sm font-black text-on-surface">{row.avgTime}s</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-on-surface-variant">Retry Rate</span>
                          <span className="text-sm font-black text-on-surface">{row.retryRate}%</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black uppercase text-on-surface-variant">
                            {row.sampleCount} samples
                          </span>
                        </div>
                        <div className="flex justify-end">
                          {row.accuracy < 60 && (
                            <button
                              onClick={async () => {
                                showToast(`L${row.level} 参数已优化`, 'success');
                              }}
                              className="px-3 py-1.5 bg-tertiary text-on-tertiary-container rounded-full text-xs font-bold flex items-center gap-1"
                            >
                              <MaterialIcon icon="tune" className="w-3 h-3" />
                              调优
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-surface-container-lowest rounded-[2.5rem] p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-tertiary-container flex items-center justify-center">
                      <MaterialIcon icon="warning" className="w-5 h-5 text-on-tertiary-container" />
                    </div>
                    <h4 className="text-xl font-display font-black text-on-surface">异常检测</h4>
                  </div>
                </div>

                {anomalies.length === 0 ? (
                  <div className="text-center py-8">
                    <MaterialIcon icon="check_circle" className="w-12 h-12 mx-auto mb-3 text-primary opacity-50" />
                    <p className="text-on-surface-variant text-sm">未检测到异常</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {anomalies.map((anomaly, i) => (
                      <div key={i} className="bg-tertiary-container/10 p-4 rounded-2xl border-l-4 border-tertiary">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <MaterialIcon icon="warning" className="w-4 h-4 text-tertiary" />
                            <span className="text-xs font-black text-tertiary uppercase">Anomaly #{i + 1}</span>
                          </div>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-black uppercase",
                            anomaly.severity === 'high' ? "bg-error-container/30 text-error" :
                            anomaly.severity === 'medium' ? "bg-tertiary-container/30 text-tertiary" :
                            "bg-secondary-container/30 text-secondary"
                          )}>{anomaly.severity}</span>
                        </div>
                        <p className="font-bold text-on-surface">L{anomaly.from} → L{anomaly.to}</p>
                        <p className="text-lg font-display font-black text-tertiary">{anomaly.dropRate}% 跌幅</p>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={async () => {
                              showToast('修复方案已应用', 'success');
                            }}
                            className="flex-1 py-2 bg-tertiary text-on-tertiary-container rounded-xl text-xs font-bold"
                          >
                            一键修复
                          </button>
                          <button
                            onClick={async () => {
                              showToast('已忽略此异常', 'info');
                            }}
                            className="px-3 py-2 bg-surface-container-low rounded-xl text-xs font-bold"
                          >
                            <MaterialIcon icon="close" className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 快速操作 */}
              <div className="bg-surface-container-lowest rounded-[2.5rem] p-8">
                <h4 className="text-lg font-display font-black text-on-surface mb-4">快速操作</h4>
                <div className="space-y-3">
                  <button
                    onClick={async () => {
                      showToast('正在重新校准所有级别...', 'info');
                      await handleAction('难度校准完成', 'success');
                    }}
                    className="w-full py-3 bg-primary text-on-primary rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <MaterialIcon icon="refresh" className="w-4 h-4" />
                    全部重新校准
                  </button>
                  <button
                    onClick={async () => {
                      showToast('导出校准报告...', 'info');
                      await handleAction('报告已导出', 'success');
                    }}
                    className="w-full py-3 bg-surface-container-low text-on-surface rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <MaterialIcon icon="download" className="w-4 h-4" />
                    导出校准报告
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'quality':
        return <QualityAnalysis />;
      case 'config':
        return (
          <div className="space-y-8">
            <div className="bg-surface-container-lowest rounded-[2.5rem] p-8">
              <div className="absolute top-8 right-8">
                {weightValid ? (
                  <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-xs font-black">
                    <MaterialIcon icon="check_circle" className="w-4 h-4" />
                    分值已平衡 ({weightTotal} pts)
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-error/10 text-error px-4 py-2 rounded-full text-xs font-black">
                    <MaterialIcon icon="warning" className="w-4 h-4" />
                    分值不平衡 ({weightTotal} / 100)
                  </div>
                )}
              </div>
              <h3 className="text-xl font-display font-black text-on-surface mb-2">分数地图</h3>
              <p className="text-xs text-on-surface-variant font-bold opacity-60 max-w-md">所有参与测评的知识点权重总和必须等于100</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {knowledgePoints.filter((k: any) => k.inAssess).map((k: any) => (
                <div key={k.id} className="bg-surface-container-low rounded-3xl p-6">
                  <p className="font-bold text-on-surface mb-4">{k.name}</p>
                  <div className="flex items-end justify-between">
                    <div className="text-3xl font-display font-black text-primary">{k.weight}</div>
                    <div className="text-[10px] font-black opacity-30">WEIGHT</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'dashboard':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-surface-container-lowest rounded-[2.5rem] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center">
                  <MaterialIcon icon="storage" className="w-6 h-6 text-on-primary-container" />
                </div>
                <div>
                  <p className="text-2xl font-display font-black text-on-surface">{kpTotal}</p>
                  <p className="text-xs text-on-surface-variant">知识点总数</p>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-[2.5rem] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center">
                  <MaterialIcon icon="edit_note" className="w-6 h-6 text-on-secondary-container" />
                </div>
                <div>
                  <p className="text-2xl font-display font-black text-on-surface">{templates.length}</p>
                  <p className="text-xs text-on-surface-variant">题库模板</p>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-[2.5rem] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-tertiary-container flex items-center justify-center">
                  <MaterialIcon icon="trending_up" className="w-6 h-6 text-on-tertiary-container" />
                </div>
                <div>
                  <p className="text-2xl font-display font-black text-on-surface">{levels.length}</p>
                  <p className="text-xs text-on-surface-variant">难度级别</p>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-[2.5rem] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${weightValid ? 'bg-primary-container' : 'bg-error-container'}`}>
                  <MaterialIcon icon="check_circle" className={`w-6 h-6 ${weightValid ? 'text-on-primary-container' : 'text-on-error'}`} />
                </div>
                <div>
                  <p className="text-2xl font-display font-black text-on-surface">{weightTotal}</p>
                  <p className="text-xs text-on-surface-variant">权重总和</p>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-on-surface-variant">此功能开发中...</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 24, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] bg-on-surface text-surface px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold border border-white/10"
          >
            <MaterialIcon icon="check_circle" className="w-5 h-5 text-primary" />
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-surface/50 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="w-72 bg-surface-container flex flex-col p-6 gap-6 border-r border-outline-variant/10">
        <div className="px-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
            <MaterialIcon icon="rocket_launch" className="w-6 h-6 text-on-primary" />
          </div>
          <div>
            <h1 className="font-black text-primary text-xl">Engine</h1>
            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-full transition-all",
                  isActive
                    ? "bg-primary text-on-primary font-black scale-[1.02]"
                    : "text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-lowest"
                )}
              >
                <MaterialIcon icon={item.icon} className="w-5 h-5" />
                <span className="text-sm font-bold">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          onClick={onExit}
          className="w-full flex items-center gap-3 px-4 py-3 text-error/60 hover:text-error transition-colors text-sm font-bold"
        >
          <MaterialIcon icon="logout" className="w-5 h-5" />
          Exit Console
        </button>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface">
        <header className="h-20 px-10 flex items-center justify-between border-b border-outline-variant/10 bg-surface/80">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 text-primary p-2 rounded-xl">
              <MaterialIcon icon="show_chart" className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-black text-on-surface">内容引擎控制台</h2>
              <p className="text-[10px] text-on-surface-variant/40 font-black uppercase">{activeTab} system</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-10"
            >
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h3 className="text-5xl font-display font-black text-on-surface mb-4">
                    {menuItems.find(i => i.id === activeTab)?.label}
                  </h3>
                </div>
              </div>

              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingItem !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4"
            onClick={() => { setEditingItem(null); setEditForm({}); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface rounded-[2rem] p-8 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-display font-black text-on-surface mb-6">
                {editingItem?.id ? '编辑知识点' : '新建知识点'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-on-surface-variant">名称</label>
                  <input
                    type="text"
                    className="w-full bg-surface-container-low rounded-xl px-4 py-3 mt-1"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-on-surface-variant">学科</label>
                  <select
                    className="w-full bg-surface-container-low rounded-xl px-4 py-3 mt-1"
                    value={editForm.subject || '初中'}
                    onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  >
                    <option value="初中">初中</option>
                    <option value="高中">高中</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-bold text-on-surface-variant">分类</label>
                  <select
                    className="w-full bg-surface-container-low rounded-xl px-4 py-3 mt-1"
                    value={editForm.category || '代数'}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  >
                    <option value="代数">代数</option>
                    <option value="几何">几何</option>
                    <option value="统计">统计</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-bold text-on-surface-variant">权重 (1-100)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="w-full bg-surface-container-low rounded-xl px-4 py-3 mt-1"
                    value={editForm.weight || 10}
                    onChange={(e) => setEditForm({ ...editForm, weight: parseInt(e.target.value) })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-on-surface-variant">参与测评</label>
                  <button
                    onClick={() => setEditForm({ ...editForm, inAssess: !editForm.inAssess })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      editForm.inAssess ? "bg-primary" : "bg-surface-variant"
                    )}
                  >
                    <motion.div
                      animate={{ x: editForm.inAssess ? 24 : 4 }}
                      className="absolute top-1 w-4 h-4 rounded-full bg-surface"
                    />
                  </button>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => { setEditingItem(null); setEditForm({}); }}
                  className="flex-1 py-3 rounded-full bg-surface-container-low text-on-surface-variant font-bold"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveKnowledge}
                  disabled={isProcessing}
                  className="flex-1 py-3 rounded-full bg-primary text-on-primary font-bold disabled:opacity-50"
                >
                  {isProcessing ? '保存中...' : '保存'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConsolePage;
