'use client';

import React, { useState, useEffect } from 'react';
import MaterialIcon from './MaterialIcon';

// 模板-知识点映射配置组件
function TemplateKnowledgeMapping({ templateId }: { templateId: string }) {
  const [currentKnowledge, setCurrentKnowledge] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    // 获取当前关联的知识点
    fetch(`/api/admin/templates/${templateId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success?.data?.knowledge) {
          setCurrentKnowledge(data.data.knowledge);
        }
      });
  }, [templateId]);

  const handleExport = async () => {
    const res = await fetch('/api/admin/templates/export');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-knowledge-mapping-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/templates/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        alert(`导入成功：更新 ${data.data.updated} 条`);
        // 刷新关联的知识点
        window.location.reload();
      } else {
        alert(`导入失败：${data.error}`);
      }
    } catch {
      alert('导入失败');
    }
  };

  return (
    <div className="bg-surface-container-low rounded-2xl p-4 mb-4">
      <h3 className="font-bold text-on-surface mb-3">关联配置</h3>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-on-surface-variant">关联知识点:</span>
        <span className="text-sm text-on-surface font-medium">
          {currentKnowledge?.name || '未关联'}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="px-3 py-1.5 text-sm bg-surface rounded-lg hover:bg-surface-container-high transition-colors"
        >
          导出映射
        </button>

        <label className="px-3 py-1.5 text-sm bg-surface rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer">
          导入映射
          <input
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}

interface TemplateEditorProps {
  template?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    type: template?.type || 'calculation',
    structure: template?.structure || { equation: '[a]x + [b] = [c]', conditions: [] },
    params: template?.params || { a: { min: -20, max: 20 }, b: { min: -20, max: 20 }, c: { min: -50, max: 50 } },
    steps: template?.steps || [
      { stepNumber: 1, instruction: '移项', hint: '将含x的项移到左边' },
      { stepNumber: 2, instruction: '合并同类项', hint: '合并常数项' },
      { stepNumber: 3, instruction: '求解', hint: '两边同时除以系数' }
    ]
  });
  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');
  const [previewLevel, setPreviewLevel] = useState(0);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: formData,
          difficulty: previewLevel,
          count: 1
        })
      });
      const data = await res.json();
      if (data.success && data.questions?.[0]) {
        setPreviewResult(data.questions[0]);
      } else {
        setPreviewResult({ error: '生成失败，请检查模板配置' });
      }
    } catch (error) {
      setPreviewResult({ error: '生成失败，请稍后重试' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const updateStructure = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      structure: { ...prev.structure, [key]: value }
    }));
  };

  const updateParam = (paramName: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      params: {
        ...prev.params,
        [paramName]: { ...prev.params[paramName as keyof typeof prev.params], [field]: value }
      }
    }));
  };

  const addStep = () => {
    const newStepNumber = Object.keys(formData.steps).length + 1;
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, { stepNumber: newStepNumber, instruction: '', hint: '' }]
    }));
  };

  const updateStep = (index: number, field: string, value: string) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const removeStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_: unknown, i: number) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('form')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
            activeTab === 'form' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
          }`}
        >
          表单编辑
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
            activeTab === 'json' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
          }`}
        >
          JSON 编辑
        </button>
      </div>

      {template?.id && (
        <TemplateKnowledgeMapping templateId={template.id} />
      )}

      {activeTab === 'form' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-2 block">模板名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3"
                placeholder="例如：一元一次方程解法 A"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-2 block">模板类型</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3"
              >
                <option value="calculation">计算题</option>
                <option value="geometry">几何题</option>
                <option value="worded">应用题</option>
              </select>
            </div>
          </div>

          {/* 方程结构 */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-2 block">方程结构</label>
              <input
                type="text"
                value={formData.structure.equation}
                onChange={(e) => updateStructure('equation', e.target.value)}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 font-mono"
                placeholder="[a]x + [b] = [c]"
              />
              <p className="text-xs text-on-surface-variant/60 mt-1">使用 [参数名] 表示可替换参数</p>
            </div>

            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-2 block">约束条件</label>
              <div className="space-y-2">
                {formData.structure.conditions.map((cond: string, i: number) => (
                  <input
                    key={i}
                    type="text"
                    value={cond}
                    onChange={(e) => {
                      const newConditions = [...formData.structure.conditions];
                      newConditions[i] = e.target.value;
                      updateStructure('conditions', newConditions);
                    }}
                    className="w-full bg-surface-container-low rounded-xl px-4 py-2 text-sm"
                    placeholder="例如：a != 0"
                  />
                ))}
                <button
                  onClick={() => updateStructure('conditions', [...formData.structure.conditions, ''])}
                  className="text-xs text-primary font-bold flex items-center gap-1"
                >
                  <MaterialIcon icon="add" className="w-3 h-3" />
                  添加条件
                </button>
              </div>
            </div>
          </div>

          {/* 参数定义 */}
          <div className="lg:col-span-2">
            <label className="text-sm font-bold text-on-surface-variant mb-2 block">参数约束</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(formData.params).map(([paramName, config]: [string, any]) => (
                <div key={paramName} className="bg-surface-container-low rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-primary">{paramName}</span>
                    <span className="text-xs text-on-surface-variant">Integer</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-on-surface-variant">Min</label>
                      <input
                        type="number"
                        value={config.min}
                        onChange={(e) => updateParam(paramName, 'min', parseInt(e.target.value))}
                        className="w-full bg-surface rounded-lg px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-on-surface-variant">Max</label>
                      <input
                        type="number"
                        value={config.max}
                        onChange={(e) => updateParam(paramName, 'max', parseInt(e.target.value))}
                        className="w-full bg-surface rounded-lg px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  const newParamName = `param${Object.keys(formData.params).length + 1}`;
                  setFormData(prev => ({
                    ...prev,
                    params: { ...prev.params, [newParamName]: { min: 0, max: 10 } }
                  }));
                }}
                className="bg-primary/10 rounded-2xl p-3 flex items-center justify-center text-primary font-bold"
              >
                <MaterialIcon icon="add" className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 解题步骤 */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-on-surface-variant">解题步骤</label>
              <button onClick={addStep} className="text-xs text-primary font-bold flex items-center gap-1">
                <MaterialIcon icon="add" className="w-3 h-3" />
                添加步骤
              </button>
            </div>
            <div className="space-y-3">
              {formData.steps.map((step: any, index: number) => (
                <div key={index} className="bg-surface-container-low rounded-2xl p-4 relative">
                  <button
                    onClick={() => removeStep(index)}
                    className="absolute top-2 right-2 text-error hover:bg-error-container rounded-full p-1"
                  >
                    <MaterialIcon icon="close" className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold">
                      {step.stepNumber}
                    </div>
                    <span className="text-sm font-bold text-on-surface-variant">步骤 {step.stepNumber}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={step.instruction}
                      onChange={(e) => updateStep(index, 'instruction', e.target.value)}
                      className="bg-surface rounded-xl px-3 py-2 text-sm"
                      placeholder="操作说明"
                    />
                    <input
                      type="text"
                      value={step.hint}
                      onChange={(e) => updateStep(index, 'hint', e.target.value)}
                      className="bg-surface rounded-xl px-3 py-2 text-sm"
                      placeholder="提示信息"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <textarea
            value={JSON.stringify(formData, null, 2)}
            onChange={(e) => {
              try {
                setFormData(JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, ignore
              }
            }}
            className="w-full h-96 bg-surface-container-low rounded-2xl p-4 font-mono text-sm"
          />
        </div>
      )}

      {/* 预览区 */}
      <div className="bg-surface-container-lowest rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-on-surface">预览</h3>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-surface-container-low p-1 rounded-full">
              {[0, 1, 2, 3, 4].map(lv => (
                <button
                  key={lv}
                  onClick={() => setPreviewLevel(lv)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    previewLevel === lv ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
                  }`}
                >
                  L{lv}
                </button>
              ))}
            </div>
            <button
              onClick={handlePreview}
              disabled={previewLoading}
              className="px-4 py-2 bg-secondary text-on-secondary-container rounded-full text-sm font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {previewLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-secondary-container border-t-transparent rounded-full animate-spin" />
                  生成中
                </>
              ) : (
                <>
                  <MaterialIcon icon="play_arrow" className="w-4 h-4" />
                  生成题目
                </>
              )}
            </button>
          </div>
        </div>

        {previewResult ? (
          previewResult.error ? (
            <div className="bg-error-container/20 text-error p-4 rounded-xl text-sm">
              {previewResult.error}
            </div>
          ) : (
            <div className="bg-surface-container-low rounded-2xl p-6">
              <p className="text-lg font-bold text-on-surface mb-4">{previewResult.content?.question || '题目生成成功'}</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-on-surface-variant">难度:</span>
                  <span className="ml-2 font-bold">L{previewLevel}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant">类型:</span>
                  <span className="ml-2 font-bold">{formData.type}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant">答案:</span>
                  <span className="ml-2 font-mono">{previewResult.answer || 'N/A'}</span>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="text-center text-on-surface-variant/60 py-8">
            点击"生成题目"预览模板效果
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-4 pt-4 border-t border-outline-variant/10">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-full bg-surface-container-low text-on-surface-variant font-bold"
        >
          取消
        </button>
        <button
          onClick={() => onSave(formData)}
          className="flex-1 py-3 rounded-full bg-primary text-on-primary font-bold"
        >
          保存模板
        </button>
      </div>
    </div>
  );
};

export default TemplateEditor;
