'use client';

import { useState, useEffect, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MixedRendererProps {
  text: string;
  className?: string;
}

/**
 * 修复 LaTeX 公式中的常见语法错误
 *
 * 问题：AI 生成的题目可能包含错误的 LaTeX，如 $sqrt{4}$ 而不是 $\sqrt{4}$
 * 这会导致 KaTeX 无法识别为数学命令，显示为原始文本
 *
 * 修复规则（按优先级执行）：
 * 1. sqrt{...} → \sqrt{...}
 * 2. frac{...}{...} → \frac{...}{...}
 * 3. sqrt后直接跟字母/数字 → \sqrt{字母/数字}
 * 4. 希腊字母大写（Delta, Alpha, Beta...）→ \Delta, \Alpha...
 * 5. 常见数学命令（times, cdot, ge, le, ne）→ \times, \cdot, \ge...
 */
function fixLaTeXSyntax(formulaContent: string): string {
  // 如果已经是正确格式（包含反斜杠开头的命令），直接返回
  if (formulaContent.includes('\\sqrt') && formulaContent.includes('\\')) {
    // 进一步修复其他可能的错误
  } else {
    // 应用所有修复规则
  }

  let fixed = formulaContent;

  // 规则1: sqrt{...} → \sqrt{...}
  // 使用负向后顾断言避免匹配已带反斜杠的
  fixed = fixed.replace(/(?<!\\)(sqrt)\{([^}]+)\}/g, '\\sqrt{$2}');

  // 规则2: frac{...}{...} → \frac{...}{...}
  fixed = fixed.replace(/(?<!\\)(frac)\{([^}]*)\}/g, '\\frac{$2}');
  // 处理 \frac{...} 没有第二个参数的情况（可能是 AI 错误生成的 frac{x}）
  fixed = fixed.replace(/\\frac\{([^}]+)\}(?![{])/g, '\\frac{$1}{}');
  // 修复可能的多余 \frac
  fixed = fixed.replace(/\\frac\{([^}]*)\}\{/g, '\\frac{$1}{');

  // 规则3: sqrt后直接跟字母（sqrt a → \sqrt{a}）
  fixed = fixed.replace(/(?<!\\)(sqrt)\s+([a-zA-Z])/g, '\\sqrt{$2}');
  // 规则4: sqrt后直接跟数字（sqrt 4 → \sqrt{4}）
  fixed = fixed.replace(/(?<!\\)(sqrt)\s+(\d+)/g, '\\sqrt{$2}');

  // 规则5: 希腊字母大写（前后要有边界）
  const greekLetters = ['Delta', 'Alpha', 'Beta', 'Gamma', 'Sigma', 'Omega', 'Theta', 'Lambda', 'Pi', 'Rho'];
  for (const letter of greekLetters) {
    // 负向后顾断言确保不匹配已带反斜杠的
    fixed = fixed.replace(new RegExp(`(?<!\\\\)${letter}(?![a-zA-Z])`, 'g'), `\\\\${letter}`);
  }

  // 规则6: 常见数学运算符（可能 AI 会输出英文单词）
  const mathCommands = ['times', 'cdot', 'ge', 'le', 'ne', 'approx', 'infty', 'pm', 'mp'];
  for (const cmd of mathCommands) {
    fixed = fixed.replace(new RegExp(`(?<!\\\\)${cmd}(?![a-zA-Z])`, 'g'), `\\\\${cmd}`);
  }

  // 规则7: 常见函数名
  const functions = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'lim', 'sum', 'max', 'min'];
  for (const fn of functions) {
    fixed = fixed.replace(new RegExp(`(?<!\\\\)${fn}(?![a-zA-Z])`, 'g'), `\\\\${fn}`);
  }

  // 规则8: 常见几何图形命令错误
  // \ntriangle → \triangle（AI 常见错误）
  fixed = fixed.replace(/\\ntriangle/g, '\\triangle');
  // \riang, \riang le → \triangle
  fixed = fixed.replace(/\\riangle\s*/g, '\\triangle');
  fixed = fixed.replace(/\\riang\s*/g, '\\triangle');
  // \rect → \rectangle（如果支持）或保持 rect
  // \square → \square（KaTeX 支持）

  // 规则9: 常见希腊字母变体错误
  // \alpha 是正确的，检查是否有 \aplha 等拼写错误
  fixed = fixed.replace(/\\aplha(?![a-zA-Z])/g, '\\alpha');
  fixed = fixed.replace(/\\betaa(?![a-zA-Z])/g, '\\beta');
  fixed = fixed.replace(/\\gammaa(?![a-zA-Z])/g, '\\gamma');

  return fixed;
}

/**
 * 混合文本渲染器
 * 处理普通文本和数学公式混合的情况
 * 使用客户端渲染避免 SSR hydration 问题
 */
export function MixedText({ text, className = '' }: MixedRendererProps) {
  // 初始状态为未挂载（服务端渲染时不渲染公式）
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const rendered = useMemo(() => {
    if (!text) return [];

    // 预处理：移除文本中多余的分隔符，避免单个字母分散显示
    // 移除行内公式内不必要的换行（如 $A\nB\nC$ → $ABC$）
    let processedText = text.replace(/\$([^$]+)\$/g, (match, content) => {
      // 只处理公式内的换行和多余空格
      const cleaned = content.replace(/[\n\r]+\s*/g, '').replace(/\s{2,}/g, ' ');
      return `$${cleaned}$`;
    });

    const parts: Array<{ type: 'text' | 'math-inline' | 'math-block'; content: string }> = [];
    let remaining = processedText;

    while (remaining.length > 0) {
      // 匹配块级公式 $$...$$
      const blockMatch = remaining.match(/^\$\$([^$]+)\$\$/);
      if (blockMatch) {
        parts.push({ type: 'math-block', content: blockMatch[1].trim() });
        remaining = remaining.slice(blockMatch[0].length);
        continue;
      }

      // 匹配行内公式 $...$
      const inlineMatch = remaining.match(/^\$([^$\n]+)\$/);
      if (inlineMatch) {
        parts.push({ type: 'math-inline', content: inlineMatch[1].trim() });
        remaining = remaining.slice(inlineMatch[0].length);
        continue;
      }

      // 找到下一个公式的位置
      const nextBlock = remaining.indexOf('$$');
      const nextInline = remaining.indexOf('$');

      if (nextBlock === -1 && nextInline === -1) {
        if (remaining.trim()) {
          parts.push({ type: 'text', content: remaining });
        }
        break;
      }

      let nextFormula = -1;

      if (nextBlock !== -1 && (nextInline === -1 || nextBlock < nextInline)) {
        nextFormula = nextBlock;
      } else if (nextInline !== -1) {
        nextFormula = nextInline;
      }

      // 添加公式前的文本
      if (nextFormula > 0) {
        const beforeText = remaining.slice(0, nextFormula);
        if (beforeText.trim()) {
          parts.push({ type: 'text', content: beforeText });
        }
      }

      // 提取公式内容（跳过开头的 $）
      const formulaStart = nextFormula;
      let formulaEnd = -1;

      // 找配对的 $
      for (let end = formulaStart + 1; end < remaining.length; end++) {
        if (remaining[end] === '$') {
          formulaEnd = end + 1;
          break;
        }
      }

      if (formulaEnd > formulaStart) {
        const formulaContent = remaining.slice(formulaStart + 1, formulaEnd - 1);
        if (formulaContent.includes('\n')) {
          parts.push({ type: 'math-block', content: formulaContent.trim() });
        } else {
          parts.push({ type: 'math-inline', content: formulaContent });
        }
      } else {
        parts.push({ type: 'text', content: '$' });
      }

      remaining = remaining.slice(formulaEnd);
    }

    return parts;
  }, [text]);

  // 服务端或未挂载时返回原文（避免 hydration mismatch）
  if (!isMounted) {
    return <span className={className}>{text}</span>;
  }

  // 客户端渲染
  return (
    <span className={className}>
      {rendered.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.content}</span>;
        }

        try {
          // 修复 LaTeX 语法错误（如 sqrt -> \sqrt）
          const fixedContent = fixLaTeXSyntax(part.content);
          const html = katex.renderToString(fixedContent, {
            displayMode: part.type === 'math-block',
            throwOnError: false,
            errorColor: '#B00020',
          });
          return (
            <span
              key={i}
              className={part.type === 'math-block' ? 'math-block' : 'math-inline'}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={i}>公式解析错误</span>;
        }
      })}
    </span>
  );
}
