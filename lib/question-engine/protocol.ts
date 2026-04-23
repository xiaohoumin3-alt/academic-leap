/**
 * 题目结构协议（Question Protocol）
 * 唯一真相源：不存"题目文本"，只存结构+参数+规则
 */

/**
 * Step类型枚举（原子化，禁止自由发挥）
 * 所有知识点能力最终映射到这些原子类型
 */
export enum StepType {
  // 二次函数
  COMPUTE_VERTEX_X = 'compute_vertex_x',
  COMPUTE_VERTEX_Y = 'compute_vertex_y',
  FINAL_COORDINATE = 'final_coordinate',
  COMPUTE_VALUE = 'compute_value',

  // 勾股定理
  PYTHAGOREAN_C_SQUARE = 'pythagorean_c_square',
  PYTHAGOREAN_C = 'pythagorean_c',

  // 一元一次方程
  SOLVE_LINEAR_EQUATION = 'solve_linear_equation',

  // 概率统计
  COMPUTE_PROBABILITY = 'compute_probability',
}

/**
 * 输入类型
 */
export type InputType = 'numeric' | 'coordinate' | 'fraction' | 'expression';

/**
 * 键盘类型
 */
export type KeyboardType = 'numeric' | 'coordinate' | 'fraction' | 'full';

/**
 * 答案类型
 */
export type AnswerType = 'number' | 'coordinate' | 'string' | 'fraction';

/**
 * 错误类型（用于能力回退和难度调整）
 */
export type ErrorType =
  | 'calculation_error'  // 计算错误：数值不对但方法对
  | 'concept_error'      // 概念错误：公式用错
  | 'format_error'       // 格式错误：如坐标格式不对
  | 'guess';             // 猜测：响应时间过快

/**
 * 步骤协议
 */
export interface StepProtocol {
  stepId: string;
  type: StepType;
  inputType: InputType;
  keyboard: KeyboardType;
  answerType: AnswerType;
  tolerance?: number;  // 数值容差
  ui: {
    instruction: string;
    inputTarget: string;
    inputHint: string;
  };
}

/**
 * 题目协议
 */
export interface QuestionProtocol {
  id: string;
  knowledgePoint: string;
  templateId: string;
  difficultyLevel: number;
  params: Record<string, number>;
  steps: StepProtocol[];
  content: {
    title: string;
    description: string;
    context?: string;
  };
  meta: {
    version: string;
    source: 'template_engine';
  };
}

/**
 * 参数约束
 */
export interface ParamConstraint {
  type: 'int' | 'float';
  min: number;
  max: number;
  exclude?: number[];  // 排除的值
}

/**
 * 参数约束集合
 */
export type ParamsSchema = Record<string, ParamConstraint>;

/**
 * 题目模板接口
 */
export interface QuestionTemplate {
  id: string;
  knowledgePoint: string;

  // 1. 参数生成器（难度控制的关键）
  generateParams: (level: number) => Record<string, number>;

  // 2. 步骤构建器（结构定义）
  buildSteps: (params: Record<string, number>) => StepProtocol[];

  // 3. 渲染器（表达层，AI可参与）
  render: (params: Record<string, number>) => {
    title: string;
    description: string;
    context?: string;
  };
}

/**
 * 判题结果
 */
export interface JudgeResult {
  isCorrect: boolean;
  correctAnswer: string | number;
  errorType: ErrorType | null;
  behaviorTag: string;
  hint?: string;
}

/**
 * 坐标
 */
export interface Coordinate {
  x: number;
  y: number;
}

/**
 * 分数
 */
export interface Fraction {
  numerator: number;
  denominator: number;
}
