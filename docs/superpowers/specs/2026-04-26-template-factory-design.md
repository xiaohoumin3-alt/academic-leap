# 模板工厂系统设计

> 为人教版八年级下册数学知识系统提供可靠、可扩展的模板生成机制

## 背景

**问题:**
- 模板创建依赖随机性和手工配置，容易出现状态不一致
- 知识点和模板关联容易断裂
- 无法批量可靠地扩展新章节
- 每改一次就报错，系统脆弱

**目标:**
建立一个标准化的"模板工厂"系统，输入教材结构，输出符合规范的知识点+模板。

## 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                    模板工厂系统                              │
├─────────────────────────────────────────────────────────────┤
│  输入层                                                       │
│  ├── YAML 配置表（版本控制，可导入导出）                    │
│  ├── 可视化编辑器（后台管理界面）                          │
│  └── 教材文本解析器（AI 辅助）                             │
├─────────────────────────────────────────────────────────────┤
│  处理层                                                       │
│  ├── 模板骨架库（通用步骤类型）                             │
│  ├── 参数规格引擎（难度配置生成）                           │
│  └── 验证器（输出质量检查）                                 │
├─────────────────────────────────────────────────────────────┤
│  输出层                                                       │
│  ├── 数据库（KnowledgeConcept, KnowledgePoint, Template）    │
│  ├── 文件系统（templates/*.ts）                            │
│  └── 部署包（seed + migration）                             │
└─────────────────────────────────────────────────────────────┘
```

## 关键设计决策

| 决策 | 方案 | 理由 |
|------|------|------|
| 模板状态 | 默认 `production` | 新模板默认可用，下线需显式处理 |
| 模板粒度 | 分层抽象 | 骨架（通用逻辑）+ 参数规格（差异化） |
| 数据存储 | 数据库存结构 + 文件系统存代码 | templateKey 作为关联键 |
| 触发方式 | 批量 + 增量 + 全程预览 | 适配首次导入和后续扩展 |

## 设计细节

### 1. 输入层

#### 1.1 YAML 配置表

```yaml
# config/chapter16-sqrt.yaml
chapter:
  id: ch16-quadratic-radical
  name: 第16章 二次根式
  concepts:
    - id: concept-quadratic-radical
      name: 二次根式
      category: 代数
      weight: 5
      knowledgePoints:
        - id: kp16-1-definition
          name: 二次根式的定义
          templates:
            - key: sqrt_concept
              type: computation
              stepTypes: [COMPUTE_SQRT]
              difficulty:
                min: 1
                max: 5
        - id: kp16-4-multiply
          name: 二次根式的乘法法则
          templates:
            - key: sqrt_multiply
              type: computation
              stepTypes: [SQRT_MIXED]
              difficulty:
                min: 1
                max: 5
```

#### 1.2 可视化编辑器

后台管理界面：
- 章节树形结构
- 知识点拖拽排序
- 模板类型下拉选择
- 难度参数滑块配置
- 预览窗口实时显示

#### 1.3 教材文本解析器

AI 辅助输入：
- 粘贴教材章节文本
- 定义解析规范（章节标题、知识点识别模式）
- AI 生成结构化配置

### 2. 处理层

#### 2.1 模板骨架库

通用步骤模式：
- `COMPUTE_*` - 计算类
- `VERIFY_*` - 判定类
- `SOLVE_*` - 解方程类

骨架定义：
```typescript
// lib/template-factory/skeletons/compute-sqrt.ts
import { QuestionTemplate, StepType } from '../protocol';

export const ComputeSqrtSkeleton: Omit<QuestionTemplate, 'id' | 'knowledgePoint'> = {
  name: '计算二次根式',
  stepTypes: ['COMPUTE_SQRT'],
  generateParams: (level: number) => {
    return { radicand: Math.floor(Math.random() * 100) + 1 };
  },
  buildSteps: (params) => [{
    stepId: 's1',
    type: StepType.COMPUTE_SQRT,
    inputType: 'numeric',
    keyboard: 'numeric',
    answerType: 'number',
    ui: {
      instruction: '计算二次根式的值',
      inputTarget: '√a 的值',
      inputHint: '输入数字',
    },
  }],
  render: (params) => ({
    title: `计算 √${params.radicand} 的值`,
    description: '二次根式计算',
    context: '二次根式定义：√a (a ≥ 0)',
  }),
};
```

#### 2.2 参数规格引擎

难度配置生成：
```typescript
// lib/template-factory/param-engine.ts
import { ParamConstraint } from '../protocol';

export function generateDifficultyConfig(
  min: number,
  max: number,
  step: number = 2
): Record<number, Record<string, ParamConstraint>> {
  const levels = {};
  for (let i = 1; i <= 5; i++) {
    levels[i] = {
      value: { type: 'int', min: min + (i - 1) * step, max: max + (i - 1) * step }
    };
  }
  return levels;
}
```

#### 2.3 验证器

输出质量检查：
- StepType 枚举值有效性
- 难度配置完整性（1-5 级别）
- 数据库外键关联验证
- 代码语法检查

### 3. 输出层

#### 3.1 数据库结构

```prisma
// Template 扩展字段
model Template {
  // ... existing fields
  status           String    @default("production")  // 默认 production
  templateSkeleton String?   // 关联骨架 ID
  paramSpec       Json?      // 难度参数规格
}
```

#### 3.2 文件系统

```
lib/question-engine/templates/
├── _factory/              # 工厂生成区域
│   ├── chapter16/
│   │   ├── sqrt_concept.ts
│   │   └── sqrt_multiply.ts
│   └── chapter19/
├── _skeletons/            # 骨架定义
│   ├── compute-sqrt.ts
│   └── verify-quadrilateral.ts
└── index.ts                # 自动注册
```

#### 3.3 部署包

一键部署脚本：
```bash
pnpm factory:deploy --config config/chapter16-sqrt.yaml
```

执行内容：
1. 解析 YAML 配置
2. 创建/更新数据库记录
3. 生成模板代码文件
4. 运行 Prisma migrate
5. 运行 seed

### 4. 预览确认流程

```
用户输入（YAML/UI）
       ↓
   工厂解析（不写入）
       ↓
   生成预览：
   - 知识点树预览
   - 模板代码预览
   - 数据库变更预览
       ↓
   用户确认 ✓
       ↓
   写入数据库 + 生成代码
       ↓
   可选：回滚
```

### 5. 触发方式

| 场景 | 方式 | 说明 |
|------|------|------|
| 首次导入教材 | 批量生成 | 指定章节范围，一键生成 |
| 后续扩展 | 增量添加 | 指定父概念和模板类型 |
| 调试/测试 | 预览模式 | 不写入，仅预览 |

## 实施计划

### Phase 1: 基础框架
- 创建模板骨架库
- 实现 YAML 配置解析器
- 实现参数规格引擎

### Phase 2: 后台管理
- 可视化编辑器
- 预览功能
- 批量生成 UI

### Phase 3: 部署集成
- 部署包生成器
- 回滚机制
- CI/CD 集成

## 预期收益

- **可靠性:** 默认 production，消除随机状态
- **可扩展性:** 新章节可批量导入
- **可维护性:** 配置即代码，版本控制
- **可视化:** 后台管理降低出错门槛