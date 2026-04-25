/**
 * 一元二次方程应用题 - 面积问题模板
 * 几何图形面积问题建立一元二次方程
 * 题型：长方形、正方形面积问题
 */

import {
  QuestionTemplate,
  StepType,
} from '../../protocol';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
  formatNumber,
} from '../../difficulty';

/**
 * 问题类型编码（全部使用数字以符合 Record<string, number> 约束）
 * 1 = 长方形 - 长是宽的k倍
 * 2 = 长方形 - 长比宽多m
 * 3 = 长方形 - 长比宽少m
 * 4 = 正方形 - 边长增加，面积增加
 * 5 = 正方形 - 边长减少，面积减少
 */
type ProblemTypeCode = 1 | 2 | 3 | 4 | 5;

/**
 * 生成长方形/正方形面积问题参数
 * 返回 Record<string, number> 以符合模板协议
 */
function generateAreaParams(level: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.quadratic_area[level] ||
                 DIFFICULTY_CONFIG.quadratic_area[1];

  // 随机选择问题类型 (1-5)
  const problemType = Math.floor(Math.random() * 5) + 1 as ProblemTypeCode;

  const params: Record<string, number> = {
    problemType,
  };

  switch (problemType) {
    case 1: {
      // 长方形 - 长是宽的k倍
      const width = generateRandomParams({ width: config.width }).width;
      const lengthRelation = generateRandomParams({ lengthRelation: config.lengthRelation }).lengthRelation;
      const length = width * lengthRelation;
      const area = length * width;

      params.width = width;
      params.length = length;
      params.lengthRelation = lengthRelation;
      params.area = area;
      break;
    }
    case 2: {
      // 长方形 - 长比宽多m
      const width = generateRandomParams({ width: config.width }).width;
      const increase = generateRandomParams({ increase: config.increase }).increase;
      const length = width + increase;
      const area = length * width;

      params.width = width;
      params.length = length;
      params.increase = increase;
      params.area = area;
      break;
    }
    case 3: {
      // 长方形 - 长比宽少m
      const length = generateRandomParams({ length: config.length }).length;
      const decrease = generateRandomParams({ decrease: config.decrease }).decrease;
      const width = length + decrease;
      const area = length * width;

      params.width = width;
      params.length = length;
      params.decrease = decrease;
      params.area = area;
      break;
    }
    case 4: {
      // 正方形 - 边长增加，面积增加
      const side = generateRandomParams({ side: config.side }).side;
      const increase = generateRandomParams({ increase: config.increase }).increase;
      const originalArea = side * side;
      const newArea = (side + increase) * (side + increase);
      const areaIncrease = newArea - originalArea;

      params.side = side;
      params.increase = increase;
      params.area = areaIncrease;
      break;
    }
    case 5: {
      // 正方形 - 边长减少，面积减少
      const side = generateRandomParams({ side: config.side }).side;
      const decrease = generateRandomParams({ decrease: config.decrease }).decrease;
      // 确保减少后边长为正
      const validSide = side > decrease ? side : decrease + 1;
      const originalArea = validSide * validSide;
      const newArea = (validSide - decrease) * (validSide - decrease);
      const areaDecrease = originalArea - newArea;

      params.side = validSide;
      params.decrease = decrease;
      params.area = areaDecrease;
      break;
    }
  }

  return params;
}

/**
 * 一元二次方程面积应用题模板
 */
export const QuadraticAreaTemplate: QuestionTemplate = {
  id: 'quadratic_area',
  knowledgePoint: 'quadratic_application',

  generateParams: (level: number) => {
    return generateAreaParams(level);
  },

  buildSteps: (params) => {
    const problemType = params.problemType as ProblemTypeCode;

    switch (problemType) {
      case 1: {
        // 长方形 - 长是宽的k倍
        const width = params.width!;
        const lengthRelation = params.lengthRelation!;

        return [
          {
            stepId: 's1',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '设宽为x，用含x的式子表示长',
              inputTarget: '长的表达式（系数）',
              inputHint: `长是宽的${lengthRelation}倍，如果宽为x，那么长是多少？（只填写${lengthRelation}x中的系数${lengthRelation}）`,
            },
          },
          {
            stepId: 's2',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '根据面积公式列出方程，求x²的系数',
              inputTarget: '方程中x²项的系数',
              inputHint: `长 × 宽 = 面积，即 ${lengthRelation}x × x = ${params.area}，展开后x²的系数是多少？`,
            },
          },
          {
            stepId: 's3',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '解方程求出宽的值',
              inputTarget: '宽的值',
              inputHint: '解方程 kx² = A，求出宽',
            },
          },
          {
            stepId: 's4',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '根据宽求出长',
              inputTarget: '长的值',
              inputHint: `长 = ${lengthRelation} × 宽`,
            },
          },
        ];
      }
      case 2: {
        // 长方形 - 长比宽多m
        const width = params.width!;
        const increase = params.increase!;

        return [
          {
            stepId: 's1',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '设宽为x，用含x的式子表示长',
              inputTarget: '长比宽多的数值',
              inputHint: `长比宽多${increase}，长的表达式是什么？（填写多出的数值${increase}）`,
            },
          },
          {
            stepId: 's2',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '根据面积公式列出方程，求x²的系数',
              inputTarget: '方程中x²项的系数',
              inputHint: `长 × 宽 = 面积，即 (x + ${increase}) × x = ${params.area}，展开后x²的系数是多少？`,
            },
          },
          {
            stepId: 's3',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '解方程求出宽的值',
              inputTarget: '宽的值',
              inputHint: '解方程 x(x + m) = A，求出宽',
            },
          },
          {
            stepId: 's4',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '根据宽求出长',
              inputTarget: '长的值',
              inputHint: `长 = 宽 + ${increase}`,
            },
          },
        ];
      }
      case 3: {
        // 长方形 - 长比宽少m
        const length = params.length!;
        const decrease = params.decrease!;

        return [
          {
            stepId: 's1',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '设长为x，用含x的式子表示宽',
              inputTarget: '宽比长少的数值',
              inputHint: `长比宽少${decrease}，即宽比长多${decrease}。宽的表达式是什么？（填写多的数值${decrease}）`,
            },
          },
          {
            stepId: 's2',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '根据面积公式列出方程，求x²的系数',
              inputTarget: '方程中x²项的系数',
              inputHint: `长 × 宽 = 面积，即 x × (x + ${decrease}) = ${params.area}，展开后x²的系数是多少？`,
            },
          },
          {
            stepId: 's3',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '解方程求出长的值',
              inputTarget: '长的值',
              inputHint: '解方程 x(x + m) = A，求出长',
            },
          },
          {
            stepId: 's4',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '根据长求出宽',
              inputTarget: '宽的值',
              inputHint: `宽 = 长 + ${decrease}`,
            },
          },
        ];
      }
      case 4: {
        // 正方形 - 边长增加，面积增加
        const side = params.side!;
        const increase = params.increase!;

        return [
          {
            stepId: 's1',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '设原边长为x，增加后的边长用含x的式子表示',
              inputTarget: '边长增加的数值',
              inputHint: `边长增加${increase}，如果原边长为x，增加后的边长是 x + ${increase}？（填写增加的数值${increase}）`,
            },
          },
          {
            stepId: 's2',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '根据面积差列出方程，展开后求x的系数',
              inputTarget: '方程中x的系数',
              inputHint: `增加后的面积 - 原面积 = ${params.area}，即 (x + ${increase})² - x² = ${params.area}，展开后x的系数是多少？（x²项会约掉）`,
            },
          },
          {
            stepId: 's3',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '解方程求出原边长',
              inputTarget: '原边长的值',
              inputHint: '解一元一次方程求出原边长',
            },
          },
        ];
      }
      case 5: {
        // 正方形 - 边长减少，面积减少
        const side = params.side!;
        const decrease = params.decrease!;

        return [
          {
            stepId: 's1',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '设原边长为x，减少后的边长用含x的式子表示',
              inputTarget: '边长减少的数值',
              inputHint: `边长减少${decrease}，如果原边长为x，减少后的边长是 x - ${decrease}？（填写减少的数值${decrease}）`,
            },
          },
          {
            stepId: 's2',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '根据面积差列出方程，展开后求x的系数',
              inputTarget: '方程中x的系数',
              inputHint: `原面积 - 减少后的面积 = ${params.area}，即 x² - (x - ${decrease})² = ${params.area}，展开后x的系数是多少？（x²项会约掉）`,
            },
          },
          {
            stepId: 's3',
            type: StepType.QUADRATIC_APPLICATION,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.001,
            ui: {
              instruction: '解方程求出原边长',
              inputTarget: '原边长的值',
              inputHint: '解一元一次方程求出原边长',
            },
          },
        ];
      }
      default:
        return [];
    }
  },

  render: (params) => {
    const problemType = params.problemType as ProblemTypeCode;

    switch (problemType) {
      case 1:
        // 长方形 - 长是宽的k倍
        return {
          title: `一个长方形的长是宽的${params.lengthRelation}倍，面积是${params.area}，求这个长方形的长和宽`,
          description: '面积应用题 - 长方形',
          context: '长方形面积公式：长 × 宽 = 面积。设宽为x，则长为kx，根据面积列方程。',
        };
      case 2:
        // 长方形 - 长比宽多m
        return {
          title: `一个长方形的宽比长少${params.increase}，面积是${params.area}，求这个长方形的长和宽`,
          description: '面积应用题 - 长方形',
          context: '长方形面积公式：长 × 宽 = 面积。设未知数，根据题意列出方程求解。',
        };
      case 3:
        // 长方形 - 长比宽少m
        return {
          title: `一个长方形的长比宽少${params.decrease}，面积是${params.area}，求这个长方形的长和宽`,
          description: '面积应用题 - 长方形',
          context: '长方形面积公式：长 × 宽 = 面积。设未知数，根据题意列出方程求解。',
        };
      case 4:
        // 正方形 - 边长增加，面积增加
        return {
          title: `一个正方形的边长增加${params.increase}后，面积增加了${params.area}，求原正方形的边长`,
          description: '面积应用题 - 正方形',
          context: '正方形面积公式：边长² = 面积。设原边长为x，根据面积变化列方程。',
        };
      case 5:
        // 正方形 - 边长减少，面积减少
        return {
          title: `一个正方形的边长减少${params.decrease}后，面积减少了${params.area}，求原正方形的边长`,
          description: '面积应用题 - 正方形',
          context: '正方形面积公式：边长² = 面积。设原边长为x，根据面积变化列方程。',
        };
      default:
        return {
          title: '面积应用题',
          description: '面积应用题',
          context: '根据面积公式建立方程求解',
        };
    }
  },
};
