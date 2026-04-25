import { describe, test, expect } from '@jest/globals';
import type {
  SkeletonConfig,
  DifficultyConfig,
  ParseResult,
  MaterialType,
  StepTypeKey,
  ParamConstraint,
  TextbookChapter,
  QuestionSample
} from '../types';

describe('Template Factory Types', () => {
  test('SkeletonConfig has correct structure', () => {
    const config: SkeletonConfig = {
      inputType: 'numeric',
      keyboard: 'numeric',
      validation: { radicand: { min: 0 } }
    };
    expect(config.inputType).toBe('numeric');
    expect(config.keyboard).toBe('numeric');
    expect(config.validation?.radicand).toEqual({ min: 0 });
  });

  test('SkeletonConfig accepts all valid input types', () => {
    const types: SkeletonConfig['inputType'][] = ['numeric', 'coordinate', 'fraction', 'expression'];
    types.forEach((type) => {
      const config: SkeletonConfig = { inputType: type, keyboard: 'numeric' };
      expect(config.inputType).toBe(type);
    });
  });

  test('SkeletonConfig accepts all valid keyboard types', () => {
    const types: SkeletonConfig['keyboard'][] = ['numeric', 'coordinate', 'fraction', 'full'];
    types.forEach((type) => {
      const config: SkeletonConfig = { inputType: 'numeric', keyboard: type };
      expect(config.keyboard).toBe(type);
    });
  });

  test('DifficultyConfig supports different constraint types', () => {
    const config: DifficultyConfig = {
      level: 2,
      constraints: [
        { param: 'radicand', type: 'int', min: 1, max: 144 },
        { param: 'radicand', type: 'special', values: [2, 3, 5] }
      ]
    };
    expect(config.constraints).toHaveLength(2);
    expect(config.level).toBe(2);
  });

  test('DifficultyConfig with range constraint', () => {
    const config: DifficultyConfig = {
      level: 3,
      constraints: [
        { param: 'side', type: 'range', min: 1, max: 100 }
      ]
    };
    expect(config.constraints[0].type).toBe('range');
    expect(config.constraints[0].min).toBe(1);
    expect(config.constraints[0].max).toBe(100);
  });

  test('DifficultyConfig with perfect_square constraint', () => {
    const config: DifficultyConfig = {
      level: 1,
      constraints: [
        { param: 'radicand', type: 'perfect_square' }
      ]
    };
    expect(config.constraints[0].type).toBe('perfect_square');
    expect(config.constraints[0].param).toBe('radicand');
  });

  test('MaterialType supports all variants', () => {
    const types: MaterialType[] = ['textbook', 'question_bank', 'mixed'];
    types.forEach((type) => {
      const config = { materialType: type };
      expect(config.materialType).toBe(type);
    });
  });

  test('StepTypeKey includes all valid step types', () => {
    const validSteps: StepTypeKey[] = [
      'COMPUTE_SQRT',
      'SIMPLIFY_SQRT',
      'SQRT_MIXED',
      'VERIFY_RIGHT_ANGLE',
      'VERIFY_PARALLELOGRAM',
      'VERIFY_RECTANGLE',
      'VERIFY_RHOMBUS',
      'VERIFY_SQUARE',
      'COMPUTE_RECT_PROPERTY',
      'COMPUTE_RHOMBUS_PROPERTY',
      'COMPUTE_SQUARE_PROPERTY',
      'IDENTIFY_QUADRATIC',
      'SOLVE_DIRECT_ROOT',
      'SOLVE_COMPLETE_SQUARE',
      'SOLVE_QUADRATIC_FORMULA',
      'SOLVE_FACTORIZE',
      'QUADRATIC_APPLICATION',
      'COMPUTE_MEAN',
      'COMPUTE_MEDIAN',
      'COMPUTE_MODE',
      'COMPUTE_VARIANCE',
      'COMPUTE_STDDEV'
    ];

    validSteps.forEach((step) => {
      const result: ParseResult<{ stepType: StepTypeKey }> = {
        success: true,
        data: { stepType: step }
      };
      expect(result.data?.stepType).toBe(step);
    });
  });

  test('ParseResult success structure', () => {
    const result: ParseResult<DifficultyConfig> = {
      success: true,
      data: {
        level: 1,
        constraints: [{ param: 'test', type: 'int' }]
      }
    };
    expect(result.success).toBe(true);
    expect(result.data?.level).toBe(1);
    expect(result.errors).toBeUndefined();
  });

  test('ParseResult error structure', () => {
    const result: ParseResult<DifficultyConfig> = {
      success: false,
      errors: [
        { field: 'level', message: 'Level must be positive' },
        { field: 'constraints', message: 'At least one constraint required' }
      ]
    };
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.data).toBeUndefined();
  });

  test('TextbookChapter structure', () => {
    const chapter: TextbookChapter = {
      number: 16,
      name: '二次根式',
      knowledgePoints: [
        { name: '平方根概念', weight: 1.0 },
        { name: '二次根式乘法', weight: 0.8 }
      ]
    };
    expect(chapter.number).toBe(16);
    expect(chapter.knowledgePoints).toHaveLength(2);
    expect(chapter.knowledgePoints[0].weight).toBe(1.0);
  });

  test('QuestionSample structure', () => {
    const sample: QuestionSample = {
      content: '化简 √144',
      difficulty: 2,
      answer: '12',
      stepType: 'SIMPLIFY_SQRT',
      knowledgePoint: '完全平方数'
    };
    expect(sample.stepType).toBe('SIMPLIFY_SQRT');
    expect(sample.difficulty).toBe(2);
    expect(sample.answer).toBe('12');
  });

  test('ParamConstraint types', () => {
    const constraints: ParamConstraint[] = [
      { param: 'a', type: 'int', min: 1, max: 100 },
      { param: 'b', type: 'perfect_square' },
      { param: 'c', type: 'range', min: 0, max: 10 },
      { param: 'd', type: 'special', values: [2, 3, 5, 7] }
    ];

    expect(constraints[0].type).toBe('int');
    expect(constraints[1].type).toBe('perfect_square');
    expect(constraints[2].type).toBe('range');
    expect(constraints[3].type).toBe('special');
    expect(constraints[3].values).toEqual([2, 3, 5, 7]);
  });
});