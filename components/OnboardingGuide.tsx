// components/OnboardingGuide.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import MaterialIcon from './MaterialIcon';
import { userApi } from '@/lib/api';

interface TextbookVersion {
  id: string;
  name: string;
  year: string;
}

interface OnboardingGuideProps {
  onComplete: () => void;
}

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [step, setStep] = useState(1);
  const [grade, setGrade] = useState(8);
  const [subject] = useState('数学'); // 目前只有数学
  const [textbooks, setTextbooks] = useState<TextbookVersion[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 加载教材列表
    const fetchTextbooks = async () => {
      try {
        const res = await fetch('/api/admin/textbooks');
        const data = await res.json();
        if (data.success && data.data) {
          setTextbooks(data.data);
          if (data.data.length > 0) {
            setSelectedTextbookId(data.data[0].id);
          }
        }
      } catch (error) {
        console.error('加载教材失败:', error);
      }
    };
    fetchTextbooks();
  }, []);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await userApi.updateSettings({
        selectedGrade: grade,
        selectedSubject: subject,
        selectedTextbookId,
        studyProgress: 0,
      });
      onComplete();
    } catch (error) {
      console.error('保存设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-surface rounded-[2rem] p-8 w-full max-w-md"
      >
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '32px' }} />
                </div>
                <h2 className="text-2xl font-display font-bold text-on-surface mb-2">
                  选择年级
                </h2>
                <p className="text-on-surface-variant">请选择你当前的年级</p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[7, 8, 9, 10, 11, 12].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className={`py-4 rounded-2xl font-medium transition-all ${
                      grade === g
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {g}年级
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mx-auto mb-4">
                  <MaterialIcon icon="menu_book" className="text-on-secondary-container" style={{ fontSize: '32px' }} />
                </div>
                <h2 className="text-2xl font-display font-bold text-on-surface mb-2">
                  选择教材
                </h2>
                <p className="text-on-surface-variant">请选择你使用的教材版本</p>
              </div>

              <div className="space-y-3 mb-6">
                {textbooks.map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => setSelectedTextbookId(tb.id)}
                    className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${
                      selectedTextbookId === tb.id
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <span className="font-medium">{tb.name}</span>
                    <span className="text-sm opacity-70">{tb.year}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-tertiary-container flex items-center justify-center mx-auto mb-4">
                  <MaterialIcon icon="check_circle" className="text-on-tertiary-container" style={{ fontSize: '32px' }} />
                </div>
                <h2 className="text-2xl font-display font-bold text-on-surface mb-2">
                  确认设置
                </h2>
                <p className="text-on-surface-variant">请确认你的选择</p>
              </div>

              <div className="bg-surface-container-low rounded-2xl p-6 mb-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">年级</span>
                  <span className="font-medium text-on-surface">{grade}年级</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">科目</span>
                  <span className="font-medium text-on-surface">{subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">教材</span>
                  <span className="font-medium text-on-surface">
                    {textbooks.find(tb => tb.id === selectedTextbookId)?.name}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-4 rounded-full bg-surface-container text-on-surface font-medium"
            >
              上一步
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={loading}
            className="flex-1 py-4 rounded-full bg-primary text-on-primary font-medium disabled:opacity-50"
          >
            {loading ? '保存中...' : step === 3 ? '完成' : '下一步'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
