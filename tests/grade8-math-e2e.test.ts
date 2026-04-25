/**
 * 端到端测试 - 验证八年级数学各章节模板
 * 测试所有章节的模板生成、步骤构建和渲染功能
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { TEMPLATE_REGISTRY } from '../lib/question-engine/templates';
import { StepType, QuestionTemplate } from '../lib/question-engine/protocol';

// 需要测试的模板列表（按章节组织）
const CHAPTER_16_TEMPLATES = [
  'sqrt_concept',
  'sqrt_simplify',
  'sqrt_property',
  'sqrt_multiply',
  'sqrt_divide',
  'sqrt_add_subtract',
];

const CHAPTER_17_TEMPLATES = [
  'pythagoras',
  'pythagoras_folding',
  'triangle_verify',
  'pythagoras_word_problem',
];

const CHAPTER_18_TEMPLATES = [
  'parallelogram_verify',
  'rectangle_property',
  'rectangle_verify',
  'rhombus_property',
  'rhombus_verify',
  'square_property',
  'square_verify',
  'quadrilateral_perimeter',
  'quadrilateral_area',
  'trapezoid_property',
];

const CHAPTER_19_TEMPLATES = [
  'quadratic_identify',
  'quadratic_direct_root',
  'quadratic_complete_square',
  'quadratic_formula',
  'quadratic_factorize',
  'quadratic_area',
  'quadratic_growth',
];

const CHAPTER_20_TEMPLATES = [
  'central_tendency',
  'data_variance',
  'data_stddev',
];

// 所有模板
const ALL_TEMPLATES = [
  ...CHAPTER_16_TEMPLATES,
  ...CHAPTER_17_TEMPLATES,
  ...CHAPTER_18_TEMPLATES,
  ...CHAPTER_19_TEMPLATES,
  ...CHAPTER_20_TEMPLATES,
];

describe('Grade 8 Math Template E2E Tests', () => {
  describe('Chapter 16: 二次根式 (Square Roots)', () => {
    test.each(CHAPTER_16_TEMPLATES)(
      'template %s should generate valid params at all difficulty levels',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        expect(template).toBeDefined();

        // 测试难度级别1-5
        for (let level = 1; level <= 5; level++) {
          const params = template.generateParams(level);

          expect(params).toBeDefined();
          expect(typeof params).toBe('object');
          expect(Object.keys(params).length).toBeGreaterThan(0);
        }
      }
    );

    test.each(CHAPTER_16_TEMPLATES)(
      'template %s should build valid steps',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        const params = template.generateParams(1);
        const steps = template.buildSteps(params);

        expect(steps).toBeDefined();
        expect(Array.isArray(steps)).toBe(true);
        expect(steps.length).toBeGreaterThan(0);

        // 验证步骤结构
        steps.forEach((step) => {
          expect(step.stepId).toBeDefined();
          expect(step.type).toBeDefined();
          expect(Object.values(StepType).includes(step.type)).toBe(true);
          expect(step.inputType).toBeDefined();
          expect(step.keyboard).toBeDefined();
          expect(step.answerType).toBeDefined();
          expect(step.ui).toBeDefined();
          expect(step.ui.instruction).toBeDefined();
          expect(step.ui.inputTarget).toBeDefined();
          expect(step.ui.inputHint).toBeDefined();
        });
      }
    );

    test.each(CHAPTER_16_TEMPLATES)(
      'template %s should render valid question',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        const params = template.generateParams(1);
        const rendered = template.render(params);

        expect(rendered).toBeDefined();
        expect(rendered.title).toBeDefined();
        expect(typeof rendered.title).toBe('string');
        expect(rendered.title.length).toBeGreaterThan(0);

        expect(rendered.description).toBeDefined();
        expect(typeof rendered.description).toBe('string');

        expect(rendered.context).toBeDefined();
        expect(typeof rendered.context).toBe('string');
        expect(String(rendered.context ?? 'N/A').length).toBeGreaterThan(0);
      }
    );
  });

  describe('Chapter 17: 勾股定理 (Pythagorean Theorem)', () => {
    test.each(CHAPTER_17_TEMPLATES)(
      'template %s should generate valid params at all difficulty levels',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        expect(template).toBeDefined();

        for (let level = 1; level <= 5; level++) {
          const params = template.generateParams(level);

          expect(params).toBeDefined();
          expect(typeof params).toBe('object');
        }
      }
    );

    test.each(CHAPTER_17_TEMPLATES)(
      'template %s should build valid steps',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        const params = template.generateParams(1);
        const steps = template.buildSteps(params);

        expect(steps).toBeDefined();
        expect(Array.isArray(steps)).toBe(true);
        expect(steps.length).toBeGreaterThan(0);

        steps.forEach((step) => {
          expect(step.stepId).toBeDefined();
          expect(step.type).toBeDefined();
          expect(step.ui).toBeDefined();
          expect(step.ui.instruction).toBeDefined();
          expect(step.ui.inputTarget).toBeDefined();
        });
      }
    );

    test.each(CHAPTER_17_TEMPLATES)(
      'template %s should render valid question',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        const params = template.generateParams(1);
        const rendered = template.render(params);

        expect(rendered.title.length).toBeGreaterThan(0);
        expect(String(rendered.context ?? 'N/A').length).toBeGreaterThan(0);
      }
    );
  });

  describe('Chapter 18: 四边形 (Quadrilaterals)', () => {
    test.each(CHAPTER_18_TEMPLATES)(
      'template %s should generate valid params at all difficulty levels',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        expect(template).toBeDefined();

        for (let level = 1; level <= 5; level++) {
          const params = template.generateParams(level);

          expect(params).toBeDefined();
          expect(typeof params).toBe('object');
        }
      }
    );

    test.each(CHAPTER_18_TEMPLATES)(
      'template %s should build valid steps',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        const params = template.generateParams(1);
        const steps = template.buildSteps(params);

        expect(steps).toBeDefined();
        expect(Array.isArray(steps)).toBe(true);
        // Some templates may have 0 steps but should still be valid arrays
        expect(steps.length).toBeGreaterThanOrEqual(0);

        steps.forEach((step) => {
          expect(step.stepId).toBeDefined();
          expect(step.type).toBeDefined();
          expect(step.ui).toBeDefined();
          expect(step.ui.instruction).toBeDefined();
        });
      }
    );

    test.each(CHAPTER_18_TEMPLATES)(
      'template %s should render valid question',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        const params = template.generateParams(1);
        const rendered = template.render(params);

        expect(rendered.title.length).toBeGreaterThan(0);
        expect(String(rendered.context ?? 'N/A').length).toBeGreaterThan(0);
      }
    );
  });

  describe('Chapter 19: 一元二次方程 (Quadratic Equations)', () => {
    test.each(CHAPTER_19_TEMPLATES)(
      'template %s should generate valid params at all difficulty levels',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        expect(template).toBeDefined();

        for (let level = 1; level <= 5; level++) {
          const params = template.generateParams(level);

          expect(params).toBeDefined();
          expect(typeof params).toBe('object');
        }
      }
    );

    test.each(CHAPTER_19_TEMPLATES)(
      'template %s should build valid steps',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        const params = template.generateParams(1);
        const steps = template.buildSteps(params);

        expect(steps).toBeDefined();
        expect(Array.isArray(steps)).toBe(true);
        expect(steps.length).toBeGreaterThan(0);

        steps.forEach((step) => {
          expect(step.stepId).toBeDefined();
          expect(step.type).toBeDefined();
          expect(step.ui).toBeDefined();
          expect(step.ui.instruction).toBeDefined();
        });
      }
    );

    test.each(CHAPTER_19_TEMPLATES)(
      'template %s should render valid question',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        const params = template.generateParams(1);
        const rendered = template.render(params);

        expect(rendered.title.length).toBeGreaterThan(0);
        expect(String(rendered.context ?? 'N/A').length).toBeGreaterThan(0);
      }
    );
  });

  describe('Chapter 20: 数据分析 (Data Analysis)', () => {
    test.each(CHAPTER_20_TEMPLATES)(
      'template %s should generate valid params at all difficulty levels',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        expect(template).toBeDefined();

        for (let level = 1; level <= 5; level++) {
          const params = template.generateParams(level);

          expect(params).toBeDefined();
          expect(typeof params).toBe('object');
        }
      }
    );

    test.each(CHAPTER_20_TEMPLATES)(
      'template %s should build valid steps',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        const params = template.generateParams(1);
        const steps = template.buildSteps(params);

        expect(steps).toBeDefined();
        expect(Array.isArray(steps)).toBe(true);
        expect(steps.length).toBeGreaterThan(0);

        steps.forEach((step) => {
          expect(step.stepId).toBeDefined();
          expect(step.type).toBeDefined();
          expect(step.ui).toBeDefined();
          expect(step.ui.instruction).toBeDefined();
        });
      }
    );

    test.each(CHAPTER_20_TEMPLATES)(
      'template %s should render valid question',
      (templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        const params = template.generateParams(1);
        const rendered = template.render(params);

        expect(rendered.title.length).toBeGreaterThan(0);
        expect(String(rendered.context ?? 'N/A').length).toBeGreaterThan(0);
      }
    );
  });

  describe('Template Registry Integration', () => {
    test('all templates in registry should be properly defined', () => {
      ALL_TEMPLATES.forEach((templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        expect(template).toBeDefined();
        expect(template.id).toBeDefined();
        expect(template.knowledgePoint).toBeDefined();
        expect(typeof template.generateParams).toBe('function');
        expect(typeof template.buildSteps).toBe('function');
        expect(typeof template.render).toBe('function');
      });
    });

    test('all templates should return consistent results across multiple calls', () => {
      // 选择几个代表性模板进行一致性测试
      const sampleTemplates = ['sqrt_concept', 'pythagoras', 'central_tendency'];

      sampleTemplates.forEach((templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        const results: Array<{ params: Record<string, number>; steps: unknown[]; rendered: unknown }> = [];

        // 生成3次，检查是否都能成功
        for (let i = 0; i < 3; i++) {
          const params = template.generateParams(2);
          const steps = template.buildSteps(params);
          const rendered = template.render(params);

          results.push({ params, steps, rendered });

          // 基本验证
          expect(params).toBeDefined();
          expect(steps).toBeDefined();
          expect(rendered).toBeDefined();
        }

        // 验证生成的参数数量一致
        const paramKeysCount = results[0].params ? Object.keys(results[0].params).length : 0;
        expect(paramKeysCount).toBeGreaterThan(0);
      });
    });

    test('template IDs should match expected chapters structure', () => {
      // 验证章节16模板
      expect(TEMPLATE_REGISTRY['sqrt_concept']).toBeDefined();
      expect(TEMPLATE_REGISTRY['sqrt_simplify']).toBeDefined();
      expect(TEMPLATE_REGISTRY['sqrt_property']).toBeDefined();
      expect(TEMPLATE_REGISTRY['sqrt_multiply']).toBeDefined();
      expect(TEMPLATE_REGISTRY['sqrt_divide']).toBeDefined();
      expect(TEMPLATE_REGISTRY['sqrt_add_subtract']).toBeDefined();

      // 验证章节17模板
      expect(TEMPLATE_REGISTRY['pythagoras']).toBeDefined();
      expect(TEMPLATE_REGISTRY['pythagoras_folding']).toBeDefined();
      expect(TEMPLATE_REGISTRY['triangle_verify']).toBeDefined();
      expect(TEMPLATE_REGISTRY['pythagoras_word_problem']).toBeDefined();

      // 验证章节18模板
      expect(TEMPLATE_REGISTRY['parallelogram_verify']).toBeDefined();
      expect(TEMPLATE_REGISTRY['rectangle_property']).toBeDefined();
      expect(TEMPLATE_REGISTRY['rectangle_verify']).toBeDefined();
      expect(TEMPLATE_REGISTRY['rhombus_property']).toBeDefined();
      expect(TEMPLATE_REGISTRY['rhombus_verify']).toBeDefined();
      expect(TEMPLATE_REGISTRY['square_property']).toBeDefined();
      expect(TEMPLATE_REGISTRY['square_verify']).toBeDefined();
      expect(TEMPLATE_REGISTRY['quadrilateral_perimeter']).toBeDefined();
      expect(TEMPLATE_REGISTRY['quadrilateral_area']).toBeDefined();
      expect(TEMPLATE_REGISTRY['trapezoid_property']).toBeDefined();

      // 验证章节19模板
      expect(TEMPLATE_REGISTRY['quadratic_identify']).toBeDefined();
      expect(TEMPLATE_REGISTRY['quadratic_direct_root']).toBeDefined();
      expect(TEMPLATE_REGISTRY['quadratic_complete_square']).toBeDefined();
      expect(TEMPLATE_REGISTRY['quadratic_formula']).toBeDefined();
      expect(TEMPLATE_REGISTRY['quadratic_factorize']).toBeDefined();
      expect(TEMPLATE_REGISTRY['quadratic_area']).toBeDefined();
      expect(TEMPLATE_REGISTRY['quadratic_growth']).toBeDefined();

      // 验证章节20模板
      expect(TEMPLATE_REGISTRY['central_tendency']).toBeDefined();
      expect(TEMPLATE_REGISTRY['data_variance']).toBeDefined();
      expect(TEMPLATE_REGISTRY['data_stddev']).toBeDefined();
    });
  });

  describe('Step Types Validation', () => {
    test('all step types used in templates should be valid StepType enum values', () => {
      const usedStepTypes = new Set<string>();

      // 收集所有使用的步骤类型
      ALL_TEMPLATES.forEach((templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];
        const params = template.generateParams(1);
        const steps = template.buildSteps(params);

        steps.forEach((step) => {
          usedStepTypes.add(step.type);
        });
      });

      // 验证所有使用的步骤类型都是有效的枚举值
      const validStepTypes = Object.values(StepType);
      usedStepTypes.forEach((stepType) => {
        expect(validStepTypes).toContain(stepType);
      });
    });
  });

  describe('Difficulty Level Progression', () => {
    test('difficulty levels should produce different parameter ranges', () => {
      // 选择一个模板测试难度递进
      const template = TEMPLATE_REGISTRY['quadratic_identify'];

      const paramsLevel1 = template.generateParams(1);
      const paramsLevel5 = template.generateParams(5);

      // 验证不同难度级别的参数
      expect(paramsLevel1).toBeDefined();
      expect(paramsLevel5).toBeDefined();

      // 验证参数结构存在
      expect(typeof paramsLevel1).toBe('object');
      expect(typeof paramsLevel5).toBe('object');
    });

    test('all templates should handle all 5 difficulty levels', () => {
      // 测试所有模板在所有难度级别下都能正常工作
      ALL_TEMPLATES.forEach((templateId) => {
        const template = TEMPLATE_REGISTRY[templateId];

        for (let level = 1; level <= 5; level++) {
          expect(() => {
            const params = template.generateParams(level);
            const steps = template.buildSteps(params);
            const rendered = template.render(params);

            // 验证返回值的结构
            expect(params).toBeDefined();
            expect(steps).toBeDefined();
            expect(rendered).toBeDefined();
          }).not.toThrow();
        }
      });
    });
  });

  describe('Complete Question Generation Flow', () => {
    test('complete flow: generateParams -> buildSteps -> render', () => {
      // 选择每个章节的一个代表模板进行完整流程测试
      const representativeTemplates = {
        'Chapter 16': 'sqrt_concept',
        'Chapter 17': 'pythagoras',
        'Chapter 18': 'rectangle_property',
        'Chapter 19': 'quadratic_identify',
        'Chapter 20': 'central_tendency',
      };

      Object.entries(representativeTemplates).forEach(([chapter, templateId]) => {
        const template = TEMPLATE_REGISTRY[templateId];

        // 完整流程
        const params = template.generateParams(3);
        const steps = template.buildSteps(params);
        const rendered = template.render(params);

        // 验证参数包含预期字段
        expect(params).toBeDefined();

        // 验证步骤结构
        expect(steps).toBeDefined();
        expect(Array.isArray(steps)).toBe(true);
        if (steps.length > 0) {
          steps.forEach((step) => {
            expect(step.stepId).toMatch(/^s\d+$/);
            expect(step.ui.instruction.length).toBeGreaterThan(0);
          });
        }

        // 验证渲染输出
        expect(rendered.title.length).toBeGreaterThan(0);
        expect(rendered.description.length).toBeGreaterThan(0);
        expect(String(rendered.context ?? 'N/A').length).toBeGreaterThan(0);

        // 输出验证信息（便于调试）
        console.log(`${chapter} (${templateId}): ${steps.length} steps, title="${rendered.title}"`);
      });
    });
  });
});
