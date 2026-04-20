/**
 * 手写OCR识别
 * 使用Google Vision API进行数学公式识别
 */

interface OCRResult {
  text: string;
  confidence: number;
  expressions: string[];
}

interface VisionAPIResponse {
  responses: Array<{
    fullTextAnnotation: {
      text: string;
    };
    textAnnotations: Array<{
      description: string;
      boundingPoly: {
        vertices: Array<{ x?: number; y?: number }>;
      };
    }>;
  }>;
}

/**
 * 使用Google Vision API进行OCR识别
 */
export async function recognizeHandwriting(
  imageBase64: string,
  apiKey: string
): Promise<OCRResult> {
  const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

  // 移除base64前缀
  const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

  const requestBody = {
    requests: [
      {
        image: {
          content: base64Data,
        },
        features: [
          {
            type: 'DOCUMENT_TEXT_DETECTION',
            maxResults: 50,
          },
        ],
        imageContext: {
          languageHints: ['zh-CN', 'en'],
        },
      },
    ],
  };

  try {
    const response = await fetch(visionApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const data: VisionAPIResponse = await response.json();

    if (!data.responses?.[0]) {
      throw new Error('No response from Vision API');
    }

    const fullText = data.responses[0].fullTextAnnotation?.text || '';
    const textAnnotations = data.responses[0].textAnnotations || [];

    // 提取数学表达式
    const expressions = extractMathExpressions(fullText);

    // 计算置信度（基于识别的文本数量）
    const confidence = Math.min(1, textAnnotations.length / 20);

    return {
      text: fullText,
      confidence,
      expressions,
    };
  } catch (error) {
    console.error('OCR识别失败:', error);
    throw error;
  }
}

/**
 * 从文本中提取数学表达式
 */
function extractMathExpressions(text: string): string[] {
  const expressions: string[] = [];

  // 匹配常见数学表达式模式
  const patterns = [
    // 方程: ax + b = c
    /[\d\s\+\-\*\/\(\)\.xXa-zA-Z]+\s*[=＝]\s*[\d\s\+\-\*\/\(\)\.xXa-zA-Z]+/g,
    // 分数: a/b
    /[\d]+\s*[/／]\s*[\d]+/g,
    // 带括号的表达式
    /\([^)]+\)/g,
    // 简单算式
    /[\d]+\s*[\+\-\*\/]\s*[\d]+/g,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      expressions.push(...matches);
    }
  }

  // 去重
  return [...new Set(expressions)];
}

/**
 * 使用Tesseract.js作为备选方案（客户端OCR）
 * 注意：需要安装 tesseract.js: pnpm add tesseract.js
 */
export async function recognizeWithTesseract(
  imageBase64: string
): Promise<OCRResult> {
  try {
    // 动态导入Tesseract.js
    const module = await import('tesseract.js');
    const Tesseract = module.default || module;

    const result = await Tesseract.recognize(imageBase64, 'eng+chi_sim', {
      logger: (m: any) => console.log(m),
    });

    const text = result.data.text;
    const expressions = extractMathExpressions(text);
    const confidence = result.data.confidence / 100;

    return {
      text,
      confidence,
      expressions,
    };
  } catch (error) {
    throw new Error('Tesseract.js未安装，请运行: pnpm add tesseract.js');
  }
}

/**
 * 将OCR识别的文本转换为标准数学格式
 */
export function normalizeMathExpression(text: string): string {
  return text
    // 统一等号
    .replace(/[＝]/g, '=')
    // 统一除号
    .replace(/[／÷]/g, '/')
    // 统一乘号
    .replace(/[×xX]/g, '*')
    // 移除空格
    .replace(/\s+/g, '')
    // 处理中文数字
    .replace(/一/g, '1')
    .replace(/二/g, '2')
    .replace(/三/g, '3')
    .replace(/四/g, '4')
    .replace(/五/g, '5')
    .replace(/六/g, '6')
    .replace(/七/g, '7')
    .replace(/八/g, '8')
    .replace(/九/g, '9')
    .replace(/零/g, '0');
}

/**
 * 对比用户答案与正确答案
 */
export function compareAnswers(
  userAnswer: string,
  correctAnswer: string,
  tolerance: number = 0.01
): boolean {
  const normalizedUser = normalizeMathExpression(userAnswer);
  const normalizedCorrect = normalizeMathExpression(correctAnswer);

  if (normalizedUser === normalizedCorrect) {
    return true;
  }

  // 尝试计算数值比较
  try {
    const userValue = safeEvaluate(normalizedUser);
    const correctValue = safeEvaluate(normalizedCorrect);

    if (userValue !== null && correctValue !== null) {
      return Math.abs(userValue - correctValue) <= tolerance;
    }
  } catch {
    // 忽略计算错误
  }

  return false;
}

/**
 * 安全计算表达式值
 */
function safeEvaluate(expression: string): number | null {
  try {
    // 只允许数字和基本运算符
    if (!/^[\d+\-*/().\s]*$/.test(expression)) {
      return null;
    }

    // 使用Function构造函数而不是eval
    const result = new Function('return ' + expression)();

    return typeof result === 'number' && !isNaN(result) ? result : null;
  } catch {
    return null;
  }
}
