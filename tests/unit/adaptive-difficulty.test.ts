/**
 * 诊断测评难度自适应单元测试
 * 测试 calculateNextDiagnosticDifficulty, shouldEnterPracticeMode, isDiagnosticBoundaryCase
 */
import {
  calculateNextDiagnosticDifficulty,
  shouldEnterPracticeMode,
  isDiagnosticBoundaryCase,
  getDifficultyDescription,
} from '@/lib/adaptive-difficulty'

describe('calculateNextDiagnosticDifficulty', () => {
  it('0-49%: 难度-3级', () => {
    expect(calculateNextDiagnosticDifficulty(6, 45)).toBe(3)
    expect(calculateNextDiagnosticDifficulty(5, 30)).toBe(2)
  })

  it('50-59%: 难度-1级', () => {
    expect(calculateNextDiagnosticDifficulty(6, 55)).toBe(5)
    expect(calculateNextDiagnosticDifficulty(3, 59)).toBe(2)
  })

  it('60-89%: 不调整难度', () => {
    expect(calculateNextDiagnosticDifficulty(6, 75)).toBe(6)
    expect(calculateNextDiagnosticDifficulty(1, 60)).toBe(1)
    expect(calculateNextDiagnosticDifficulty(12, 89)).toBe(12)
  })

  it('90-94%: 难度+1级', () => {
    expect(calculateNextDiagnosticDifficulty(6, 92)).toBe(7)
    expect(calculateNextDiagnosticDifficulty(11, 90)).toBe(12)
  })

  it('95-100%: 难度+2级', () => {
    expect(calculateNextDiagnosticDifficulty(6, 98)).toBe(8)
    expect(calculateNextDiagnosticDifficulty(10, 100)).toBe(12)
  })

  it('边界: 难度1降低后仍是1', () => {
    expect(calculateNextDiagnosticDifficulty(1, 30)).toBe(1)
    expect(calculateNextDiagnosticDifficulty(1, 0)).toBe(1)
  })

  it('边界: 难度12提高后仍是12', () => {
    expect(calculateNextDiagnosticDifficulty(12, 98)).toBe(12)
    expect(calculateNextDiagnosticDifficulty(12, 100)).toBe(12)
  })

  it('边界值60: 进入练习（不调整）', () => {
    expect(calculateNextDiagnosticDifficulty(6, 60)).toBe(6)
  })

  it('边界值90: 提高1级（重新测评）', () => {
    expect(calculateNextDiagnosticDifficulty(6, 90)).toBe(7)
  })
})

describe('shouldEnterPracticeMode', () => {
  it('60-89分: 返回true', () => {
    expect(shouldEnterPracticeMode(60)).toBe(true)
    expect(shouldEnterPracticeMode(75)).toBe(true)
    expect(shouldEnterPracticeMode(89)).toBe(true)
  })

  it('其他分数: 返回false', () => {
    expect(shouldEnterPracticeMode(59)).toBe(false)
    expect(shouldEnterPracticeMode(90)).toBe(false)
    expect(shouldEnterPracticeMode(0)).toBe(false)
    expect(shouldEnterPracticeMode(100)).toBe(false)
  })
})

describe('isDiagnosticBoundaryCase', () => {
  it('难度1且<60%: 边界情况', () => {
    const result = isDiagnosticBoundaryCase(1, 30)
    expect(result.isBoundary).toBe(true)
    expect(result.reason).toBe('最低难度')
  })

  it('难度12且≥90%: 边界情况', () => {
    const result = isDiagnosticBoundaryCase(12, 95)
    expect(result.isBoundary).toBe(true)
    expect(result.reason).toBe('最高难度')
  })

  it('非边界情况', () => {
    expect(isDiagnosticBoundaryCase(5, 30).isBoundary).toBe(false)
    expect(isDiagnosticBoundaryCase(5, 95).isBoundary).toBe(false)
    expect(isDiagnosticBoundaryCase(1, 75).isBoundary).toBe(false)
    expect(isDiagnosticBoundaryCase(12, 75).isBoundary).toBe(false)
  })
})

describe('getDifficultyDescription (扩展到12级)', () => {
  it('原1-5级保持不变', () => {
    expect(getDifficultyDescription(1)).toBe('入门 - 基础练习')
    expect(getDifficultyDescription(2)).toBe('简单 - 逐步提升')
    expect(getDifficultyDescription(3)).toBe('中等 - 正式挑战')
    expect(getDifficultyDescription(4)).toBe('困难 - 综合运用')
    expect(getDifficultyDescription(5)).toBe('专家 - 极限挑战')
  })

  it('新6-12级描述正确', () => {
    expect(getDifficultyDescription(6)).toBe('进阶1')
    expect(getDifficultyDescription(7)).toBe('进阶2')
    expect(getDifficultyDescription(8)).toBe('进阶3')
    expect(getDifficultyDescription(9)).toBe('高阶1')
    expect(getDifficultyDescription(10)).toBe('高阶2')
    expect(getDifficultyDescription(11)).toBe('高阶3')
    expect(getDifficultyDescription(12)).toBe('大师')
  })

  it('未知等级返回默认', () => {
    expect(getDifficultyDescription(0)).toBe('中等')
    expect(getDifficultyDescription(13)).toBe('中等')
  })
})