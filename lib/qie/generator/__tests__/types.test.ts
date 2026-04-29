import { ComplexitySpec, validateComplexitySpec, StructureType, DepthLevel, DistractionLevel } from '../types';

describe('ComplexitySpec', () => {
  it('should accept valid structure values', () => {
    const spec: ComplexitySpec = {
      structure: 'linear',
      depth: 1,
      distraction: 0,
    };
    expect(spec.structure).toBe('linear');
  });

  it('should validate correct spec', () => {
    const spec = {
      structure: 'linear' as const,
      depth: 1 as const,
      distraction: 0 as const,
    };
    expect(validateComplexitySpec(spec)).toBe(true);
  });

  it('should reject invalid structure', () => {
    const spec = {
      structure: 'invalid',
      depth: 1,
      distraction: 0,
    };
    expect(validateComplexitySpec(spec)).toBe(false);
  });

  it('should reject invalid depth', () => {
    const spec = {
      structure: 'linear' as const,
      depth: 5,
      distraction: 0 as const,
    };
    expect(validateComplexitySpec(spec)).toBe(false);
  });

  it('should reject invalid distraction', () => {
    const spec = {
      structure: 'linear' as const,
      depth: 1 as const,
      distraction: 4,
    };
    expect(validateComplexitySpec(spec)).toBe(false);
  });

  it('should accept all valid structure types', () => {
    const validStructures: StructureType[] = ['linear', 'nested', 'multi_equation', 'constraint_chain'];
    validStructures.forEach((structure) => {
      const spec = { structure, depth: 1 as const, distraction: 0 as const };
      expect(validateComplexitySpec(spec)).toBe(true);
    });
  });

  it('should accept all valid depth levels', () => {
    const validDepths: DepthLevel[] = [1, 2, 3, 4];
    validDepths.forEach((depth) => {
      const spec = { structure: 'linear' as const, depth, distraction: 0 as const };
      expect(validateComplexitySpec(spec)).toBe(true);
    });
  });

  it('should accept all valid distraction levels', () => {
    const validDistractions: DistractionLevel[] = [0, 1, 2, 3];
    validDistractions.forEach((distraction) => {
      const spec = { structure: 'linear' as const, depth: 1 as const, distraction };
      expect(validateComplexitySpec(spec)).toBe(true);
    });
  });
});
