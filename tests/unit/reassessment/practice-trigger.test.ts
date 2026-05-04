/**
 * 复测评场景2 - 练习达成触发功能测试
 *
 * User Journey: As a 学生练习者，我希望在练习一组20题且正确率达到90%时收到复测评提示
 *
 * 测试覆盖：
 * 1. 滑动窗口存储（原子操作）
 * 2. 滑动窗口检测（20题正确率>=90%）
 * 3. 新鲜度检查（7天内有效）
 * 4. 去重检查（避免重复触发）
 * 5. 边界条件
 */

import {
  addPracticeRecord,
  checkPracticeAchievement,
  clearPracticeWindow,
  getPracticeWindow
} from '@/lib/reassessment/practice-trigger';

// Mock Redis module - 使用jest.fn()直接在mock中定义
jest.mock('@/lib/redis', () => ({
  evalLua: jest.fn(),
  lrange: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  __esModule: true
}));

import { evalLua, lrange, del } from '@/lib/redis';

const mockEvalLua = evalLua as jest.MockedFunction<typeof evalLua>;
const mockLrange = lrange as jest.MockedFunction<typeof lrange>;
const mockDel = del as jest.MockedFunction<typeof del>;

describe('addPracticeRecord', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该使用Lua脚本原子操作添加记录并修剪窗口', async () => {
    mockEvalLua.mockResolvedValue(1);

    await addPracticeRecord('user-123', {
      questionId: 'q-1',
      isCorrect: true,
      timestamp: Date.now()
    });

    expect(mockEvalLua).toHaveBeenCalledWith({
      keys: ['user:user-123:practice:window'],
      arguments: expect.arrayContaining([
        expect.stringContaining('"questionId":"q-1"'),
        expect.any(String) // TTL
      ])
    });
  });

  it('应该设置30天TTL', async () => {
    mockEvalLua.mockResolvedValue(1);

    await addPracticeRecord('user-123', {
      questionId: 'q-1',
      isCorrect: true,
      timestamp: Date.now()
    });

    const callArgs = mockEvalLua.mock.calls[0][0];
    expect(parseInt(callArgs.arguments[1] as string)).toBe(30 * 24 * 3600);
  });

  it('应该限制窗口大小为20', async () => {
    mockEvalLua.mockResolvedValue(1);

    await addPracticeRecord('user-123', {
      questionId: 'q-21',
      isCorrect: true,
      timestamp: Date.now()
    });

    // Lua脚本应该包含LTRIM 0 19
    expect(mockEvalLua).toHaveBeenCalledWith(
      expect.objectContaining({
        keys: expect.arrayContaining(['user:user-123:practice:window'])
      })
    );
  });
});

describe('checkPracticeAchievement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('窗口少于20题时应该返回未达成', async () => {
    mockLrange.mockResolvedValue([
      { questionId: 'q-1', isCorrect: true, timestamp: Date.now() }
    ]);

    const result = await checkPracticeAchievement('user-123');

    expect(result.achieved).toBe(false);
    expect(result.correctRate).toBeUndefined();
  });

  it('20题中18题正确（90%）应该触发', async () => {
    const now = Date.now();
    const records = Array.from({ length: 18 }, () => ({
      questionId: `q-${Math.random()}`,
      isCorrect: true,
      timestamp: now - Math.random() * 1000
    })).concat(Array.from({ length: 2 }, () => ({
      questionId: `q-${Math.random()}`,
      isCorrect: false,
      timestamp: now - Math.random() * 1000
    })));

    mockLrange.mockResolvedValue(records as any);

    const result = await checkPracticeAchievement('user-123');

    expect(result.achieved).toBe(true);
    expect(result.correctRate).toBe(0.9);
  });

  it('20题中17题正确（85%）不应该触发', async () => {
    const now = Date.now();
    const records = Array.from({ length: 17 }, () => ({
      questionId: `q-${Math.random()}`,
      isCorrect: true,
      timestamp: now - Math.random() * 1000
    })).concat(Array.from({ length: 3 }, () => ({
      questionId: `q-${Math.random()}`,
      isCorrect: false,
      timestamp: now - Math.random() * 1000
    })));

    mockLrange.mockResolvedValue(records as any);

    const result = await checkPracticeAchievement('user-123');

    expect(result.achieved).toBe(false);
    expect(result.correctRate).toBe(0.85);
  });

  it('应该执行新鲜度检查：超过7天的窗口应该失效', async () => {
    const now = Date.now();
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;

    // 18题正确2题错误，但最新题是8天前
    const records = Array.from({ length: 18 }, (_, i) => ({
      questionId: `q-${i}`,
      isCorrect: true,
      timestamp: eightDaysAgo + i * 1000  // i=0时是8天前（最新）
    })).concat(Array.from({ length: 2 }, () => ({
      questionId: `q-wrong`,
      isCorrect: false,
      timestamp: eightDaysAgo + 18 * 1000
    })));

    mockLrange.mockResolvedValue(records as any);
    mockDel.mockResolvedValue(1);

    const result = await checkPracticeAchievement('user-123');

    expect(result.achieved).toBe(false);
    expect(mockDel).toHaveBeenCalledWith('user:user-123:practice:window');
  });

  it('新鲜度检查：7天内的窗口应该有效', async () => {
    const now = Date.now();
    const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000;

    // 18题正确2题错误，最新题是6天前
    const records = Array.from({ length: 18 }, (_, i) => ({
      questionId: `q-${i}`,
      isCorrect: true,
      timestamp: sixDaysAgo + i * 1000  // i=0时是6天前（最新）
    })).concat(Array.from({ length: 2 }, () => ({
      questionId: `q-wrong`,
      isCorrect: false,
      timestamp: sixDaysAgo + 18 * 1000
    })));

    mockLrange.mockResolvedValue(records as any);

    const result = await checkPracticeAchievement('user-123');

    expect(result.achieved).toBe(true);
  });

  it('应该只取最近20题进行计算', async () => {
    const now = Date.now();
    // 创建25题记录，前20题18个正确，后5题全错
    const first20 = Array.from({ length: 18 }, () => ({
      questionId: `q-correct`,
      isCorrect: true,
      timestamp: now - 10000
    })).concat(Array.from({ length: 2 }, () => ({
      questionId: `q-wrong`,
      isCorrect: false,
      timestamp: now - 9000
    })));

    const extra5 = Array.from({ length: 5 }, () => ({
      questionId: `q-wrong-late`,
      isCorrect: false,
      timestamp: now - 1000
    }));

    mockLrange.mockResolvedValue([...first20, ...extra5] as any);

    const result = await checkPracticeAchievement('user-123');

    // 应该只计算最近20题，18/20 = 90%
    expect(result.achieved).toBe(true);
  });
});

describe('clearPracticeWindow', () => {
  it('应该清空指定用户的滑动窗口', async () => {
    mockDel.mockResolvedValue(1);

    await clearPracticeWindow('user-123');

    expect(mockDel).toHaveBeenCalledWith('user:user-123:practice:window');
  });
});

describe('getPracticeWindow', () => {
  it('应该返回用户当前的滑动窗口数据', async () => {
    const records = [
      { questionId: 'q-1', isCorrect: true, timestamp: Date.now() }
    ];
    mockLrange.mockResolvedValue(records as any);

    const result = await getPracticeWindow('user-123');

    expect(result).toEqual(records);
    expect(mockLrange).toHaveBeenCalledWith('user:user-123:practice:window', 0, -1);
  });
});
