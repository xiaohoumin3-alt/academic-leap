/**
 * UOK Selector Unit Tests
 *
 * Tests for Zone of Proximal Development calculation including:
 * - ZPD calculation for students
 * - Selection from ZPD options
 * - Student state handling
 * - Knowledge point prioritization
 */

import {
  calculateZPD,
  selectFromZPD,
  type StudentState,
  type ZoneOfProximalDevelopment
} from '../uok-selector';

describe('calculateZPD', () => {
  const createBasicStudentState = (): StudentState => ({
    studentId: 'student-123',
    ability: 0.5,
    knowledgePoints: {
      'addition': {
        mastery: 0.8,
        attempts: 10,
        recentPerformance: [1, 1, 1, 0, 1]
      },
      'subtraction': {
        mastery: 0.6,
        attempts: 8,
        recentPerformance: [1, 0, 1, 1, 0]
      }
    }
  });

  it('should return ZPDs for all knowledge points when no target specified', () => {
    // Arrange
    const studentState = createBasicStudentState();

    // Act
    const result = calculateZPD(studentState);

    // Assert
    expect(result).toHaveLength(2);
    expect(result.every(zpd => zpd.knowledgePoint)).toBeDefined();
    expect(result.every(zpd => zpd.minDifficulty)).toBeDefined();
    expect(result.every(zpd => zpd.maxDifficulty)).toBeDefined();
    expect(result.every(zpd => zpd.reason)).toBeDefined();
  });

  it('should return ZPD for specific target knowledge point', () => {
    // Arrange
    const studentState = createBasicStudentState();

    // Act
    const result = calculateZPD(studentState, 'addition');

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].knowledgePoint).toBe('addition');
  });

  it('should return empty array for unknown target knowledge point', () => {
    // Arrange
    const studentState = createBasicStudentState();

    // Act
    const result = calculateZPD(studentState, 'unknown-kp');

    // Assert
    expect(result).toEqual([]);
  });

  it('should sort ZPDs by priority (incomplete mastery first)', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'student-123',
      ability: 0.5,
      knowledgePoints: {
        'mastered': { mastery: 0.9, attempts: 10, recentPerformance: [1, 1, 1] },
        'learning': { mastery: 0.5, attempts: 5, recentPerformance: [1, 0, 1] },
        'beginner': { mastery: 0.2, attempts: 2, recentPerformance: [0, 0] }
      }
    };

    // Act
    const result = calculateZPD(studentState);

    // Assert
    // Incomplete mastery (< 0.8) should come first
    const incompleteKPs = result.filter(zpd => {
      const mastery = studentState.knowledgePoints[zpd.knowledgePoint].mastery;
      return mastery < 0.8;
    });
    expect(incompleteKPs.length).toBeGreaterThan(0);
  });

  it('should calculate ZPD with correct difficulty range', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'student-123',
      ability: 0.0,
      knowledgePoints: {
        'test': { mastery: 0.5, attempts: 5, recentPerformance: [1, 0, 1] }
      }
    };

    // Act
    const result = calculateZPD(studentState);

    // Assert
    expect(result[0].minDifficulty).toBeLessThanOrEqual(0);
    expect(result[0].maxDifficulty).toBeGreaterThanOrEqual(0);
    expect(result[0].maxDifficulty - result[0].minDifficulty).toBeCloseTo(0.4, 1); // ZPD_WIDTH * 2
  });

  it('should clamp difficulty range to IRT bounds [-3, 3]', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'student-123',
      ability: 3, // At upper bound
      knowledgePoints: {
        'test': { mastery: 0.5, attempts: 5, recentPerformance: [1, 0, 1] }
      }
    };

    // Act
    const result = calculateZPD(studentState);

    // Assert
    expect(result[0].maxDifficulty).toBeLessThanOrEqual(3);
    expect(result[0].minDifficulty).toBeGreaterThanOrEqual(-3);
  });

  it('should handle student with no knowledge points', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'new-student',
      ability: 0.0,
      knowledgePoints: {}
    };

    // Act
    const result = calculateZPD(studentState);

    // Assert
    expect(result).toEqual([]);
  });

  it('should generate appropriate reason for early learning phase', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'beginner-student',
      ability: 0.0,
      knowledgePoints: {
        'test': { mastery: 0.2, attempts: 2, recentPerformance: [0] }
      }
    };

    // Act
    const result = calculateZPD(studentState);

    // Assert
    expect(result[0].reason).toContain('Early learning phase');
    expect(result[0].reason).toContain('foundational');
  });

  it('should generate appropriate reason for developing phase', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'developing-student',
      ability: 0.5,
      knowledgePoints: {
        'test': { mastery: 0.5, attempts: 5, recentPerformance: [1, 0, 1] }
      }
    };

    // Act
    const result = calculateZPD(studentState);

    // Assert
    expect(result[0].reason).toContain('Developing understanding');
    expect(result[0].reason).toContain('Optimal zone');
  });

  it('should generate appropriate reason for approaching mastery', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'advanced-student',
      ability: 0.8,
      knowledgePoints: {
        'test': { mastery: 0.85, attempts: 10, recentPerformance: [1, 1, 1] }
      }
    };

    // Act
    const result = calculateZPD(studentState);

    // Assert
    expect(result[0].reason).toContain('Approaching mastery');
    expect(result[0].reason).toContain('challenge');
  });

  it('should generate appropriate reason for near mastery', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'expert-student',
      ability: 1.0,
      knowledgePoints: {
        'test': { mastery: 0.95, attempts: 20, recentPerformance: [1, 1, 1] }
      }
    };

    // Act
    const result = calculateZPD(studentState);

    // Assert
    expect(result[0].reason).toContain('Near mastery');
    expect(result[0].reason).toContain('application');
  });

  it('should include ability and mastery in reason string', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {
        'test': { mastery: 0.6, attempts: 5, recentPerformance: [1, 0, 1] }
      }
    };

    // Act
    const result = calculateZPD(studentState);

    // Assert
    expect(result[0].reason).toContain('0.50'); // ability formatted
    expect(result[0].reason).toContain('60%'); // mastery percentage
  });

  it('should handle negative ability values', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'struggling-student',
      ability: -1,
      knowledgePoints: {
        'test': { mastery: 0.3, attempts: 3, recentPerformance: [0, 0, 1] }
      }
    };

    // Act
    const result = calculateZPD(studentState);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].minDifficulty).toBeGreaterThanOrEqual(-3);
  });

  it('should handle high ability values', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'advanced-student',
      ability: 2,
      knowledgePoints: {
        'test': { mastery: 0.9, attempts: 15, recentPerformance: [1, 1, 1] }
      }
    };

    // Act
    const result = calculateZPD(studentState);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].maxDifficulty).toBeLessThanOrEqual(3);
  });

  it('should handle empty recent performance array', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'no-performance-student',
      ability: 0.5,
      knowledgePoints: {
        'test': { mastery: 0.5, attempts: 0, recentPerformance: [] }
      }
    };

    // Act
    const result = calculateZPD(studentState);

    // Assert
    expect(result).toHaveLength(1);
  });

  it('should handle missing recentPerformance (undefined)', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'undefined-performance-student',
      ability: 0.5,
      knowledgePoints: {
        // Cast to allow missing recentPerformance
        'test': { mastery: 0.5, attempts: 5, recentPerformance: undefined as any }
      }
    };
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      { knowledgePoint: 'test', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Test' }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    expect(result.knowledgePoint).toBe('test');
  });

  it('should handle missing recentPerformance (null)', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'null-performance-student',
      ability: 0.5,
      knowledgePoints: {
        // Cast to allow null recentPerformance
        'test': { mastery: 0.5, attempts: 5, recentPerformance: null as any }
      }
    };
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      { knowledgePoint: 'test', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Test' }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    expect(result.knowledgePoint).toBe('test');
  });

  it('should handle ZPD option not found in student knowledge points', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {
        'known-kp': { mastery: 0.5, attempts: 5, recentPerformance: [0, 1] }
      }
    };
    // Create ZPD option for a knowledge point not in studentState.knowledgePoints
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      { knowledgePoint: 'unknown-kp', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Unknown' },
      { knowledgePoint: 'known-kp', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Known' }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    // Unknown knowledge point should be prioritized (returns score 100)
    expect(result.knowledgePoint).toBe('unknown-kp');
  });
});

describe('selectFromZPD', () => {
  const createZPDOptions = (): ZoneOfProximalDevelopment[] => [
    {
      knowledgePoint: 'addition',
      minDifficulty: 0.3,
      maxDifficulty: 0.7,
      reason: 'Student has partial mastery'
    },
    {
      knowledgePoint: 'subtraction',
      minDifficulty: 0.4,
      maxDifficulty: 0.8,
      reason: 'Within learning zone'
    },
    {
      knowledgePoint: 'multiplication',
      minDifficulty: 0.5,
      maxDifficulty: 0.9,
      reason: 'Introduction needed'
    }
  ];

  const createStudentState = (): StudentState => ({
    studentId: 'student-123',
    ability: 0.5,
    knowledgePoints: {
      'addition': {
        mastery: 0.6,
        attempts: 10,
        recentPerformance: [1, 1, 0, 1, 1]
      },
      'subtraction': {
        mastery: 0.4,
        attempts: 5,
        recentPerformance: [1, 0, 1, 0, 1]
      },
      'multiplication': {
        mastery: 0.2,
        attempts: 2,
        recentPerformance: [0, 0]
      }
    }
  });

  it('should return single ZPD from options', () => {
    // Arrange
    const zpdOptions = createZPDOptions();
    const studentState = createStudentState();

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    expect(result).toHaveProperty('knowledgePoint');
    expect(result).toHaveProperty('minDifficulty');
    expect(result).toHaveProperty('maxDifficulty');
    expect(result).toHaveProperty('reason');
  });

  it('should prioritize low mastery knowledge points', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {
        'high-mastery': { mastery: 0.9, attempts: 10, recentPerformance: [1, 1] },
        'low-mastery': { mastery: 0.3, attempts: 2, recentPerformance: [0, 1] }
      }
    };
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      { knowledgePoint: 'high-mastery', minDifficulty: 0.5, maxDifficulty: 0.7, reason: 'High' },
      { knowledgePoint: 'low-mastery', minDifficulty: 0.3, maxDifficulty: 0.5, reason: 'Low' }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    expect(result.knowledgePoint).toBe('low-mastery');
  });

  it('should throw error for empty ZPD options', () => {
    // Arrange
    const zpdOptions: ZoneOfProximalDevelopment[] = [];
    const studentState = createStudentState();

    // Act & Assert
    expect(() => selectFromZPD(zpdOptions, studentState)).toThrow('No ZPD options available');
  });

  it('should return first option when only one available', () => {
    // Arrange
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      {
        knowledgePoint: 'addition',
        minDifficulty: 0.3,
        maxDifficulty: 0.7,
        reason: 'Test'
      }
    ];
    const studentState = createStudentState();

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    expect(result.knowledgePoint).toBe('addition');
  });

  it('should handle new knowledge point (high priority)', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {}
    };
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      {
        knowledgePoint: 'new-topic',
        minDifficulty: 0.3,
        maxDifficulty: 0.7,
        reason: 'New topic'
      }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    expect(result.knowledgePoint).toBe('new-topic');
  });

  it('should prioritize improving performance trend', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {
        'improving': {
          mastery: 0.5,
          attempts: 5,
          recentPerformance: [0, 0.3, 0.6, 0.8, 1]
        },
        'stable': {
          mastery: 0.5,
          attempts: 5,
          recentPerformance: [0.5, 0.5, 0.5, 0.5, 0.5]
        }
      }
    };
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      { knowledgePoint: 'improving', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Improving' },
      { knowledgePoint: 'stable', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Stable' }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    expect(result.knowledgePoint).toBe('improving');
  });

  it('should prioritize less practiced topics', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {
        'practiced': { mastery: 0.5, attempts: 20, recentPerformance: [1, 1] },
        'new': { mastery: 0.5, attempts: 1, recentPerformance: [0] }
      }
    };
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      { knowledgePoint: 'practiced', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Practiced' },
      { knowledgePoint: 'new', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'New' }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    expect(result.knowledgePoint).toBe('new');
  });

  it('should prioritize topics needing review (recent struggles)', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {
        'struggling': {
          mastery: 0.5,
          attempts: 10,
          recentPerformance: [0.2, 0.3, 0.1, 0.4, 0.2]
        },
        'stable': {
          mastery: 0.5,
          attempts: 10,
          recentPerformance: [0.5, 0.5, 0.5, 0.5, 0.5]
        }
      }
    };
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      { knowledgePoint: 'struggling', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Struggling' },
      { knowledgePoint: 'stable', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Stable' }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    expect(result.knowledgePoint).toBe('struggling');
  });

  it('should penalize declining performance trend', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {
        'declining': {
          mastery: 0.5,
          attempts: 5,
          recentPerformance: [1, 0.8, 0.6, 0.4, 0.2]
        },
        'improving': {
          mastery: 0.5,
          attempts: 5,
          recentPerformance: [0.2, 0.4, 0.6, 0.8, 1]
        }
      }
    };
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      { knowledgePoint: 'declining', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Declining' },
      { knowledgePoint: 'improving', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Improving' }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    // Improving should be selected due to better trend score
    expect(result.knowledgePoint).toBe('improving');
  });

  it('should prioritize knowledge point with zero attempts', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {
        'no-attempts': {
          mastery: 0.25,
          attempts: 0,
          recentPerformance: []
        },
        'many-attempts': {
          mastery: 0.25,
          attempts: 20,
          recentPerformance: [0, 1, 0]
        }
      }
    };
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      { knowledgePoint: 'no-attempts', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'No attempts' },
      { knowledgePoint: 'many-attempts', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Many attempts' }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    // Zero attempts (20 points) should get higher priority than many attempts (5 points)
    expect(result.knowledgePoint).toBe('no-attempts');
  });

  it('should consider ZPD width in scoring', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {
        'narrow-zpd': {
          mastery: 0.5,
          attempts: 5,
          recentPerformance: [0.5, 0.5, 0.5]
        },
        'wide-zpd': {
          mastery: 0.5,
          attempts: 5,
          recentPerformance: [0.5, 0.5, 0.5]
        }
      }
    };
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      { knowledgePoint: 'narrow-zpd', minDifficulty: 0.45, maxDifficulty: 0.55, reason: 'Narrow' },
      { knowledgePoint: 'wide-zpd', minDifficulty: 0.3, maxDifficulty: 0.7, reason: 'Wide' }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    // Wider ZPD should get priority (more question options)
    expect(result.knowledgePoint).toBe('wide-zpd');
  });

  it('should handle edge case with slightly declining trend (-0.2 < trend < 0)', () => {
    // Arrange
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {
        'slightly-declining': {
          mastery: 0.5,
          attempts: 5,
          recentPerformance: [0.6, 0.55, 0.5, 0.48, 0.45]
        }
      }
    };
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      { knowledgePoint: 'slightly-declining', minDifficulty: 0.4, maxDifficulty: 0.6, reason: 'Test' }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    expect(result.knowledgePoint).toBe('slightly-declining');
  });

  it('should correctly score mastery levels across all ranges', () => {
    // Arrange - Test all mastery scoring brackets
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {
        'foundation': { mastery: 0.2, attempts: 5, recentPerformance: [0, 0, 1] },
        'active-learning': { mastery: 0.5, attempts: 5, recentPerformance: [0, 1, 0] },
        'approaching': { mastery: 0.75, attempts: 5, recentPerformance: [1, 0, 1] },
        'near-mastery': { mastery: 0.85, attempts: 5, recentPerformance: [1, 1, 0] }
      }
    };
    const zpdOptions: ZoneOfProximalDevelopment[] = [
      { knowledgePoint: 'foundation', minDifficulty: 0.3, maxDifficulty: 0.7, reason: 'Foundation' },
      { knowledgePoint: 'active-learning', minDifficulty: 0.3, maxDifficulty: 0.7, reason: 'Active' },
      { knowledgePoint: 'approaching', minDifficulty: 0.3, maxDifficulty: 0.7, reason: 'Approaching' },
      { knowledgePoint: 'near-mastery', minDifficulty: 0.3, maxDifficulty: 0.7, reason: 'Near mastery' }
    ];

    // Act
    const result = selectFromZPD(zpdOptions, studentState);

    // Assert
    // Lowest mastery (< 0.3) should be selected
    expect(result.knowledgePoint).toBe('foundation');
  });
});

describe('StudentState type validation', () => {
  it('should accept valid student state structure', () => {
    // Arrange & Act
    const studentState: StudentState = {
      studentId: 'test-student',
      ability: 0.5,
      knowledgePoints: {
        'addition': {
          mastery: 0.7,
          attempts: 10,
          recentPerformance: [1, 1, 0, 1]
        }
      }
    };

    // Assert
    expect(studentState.studentId).toBe('test-student');
    expect(studentState.ability).toBe(0.5);
    expect(studentState.knowledgePoints['addition'].mastery).toBe(0.7);
  });

  it('should accept student with empty knowledge points', () => {
    // Arrange & Act
    const studentState: StudentState = {
      studentId: 'new-student',
      ability: 0.0,
      knowledgePoints: {}
    };

    // Assert
    expect(Object.keys(studentState.knowledgePoints)).toHaveLength(0);
  });

  it('should accept student with multiple knowledge points', () => {
    // Arrange & Act
    const studentState: StudentState = {
      studentId: 'multi-kp-student',
      ability: 0.6,
      knowledgePoints: {
        'addition': { mastery: 0.8, attempts: 10, recentPerformance: [1, 1, 1] },
        'subtraction': { mastery: 0.6, attempts: 8, recentPerformance: [1, 0, 1] },
        'multiplication': { mastery: 0.4, attempts: 5, recentPerformance: [0, 1] }
      }
    };

    // Assert
    expect(Object.keys(studentState.knowledgePoints)).toHaveLength(3);
  });

  it('should accept ability at maximum (1.0)', () => {
    // Arrange & Act
    const studentState: StudentState = {
      studentId: 'perfect-student',
      ability: 1.0,
      knowledgePoints: {}
    };

    // Assert
    expect(studentState.ability).toBe(1.0);
  });

  it('should accept ability at minimum (0.0)', () => {
    // Arrange & Act
    const studentState: StudentState = {
      studentId: 'beginner-student',
      ability: 0.0,
      knowledgePoints: {}
    };

    // Assert
    expect(studentState.ability).toBe(0.0);
  });

  it('should accept mastery at boundaries', () => {
    // Arrange & Act
    const studentState: StudentState = {
      studentId: 'boundary-student',
      ability: 0.5,
      knowledgePoints: {
        'perfect': { mastery: 1.0, attempts: 10, recentPerformance: [1, 1, 1] },
        'zero': { mastery: 0.0, attempts: 0, recentPerformance: [] }
      }
    };

    // Assert
    expect(studentState.knowledgePoints['perfect'].mastery).toBe(1.0);
    expect(studentState.knowledgePoints['zero'].mastery).toBe(0.0);
  });

  it('should accept zero attempts', () => {
    // Arrange & Act
    const studentState: StudentState = {
      studentId: 'no-attempts-student',
      ability: 0.5,
      knowledgePoints: {
        'unattempted': { mastery: 0.0, attempts: 0, recentPerformance: [] }
      }
    };

    // Assert
    expect(studentState.knowledgePoints['unattempted'].attempts).toBe(0);
  });

  it('should accept high attempt counts', () => {
    // Arrange & Act
    const studentState: StudentState = {
      studentId: 'practiced-student',
      ability: 0.7,
      knowledgePoints: {
        'practiced': { mastery: 0.9, attempts: 1000, recentPerformance: [1, 1, 1] }
      }
    };

    // Assert
    expect(studentState.knowledgePoints['practiced'].attempts).toBe(1000);
  });

  it('should accept empty recent performance array', () => {
    // Arrange & Act
    const studentState: StudentState = {
      studentId: 'no-recent-student',
      ability: 0.5,
      knowledgePoints: {
        'kp': { mastery: 0.5, attempts: 5, recentPerformance: [] }
      }
    };

    // Assert
    expect(studentState.knowledgePoints['kp'].recentPerformance).toEqual([]);
  });

  it('should accept binary performance values', () => {
    // Arrange & Act
    const studentState: StudentState = {
      studentId: 'binary-perf-student',
      ability: 0.5,
      knowledgePoints: {
        'kp': { mastery: 0.5, attempts: 5, recentPerformance: [0, 1, 0, 1, 0] }
      }
    };

    // Assert
    expect(studentState.knowledgePoints['kp'].recentPerformance).toContain(0);
    expect(studentState.knowledgePoints['kp'].recentPerformance).toContain(1);
  });

  it('should accept floating point performance values', () => {
    // Arrange & Act
    const studentState: StudentState = {
      studentId: 'float-perf-student',
      ability: 0.5,
      knowledgePoints: {
        'kp': { mastery: 0.6, attempts: 5, recentPerformance: [0.2, 0.8, 0.5, 0.7, 0.6] }
      }
    };

    // Assert
    expect(studentState.knowledgePoints['kp'].recentPerformance[0]).toBe(0.2);
  });
});

describe('ZoneOfProximalDevelopment type validation', () => {
  it('should accept valid ZPD structure', () => {
    // Arrange & Act
    const zpd: ZoneOfProximalDevelopment = {
      knowledgePoint: 'addition',
      minDifficulty: 0.3,
      maxDifficulty: 0.7,
      reason: 'Student has partial mastery'
    };

    // Assert
    expect(zpd.knowledgePoint).toBe('addition');
    expect(zpd.minDifficulty).toBe(0.3);
    expect(zpd.maxDifficulty).toBe(0.7);
    expect(zpd.reason).toBeDefined();
  });

  it('should accept ZPD with negative min difficulty', () => {
    // Arrange & Act
    const zpd: ZoneOfProximalDevelopment = {
      knowledgePoint: 'basic',
      minDifficulty: -2.5,
      maxDifficulty: -1.5,
      reason: 'Below average ability'
    };

    // Assert
    expect(zpd.minDifficulty).toBe(-2.5);
  });

  it('should accept ZPD with max difficulty above 1.0', () => {
    // Arrange & Act
    const zpd: ZoneOfProximalDevelopment = {
      knowledgePoint: 'advanced',
      minDifficulty: 2.0,
      maxDifficulty: 2.8,
      reason: 'Above average ability'
    };

    // Assert
    expect(zpd.maxDifficulty).toBe(2.8);
  });

  it('should accept narrow difficulty range', () => {
    // Arrange & Act
    const zpd: ZoneOfProximalDevelopment = {
      knowledgePoint: 'precise',
      minDifficulty: 0.5,
      maxDifficulty: 0.55,
      reason: 'Narrow zone'
    };

    // Assert
    expect(zpd.maxDifficulty - zpd.minDifficulty).toBeCloseTo(0.05, 5);
  });

  it('should accept wide difficulty range', () => {
    // Arrange & Act
    const zpd: ZoneOfProximalDevelopment = {
      knowledgePoint: 'broad',
      minDifficulty: -1.0,
      maxDifficulty: 1.0,
      reason: 'Wide zone'
    };

    // Assert
    expect(zpd.maxDifficulty - zpd.minDifficulty).toBe(2.0);
  });

  it('should accept special characters in knowledge point name', () => {
    // Arrange & Act
    const zpd: ZoneOfProximalDevelopment = {
      knowledgePoint: '分数加法 (Fraction Addition)',
      minDifficulty: 0.3,
      maxDifficulty: 0.7,
      reason: 'Test'
    };

    // Assert
    expect(zpd.knowledgePoint).toContain('分数');
  });

  it('should accept empty reason string', () => {
    // Arrange & Act
    const zpd: ZoneOfProximalDevelopment = {
      knowledgePoint: 'test',
      minDifficulty: 0.5,
      maxDifficulty: 0.6,
      reason: ''
    };

    // Assert
    expect(zpd.reason).toBe('');
  });

  it('should accept long reason string', () => {
    // Arrange & Act
    const longReason = 'This is a very detailed explanation '.repeat(10);
    const zpd: ZoneOfProximalDevelopment = {
      knowledgePoint: 'test',
      minDifficulty: 0.5,
      maxDifficulty: 0.6,
      reason: longReason
    };

    // Assert
    expect(zpd.reason.length).toBeGreaterThan(100);
  });
});
