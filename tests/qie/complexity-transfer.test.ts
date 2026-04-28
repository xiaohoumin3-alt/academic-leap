import { UOK } from '$lib/qie';

describe('Complexity Transfer - Numerical Stability', () => {
  it('should clamp weighted delta to prevent numerical explosion', () => {
    const uok = new UOK();

    uok.encodeQuestion({
      id: 'simple',
      content: 'Simple',
      topics: ['math']
    });
    uok.encodeQuestion({
      id: 'complex',
      content: 'Complex',
      topics: ['math']
    });

    // Manually set question features to create extreme delta
    const state = (uok as any).state;
    state.questions.get('simple').features = {
      difficulty: 0.1,
      complexity: 0.1,
      cognitiveLoad: 0.1,
      reasoningDepth: 0.1,
    };
    state.questions.get('complex').features = {
      difficulty: 1.0,
      complexity: 1.0,
      cognitiveLoad: 1.0,
      reasoningDepth: 1.0,
    };

    const pTransfer = uok.predictWithComplexityTransfer('s1', 'simple', 'complex');

    // With clamp, P should not collapse to near-zero even with extreme delta
    expect(pTransfer).toBeGreaterThan(0.01);
  });

  it('should handle zero complexity delta correctly', () => {
    const uok = new UOK();

    uok.encodeQuestion({
      id: 'q1',
      content: 'Q1',
      topics: ['math']
    });
    uok.encodeQuestion({
      id: 'q2',
      content: 'Q2',
      topics: ['math']
    });

    const state = (uok as any).state;
    const features = {
      difficulty: 0.5,
      complexity: 0.5,
      cognitiveLoad: 0.5,
      reasoningDepth: 0.5,
    };
    state.questions.get('q1').features = features;
    state.questions.get('q2').features = features;

    const pSimple = uok.predict('s1', 'q1', { difficulty: 0.5, complexity: 0.5 });
    const pTransfer = uok.predictWithComplexityTransfer('s1', 'q1', 'q2');

    // With zero delta, P_complex should equal P_simple
    expect(Math.abs(pTransfer - pSimple)).toBeLessThan(0.001);
  });
});