import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Lightbulb,
  RotateCcw,
  CheckCircle2,
  Timer,
  Zap,
  Brain,
  ChevronLeft,
  ChevronRight,
  Divide,
  Minus,
  Plus,
 X,
  CornerDownLeft,
  Search,
  Triangle,
  Star,
  Activity,
  ClipboardCheck,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { questionsApi, practiceApi, type Question, type QuestionStep } from '../lib/api';
import {
  createAdaptiveDifficultySystem,
  getDifficultyDescription,
  getKnowledgePointsByDifficulty,
  calculateBehaviorTag
} from '../lib/adaptive-difficulty';
import { BehaviorBadge, DifficultyChange, useDifficultyNotification } from './BehaviorFeedback';

interface ExercisePageProps {
  mode: 'diagnostic' | 'training';
  initialDifficulty: number;
  onBack: () => void;
  onStart?: (questionId: string) => void | Promise<void>;
  onFinish: (results: any) => void;
}

const ExercisePage: React.FC<ExercisePageProps> = ({ mode, initialDifficulty, onBack, onStart, onFinish }) => {
  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [stepsResults, setStepsResults] = useState<Record<number, 'correct' | 'error' | 'pending'>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [stepTags, setStepTags] = useState<Record<number, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [difficultyLevel, setDifficultyLevel] = useState(initialDifficulty);
  const [difficultyChange, setDifficultyChange] = useState<{ type: 'up' | 'down' | null; message: string }>({ type: null, message: '' });

  // 自适应难度系统
  const adaptiveSystem = useRef(createAdaptiveDifficultySystem({
    level: initialDifficulty
  }));

  // 键盘布局
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '/', '↵'];

  // 初始化：获取题目
  useEffect(() => {
    loadQuestion();
  }, [difficultyLevel]);

  const loadQuestion = async () => {
    setIsLoading(true);
    try {
      // 获取或生成题目
      const knowledgePoint = getKnowledgePointsByDifficulty(difficultyLevel, 'calculation')[0];

      const response = await questionsApi.generate({
        type: 'calculation',
        difficulty: difficultyLevel,
        knowledgePoint,
        count: 1,
      });

      if (response.questions && response.questions.length > 0) {
        const question = response.questions[0];
        setCurrentQuestion(question);

        // 通知父组件开始练习
        if (onStart) {
          await onStart(question.id);
        }

        // 初始化步骤状态
        const stepCount = question.steps?.length || 3;
        setStepsResults(
          Object.fromEntries(
            Array.from({ length: stepCount }, (_, i) => [i + 1, 'pending' as const])
          )
        );
        setActiveStep(1);
        setInputs({});
        setStepTags({});
        setShowHint(false);
        setFeedback(null);
      }
    } catch (error) {
      console.error('加载题目失败:', error);
      // 使用降级题目
      setCurrentQuestion({
        id: 'fallback',
        type: 'calculation',
        difficulty: difficultyLevel,
        content: {
          title: '分数四则运算',
          description: '计算以下表达式的值',
          context: '基础数学练习',
        },
        answer: '1/4',
        hint: '先计算括号内，再进行除法',
        knowledgePoints: ['分数运算'],
        steps: [
          { stepNumber: 1, expression: '(1/2) ÷ 2 =', answer: '1/4', hint: '除以2等于乘以1/2' },
          { stepNumber: 2, expression: '5 - 1/4 =', answer: '19/4', hint: '整数减分数，先通分' },
          { stepNumber: 3, expression: '(2/3) × 19/4 =', answer: '19/6', hint: '分子相乘，分母相乘' },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 开始练习时创建attempt记录
  useEffect(() => {
    const startPractice = async () => {
      try {
        const response = await practiceApi.start({ mode });
        if (response.attemptId) {
          setAttemptId(response.attemptId);
        }
      } catch (error) {
        console.error('开始练习失败:', error);
      }
    };

    startPractice();
  }, [mode]);

  // 更新步骤开始时间
  useEffect(() => {
    setStartTime(Date.now());
  }, [activeStep]);

  // 获取当前步骤
  const getCurrentStep = (): QuestionStep | null => {
    if (!currentQuestion?.steps) return null;
    return currentQuestion.steps.find(s => s.stepNumber === activeStep) || null;
  };

  // 处理键盘输入
  const handleKeyPress = (key: string) => {
    if (key === '↵') {
      checkAnswer();
      return;
    }

    setInputs(prev => ({
      ...prev,
      [`step${activeStep}`]: prev[`step${activeStep}`] + key
    }));
  };

  // 处理手写上传（模拟）
  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      const currentStep = getCurrentStep();
      if (currentStep) {
        setInputs(prev => ({ ...prev, [`step${activeStep}`]: currentStep.answer }));
      }
    }, 1500);
  };

  // 检查答案
  const checkAnswer = async () => {
    const currentInput = inputs[`step${activeStep}`];
    if (!currentInput?.trim()) {
      setFeedback('请输入答案');
      return;
    }

    const duration = Date.now() - startTime;
    const currentStep = getCurrentStep();

    // 调用AI批改API
    try {
      const response = await questionsApi.verify({
        questionId: currentQuestion?.id,
        stepNumber: activeStep,
        userAnswer: currentInput.trim(),
        duration,
      });

      const isCorrect = response.isCorrect;
      const behaviorTag = response.behaviorTag || calculateBehaviorTag(duration, isCorrect);

      // 更新结果
      setStepTags(prev => ({ ...prev, [activeStep]: behaviorTag }));
      setStepsResults(prev => ({ ...prev, [activeStep]: isCorrect ? 'correct' : 'error' }));
      setFeedback(response.feedback || (isCorrect ? '正确！' : '答案错误'));

      // 提交步骤记录
      if (attemptId) {
        await practiceApi.submit({
          attemptId,
          stepNumber: activeStep,
          userAnswer: currentInput.trim(),
          isCorrect,
          duration,
        });
      }

      // 自适应难度调整
      if (mode === 'training') {
        const result = adaptiveSystem.current.recordAnswer(isCorrect, duration);

        if (result.adjustment && result.adjustment.shouldAdjust) {
          setDifficultyLevel(result.adjustment.newLevel);
          setDifficultyChange({
            type: result.adjustment.newLevel > difficultyLevel ? 'up' : 'down',
            message: result.adjustment.reason
          });
        }
      }

      // 延迟后进入下一步或完成
      setTimeout(() => {
        const totalSteps = currentQuestion?.steps?.length || 3;
        if (activeStep < totalSteps) {
          setActiveStep(prev => prev + 1);
          setFeedback(null);
        } else {
          completePractice();
        }
      }, 1500);

    } catch (error) {
      console.error('批改失败:', error);
      // 降级：简单字符串匹配
      if (currentStep) {
        const isCorrect = currentInput.trim() === currentStep.answer;
        setStepsResults(prev => ({ ...prev, [activeStep]: isCorrect ? 'correct' : 'error' }));
        setFeedback(isCorrect ? '正确！' : `答案错误。提示：${currentStep.hint}`);

        setTimeout(() => {
          const totalSteps = currentQuestion?.steps?.length || 3;
          if (activeStep < totalSteps) {
            setActiveStep(prev => prev + 1);
            setFeedback(null);
          } else {
            completePractice();
          }
        }, 1500);
      }
    }
  };

  // 完成练习
  const completePractice = async () => {
    setIsFinished(true);

    // 计算分数
    const correctCount = Object.values(stepsResults).filter(r => r === 'correct').length;
    const totalCount = Object.keys(stepsResults).length;
    const score = Math.round((correctCount / totalCount) * 100);
    const duration = Math.round((Date.now() - startTime) / 1000);

    // 提交完成记录
    if (attemptId) {
      try {
        await practiceApi.finish({
          attemptId,
          score,
          duration,
        });
      } catch (error) {
        console.error('提交练习失败:', error);
      }
    }

    // 延迟调用回调
    setTimeout(() => {
      onFinish({
        score,
        correctCount,
        totalCount,
        difficultyLevel,
        adjustmentHistory: adaptiveSystem.current.getState().adjustmentHistory,
      });
    }, 3000);
  };

  // 清空输入
  const handleClear = () => {
    setInputs(prev => ({ ...prev, [`step${activeStep}`]: '' }));
  };

  // 删除最后一个字符
  const handleBackspace = () => {
    setInputs(prev => {
      const currentValue = prev[`step${activeStep}`] || '';
      return {
        ...prev,
        [`step${activeStep}`]: currentValue.slice(0, -1)
      };
    });
  };

  const currentStep = getCurrentStep();
  const progress = currentQuestion?.steps
    ? (Object.values(stepsResults).filter(s => s === 'correct').length / currentQuestion.steps.length) * 100
    : 0;

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-display font-black text-primary text-xl">正在准备题目...</p>
      </div>
    );
  }

  // 完成状态
  if (isFinished) {
    const correctCount = Object.values(stepsResults).filter(r => r === 'correct').length;
    const totalCount = Object.keys(stepsResults).length;
    const score = Math.round((correctCount / totalCount) * 100);

    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center space-y-8 pb-32">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          className="w-32 h-32 bg-gradient-to-br from-primary to-primary-container rounded-full flex items-center justify-center shadow-2xl relative"
        >
          <CheckCircle2 className="w-16 h-16 text-on-primary" strokeWidth={3} />
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-primary rounded-full"
          />
        </motion.div>

        <div className="space-y-2">
          <h2 className="text-3xl font-display font-black text-on-surface">挑战已完成！</h2>
          <p className="text-on-surface-variant font-medium">
            正确率: {score}% ({correctCount}/{totalCount})
          </p>
        </div>

        <div className="w-full space-y-4">
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary-container rounded-3xl p-6 flex flex-col items-center gap-2 ambient-shadow">
                 <Zap className="w-8 h-8 text-secondary fill-secondary" />
                 <span className="text-2xl font-display font-black text-on-secondary-container">+{score * 10} EXP</span>
              </div>
              <div className="bg-tertiary-container rounded-3xl p-6 flex flex-col items-center gap-2 ambient-shadow">
                 <Star className="w-8 h-8 text-tertiary fill-tertiary" />
                 <span className="text-2xl font-display font-black text-on-tertiary-container">{score} 积分</span>
              </div>
           </div>

           {/* 难度变化通知 */}
           {difficultyChange.type && (
             <DifficultyChange
               type={difficultyChange.type}
               message={difficultyChange.message}
               onClose={() => setDifficultyChange({ type: null, message: '' })}
             />
           )}
        </div>

        <div className="w-full flex flex-col gap-4">
          <button
            onClick={() => {
              adaptiveSystem.current.reset();
              setDifficultyLevel(initialDifficulty);
              setDifficultyChange({ type: null, message: '' });
              loadQuestion();
              setIsFinished(false);
            }}
            className="w-full py-4 rounded-full bg-primary text-on-primary font-display font-black text-lg shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            继续练习
          </button>
          <button
            onClick={onBack}
            className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-display font-black text-lg hover:bg-surface-variant transition-all"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface relative">
      {/* Uploading Overlay */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-surface/80 backdrop-blur-md flex flex-col items-center justify-center gap-4"
          >
             <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
             <p className="font-display font-black text-primary text-xl">智能批改中</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-surface">
        <button onClick={onBack} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-on-surface-variant" />
        </button>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-primary-container rounded-full">
            <span className="text-sm font-bold text-on-primary-container">
              难度：{difficultyLevel <= 2 ? '略高于水平' : difficultyLevel === 3 ? '颇具挑战' : '极具挑战'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-full">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-on-surface-variant">
              Lv.{difficultyLevel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-on-surface-variant" />
          <span className="text-sm font-bold text-on-surface-variant">
            {Math.floor((Date.now() - startTime) / 1000)}s
          </span>
        </div>
      </div>

      {/* 难度变化提示 */}
      <AnimatePresence>
        {difficultyChange.type && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "mx-6 mt-4 p-4 rounded-2xl flex items-center gap-3",
              difficultyChange.type === 'up' ? "bg-primary-container text-on-primary-container" : "bg-tertiary-container text-on-tertiary-container"
            )}
          >
            {difficultyChange.type === 'up' ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{difficultyChange.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* 题目标题 */}
          <div className="text-center">
            <h2 className="text-lg font-display font-bold text-on-surface-variant mb-1">
              {mode === 'diagnostic' ? '学力摸底评价进行中' : '专项强化环节'}
            </h2>
            <p className="text-sm text-on-surface-variant/70 mb-3">
              {mode === 'diagnostic' ? '全考点覆盖测评' : '几何与分数计算'}
            </p>
            <h3 className="text-xl font-display font-black text-on-surface">
              {currentQuestion?.content.title || '练习题'}
            </h3>
            <p className="text-on-surface-variant mt-2">
              {currentQuestion?.content.description}
            </p>
          </div>

          {/* 辅助线工具 */}
          <div className="bg-surface-container-low rounded-2xl p-4">
            <h4 className="text-sm font-bold text-on-surface-variant mb-3">辅助线工具</h4>
            <div className="flex gap-2 flex-wrap">
              <button className="px-3 py-2 bg-surface rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors">
                连接 AB
              </button>
              <button className="px-3 py-2 bg-surface rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors">
                作 CD 垂直
              </button>
              <button className="px-3 py-2 bg-surface rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors">
                平分角 A
              </button>
            </div>
          </div>

          {/* 分步计算标题 */}
          <h3 className="text-lg font-display font-bold text-on-surface text-center">分步计算</h3>

          {/* 步骤进度 */}
          <div className="flex justify-center gap-2">
            {currentQuestion?.steps?.map((step, index) => (
              <div
                key={step.stepNumber}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all",
                  step.stepNumber === activeStep && "bg-primary text-on-primary scale-110",
                  step.stepNumber < activeStep && "bg-surface-container-high text-on-surface-variant",
                  step.stepNumber > activeStep && "bg-surface-container text-on-surface-variant"
                )}
              >
                {step.stepNumber < activeStep && (
                  stepsResults[step.stepNumber] === 'correct' ? '✓' : '✗'
                )}
                {step.stepNumber === activeStep && step.stepNumber}
                {step.stepNumber > activeStep && step.stepNumber}
              </div>
            ))}
          </div>

          {/* 当前步骤 */}
          {currentStep && (
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-surface-container-low rounded-3xl p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-on-surface-variant">
                  步骤 {activeStep}
                </span>
                <button
                  onClick={() => setShowHint(!showHint)}
                  className="flex items-center gap-2 px-3 py-1 bg-tertiary-container rounded-full text-sm font-medium text-on-tertiary-container"
                >
                  <Lightbulb className="w-4 h-4" />
                  提示
                </button>
              </div>

              <div className="text-center">
                <p className="text-4xl font-display font-black text-on-surface mb-4">
                  {currentStep.expression}
                </p>

                {/* 答案输入 */}
                <div className="relative">
                  <input
                    type="text"
                    value={inputs[`step${activeStep}`] || ''}
                    readOnly
                    className={cn(
                      "w-64 px-6 py-4 text-center text-2xl font-bold rounded-2xl border-2 transition-all",
                      feedback
                        ? feedback.includes('正确')
                          ? "bg-primary-container border-primary text-on-primary-container"
                          : "bg-error-container border-error text-on-error-container"
                        : "bg-surface border-surface-variant text-on-surface"
                    )}
                    placeholder="输入答案"
                  />

                  {/* 行为标签 */}
                  <BehaviorBadge
                    tag={stepTags[activeStep] as any}
                    show={!!stepTags[activeStep]}
                    position="top-right"
                  />
                </div>

                {/* 反馈消息 */}
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "mt-4 p-4 rounded-2xl text-sm font-medium",
                      feedback.includes('正确')
                        ? "bg-primary-container text-on-primary-container"
                        : "bg-error-container text-on-error-container"
                    )}
                  >
                    {feedback}
                  </motion.div>
                )}

                {/* 提示 */}
                {showHint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 p-4 bg-tertiary-container rounded-2xl"
                  >
                    <p className="text-sm text-on-tertiary-container">
                      💡 {currentStep.hint}
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* 手写上传按钮 */}
          <button
            onClick={handleUpload}
            className="w-full py-4 bg-surface-container-highest rounded-2xl flex items-center justify-center gap-3 font-bold text-on-surface hover:bg-surface-variant transition-colors"
          >
            <Search className="w-5 h-5" />
            扫描手写步骤
          </button>
        </div>
      </div>

      {/* 虚拟键盘 */}
      <div className="p-6 bg-surface">
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-4 gap-2">
            {keys.map((key) => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                className={cn(
                  "py-4 rounded-2xl font-bold text-lg transition-all",
                  key === '↵'
                    ? "bg-primary text-on-primary shadow-lg hover:scale-105"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-variant"
                )}
              >
                {key === '↵' ? '提交' : key}
              </button>
            ))}
            <button
              onClick={handleBackspace}
              className="py-4 rounded-2xl bg-error-container text-on-error-container font-bold hover:scale-105 transition-all"
            >
              <CornerDownLeft className="w-6 h-6 mx-auto" />
            </button>
            <button
              onClick={handleClear}
              className="py-4 rounded-2xl bg-tertiary-container text-on-tertiary-container font-bold hover:scale-105 transition-all"
            >
              清除
            </button>
          </div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="h-3 bg-surface-container-high rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
};

export default ExercisePage;
