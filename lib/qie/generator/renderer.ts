import { RenderInput, ExprAST } from './types';

export class LLMRenderer {
  private apiKey: string;
  private baseURL?: string;

  constructor() {
    this.apiKey = process.env.GEMMA_API_KEY || process.env.MINIMAX_API_KEY || '';
    this.baseURL = process.env.GEMMA_BASE_URL || process.env.MINIMAX_BASE_URL;
  }

  async render(input: RenderInput): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMMA_API_KEY or MINIMAX_API_KEY not set');
    }

    const prompt = this.buildPrompt(input);

    try {
      const response = await fetch(`${this.baseURL || 'https://api.minimaxi.chat'}/v1/text/chatcompletion_v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gemma-4-31b-it',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('LLM Renderer error:', error);
      throw error;
    }
  }

  private buildPrompt(input: RenderInput): string {
    if (input.type === 'ast') {
      return `将以下数学表达式转换成题目文本，不要改变任何数学结构：

表达式: ${this.serializeAST(input.ast)}
要求: 纯文本转换，不添加额外内容，只输出题目文本。`;
    } else {
      const paramsText = Object.entries(input.params)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');

      return `以下是一个数学题模板，填充参数后生成题目文本：

模板: ${input.template}
参数: ${paramsText}
要求: 纯文本转换，不添加额外内容，只输出题目文本。`;
    }
  }

  private serializeAST(ast: ExprAST): string {
    const visit = (node: ExprAST): string => {
      switch (node.type) {
        case 'const':
          return String(node.value);
        case 'var':
          return node.name;
        case 'add':
          return `(${visit(node.left)} + ${visit(node.right)})`;
        case 'sub':
          return `(${visit(node.left)} - ${visit(node.right)})`;
        case 'mul':
          return `(${visit(node.left)} * ${visit(node.right)})`;
        case 'div':
          return `(${visit(node.left)} / ${visit(node.right)})`;
        case 'neg':
          return `(-${visit(node.expr)})`;
        case 'group':
          return `(${visit(node.expr)})`;
        default:
          return '';
      }
    };
    return visit(ast);
  }
}
