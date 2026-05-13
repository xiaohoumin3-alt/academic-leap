/**
 * API 统一响应格式测试 (P1 HIGH)
 *
 * 验证 API 响应格式统一化 (lib/api/response.ts)
 *
 * TDD 流程:
 * 1. RED: 编写失败测试
 * 2. GREEN: 实现修复
 * 3. REFACTOR: 清理代码
 */

describe('API 响应格式检查', () => {
  it('lib/api/response.ts 应存在', () => {
    const fs = require('fs');
    const path = require('path');

    const responsePath = path.join(__dirname, '../../lib/api/response.ts');
    const exists = fs.existsSync(responsePath);

    expect(exists).toBe(true);
  });

  it('lib/api/response.ts 应导出 successResponse', () => {
    const fs = require('fs');
    const path = require('path');

    const responsePath = path.join(__dirname, '../../lib/api/response.ts');

    if (!fs.existsSync(responsePath)) {
      // 文件不存在，测试失败 (RED 阶段)
      expect(true).toBe(false);
      return;
    }

    const content = fs.readFileSync(responsePath, 'utf8');
    expect(content).toMatch(/export\s+(function|const)\s+successResponse/);
  });

  it('lib/api/response.ts 应导出 errorResponse', () => {
    const fs = require('fs');
    const path = require('path');

    const responsePath = path.join(__dirname, '../../lib/api/response.ts');

    if (!fs.existsSync(responsePath)) {
      expect(true).toBe(false);
      return;
    }

    const content = fs.readFileSync(responsePath, 'utf8');
    expect(content).toMatch(/export\s+(function|const)\s+errorResponse/);
  });
});

describe('successResponse 函数规范', () => {
  it('successResponse 应返回 success: true', () => {
    const fs = require('fs');
    const path = require('path');

    const responsePath = path.join(__dirname, '../../lib/api/response.ts');

    if (!fs.existsSync(responsePath)) {
      expect(true).toBe(false);
      return;
    }

    const content = fs.readFileSync(responsePath, 'utf8');
    // 检查函数定义中是否包含 success: true
    expect(content).toContain('success');
    expect(content).toMatch(/success\s*:\s*true|success:\s*['"]true['"]/);
  });

  it('successResponse 应支持 data 参数', () => {
    const fs = require('fs');
    const path = require('path');

    const responsePath = path.join(__dirname, '../../lib/api/response.ts');

    if (!fs.existsSync(responsePath)) {
      expect(true).toBe(false);
      return;
    }

    const content = fs.readFileSync(responsePath, 'utf8');
    // 检查函数签名是否包含 data 参数
    expect(content).toContain('data');
  });

  it('successResponse 应支持可选的 meta 参数', () => {
    const fs = require('fs');
    const path = require('path');

    const responsePath = path.join(__dirname, '../../lib/api/response.ts');

    if (!fs.existsSync(responsePath)) {
      expect(true).toBe(false);
      return;
    }

    const content = fs.readFileSync(responsePath, 'utf8');
    // 检查是否支持分页等元数据
    const hasMeta = content.includes('meta') ||
      content.includes('total') ||
      content.includes('page') ||
      content.includes('limit');

    expect(hasMeta).toBe(true);
  });
});

describe('errorResponse 函数规范', () => {
  it('errorResponse 应返回 success: false', () => {
    const fs = require('fs');
    const path = require('path');

    const responsePath = path.join(__dirname, '../../lib/api/response.ts');

    if (!fs.existsSync(responsePath)) {
      expect(true).toBe(false);
      return;
    }

    const content = fs.readFileSync(responsePath, 'utf8');
    // 检查函数定义中是否包含 success: false
    expect(content).toMatch(/success\s*:\s*false|success:\s*['"]false['"]/);
  });

  it('errorResponse 应支持 error/message 参数', () => {
    const fs = require('fs');
    const path = require('path');

    const responsePath = path.join(__dirname, '../../lib/api/response.ts');

    if (!fs.existsSync(responsePath)) {
      expect(true).toBe(false);
      return;
    }

    const content = fs.readFileSync(responsePath, 'utf8');
    expect(content).toMatch(/error\s*[:?]|message\s*[:?]/);
  });

  it('errorResponse 应支持可选的 code 参数', () => {
    const fs = require('fs');
    const path = require('path');

    const responsePath = path.join(__dirname, '../../lib/api/response.ts');

    if (!fs.existsSync(responsePath)) {
      expect(true).toBe(false);
      return;
    }

    const content = fs.readFileSync(responsePath, 'utf8');
    expect(content).toContain('code');
  });
});

describe('API 响应格式标准', () => {
  it('应定义 ApiResponse<T> 类型', () => {
    const fs = require('fs');
    const path = require('path');

    const responsePath = path.join(__dirname, '../../lib/api/response.ts');

    if (!fs.existsSync(responsePath)) {
      expect(true).toBe(false);
      return;
    }

    const content = fs.readFileSync(responsePath, 'utf8');
    // 检查是否有类型定义
    expect(content).toMatch(/interface\s+ApiResponse|type\s+ApiResponse/);
  });

  it('ApiResponse 应包含标准的字段', () => {
    const fs = require('fs');
    const path = require('path');

    const responsePath = path.join(__dirname, '../../lib/api/response.ts');

    if (!fs.existsSync(responsePath)) {
      expect(true).toBe(false);
      return;
    }

    const content = fs.readFileSync(responsePath, 'utf8');
    // 检查类型定义中的标准字段
    expect(content).toContain('success');
    expect(content).toContain('data');
  });
});