import { describe, test, expect, afterAll, beforeEach } from '@jest/globals';
import { prisma } from '@/lib/prisma';

describe('Skeleton Model', () => {
  beforeEach(async () => {
    // Clean up any existing test data
    await prisma.skeleton.deleteMany({ where: { id: 'test_skeleton_task1' } });
  });

  afterAll(async () => {
    // Clean up test data after all tests
    await prisma.skeleton.deleteMany({ where: { id: 'test_skeleton_task1' } });
  });

  test('can create skeleton with default pending status', async () => {
    const skeleton = await prisma.skeleton.create({
      data: {
        id: 'test_skeleton_task1',
        stepType: 'COMPUTE_SQRT',
        name: '计算二次根式',
        config: {
          inputType: 'numeric',
          keyboard: 'numeric'
        },
        source: 'manual'
      }
    });

    expect(skeleton.status).toBe('pending');
    expect(skeleton.stepType).toBe('COMPUTE_SQRT');
    expect(skeleton.name).toBe('计算二次根式');
    expect(skeleton.source).toBe('manual');
    expect(skeleton.approvedBy).toBeNull();
  });

  test('skeleton config can store complex JSON structure', async () => {
    const complexConfig = {
      inputType: 'numeric',
      keyboard: 'scientific',
      validation: {
        min: 0,
        max: 10000,
        decimals: 4
      },
      hints: ['hint1', 'hint2'],
      tolerance: 0.0001
    };

    const skeleton = await prisma.skeleton.create({
      data: {
        id: 'test_skeleton_complex',
        stepType: 'COMPUTE_EXPR',
        name: '表达式计算',
        config: complexConfig,
        source: 'ai_generated'
      }
    });

    expect(skeleton.config).toEqual(complexConfig);
    expect((skeleton.config as Record<string, unknown>).validation).toBeDefined();

    // Clean up
    await prisma.skeleton.delete({ where: { id: 'test_skeleton_complex' } });
  });

  test('skeleton status transitions work correctly', async () => {
    // Create with pending status
    const skeleton = await prisma.skeleton.create({
      data: {
        id: 'test_skeleton_status',
        stepType: 'FRACTION_SIMPLIFY',
        name: '分数化简',
        config: { inputType: 'numeric' },
        source: 'manual'
      }
    });

    expect(skeleton.status).toBe('pending');

    // Update to approved
    const updated = await prisma.skeleton.update({
      where: { id: 'test_skeleton_status' },
      data: {
        status: 'approved',
        approvedBy: 'admin_user_123'
      }
    });

    expect(updated.status).toBe('approved');
    expect(updated.approvedBy).toBe('admin_user_123');

    // Clean up
    await prisma.skeleton.delete({ where: { id: 'test_skeleton_status' } });
  });
});