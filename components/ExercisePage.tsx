import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { questionsApi, practiceApi, type Question, type QuestionStep } from '../lib/api';
import {
  createAdaptiveDifficultySystem,
  getDifficultyDescription,
  calculateBehaviorTag,
  calculateIndependenceScore,
  type HelpUsage,
  type ScoreCalculation
} from '../lib/adaptive-difficulty';
import { BehaviorBadge, DifficultyChange, useDifficultyNotification } from './BehaviorFeedback';
import MaterialIcon from './MaterialIcon';
import { getErrorHint } from './question-input/error-messages';
import { AnswerMode } from '@/lib/question-engine/protocol-v2';
import { detectProtocolVersion } from '@/lib/question-engine/migrate';
import type { StepProtocolV2 } from '@/lib/question-engine/protocol-v2';
import { YesNoInput, ChoiceInput, NumberInput } from './ExercisePage/v2-inputs';
import PredictionBadge from './PredictionBadge';
import ComplexityBadge, { ComplexityBar } from './ComplexityBadge';

export interface ExerciseResult {
  score: number;
  correctCount: number;
  totalCount: number;
  difficultyLevel: number;
  adjustmentHistory: Array<{
    timestamp: number;
    fromLevel: number;
    toLevel: number;
    reason: string;
  }>;
  independenceResult?: ScoreCalculation;
  attemptId?: string | null; // 测评模式下用于获取完整分析
}

interface DiagnosticConfig {
  questionCount: number;      // 固定题目数量
  autoAdjustDifficulty: boolean;  // 是否自动调整难度
}

interface ExercisePageProps {
  mode: 'diagnostic' | 'training';
  initialDifficulty: number;
  onBack: () => void;
  onStart?: (questionId: string) => void | Promise<void>;
  onFinish: (results: ExerciseResult) => void;
  diagnosticConfig?: DiagnosticConfig;
}

const ExercisePage: React.FC<ExercisePageProps> = ({ mode, initialDifficulty, onBack, onStart, onFinish, diagnosticConfig }) => {
  const isDiagnostic = mode === 'diagnostic';
  const diagnosticQuestionCount = diagnosticConfig?.questionCount ?? 10;

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
  const [requireAction, setRequireAction] = useState<{ type: 'textbook' | 'knowledgePoints' | null; message: string }>({ type: null, message: '' });
  const [difficultyLevel, setDifficultyLevel] = useState(initialDifficulty);
  const [difficultyChange, setDifficultyChange] = useState<{ type: 'up' | 'down' | null; message: string }>({ type: null, message: '' });
  // 诊断模式：已完成的题目数量
  const [completedCount, setCompletedCount] = useState(0);
  // 当前题目序号（从1开始，用于UI显示）
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);

  // 独立性评估系统 - 帮助强度追踪
  const [hintRevealed, setHintRevealed] = useState(false);
  const [stepRevealed, setStepRevealed] = useState(false);
  const [hintUsedTime, setHintUsedTime] = useState<number | null>(null);
  const [stepStartTime] = useState(Date.now());
  const [retryCount, setRetryCount] = useState(0);
  const [anyHintUsed, setAnyHintUsed] = useState(false);
  const [anyStepUsed, setAnyStepUsed] = useState(false);

  // 自适应难度系统
  const adaptiveSystem = useRef(createAdaptiveDifficultySystem({
    level: initialDifficulty
  }));

  // finish 延迟定时器，用于在用户点击"继续练习"时取消
  const finishTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 防止 completePractice 重复调用
  const isCompletingRef = useRef(false);

  // 难度级别 ref，确保 generateLocalQuestion 始终获取最新值
  const difficultyLevelRef = useRef(difficultyLevel);
  useEffect(() => {
    difficultyLevelRef.current = difficultyLevel;
  }, [difficultyLevel]);

  // 标记是否已加载过第一题
  const hasLoadedFirstQuestion = useRef(false);
  // 标记是否应该跳过下一次难度变化（用于"继续练习"时避免重复加载）
  const shouldSkipNextDifficultyChange = useRef(false);
  // 防止并发调用 loadQuestion
  const isLoadingQuestion = useRef(false);
  // 防止 checkAnswer 重复提交
  const isSubmitting = useRef(false);
  // 保存当前题目的答题结果（用于 completePractice）
  const questionResultsRef = useRef<{ correctResults: Record<number, 'correct' | 'error'>; totalSteps: number }>({
    correctResults: {},
    totalSteps: 3,
  });

  // 初始化：获取题目
  useEffect(() => {
    // 如果标记为跳过，则跳过这次加载并清除标记
    if (shouldSkipNextDifficultyChange.current) {
      shouldSkipNextDifficultyChange.current = false;
      return;
    }
    // 诊断模式：只在初始化时加载，难度变化不重新加载
    // 练习模式：难度变化时重新加载
    if (isDiagnostic && hasLoadedFirstQuestion.current) {
      return; // 诊断模式固定难度，忽略难度变化
    }
    loadQuestion({ isFirstLoad: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyLevel]);

  // 获取用户已启用的知识点名称列表
  const fetchEnabledKnowledgePoints = async (): Promise<Set<string>> => {
    try {
      const res = await fetch('/api/user/knowledge-tree');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.chapters) {
          const enabledNames = new Set<string>();
          for (const chapter of data.data.chapters) {
            for (const kp of chapter.knowledgePoints) {
              if (kp.enabled) {
                enabledNames.add(kp.name);
              }
            }
          }
          console.log('已启用的知识点:', Array.from(enabledNames));
          return enabledNames;
        }
      } else if (res.status === 400) {
        // 用户未选择教材
        console.warn('用户未选择教材');
        throw new Error('REQUIRE_TEXTBOOK_SELECTION');
      }
    } catch (e) {
      console.warn('获取已启用知识点失败:', e);
      if (e instanceof Error && e.message === 'REQUIRE_TEXTBOOK_SELECTION') {
        throw e; // 重新抛出，让上层处理
      }
    }
    return new Set<string>();
  };

  // 生成本地题目 - 根据错题模式调整
  const generateLocalQuestion = (knowledgePoint = '一元一次方程'): Question => {
    const currentDifficulty = difficultyLevelRef.current;
    const pattern = getMistakePattern();

    let a, b, x, c;

    // 根据错题模式调整题目生成
    if (pattern && pattern.negativeRate > 0.4) {
      // 用户常在带负数题上出错，多练这类
      a = Math.floor(Math.random() * 4) + 1;
      b = Math.floor(Math.random() * 8) - 6;  // 更大概率负数
      x = Math.floor(Math.random() * 8) - 4;
    } else {
      a = Math.floor(Math.random() * 5) + 1;
      b = Math.floor(Math.random() * 10) - 5;
      x = Math.floor(Math.random() * 10) - 5;
    }

    c = a * x + b;
    const equation = `${a}x + ${b >= 0 ? b : `(${b})`} = ${c}`;

    console.log('生成题目:', { a, b, x, c, equation, difficulty: currentDifficulty, pattern, knowledgePoint });

    return {
      id: `local_${Date.now()}_${Math.random()}`,
      type: 'calculation',
      difficulty: currentDifficulty,
      content: { title: equation, description: '解方程', context: '' },
      answer: x.toString(),
      hint: `${a}x = ${c - b}, x = ${x}`,
      knowledgePoints: [knowledgePoint],
      steps: [
        { stepNumber: 1, expression: equation, answer: x.toString(), hint: `x = ${x}` }
      ],
    };
  };

  const loadQuestion = async (options?: { isFirstLoad: boolean }) => {
    // 防止并发调用
    if (isLoadingQuestion.current) {
      console.log('loadQuestion 已在执行中，跳过');
      return;
    }

    isLoadingQuestion.current = true;
    setIsLoading(true);

    // 如果是第一次加载，标记已加载；否则递增题目序号
    if (options?.isFirstLoad) {
      hasLoadedFirstQuestion.current = true;
    } else if (!hasLoadedFirstQuestion.current) {
      // 兼容旧逻辑：如果没有传入 isFirstLoad，按旧方式处理
      hasLoadedFirstQuestion.current = true;
    } else {
      setCurrentQuestionNumber(prev => prev + 1);
    }
    console.log('=== loadQuestion 开始 ===', { difficultyLevel, isFirstLoad: options?.isFirstLoad ?? !hasLoadedFirstQuestion.current });

    // 优先获取用户的薄弱知识点（在try块外，确保catch块也能访问）
    let knowledgePoint = '一元一次方程'; // 默认值

    try {
      // 并行获取薄弱知识点和已启用知识点
      const [weakRes, enabledSet] = await Promise.all([
        fetch('/api/analytics/knowledge'),
        fetchEnabledKnowledgePoints().catch(e => {
          if (e instanceof Error && e.message === 'REQUIRE_TEXTBOOK_SELECTION') {
            // 用户未选择教材，返回空 Set
            return new Set<string>();
          }
          throw e;
        }),
      ]);

      let allKnowledge: any[] = [];
      let requireTextbookSelection = false;

      if (weakRes.ok) {
        const weakData = await weakRes.json();
        allKnowledge = weakData.knowledge || [];
        requireTextbookSelection = weakData.requireTextbookSelection || false;
      }

      // 如果用户未选择教材或未启用知识点，显示提示
      if (requireTextbookSelection) {
        setRequireAction({ type: 'textbook', message: '请先选择教材' });
        setIsLoading(false);
        isLoadingQuestion.current = false;
        return;
      }
      if (enabledSet.size === 0) {
        setRequireAction({ type: 'knowledgePoints', message: '请至少启用一个知识点' });
        setIsLoading(false);
        isLoadingQuestion.current = false;
        return;
      }

      // 过滤出已启用的知识点
      // 过滤出已启用的知识点（此时 enabledSet.size > 0 已保证）
      const enabledKnowledge = allKnowledge.filter((k: any) => {
        const kpName = typeof k === 'string' ? k : k.knowledgePoint;
        return enabledSet.has(kpName);
      });
      console.log(`已启用知识点过滤: ${allKnowledge.length} -> ${enabledKnowledge.length}`);

      // 优先选择薄弱知识点（mastery < 50），如果没有薄弱知识点则从已启用的所有中选择
      const weakPoints = enabledKnowledge.filter((k: any) => k.mastery < 50);
      const poolToSelect = weakPoints.length > 0 ? weakPoints : enabledKnowledge;

      if (poolToSelect.length > 0) {
        const index = Math.floor(Math.random() * poolToSelect.length);
        const selected = poolToSelect[index];
        knowledgePoint = typeof selected === 'string'
          ? selected
          : selected.knowledgePoint || knowledgePoint;
        console.log('可用知识点:', allKnowledge.map((k: any) => typeof k === 'string' ? k : k.knowledgePoint));
        console.log('已启用知识点:', enabledKnowledge.map((k: any) => typeof k === 'string' ? k : k.knowledgePoint));
        console.log('选择池:', poolToSelect.map((k: any) => typeof k === 'string' ? k : k.knowledgePoint));
        console.log('使用知识点:', knowledgePoint);
      } else {
        console.warn('没有已启用的知识点，使用默认值');
      }
    } catch (e) {
      console.warn('获取薄弱知识点失败，使用默认:', e);
    }

    console.log('最终使用的知识点:', knowledgePoint);

    try {
      const response = await questionsApi.generate({
        type: 'calculation',
        difficulty: difficultyLevel,
        knowledgePoint,
        count: 1,
      });

      console.log('API response:', response);
      console.log('response.questions:', response.questions);

      if (response.questions && response.questions.length > 0) {
        const question = response.questions[0];
        setCurrentQuestion(question);

        if (onStart) {
          await onStart(question.id);
        }

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
        setHintRevealed(false);
        setStepRevealed(false);
      } else {
        // 没有可用题目，显示错误信息
        console.error('生成题目失败: 没有可用的模板');
        setFeedback('该知识点暂未配置题目模板，请选择其他知识点或联系管理员');
      }
    } catch (error) {
      console.error('loadQuestion 错误:', error);
      // 使用本地题目
      setCurrentQuestion(generateLocalQuestion(knowledgePoint));
      const stepCount = 1;
      setStepsResults({ 1: 'pending' });
      setActiveStep(1);
      setInputs({});
      setStepTags({});
      setHintRevealed(false);
      setStepRevealed(false);
    } finally {
      setIsLoading(false);
      isLoadingQuestion.current = false;
    }
  };

  // 开始练习时创建attempt记录
  useEffect(() => {
    const startPractice = async () => {
      try {
        const response = await practiceApi.start({ mode });
        console.log('开始练习响应:', response);
        if (response.attemptId) {
          setAttemptId(response.attemptId);
          console.log('attemptId 已设置:', response.attemptId);
        } else if (response.error) {
          console.error('开始练习失败:', response.error);
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
    // 步骤可能是 stepNumber (数据库) 或 stepId (模板引擎)
    const step = currentQuestion.steps.find(s =>
      (s as any).stepNumber === activeStep ||
      (s as any).stepId === `s${activeStep}`
    );
    return step || null;
  };

  // 类型守卫：检查步骤是否为 v2 协议
  const isStepProtocolV2 = (step: any): step is StepProtocolV2 => {
    return step && typeof step === 'object' && 'answerMode' in step && 'expectedAnswer' in step;
  };

  // v2 协议步骤渲染函数
  const renderStepInput = (
    step: any,
    stepValue: string,
    onValueChange: (val: string) => void,
    onSubmit: (directValue?: string) => void  // 接受 directValue 参数
  ) => {
    // 使用类型守卫安全检查
    if (isStepProtocolV2(step)) {
      const status = stepsResults[activeStep] as 'correct' | 'error' | null;

      switch (step.answerMode) {
        case AnswerMode.YES_NO:
          return (
            <YesNoInput
              value={stepValue}
              yesLabel={step.options?.yes || '是'}
              noLabel={step.options?.no || '否'}
              onYes={() => {
                // 直接传递值给 checkAnswer，避免状态更新延迟
                onSubmit('yes');
              }}
              onNo={() => {
                // 直接传递值给 checkAnswer，避免状态更新延迟
                onSubmit('no');
              }}
              disabled={isSubmitting.current}
            />
          );

        case AnswerMode.MULTIPLE_CHOICE:
          return (
            <ChoiceInput
              value={stepValue}
              options={step.options?.choices || {}}
              onSelect={(val) => {
                // 直接传递值给 checkAnswer，避免状态更新延迟
                onSubmit(val);
              }}
              disabled={isSubmitting.current}
              status={status}
            />
          );

        case AnswerMode.NUMBER:
          return (
            <NumberInput
              value={stepValue}
              onChange={onValueChange}
              onSubmit={onSubmit}
              disabled={isSubmitting.current}
              status={status}
            />
          );

        case AnswerMode.COORDINATE:
          // 坐标输入使用普通的数字输入，但格式为 (x,y)
          return (
            <input
              key={step.stepId}
              type="text"
              value={stepValue}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
              placeholder={step.ui.inputPlaceholder || '(x, y)'}
              disabled={isSubmitting.current}
              className={cn(
                'w-64 px-6 py-4 text-center text-2xl font-bold rounded-2xl border-2 transition-all',
                !status && 'bg-surface border-surface-variant text-on-surface',
                status === 'correct' && 'bg-primary-container border-primary text-on-primary-container',
                status === 'error' && 'bg-error-container border-error text-on-error-container'
              )}
            />
          );

        case AnswerMode.TEXT_INPUT:
        default:
          // 使用原有的文本输入
          return (
            <input
              key={step.stepId}
              type="text"
              value={stepValue}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
              placeholder={step.ui.inputPlaceholder || '输入答案'}
              disabled={isSubmitting.current}
              className={cn(
                'w-64 px-6 py-4 text-center text-2xl font-bold rounded-2xl border-2 transition-all',
                !status && 'bg-surface border-surface-variant text-on-surface',
                status === 'correct' && 'bg-primary-container border-primary text-on-primary-container',
                status === 'error' && 'bg-error-container border-error text-on-error-container'
              )}
            />
          );
      }
    }

    // v1 协议或未实现的 v2 模式：返回 null，使用原有输入方式
    return null;
  };

  // 根据当前步骤的 keyboard 配置获取键盘布局
  const getKeyboardLayout = () => {
    const currentStep = getCurrentStep();

    // 从步骤配置中获取 keyboard 类型
    const keyboardType = currentStep?.keyboard || 'numeric';

    // 根据 keyboard 类型返回不同键盘
    switch (keyboardType) {
      case 'numeric':
        // 纯数字键盘：0-9、小数点、负号
        return {
          mainKeys: ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '-', '↵'],
          extraKeys: [],
        };
      case 'coordinate':
        // 坐标键盘：数字、括号、逗号、负号
        return {
          mainKeys: ['7', '8', '9', '(', '4', '5', '6', ')', '1', '2', '3', ',', '0', '-', '.', '↵'],
          extraKeys: [],
        };
      case 'fraction':
        // 分数键盘
        return {
          mainKeys: ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '/', '+', '↵'],
          extraKeys: ['½', '⅓', '¼', '¾'],
        };
      case 'full':
      default:
        // 完整数学键盘
        return {
          mainKeys: ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '/', '+', '↵'],
          extraKeys: ['x', 'y', '=', '(', ')', '.'],
        };
    }
  };

  const keyboardLayout = getKeyboardLayout();
  const keys = keyboardLayout.mainKeys;
  const extraKeys = keyboardLayout.extraKeys;

  // 处理键盘输入
  const handleKeyPress = (key: string) => {
    if (key === '↵') {
      checkAnswer();
      return;
    }

    setInputs(prev => ({
      ...prev,
      [`step${activeStep}`]: (prev[`step${activeStep}`] || '') + key
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
  // directValue: 直接传入的答案值（用于选择题/判断题，避免状态更新延迟）
  const checkAnswer = async (directValue?: string) => {
    // 防止重复提交
    if (isSubmitting.current) {
      console.log('checkAnswer: 已在提交中，跳过');
      return;
    }

    // 优先使用直接传入的值，否则从 inputs 状态读取
    const currentInput = directValue || inputs[`step${activeStep}`];
    if (!currentInput?.trim()) {
      setFeedback('请输入答案');
      return;
    }

    // 如果是直接传入的值，同步更新 inputs 状态
    if (directValue && !inputs[`step${activeStep}`]) {
      setInputs(prev => ({ ...prev, [`step${activeStep}`]: directValue }));
    }

    isSubmitting.current = true;

    const duration = Date.now() - startTime;

    // 调用判题引擎API（答案由后端计算）
    let isCorrect = false;
    let behaviorTag = '';
    let feedback = '';

    try {
      // 调用后端判题引擎，不再传递 correctAnswer
      const response = await questionsApi.verify({
        questionId: currentQuestion?.id,
        stepNumber: activeStep,
        userAnswer: currentInput.trim(),
        duration,
        // ✅ 不再传递 correctAnswer，由后端判题引擎根据 step.type + params 计算
      });

      console.log('verify API 响应:', response);

      // 处理旧格式题目错误
      if (response.success === false && response.requiresRegenerate) {
        feedback = response.error || '该题目使用旧格式，请重新生成';
        setFeedback(feedback);
        setStepsResults(prev => ({ ...prev, [activeStep]: 'error' }));
        return;
      }

      // 处理一般错误
      if (response.success === false) {
        feedback = response.error || '批改失败，请稍后重试';
        setFeedback(feedback);
        setStepsResults(prev => ({ ...prev, [activeStep]: 'error' }));
        return;
      }

      // API 返回了明确的判断结果
      if (response && response.success && response.isCorrect !== undefined) {
        isCorrect = response.isCorrect;
        behaviorTag = response.behaviorTag || calculateBehaviorTag(duration, isCorrect);
        // 优先使用 errorType 获取结构化错误提示，否则使用后端返回的 feedback
        const errorHint = (response as any).errorType
          ? getErrorHint((response as any).errorType, (response as any).correctAnswer?.toString() || '')
          : undefined;
        feedback = errorHint || response.feedback || (isCorrect ? '正确！' : '答案错误');
      } else {
        // 不应该到达这里，但保留兜底逻辑
        console.warn('API 返回了意外的响应格式:', response);
        feedback = '批改失败，请稍后重试';
      }

      // 更新结果
      console.log('更新练习结果:', { activeStep, isCorrect, feedback });
      setStepTags(prev => ({ ...prev, [activeStep]: behaviorTag }));
      setStepsResults(prev => ({ ...prev, [activeStep]: isCorrect ? 'correct' : 'error' }));
      setFeedback(feedback);

      // 保存当前题目的答题结果到 ref（用于 completePractice）
      questionResultsRef.current = {
        correctResults: { [activeStep]: isCorrect ? 'correct' : 'error' },
        totalSteps: currentQuestion?.steps?.length || 3,
      };

      // 提交步骤记录
      if (attemptId) {
        await practiceApi.submit({
          attemptId,
          stepNumber: activeStep,
          userAnswer: currentInput.trim(),
          isCorrect,
          duration,
          questionStepId: (currentStep as any).id || null,
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
          setHintRevealed(false);
          setStepRevealed(false);
        } else {
          // 传入当前步骤的正确结果，不依赖异步状态更新
          // diagnostic 模式：steps完成后继续下一题，而不是完成
          if (isDiagnostic) {
            setCompletedCount(prev => {
              const newCount = prev + 1;
              if (newCount >= diagnosticQuestionCount) {
                completePractice(isCorrect);
              } else {
                setTimeout(() => {
                  loadQuestion();
                  setFeedback(null);
                  setInputs({});
                }, 1000);
              }
              return newCount;
            });
          } else {
            completePractice(isCorrect);
          }
        }
      }, 1500);

    } catch (error) {
      console.error('批改失败:', error);
      console.log('当前题目答案:', currentStep?.answer, currentQuestion?.answer);
      // 降级：使用 currentQuestion 的 answer 做比对
      const correctAnswer = currentStep?.answer || currentQuestion?.answer;
      if (correctAnswer !== undefined && correctAnswer !== null) {
        const userAns = currentInput.trim();
        const correctAns = String(correctAnswer).trim();
        const isCorrect = userAns === correctAns;

        if (isCorrect) {
          // 正确：绿色反馈，保存步骤记录
          setStepsResults(prev => ({ ...prev, [activeStep]: 'correct' }));
          setFeedback('正确！');

          // 先提交步骤记录
          if (attemptId) {
            await practiceApi.submit({
              attemptId,
              stepNumber: activeStep,
              userAnswer: userAns,
              isCorrect,
              duration,
              questionStepId: (currentStep as any).id || null,
            });
          }

          // diagnostic 模式：增加完成计数
          if (isDiagnostic) {
            setCompletedCount(prev => {
              const newCount = prev + 1;
              if (newCount >= diagnosticQuestionCount) {
                completePractice(isCorrect);
              } else {
                setTimeout(() => {
                  loadQuestion();
                  setFeedback(null);
                  setInputs({});
                }, 1000);
              }
              return newCount;
            });
          } else {
            // 普通练习模式：完成练习
            completePractice(isCorrect);
          }
        } else {
          // 错误：显示红色反馈
          setStepsResults(prev => ({ ...prev, [activeStep]: 'error' }));
          addToMistakeList(currentQuestion!, correctAns);

          if (isDiagnostic) {
            // diagnostic 模式：不降低难度，继续下一题
            setCompletedCount(prev => {
              const newCount = prev + 1;
              setFeedback('答案错误，继续下一题');
              if (newCount >= diagnosticQuestionCount) {
                completePractice(isCorrect);
              } else {
                setTimeout(() => {
                  loadQuestion();
                  setFeedback(null);
                  setInputs({});
                }, 1000);
              }
              return newCount;
            });
          } else {
            // 普通练习模式：降低难度出新题
            setFeedback('答案错误，换个简单的试试');

            setTimeout(async () => {
              await completePractice(isCorrect);
              decreaseDifficulty(); // 会触发 useEffect [difficultyLevel] 自动加载新题
              setFeedback(null);
              setInputs({});
            }, 1000);
          }
        }
      } else {
        // 如果连 currentQuestion.answer 都没有，显示错误
        setStepsResults(prev => ({ ...prev, [activeStep]: 'error' }));
        setFeedback('无法验证答案，请稍后重试');
      }
    } finally {
      isSubmitting.current = false;
    }
  };

  // 加入错题本 - 记录错误模式，后续针对性出题
  const addToMistakeList = (question: Question, correctAnswer: string) => {
    try {
      const mistakes = JSON.parse(localStorage.getItem('mistakePatterns') || '[]');

      // 分析错题特征
      const equation = question.content.title;
      const hasNegative = equation.includes('(');
      const hasFraction = equation.includes('/');

      mistakes.push({
        equation,
        userAnswer: inputs[`step${activeStep}`],
        correctAnswer,
        hasNegative,
        hasFraction,
        timestamp: Date.now(),
      });

      // 只保留最近50条错题
      localStorage.setItem('mistakePatterns', JSON.stringify(mistakes.slice(-50)));
    } catch (e) {
      console.error('保存错题失败:', e);
    }
  };

  // 获取错题模式，用于生成针对性题目
  const getMistakePattern = () => {
    try {
      const mistakes = JSON.parse(localStorage.getItem('mistakePatterns') || '[]');
      if (mistakes.length === 0) return null;

      // 统计最近10题的错误特征
      const recent = mistakes.slice(-10);
      const negativeRate = recent.filter((m: any) => m.hasNegative).length / recent.length;
      const fractionRate = recent.filter((m: any) => m.hasFraction).length / recent.length;

      return { negativeRate, fractionRate };
    } catch (e) {
      return null;
    }
  };

  // 降低难度
  const decreaseDifficulty = () => {
    const newLevel = Math.max(0, difficultyLevel - 1);
    setDifficultyLevel(newLevel);
    setDifficultyChange({
      type: 'down',
      message: '降低难度，继续加油！'
    });
  };

  // 完成练习
  const completePractice = async (lastStepCorrect?: boolean) => {
    // 防重入保护 - 如果已经在完成中，跳过
    if (isCompletingRef.current) {
      console.log('completePractice 已执行中，跳过');
      return;
    }

    // 标记开始
    isCompletingRef.current = true;

    // 重置帮助追踪状态
    setAnyHintUsed(false);
    setAnyStepUsed(false);

    // 使用 ref 中保存的答题结果来计算分数
    const { correctResults, totalSteps } = questionResultsRef.current;
    const correctCount = Object.values(correctResults).filter(r => r === 'correct').length;
    // 如果没有答题记录，默认给一个最低分
    const baseScore = totalSteps > 0 ? Math.round((correctCount / totalSteps) * 100) : 60;
    const totalCount = totalSteps;

    // 独立性评估：计算帮助强度得分
    const helpUsage: HelpUsage = {
      level: anyStepUsed ? 'L2' : (anyHintUsed ? 'L1' : 'L0'),
      hintUsed: anyHintUsed,
      stepUsed: anyStepUsed,
      timeToFirstHint: hintUsedTime,
      retryCount,
    };

    const independenceResult = calculateIndependenceScore(baseScore, helpUsage, retryCount);
    const finalScore = independenceResult.finalScore;
    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('完成练习:', {
      correctCount,
      totalCount,
      baseScore,
      helpUsage,
      independenceResult,
      finalScore,
      duration,
      correctResults,
      attemptId
    });

    // 提交完成记录
    if (attemptId) {
      try {
        const finishResponse = await practiceApi.finish({
          attemptId,
          score: finalScore,
          duration,
        });
        console.log('完成练习响应:', finishResponse);

        // 调用学习路径微调API - 使用 questionStepId 让 API 处理知识点映射
        try {
          const questionStepIds = currentQuestion?.steps?.map((step, idx) => ({
            questionStepId: (step as any).id || `step-${idx}`,
            isCorrect: correctResults[idx + 1] === 'correct'
          })) || [];

          await fetch('/api/learning-path/adjust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attemptId,
              practiceResults: questionStepIds.map(r => ({
                knowledgePointId: r.questionStepId,
                isCorrect: r.isCorrect
              }))
            })
          });
        } catch (adjustError) {
          console.error('学习路径微调失败:', adjustError);
        }
      } catch (error) {
        console.error('提交练习失败:', error);
      }
    } else {
      console.warn('没有 attemptId，跳过提交完成记录');
    }

    // 测评模式：立即跳转到结果页，不显示练习完成页面
    if (isDiagnostic) {
      onFinish({
        score: finalScore,
        correctCount,
        totalCount,
        difficultyLevel,
        adjustmentHistory: adaptiveSystem.current.getState().adjustmentHistory,
        independenceResult,
        attemptId, // 传递 attemptId 用于获取完整测评分析
      });
      // 注意：不在这里重置标志，由调用方负责清理
      return;
    }

    // 练习模式：设置完成状态，显示完成页面
    setIsFinished(true);

    // 清除之前的定时器（如果有）
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
    }

    // 延迟调用回调
    finishTimeoutRef.current = setTimeout(() => {
      onFinish({
        score: finalScore,
        correctCount,
        totalCount,
        difficultyLevel,
        adjustmentHistory: adaptiveSystem.current.getState().adjustmentHistory,
        independenceResult,
      });
    }, 3000);

    // 重置防重入标志
    isCompletingRef.current = false;
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

  // 需要操作状态（选择教材或知识点）
  if (requireAction.type) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-6 bg-surface">
        <div className="w-20 h-20 rounded-full bg-tertiary-container flex items-center justify-center">
          {requireAction.type === 'textbook' ? (
            <MaterialIcon icon="menu_book" className="text-on-tertiary-container" style={{ fontSize: '40px' }} />
          ) : (
            <MaterialIcon icon="check_circle_outline" className="text-on-tertiary-container" style={{ fontSize: '40px' }} />
          )}
        </div>
        <h2 className="text-2xl font-display font-bold text-on-surface text-center">
          {requireAction.message}
        </h2>
        <p className="text-base text-on-surface-variant text-center max-w-md">
          {requireAction.type === 'textbook'
            ? '请先到"分析"页面选择您使用的教材'
            : '请在"分析"页面勾选至少一个知识点来开始练习'}
        </p>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-primary text-on-primary rounded-full font-bold text-base hover:bg-primary/90 transition-colors"
        >
          去选择
        </button>
      </div>
    );
  }

  // 完成状态
  if (isFinished) {
    const correctCount = Object.values(stepsResults).filter(r => r === 'correct').length;
    const totalCount = Object.keys(stepsResults).length;
    const baseScore = Math.round((correctCount / totalCount) * 100);

    // 计算独立性得分
    const helpUsage: HelpUsage = {
      level: anyStepUsed ? 'L2' : (anyHintUsed ? 'L1' : 'L0'),
      hintUsed: anyHintUsed,
      stepUsed: anyStepUsed,
      timeToFirstHint: hintUsedTime,
      retryCount,
    };
    const independenceResult = calculateIndependenceScore(baseScore, helpUsage, retryCount);
    const finalScore = independenceResult.finalScore;

    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center space-y-8 pb-32">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          className="w-32 h-32 bg-gradient-to-br from-primary to-primary-container rounded-full flex items-center justify-center shadow-2xl relative"
        >
          <MaterialIcon icon="check_circle" className="text-on-primary" filled style={{ fontSize: '64px' }} />
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-primary rounded-full"
          />
        </motion.div>

        <div className="space-y-2">
          <h2 className="text-3xl font-display font-black text-on-surface">挑战已完成！</h2>
          <p className="text-on-surface-variant font-medium">
            正确率: {baseScore}% ({correctCount}/{totalCount})
          </p>
        </div>

        {/* 独立性评估标签 */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "px-6 py-3 rounded-full text-lg font-bold",
            independenceResult.independenceLabel === '独立完成' && "bg-primary-container text-on-primary-container",
            independenceResult.independenceLabel === '提示辅助' && "bg-amber-container text-on-amber-container",
            independenceResult.independenceLabel === '步骤辅助' && "bg-orange-container text-on-orange-container"
          )}
        >
          {independenceResult.independenceEmoji} {independenceResult.independenceLabel} +{finalScore}分
        </motion.div>

        <div className="w-full space-y-4">
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary-container rounded-3xl p-6 flex flex-col items-center gap-2 ambient-shadow">
                 <MaterialIcon icon="bolt" className="text-secondary fill-secondary" filled style={{ fontSize: '32px' }} />
                 <span className="text-2xl font-display font-black text-on-secondary-container">+{finalScore * 10} EXP</span>
              </div>
              <div className="bg-tertiary-container rounded-3xl p-6 flex flex-col items-center gap-2 ambient-shadow">
                 <MaterialIcon icon="star" className="text-tertiary fill-tertiary" filled style={{ fontSize: '32px' }} />
                 <span className="text-2xl font-display font-black text-on-tertiary-container">{finalScore} 积分</span>
              </div>
           </div>

           {/* 得分明细 */}
           {(independenceResult.breakdown.hintPenalty > 0 || independenceResult.breakdown.stepPenalty > 0 || independenceResult.breakdown.retryPenalty > 0) && (
             <div className="bg-surface-variant rounded-2xl p-4 text-sm space-y-1">
               <div className="flex justify-between text-on-surface-variant">
                 <span>基础分</span>
                 <span className="font-medium">{independenceResult.breakdown.baseScore}</span>
               </div>
               {independenceResult.breakdown.hintPenalty > 0 && (
                 <div className="flex justify-between text-amber-600">
                   <span>提示辅助</span>
                   <span className="font-medium">-{independenceResult.breakdown.hintPenalty}</span>
                 </div>
               )}
               {independenceResult.breakdown.stepPenalty > 0 && (
                 <div className="flex justify-between text-orange-600">
                   <span>步骤辅助</span>
                   <span className="font-medium">-{independenceResult.breakdown.stepPenalty}</span>
                 </div>
               )}
               {independenceResult.breakdown.retryPenalty > 0 && (
                 <div className="flex justify-between text-red-600">
                   <span>重试扣分</span>
                   <span className="font-medium">-{independenceResult.breakdown.retryPenalty}</span>
                 </div>
               )}
               <div className="border-t border-outline-variant pt-1 mt-1 flex justify-between text-on-surface font-bold">
                 <span>最终得分</span>
                 <span>{finalScore}</span>
               </div>
             </div>
           )}

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
              // 清除 finish 定时器，防止自动跳转
              if (finishTimeoutRef.current) {
                clearTimeout(finishTimeoutRef.current);
                finishTimeoutRef.current = null;
              }
              adaptiveSystem.current.reset();
              hasLoadedFirstQuestion.current = false;
              setCurrentQuestionNumber(1);
              setCompletedCount(0);
              // 标记跳过难度变化触发，避免重复加载
              shouldSkipNextDifficultyChange.current = true;
              setDifficultyLevel(initialDifficulty);
              setDifficultyChange({ type: null, message: '' });
              setIsFinished(false);
              // 手动调用 loadQuestion，因为 useEffect 被跳过了
              loadQuestion({ isFirstLoad: true });
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
          <MaterialIcon icon="arrow_back" className="text-on-surface-variant" style={{ fontSize: '24px' }} />
        </button>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-secondary-container rounded-full">
            <span className="text-xs font-bold text-on-secondary-container">
              {isDiagnostic ? `第 ${currentQuestionNumber} 题` : `第 ${activeStep} 步`}
            </span>
          </div>
          <div className="px-4 py-2 bg-primary-container rounded-full">
            <span className="text-sm font-bold text-on-primary-container">
              难度：{difficultyLevel <= 2 ? '略高于水平' : difficultyLevel === 3 ? '颇具挑战' : '极具挑战'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-full">
            <MaterialIcon icon="psychology" className="text-primary" style={{ fontSize: '16px' }} />
            <span className="text-sm font-bold text-on-surface-variant">
              Lv.{difficultyLevel}
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-tertiary-container rounded-full">
            <MaterialIcon icon="stars" className="text-on-tertiary-container" style={{ fontSize: '16px' }} />
            <span className="text-sm font-bold text-on-tertiary-container">
              +{difficultyLevel * 10} XP
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <MaterialIcon icon="timer" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
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
              <MaterialIcon icon="trending_up" className="" style={{ fontSize: '20px' }} />
            ) : (
              <MaterialIcon icon="warning" className="" style={{ fontSize: '20px' }} />
            )}
            <span className="text-sm font-medium">{difficultyChange.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* 简单明了的标题 */}
          <div className="text-center">
            <h2 className="text-lg font-display font-bold text-primary mb-2">
              第 {activeStep} 步 / 共 {currentQuestion?.steps?.length || 3} 步
            </h2>
            <p className="text-sm text-on-surface-variant mb-4">
              用键盘输入答案，然后点提交
            </p>
            <h3 className="text-2xl font-display font-black text-on-surface">
              {typeof currentQuestion?.content === 'string' ? currentQuestion.content : currentQuestion?.content?.title || '计算题'}
            </h3>
            {currentQuestion?.content?.context && (
              <p className="mt-3 text-lg text-on-surface-variant font-medium">
                {currentQuestion.content.context}
              </p>
            )}
            {/* 预测概率显示 + 复杂度特征 */}
            <div className="flex justify-center mt-4 flex-wrap gap-3">
              <PredictionBadge
                questionDifficulty={currentQuestion?.difficulty ?? 0.5}
                knowledgeNodes={currentQuestion?.knowledgePoints ?? ['general']}
                className=""
              />
              <ComplexityBadge
                features={{
                  cognitiveLoad: currentQuestion?.cognitiveLoad,
                  reasoningDepth: currentQuestion?.reasoningDepth,
                  complexity: currentQuestion?.complexity,
                }}
                compact
              />
            </div>

            {/* 复杂度详细条 */}
            {(currentQuestion?.cognitiveLoad !== undefined ||
              currentQuestion?.reasoningDepth !== undefined ||
              currentQuestion?.complexity !== undefined) && (
              <div className="mt-4 max-w-xs mx-auto space-y-2">
                {currentQuestion?.cognitiveLoad !== undefined && (
                  <ComplexityBar value={currentQuestion.cognitiveLoad} label="认知负荷" color="bg-blue-500" />
                )}
                {currentQuestion?.reasoningDepth !== undefined && (
                  <ComplexityBar value={currentQuestion.reasoningDepth} label="推理深度" color="bg-purple-500" />
                )}
                {currentQuestion?.complexity !== undefined && (
                  <ComplexityBar value={currentQuestion.complexity} label="综合复杂度" color="bg-orange-500" />
                )}
              </div>
            )}
          </div>

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
                  <MaterialIcon icon="lightbulb" className="" style={{ fontSize: '16px' }} />
                  提示
                </button>
              </div>

              {/* 独立性评估系统：帮助控制 */}
              {!hintRevealed && !stepRevealed && (
                <div className="flex justify-center gap-3 mb-4">
                  <button
                    onClick={() => {
                      setStepRevealed(true);
                      setHintRevealed(true);
                      setHintUsedTime(Date.now() - stepStartTime);
                      setAnyHintUsed(true);
                      setAnyStepUsed(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-container rounded-full text-sm font-medium text-on-orange-container hover:scale-105 transition-transform"
                  >
                    <MaterialIcon icon="description" style={{ fontSize: '16px' }} />
                    查看步骤
                    <span className="text-xs opacity-75">(-30分)</span>
                  </button>
                </div>
              )}

              {hintRevealed && (currentStep.instruction || (currentStep as any).ui?.instruction) && (
                <div className={cn(
                  "text-center mb-4 rounded-2xl p-4",
                  stepRevealed ? "bg-orange-container text-on-orange-container" : "bg-amber-container text-on-amber-container"
                )}>
                  <p className="text-base font-medium">
                    {stepRevealed && <span className="mr-2">📝 步骤：</span>}
                    {hintRevealed && !stepRevealed && <span className="mr-2">💡 提示：</span>}
                    {currentStep.instruction || (currentStep as any).ui?.instruction}
                  </p>
                  {stepRevealed && (
                    <p className="text-xs mt-2 opacity-75">⚠️ 已使用步骤辅助，得分将降低</p>
                  )}
                </div>
              )}

              {stepRevealed && (currentStep.inputTarget || (currentStep as any).ui?.inputTarget) && (
                <div className="text-center mb-4">
                  <div className="inline-block bg-surface-container-high rounded-2xl px-6 py-3">
                    <p className="text-sm text-on-surface-variant">
                      输入：{currentStep.inputTarget || (currentStep as any).ui?.inputTarget}
                    </p>
                  </div>
                </div>
              )}


              {/* 答案输入 */}
              <div className="relative flex flex-col items-center">
                {/* v2 协议输入组件 */}
                {(() => {
                  const v2Input = renderStepInput(
                    currentStep,
                    inputs[`step${activeStep}`] || '',
                    (val) => setInputs(prev => ({ ...prev, [`step${activeStep}`]: val })),
                    checkAnswer
                  );
                  if (v2Input) {
                    return (
                      <>
                        {v2Input}
                        {/* 输入提示 */}
                        {(currentStep as any).ui?.hint && !inputs[`step${activeStep}`] && (
                          <p className="mt-2 text-xs text-on-surface-variant">
                            {(currentStep as any).ui.hint}
                          </p>
                        )}
                      </>
                    );
                  }
                  // v1 协议：使用数字输入组件
                  return (
                    <>
                      <NumberInput
                        value={inputs[`step${activeStep}`] || ''}
                        onChange={(val) => setInputs(prev => ({ ...prev, [`step${activeStep}`]: val }))}
                        onSubmit={checkAnswer}
                        disabled={isSubmitting.current}
                        placeholder={currentStep.inputHint || '输入答案'}
                        status={stepsResults[activeStep] as 'correct' | 'error' | null}
                      />
                    </>
                  );
                })()}

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
                    stepsResults[activeStep] === 'correct' && "bg-primary-container text-on-primary-container",
                    stepsResults[activeStep] === 'error' && "bg-error-container text-on-error-container"
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
            </motion.div>
          )}

          {/* 手写上传按钮 */}
          <button
            onClick={handleUpload}
            className="w-full py-4 bg-surface-container-highest rounded-2xl flex items-center justify-center gap-3 font-bold text-on-surface hover:bg-surface-variant transition-colors"
          >
            <MaterialIcon icon="document_scanner" className="" style={{ fontSize: '20px' }} />
            扫描手写步骤
          </button>
        </div>
      </div>

      {/* 虚拟键盘 - v1 协议 或 v2 数字输入时显示 */}
      {getCurrentStep() && (
        (detectProtocolVersion(getCurrentStep()! as any) !== 'v2' ||
         (currentStep as any).answerMode === AnswerMode.NUMBER)
      ) && (
      <div className="p-6 pb-24 bg-surface">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* 额外按钮行 - 只在有额外键时显示 */}
          {extraKeys.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {extraKeys.map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className="py-3 rounded-2xl font-bold text-sm bg-secondary-container/20 text-secondary hover:bg-secondary-container/30 transition-all"
                >
                  {key}
                </button>
              ))}
            </div>
          )}
          {/* 主键盘 */}
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
              <MaterialIcon icon="backspace" className="mx-auto" style={{ fontSize: '24px' }} />
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
      )}

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
