/**
 * 矩形性质计算模板
 * 矩形性质：
 * 1. 四个角都是直角
 * 2. 对角线相等
 * 3. 对角线把矩形分成四个全等的直角三角形
 */

import { QuestionTemplate } from '../../protocol';
import { AnswerMode, StepProtocolV2 } from '../../protocol-v2';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
} from '../../difficulty';

/**
 * 计算类型
 */
type ComputeType = 'diagonal_length' | 'angle_check' | 'triangle_area';

/**
 * 矩形性质计算模板
 */
export const RectanglePropertyTemplate: QuestionTemplate = {
  id: 'rectangle_property',
  knowledgePoint: 'rectangle_property',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.rectangle_property[level] ||
                   DIFFICULTY_CONFIG.rectangle_property[1];

    const params = generateRandomParams(config);

    // 确定计算类型
    let computeType: ComputeType;
    if (level <= 2) {
      // 基础：计算对角线长度（勾股定理）
      computeType = 'diagonal_length';
      params.computeType = 0;
    } else if (level <= 4) {
      // 中等：增加角度验证
      const rand = Math.random();
      if (rand < 0.6) computeType = 'diagonal_length';
      else computeType = 'angle_check';
      params.computeType = computeType === 'diagonal_length' ? 0 : 1;
    } else {
      // 高级：包含三角形面积计算
      const rand = Math.random();
      if (rand < 0.4) computeType = 'diagonal_length';
      else if (rand < 0.7) computeType = 'angle_check';
      else computeType = 'triangle_area';
      params.computeType = computeType === 'diagonal_length' ? 0 :
                          computeType === 'angle_check' ? 1 : 2;
    }

    // 确保宽和高是勾股数或整数，便于计算
    if (computeType === 'diagonal_length' || computeType === 'triangle_area') {
      // 尝试生成整数勾股数
      const pythagoreanPairs = [
        [3, 4], [5, 12], [8, 15], [7, 24], [9, 40],
        [5, 5], [6, 8], [9, 12], [10, 24]
      ];
      const pair = pythagoreanPairs[Math.floor(Math.random() * pythagoreanPairs.length)];
      params.width = pair[0];
      params.height = pair[1];
    }

    // 计算答案
    let answer: number;
    switch (computeType) {
      case 'diagonal_length':
        answer = Math.sqrt(params.width ** 2 + params.height ** 2);
        break;
      case 'angle_check':
        answer = 90;
        break;
      case 'triangle_area':
        answer = (params.width * params.height) / 2;
        break;
      default:
        answer = Math.sqrt(params.width ** 2 + params.height ** 2);
    }

    params.answer = Math.round(answer * 100) / 100;
    params.level = level;

    return params;
  },

  buildSteps: (params): StepProtocolV2[] => {
    const computeType: ComputeType =
      params.computeType === 1 ? 'angle_check' :
      params.computeType === 2 ? 'triangle_area' : 'diagonal_length';

    const width = params.width!;
    const height = params.height!;

    switch (computeType) {
      case 'diagonal_length': {
        const diagonal = Math.sqrt(width ** 2 + height ** 2);
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.NUMBER,
            ui: {
              instruction: '应用矩形性质：识别已知条件',
              hint: `矩形宽为${width}，高为${height}，应用勾股定理计算对角线`,
            },
            expectedAnswer: { type: 'number', value: width * width + height * height },
            keyboard: { type: 'numeric' },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.NUMBER,
            ui: {
              instruction: '利用勾股定理计算对角线长度',
              hint: `对角线² = 宽² + 高² = ${width}² + ${height}² = ${width * width + height * height}`,
            },
            expectedAnswer: { type: 'number', value: Math.round(diagonal * 100) / 100, tolerance: 0.01 },
            keyboard: { type: 'numeric' },
          },
        ];
      }

      case 'angle_check': {
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.NUMBER,
            ui: {
              instruction: '确定矩形内角的度数',
              hint: '矩形四个角都是直角',
            },
            expectedAnswer: { type: 'number', value: 90 },
            keyboard: { type: 'numeric' },
          },
        ];
      }

      case 'triangle_area': {
        const area = (width * height) / 2;
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.NUMBER,
            ui: {
              instruction: '应用矩形性质：识别已知条件',
              hint: `矩形宽为${width}，高为${height}，对角线把矩形分成两个直角三角形`,
            },
            expectedAnswer: { type: 'number', value: width * height },
            keyboard: { type: 'numeric' },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.NUMBER,
            ui: {
              instruction: '计算直角三角形面积',
              hint: `三角形面积 = 矩形面积 ÷ 2 = (宽 × 高) ÷ 2 = (${width} × ${height}) ÷ 2`,
            },
            expectedAnswer: { type: 'number', value: area },
            keyboard: { type: 'numeric' },
          },
        ];
      }

      default:
        return [];
    }
  },

  render: (params) => {
    const computeType: ComputeType =
      params.computeType === 1 ? 'angle_check' :
      params.computeType === 2 ? 'triangle_area' : 'diagonal_length';

    let context: string;
    let title: string;

    switch (computeType) {
      case 'diagonal_length':
        context = `矩形ABCD中，AB=${params.width}，BC=${params.height}，求对角线AC的长度`;
        title = '矩形对角线长度计算';
        break;
      case 'angle_check':
        context = `矩形ABCD中，每个内角的度数是多少？`;
        title = '矩形内角度数';
        break;
      case 'triangle_area':
        context = `矩形ABCD中，AB=${params.width}，BC=${params.height}，对角线AC把矩形分成两个直角三角形，求其中一个三角形的面积`;
        title = '矩形分割三角形面积';
        break;
      default:
        context = `矩形ABCD中，AB=${params.width}，BC=${params.height}，求对角线AC的长度`;
        title = '矩形性质计算';
    }

    return {
      title,
      description: '利用矩形性质进行计算',
      context,
    };
  },
};
