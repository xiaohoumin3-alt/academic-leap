import { RenderInput } from '../types';

export class MockLLMRenderer {
  async render(input: RenderInput): Promise<string> {
    if (input.type === 'template') {
      return `解方程: ${input.params.a}x ${this.formatSigned(input.params.b)} = ${input.params.c}`;
    } else {
      return '解方程: 2(x + 3) = 10';
    }
  }

  private formatSigned(n: number): string {
    return n >= 0 ? `+ ${n}` : `- ${Math.abs(n)}`;
  }
}
