import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Network, 
  BookOpen, 
  Archive, 
  Sliders, 
  FileText, 
  HelpCircle,
  Plus,
  Save,
  RefreshCw,
  PieChart as PieChartIcon,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Database,
  CheckSquare,
  LogOut,
  AppWindow,
  Search,
  Settings,
  Bell,
  Activity,
  Heart,
  Wrench,
  Variable,
  FileCode,
  Check,
  Send,
  Trash2,
  Rocket,
  Zap,
  Minus,
  Edit3,
  Filter,
  MoreVertical,
  Activity as Pulse,
  Code2,
  ShieldCheck,
  FlaskConical,
  Bug
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ConsolePageProps {
  onExit: () => void;
}

type Tab = 'dashboard' | 'template' | 'difficulty' | 'data' | 'quality' | 'config';

const ConsolePage: React.FC<ConsolePageProps> = ({ onExit }) => {
  const [activeTab, setActiveTab] = useState<Tab>('data');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Template Preview State
  const [previewLevel, setPreviewLevel] = useState(0);

  // Knowledge Points State
  const [knowledgePoints, setKnowledgePoints] = useState([
    { id: 'K001', name: '一元一次方程', subject: '初中', weight: 25, master: 1.25, inAssess: true, status: 'Active' },
    { id: 'K002', name: '勾股定理', subject: '初中', weight: 15, master: 0.98, inAssess: true, status: 'Active' },
    { id: 'K003', name: '几何求角', subject: '初中', weight: 20, master: 0.85, inAssess: true, status: 'Review' },
    { id: 'K004', name: '二次函数', subject: '初中', weight: 25, master: 0.72, inAssess: true, status: 'Active' },
    { id: 'K005', name: '概率统计', subject: '初中', weight: 15, master: 1.10, inAssess: false, status: 'Draft' },
  ]);

  const totalScore = knowledgePoints.filter(k => k.inAssess).reduce((acc, curr) => acc + curr.weight, 0);

  const toggleAssess = (id: string) => {
    setKnowledgePoints(prev => prev.map(k => k.id === id ? { ...k, inAssess: !k.inAssess } : k));
    showToast('测评参与状态已更新', 'info');
  };

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setIsProcessing(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsProcessing(false);
    showToast(msg, type);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'template', label: '模板编辑器', icon: Edit3 },
    { id: 'difficulty', label: '难度校准', icon: TrendingUp },
    { id: 'data', label: '知识点管理', icon: Database },
    { id: 'quality', label: '质量分析', icon: ShieldCheck },
    { id: 'config', label: '分数地图', icon: Network },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'data':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                 <div className="bg-surface-container-low border border-outline-variant/10 rounded-full py-2 px-4 flex items-center gap-2">
                    <Filter className="w-3 h-3 text-on-surface-variant" />
                    <span className="text-xs font-bold">按学科筛选</span>
                 </div>
                 <div className="bg-surface-container-low border border-outline-variant/10 rounded-full py-2 px-4 flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">全部状态 (124)</span>
                 </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden ambient-shadow border border-outline-variant/5">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
                    <th className="px-8 py-4">ID / 名称</th>
                    <th className="px-6 py-4">关联学科</th>
                    <th className="px-6 py-4">分值权重</th>
                    <th className="px-6 py-4">参与测评</th>
                    <th className="px-6 py-4">掌握系数</th>
                    <th className="px-6 py-4 text-right pr-12">操作</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold">
                  {knowledgePoints.map((item) => (
                    <tr key={item.id} className="border-t border-outline-variant/5 hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-8 py-5">
                         <div className="flex flex-col">
                            <span className="text-on-surface">{item.name}</span>
                            <span className="text-[10px] font-mono text-on-surface-variant/40">{item.id}</span>
                         </div>
                      </td>
                      <td className="px-6 py-5 text-on-surface-variant">{item.subject}</td>
                      <td className="px-6 py-5">
                         <div className="flex items-center gap-2">
                            <span className="text-primary">{item.weight}</span>
                            <span className="text-[10px] opacity-30">pts</span>
                         </div>
                      </td>
                      <td className="px-6 py-5">
                         <button 
                            onClick={() => toggleAssess(item.id)}
                            className={cn(
                              "w-12 h-6 rounded-full transition-all relative overflow-hidden",
                              item.inAssess ? "bg-primary shadow-[0_0_8px_rgba(0,106,40,0.4)]" : "bg-surface-variant"
                            )}
                         >
                            <motion.div 
                              animate={{ x: item.inAssess ? 24 : 4 }}
                              className="absolute top-1 w-4 h-4 rounded-full bg-surface"
                            />
                         </button>
                      </td>
                      <td className="px-6 py-5 font-mono text-on-surface-variant/60">{item.master}x</td>
                      <td className="px-6 py-5 text-right pr-12">
                         <button 
                           onClick={() => handleAction(`已执行 [${item.name}] 的快速管理操作`)}
                           className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                         >
                            <MoreVertical className="w-4 h-4 text-outline-variant" />
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'template':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-250px)]">
             {/* Left List */}
             <div className="lg:col-span-4 bg-surface-container-lowest rounded-[2.5rem] p-6 ambient-shadow overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-between mb-6">
                   <h4 className="font-display font-black text-on-surface">模板列表 (24)</h4>
                   <button className="p-2 bg-primary/10 rounded-xl text-primary"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                   {[
                     { name: '一元一次方程解法 A', type: 'Calculation', id: 'T102', active: true },
                     { name: '几何求角基本型', type: 'Geometry', id: 'T205' },
                     { name: '应用题：行程问题', type: 'Worded', id: 'T088' },
                     { name: '分式化简求值', type: 'Calculation', id: 'T312' },
                     { name: '平行四边形性质', type: 'Geometry', id: 'T902' }
                   ].map(t => (
                     <div key={t.id} className={cn(
                       "p-4 rounded-3xl border transition-all cursor-pointer",
                       t.active ? "bg-primary/5 border-primary/20" : "bg-surface-container-low border-transparent hover:bg-surface-container-high"
                     )}>
                        <div className="flex justify-between items-start mb-2">
                           <span className="text-xs font-black text-primary uppercase">{t.type}</span>
                           <span className="text-[10px] font-mono opacity-30">{t.id}</span>
                        </div>
                        <p className="font-bold text-on-surface">{t.name}</p>
                     </div>
                   ))}
                </div>
             </div>

             {/* Right Editor */}
             <div className="lg:col-span-8 bg-surface-container-lowest rounded-[2.5rem] p-8 ambient-shadow flex flex-col">
                <div className="flex justify-between items-center mb-8">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                         <Code2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-display font-black text-on-surface">模板定义：一元一次方程解法 A</h4>
                        <p className="text-[10px] text-on-surface-variant font-bold opacity-60 tracking-widest">JSON-STRUCTURE / PARAMS</p>
                      </div>
                   </div>
                   <div className="flex gap-2">
                       <button 
                         onClick={() => handleAction(`预览实例生成成功，难度：L${previewLevel}`)}
                         className="px-4 py-2 bg-service-container text-primary rounded-full text-xs font-black hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-primary/20"
                       >
                         <Rocket className="w-3 h-3" />
                         预览生成题
                       </button>
                       <button 
                         onClick={() => handleAction('版本 v1.2 已发布至 Staging 环境')}
                         className="px-4 py-2 bg-primary text-on-primary rounded-full text-xs font-bold hover:scale-105 active:scale-95 transition-all"
                       >
                         发布 v1.2
                       </button>
                   </div>
                </div>

                <div className="flex-1 space-y-8 overflow-y-auto no-scrollbar pr-4">
                   <div className="space-y-4">
                      <div className="flex justify-between items-center">
                         <h5 className="text-[10px] font-black text-on-surface-variant uppercase">方程结构 / Equation Structure</h5>
                         <div className="flex gap-1 bg-surface-container-low p-1 rounded-full border border-outline-variant/10">
                            {[0, 2, 4].map(lv => (
                              <button 
                                key={lv}
                                onClick={() => setPreviewLevel(lv)}
                                className={cn(
                                  "px-3 py-1 rounded-full text-[10px] font-black transition-all",
                                  previewLevel === lv ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant/40 hover:text-on-surface-variant"
                                )}
                              >
                                L{lv}
                              </button>
                            ))}
                         </div>
                      </div>
                      <motion.div 
                       key={previewLevel}
                       initial={{ opacity: 0, scale: 0.95 }}
                       animate={{ opacity: 1, scale: 1 }}
                       className="bg-surface-container-low p-6 rounded-3xl flex items-baseline gap-2 font-mono text-2xl border border-outline-variant/10"
                      >
                         {previewLevel === 0 ? (
                           <>
                             <span className="text-primary">[a]</span>x <span className="text-secondary">+</span> <span className="text-primary">[b]</span> <span className="text-on-surface/30">=</span> <span className="text-primary">[c]</span>
                           </>
                         ) : previewLevel === 2 ? (
                           <>
                             <span className="text-primary">[a]</span>(x <span className="text-secondary">+</span> <span className="text-primary">[b]</span>) <span className="text-on-surface/30">=</span> <span className="text-primary">[c]</span>
                           </>
                         ) : (
                           <>
                             (<span className="text-primary">[a]</span>/<span className="text-primary">[b]</span>)x <span className="text-secondary">+</span> <span className="text-primary">[c]</span> <span className="text-on-surface/30">=</span> <span className="text-primary">[d]</span>
                           </>
                         )}
                      </motion.div>
                   </div>

                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                         <h5 className="text-[10px] font-black text-on-surface-variant uppercase">参数限制 / Param Constraints</h5>
                         <div className="space-y-3">
                            {(previewLevel < 4 ? ['a', 'b', 'c'] : ['a', 'b', 'c', 'd']).map(p => (
                              <div key={p} className="flex justify-between p-3 bg-surface rounded-2xl border border-outline-variant/10 text-xs font-bold">
                                 <span>{p}</span>
                                 <span className="text-primary">
                                   {previewLevel === 4 && p === 'b' ? 'Natural (2, 12)' : 'Integer (-20, 20)'}
                                 </span>
                              </div>
                            ))}
                         </div>
                      </div>
                      <div className="space-y-4">
                         <h5 className="text-[10px] font-black text-on-surface-variant uppercase">解构规则 / Step Rules</h5>
                         <div className="space-y-3">
                            <div className="p-3 bg-secondary/5 rounded-2xl text-xs font-bold flex items-center gap-2">
                               <div className="w-2 h-2 rounded-full bg-secondary"></div>
                               Step 1: {previewLevel === 0 ? '移项并合并' : previewLevel === 2 ? '展开括号应用分配律' : '全等式去分母 (两边乘 [b])'}
                            </div>
                            <div className="p-3 bg-secondary/5 rounded-2xl text-xs font-bold flex items-center gap-2 opacity-50">
                               <div className="w-2 h-2 rounded-full bg-secondary"></div>
                               Step 2: 求解未知数并化简
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        );
      case 'difficulty':
        return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                     {/* Stats Matrix */}
                     <div className="lg:col-span-8 space-y-6">
                        <div className="bg-surface-container-lowest rounded-[2.5rem] p-8 ambient-shadow relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-700"></div>
                           
                           <div className="flex justify-between items-center mb-8">
                              <h4 className="text-xl font-display font-black text-on-surface">校准矩阵 / Matrix</h4>
                              <span className="text-[10px] font-black text-on-surface-variant/40 tracking-widest uppercase">Target: Accuracy 60-80%</span>
                           </div>

                           <div className="space-y-3">
                              {[
                                { level: 'L0', accuracy: 92, time: '45s', retry: 5, status: '偏易' },
                                { level: 'L1', accuracy: 78, time: '1m 12s', retry: 12, status: '正常' },
                                { level: 'L2', accuracy: 52, time: '3m 45s', retry: 48, status: '⚠ 偏难', highlight: true },
                                { level: 'L3', accuracy: 18, time: '7m 20s', retry: 82, status: '过难', error: true }
                              ].map((row) => (
                                <div 
                                  key={row.level}
                                  className={cn(
                                    "grid grid-cols-5 gap-4 px-8 py-5 items-center rounded-3xl transition-all duration-300",
                                    row.highlight ? "bg-tertiary-container/10 border-l-4 border-tertiary shadow-md translate-x-2" : 
                                    row.error ? "bg-error-container/10 border-l-4 border-error" : 
                                    "bg-surface-container-low/40 hover:bg-surface-container-low"
                                  )}
                                >
                                  <div className="font-display font-black text-xl text-on-surface">{row.level}</div>
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
                                     <span className="text-sm font-black text-on-surface">{row.time}</span>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                     <span className="text-xs font-bold text-on-surface-variant">Retry Rate</span>
                                     <span className="text-sm font-black text-on-surface">{row.retry}%</span>
                                  </div>
                                  <div className="text-right">
                                     <span className={cn(
                                       "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight",
                                       row.highlight ? "bg-tertiary text-on-tertiary shadow-sm" : 
                                       row.error ? "bg-error text-on-error shadow-sm" : "bg-surface-container-highest text-on-surface-variant"
                                     )}>
                                        {row.status}
                                     </span>
                                  </div>
                                </div>
                              ))}
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                           <div className="bg-surface-container-lowest rounded-[2rem] p-6 ambient-shadow flex flex-col justify-between">
                              <div className="flex justify-between items-start">
                                 <h4 className="text-lg font-display font-black text-on-surface">系统活力 / Health</h4>
                                 <Heart className="w-5 h-5 text-primary fill-primary/20" />
                              </div>
                              <div className="mt-4 flex items-center gap-4">
                                 <span className="text-4xl font-display font-black text-primary">82%</span>
                                 <div className="flex-1 h-2 bg-surface-variant rounded-full overflow-hidden">
                                    <div className="bg-primary h-full rounded-full" style={{ width: '82%' }}></div>
                                 </div>
                              </div>
                              <p className="text-[10px] text-on-surface-variant font-bold mt-4 opacity-50">引擎目前稳定，结构偏移较小。</p>
                           </div>
                           <div 
                              onClick={() => handleAction('全量同步指令已下达，正在广播变更...')}
                              className="bg-surface-container-lowest rounded-[2rem] p-6 ambient-shadow flex items-center gap-6 group cursor-pointer hover:bg-primary/5 transition-colors"
                           >
                              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                 <Wrench className="w-8 h-8 text-primary" />
                              </div>
                              <div>
                                 <h4 className="font-display font-black text-on-surface leading-tight">全量同步</h4>
                                 <p className="text-xs text-on-surface-variant font-bold opacity-60">Sync all instances</p>
                              </div>
                              <ChevronRight className="ml-auto w-5 h-5 text-outline-variant" />
                           </div>
                        </div>
                     </div>

                     {/* Insights Panel */}
                     <div className="lg:col-span-4 space-y-6">
                        <section className="bg-surface-container-lowest rounded-[2.5rem] p-8 ambient-shadow relative overflow-hidden flex flex-col h-full">
                           <div className="flex items-center gap-3 mb-6">
                              <div className="w-10 h-10 rounded-2xl bg-secondary-container flex items-center justify-center shadow-lg shadow-secondary/10">
                                 <Zap className="w-5 h-5 text-on-secondary-container fill-on-secondary-container" />
                              </div>
                              <h4 className="text-xl font-display font-black text-on-surface">系统洞察 / AI</h4>
                           </div>
                           
                           <div className="space-y-6 flex-1">
                              <div className="bg-surface p-5 rounded-3xl border-l-4 border-tertiary relative overflow-hidden shadow-sm">
                                 <div className="flex flex-col gap-2 relative z-10">
                                    <div className="flex items-center gap-2">
                                       <AlertCircle className="w-4 h-4 text-tertiary" />
                                       <span className="text-xs font-black text-tertiary tracking-tighter uppercase">Anomsly Detected</span>
                                    </div>
                                    <h5 className="font-display font-black text-on-surface">Level 2 跨度异常</h5>
                                    <p className="text-xs text-on-surface-variant leading-relaxed font-bold opacity-60">
                                       L1 到 L2 的正确率跌幅超过 25%，表明题目存在认知阶梯断层。
                                    </p>
                                    <button 
                                       onClick={() => handleAction('正在修复 L2 跨度分布...')}
                                       className="mt-2 w-full py-2 bg-tertiary-container text-on-tertiary-container text-[10px] font-black rounded-full hover:shadow-md active:scale-95 transition-all"
                                     >
                                       修复建议：降级计算量
                                    </button>
                                 </div>
                              </div>
                           </div>

                           <div className="mt-8">
                              <button 
                                onClick={() => handleAction('演化模拟正在推演，采样点：15,000')}
                                className="w-full h-14 bg-on-surface text-surface rounded-full font-display font-black tracking-tight hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                              >
                                 开始演化模拟
                              </button>
                           </div>
                        </section>
                     </div>
                  </div>
        );
      case 'quality':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {[
               { title: '无限解检测', status: 'Healthy', icon: FlaskConical, desc: '检测方程模板是否可能产生 0=0 的情况' },
               { title: '冗余题剔除', status: '⚠ Issues', icon: Trash2, desc: '检测语义重复度 > 0.9 的自动生成题' },
               { title: '符号冲突', status: 'Healthy', icon: Bug, desc: '检查分数与分母符号的显示冲突' },
             ].map(card => (
               <div key={card.title} className="bg-surface-container-lowest rounded-[2rem] p-8 ambient-shadow border border-outline-variant/5">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                       <card.icon className="w-6 h-6" />
                    </div>
                    <span className={cn(
                      "text-[10px] font-black uppercase px-3 py-1 rounded-full",
                      card.status === 'Healthy' ? "bg-primary/10 text-primary" : "bg-error/10 text-error"
                    )}>{card.status}</span>
                  </div>
                  <h4 className="font-display font-black text-on-surface mb-2">{card.title}</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed opacity-60 font-bold">{card.desc}</p>
                  <button 
                    onClick={() => handleAction(`[${card.title}] 诊断运行完毕，未发现致命冲突`)}
                    className="mt-8 w-full py-3 bg-surface-container-low rounded-xl text-xs font-bold hover:bg-surface-container-high active:scale-95 transition-all"
                  >
                    运行诊断
                  </button>
               </div>
             ))}
          </div>
        )
      case 'config':
        return (
          <div className="space-y-8">
             <div className="bg-surface-container-lowest rounded-[2.5rem] p-8 ambient-shadow relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8">
                   {totalScore === 100 ? (
                     <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-xs font-black">
                        <CheckCircle2 className="w-4 h-4" />
                        分值已平衡 (100 pts)
                     </div>
                   ) : (
                     <div className="flex items-center gap-2 bg-error/10 text-error px-4 py-2 rounded-full text-xs font-black animate-pulse">
                        <AlertCircle className="w-4 h-4" />
                        分值不平衡 ({totalScore} / 100)
                     </div>
                   )}
                </div>
                <h3 className="text-xl font-display font-black text-on-surface mb-2">分数地图 / Score Balance</h3>
                <p className="text-xs text-on-surface-variant font-bold opacity-60 max-w-md">所有参与测评的知识点权重总和必须严格等于 100。当前权重直接决定主流程题目的分布比例。</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {knowledgePoints.filter(k => k.inAssess).map(k => (
                  <div key={k.id} className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/5">
                     <p className="text-[10px] font-black text-on-surface-variant/40 mb-1">{k.id}</p>
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
    }
  }

  return (
    <div className="flex h-screen bg-surface overflow-hidden relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 24, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] bg-on-surface text-surface px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold border border-white/10"
          >
             <CheckCircle2 className="w-5 h-5 text-primary" />
             {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-surface/50 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
          >
             <motion.div 
               animate={{ rotate: 360 }}
               transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
               className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
             />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-72 bg-[#bffee7] flex flex-col p-6 gap-6 z-50 border-r border-outline-variant/10 shadow-2xl shadow-primary/10">
        <div className="px-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-lg shadow-primary/20">
             <Rocket className="w-6 h-6 text-on-primary fill-on-primary" />
          </div>
          <div>
            <h1 className="text-display font-black text-primary text-xl leading-none">Engine</h1>
            <p className="text-[10px] font-bold text-on-surface-variant/40 mt-1 uppercase tracking-widest leading-none">Educational Core</p>
          </div>
        </div>

        <button 
          onClick={() => handleAction('配置已成功部署至分布式 Edge 节点')}
          className="w-full bg-on-surface text-surface font-bold py-3 rounded-full shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
        >
           <Send className="w-4 h-4" />
           部署当前配置
        </button>

        <nav className="flex-1 space-y-2 no-scrollbar overflow-y-auto px-1 mt-6">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-full transition-all duration-300",
                  isActive 
                    ? "bg-surface-container-lowest text-primary shadow-sm ambient-shadow font-black scale-[1.02]" 
                    : "text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-lowest/30"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "fill-primary")} />
                <span className="text-sm font-bold">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="pt-6 border-t border-outline-variant/10 space-y-2">
           <button className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant/40 hover:text-primary transition-colors text-sm font-bold">
              <Settings className="w-5 h-5" />
              Settings
           </button>
           <button 
             onClick={onExit}
             className="w-full flex items-center gap-3 px-4 py-3 text-error/60 hover:text-error transition-colors text-sm font-bold"
           >
              <LogOut className="w-5 h-5" />
              Exit Console
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface">
        {/* Top Navbar */}
        <header className="h-20 px-10 flex items-center justify-between border-b border-outline-variant/10 glass-panel z-40 bg-surface/80">
           <div className="flex items-center gap-4">
              <div className="bg-primary/10 text-primary p-2 rounded-xl">
                 <Pulse className="w-5 h-5" />
              </div>
              <div>
                 <h2 className="text-xl font-display font-black text-on-surface tracking-tight">内容引擎控制台</h2>
                 <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-widest">{activeTab} system / active</p>
              </div>
           </div>
           
           <div className="flex items-center gap-8">
              <div className="flex items-center gap-3 bg-surface-container-low p-1 rounded-full border border-outline-variant/10">
                 <button className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase bg-primary text-on-primary shadow-sm transition-all">Prod</button>
                 <button className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase text-on-surface-variant opacity-40 hover:opacity-100 transition-all">Staging</button>
                 <button className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase text-on-surface-variant opacity-40 hover:opacity-100 transition-all">Beta</button>
              </div>
              <div className="flex items-center gap-4 border-l border-outline-variant/20 pl-8">
                <button className="relative w-10 h-10 rounded-full hover:bg-surface-high transition-colors flex items-center justify-center">
                   <Bell className="w-5 h-5 text-on-surface-variant" />
                   <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
                </button>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-tertiary to-tertiary-container flex items-center justify-center text-on-tertiary font-black shadow-lg shadow-tertiary/10 border border-white/20">
                   A
                </div>
              </div>
           </div>
        </header>

        {/* Workspace Content */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-10 relative">
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
                      <h3 className="text-5xl font-display font-black text-on-surface tracking-tighter mb-4">
                         {menuItems.find(i => i.id === activeTab)?.label}
                      </h3>
                      <p className="text-sm text-on-surface-variant max-w-2xl font-bold opacity-60 leading-relaxed italic">
                         {activeTab === 'template' ? '通过参数化语言流式定义题目的解构步骤与逻辑分支。' : 
                          activeTab === 'difficulty' ? '根据百万级真实反馈数据，动态调整学习路径的梯度。' :
                          activeTab === 'data' ? '管理跨级衔接的知识点索引，确保学力跃迁路径的连续性。' : 
                          '系统核心全局参数配置与监控。'}
                      </p>
                   </div>
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleAction('工作区缓存已清除', 'info')}
                        className="px-8 py-4 rounded-full bg-surface-container-lowest text-on-surface-variant font-black text-xs shadow-sm flex items-center gap-2 border border-outline-variant/10 hover:shadow-md active:scale-95 transition-all"
                      >
                        <RefreshCw className="w-4 h-4" />
                        重置状态
                      </button>
                      <button 
                        onClick={() => handleAction('变更已提交，同步进度：100%')}
                        className="px-10 py-4 rounded-full bg-primary text-on-primary font-black text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 border-2 border-white/20"
                      >
                        <Save className="w-4 h-4 fill-on-primary" />
                        保存并同步
                      </button>
                   </div>
                </div>

                {renderContent()}
             </motion.div>
           </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default ConsolePage;
