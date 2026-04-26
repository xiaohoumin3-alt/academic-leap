# 判题系统 v2 测试计划与结果

## 测试元信息

| 项目 | 值 |
|------|-----|
| 测试日期 | 2026-04-26 |
| 测试人员 | |
| 测试环境 | 开发环境 (localhost) |
| 浏览器版本 | Chrome/Safari/Firefox |
| 测试类型 | 手动功能测试 + 性能测试 |

---

## 测试计划概述

本测试计划涵盖判题系统 v2 的所有 AnswerMode 组件的功能验证和性能测试。

### 测试范围

1. **功能测试**: 所有 AnswerMode UI 组件
   - YES_NO (是/否按钮)
   - MULTIPLE_CHOICE (单选/多选)
   - NUMBER (数字键盘)
   - COORDINATE (坐标输入)
   - TEXT_INPUT (文本输入)

2. **性能测试**: 响应时间和渲染性能
   - 判题响应时间 < 100ms
   - UI 渲染时间 < 50ms
   - 内存泄漏检测

3. **兼容性测试**: v1/v2 协议兼容性

---

## 第一部分: 功能测试清单

### 1. YES_NO 模式测试

| 测试用例 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|---------|---------|---------|------|
| YES_NO-001 | 点击"是"按钮 | 提交 "yes"，触发判题 | | [ ] |
| YES_NO-002 | 点击"否"按钮 | 提交 "no"，触发判题 | | [ ] |
| YES_NO-003 | 正确答案为"是"时点击"是" | 显示正确反馈 | | [ ] |
| YES_NO-004 | 正确答案为"是"时点击"否" | 显示错误提示，errorType=concept_error | | [ ] |
| YES_NO-005 | 禁用状态下点击按钮 | 按钮无响应，视觉呈现禁用态 | | [ ] |
| YES_NO-006 | 自定义 yes/no 文本 | 显示自定义文本 | | [ ] |

**组件路径**: `components/question-input/YesNoInput.tsx`

**判题函数**: `judgeYesNo()` in `lib/question-engine/judge-v2.ts`

---

### 2. MULTIPLE_CHOICE 模式测试

| 测试用例 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|---------|---------|---------|------|
| CHOICE-001 | 单选模式：点击选项 | 选中该选项，自动提交 | | [ ] |
| CHOICE-002 | 单选模式：切换选项 | 取消原选项，选中新选项 | | [ ] |
| CHOICE-003 | 多选模式：点击多个选项 | 多个选项同时被选中 | | [ ] |
| CHOICE-004 | 多选模式：取消已选项 | 该选项取消选中 | | [ ] |
| CHOICE-005 | 多选模式：点击提交 | 提交所有选中项 (逗号分隔) | | [ ] |
| CHOICE-006 | 禁用状态下点击 | 无响应，视觉呈现禁用态 | | [ ] |
| CHOICE-007 | 正确单选答案 | 显示正确反馈 | | [ ] |
| CHOICE-008 | 错误单选答案 | 显示错误提示，errorType=concept_error | | [ ] |
| CHOICE-009 | 正确多选答案 | 显示正确反馈 | | [ ] |
| CHOICE-010 | 部分正确的多选答案 | 显示错误提示，指出正确数量 | | [ ] |

**组件路径**: `components/question-input/ChoiceInput.tsx`

**判题函数**: `judgeChoice()` in `lib/question-engine/judge-v2.ts`

---

### 3. NUMBER 模式测试

| 测试用例 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|---------|---------|---------|------|
| NUMBER-001 | 输入普通数字 | 正确显示数字 | | [ ] |
| NUMBER-002 | 点击退格键(←) | 删除最后一个字符 | | [ ] |
| NUMBER-003 | 点击 +/- 键 | 切换正负号 | | [ ] |
| NUMBER-004 | 点击小数点(.) | 插入小数点 | | [ ] |
| NUMBER-005 | 点击特殊键(√, π) | 插入对应符号 | | [ ] |
| NUMBER-006 | 输入负数 | 显示负号和数字 | | [ ] |
| NUMBER-007 | 输入小数 | 显示小数形式 | | [ ] |
| NUMBER-008 | 点击提交按钮 | 触发判题 | | [ ] |
| NUMBER-009 | 禁用状态下操作 | 无响应，视觉呈现禁用态 | | [ ] |
| NUMBER-010 | 空值提交 | 显示验证提示或禁止提交 | | [ ] |
| NUMBER-011 | 正确数值答案 (在容差范围内) | 显示正确反馈 | | [ ] |
| NUMBER-012 | 错误数值答案 | 显示错误提示，显示正确答案 | | [ ] |
| NUMBER-013 | 非数字输入 | 显示格式错误提示 | | [ ] |

**组件路径**: `components/question-input/NumberInput.tsx`

**判题函数**: `judgeNumber()` in `lib/question-engine/judge-v2.ts`

**容差配置**: `tolerance` 参数，默认 0.001

---

### 4. COORDINATE 模式测试

| 测试用例 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|---------|---------|---------|------|
| COORD-001 | 输入 X 和 Y 值 | 组合成 (x, y) 格式 | | [ ] |
| COORD-002 | 只输入 X 值 | 不触发提交，等待 Y 值 | | [ ] |
| COORD-003 | 只输入 Y 值 | 不触发提交，等待 X 值 | | [ ] |
| COORD-004 | 输入负数坐标 | 正确显示负号 | | [ ] |
| COORD-005 | 输入小数坐标 | 正确显示小数 | | [ ] |
| COORD-006 | 点击提交按钮 | 触发判题 | | [ ] |
| COORD-007 | 禁用状态下操作 | 无响应，视觉呈现禁用态 | | [ ] |
| COORD-008 | 正确坐标 (在容差范围内) | 显示正确反馈 | | [ ] |
| COORD-009 | 错误坐标 | 显示错误提示，显示正确坐标 | | [ ] |
| COORD-010 | X 或 Y 为非数字 | 显示格式错误提示 | | [ ] |

**组件路径**: `components/question-input/CoordinateInput.tsx`

**判题函数**: `judgeCoordinate()` in `lib/question-engine/judge-v2.ts`

**支持格式**: `(x, y)`, `[x, y]`, `x y`

**容差配置**: `tolerance` 参数，默认 0.01

---

### 5. TEXT_INPUT 模式测试

| 测试用例 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|---------|---------|---------|------|
| TEXT-001 | 输入文本 | 正确显示输入内容 | | [ ] |
| TEXT-002 | 输入正确答案 (精确匹配) | 显示正确反馈 | | [ ] |
| TEXT-003 | 输入同义词 | 显示正确反馈 | | [ ] |
| TEXT-004 | 输入包含正确答案的文本 | 显示正确反馈 | | [ ] |
| TEXT-005 | 大小写混合 | 不区分大小写匹配 | | [ ] |
| TEXT-006 | 首尾空格 | 自动去除空格后匹配 | | [ ] |
| TEXT-007 | 错误答案 | 显示错误提示，显示正确答案 | | [ ] |

**判题函数**: `judgeString()` in `lib/question-engine/judge-v2.ts`

**同义词支持**: `variants` 参数

---

### 6. 错误提示测试

| 错误类型 | 触发场景 | 预期提示信息 | 实际结果 | 状态 |
|---------|---------|-------------|---------|------|
| format_error | 坐标格式错误、非数字输入 | "输入格式不正确，请检查" | | [ ] |
| calculation_error | 数值计算错误、坐标数值错误 | "正确答案是：{correctAnswer}" | | [ ] |
| concept_error | 判断错误、选择错误 | "再仔细想想题目条件" | | [ ] |
| system_error | 未知题型 | "题目配置错误，请联系管理员" | | [ ] |

**配置路径**: `components/question-input/error-messages.ts`

---

## 第二部分: 性能测试

### 测试方法

使用浏览器 DevTools (Performance 标签页) 进行测量:

1. 打开 Chrome DevTools (F12)
2. 切换到 Performance 标签页
3. 点击录制按钮
4. 执行测试操作 (提交答案)
5. 停止录制
6. 分析结果

### 判题响应时间测试

| 测试场景 | 目标 | 测试1 | 测试2 | 测试3 | 平均值 | 状态 |
|---------|------|-------|-------|-------|--------|------|
| YES_NO 判题 | < 100ms | | | | | [ ] |
| MULTIPLE_CHOICE 判题 | < 100ms | | | | | [ ] |
| NUMBER 判题 | < 100ms | | | | | [ ] |
| COORDINATE 判题 | < 100ms | | | | | [ ] |
| TEXT_INPUT 判题 | < 100ms | | | | | [ ] |

**测试脚本**: 在 `judgeStepV2()` 函数前后添加性能计时

```javascript
console.time('judge');
judgeStepV2(step, userInput);
console.timeEnd('judge');
```

### UI 渲染时间测试

| 测试场景 | 目标 | 测试1 | 测试2 | 测试3 | 平均值 | 状态 |
|---------|------|-------|-------|-------|--------|------|
| YesNoInput 渲染 | < 50ms | | | | | [ ] |
| ChoiceInput 渲染 | < 50ms | | | | | [ ] |
| NumberInput 渲染 | < 50ms | | | | | [ ] |
| CoordinateInput 渲染 | < 50ms | | | | | [ ] |

### 内存泄漏测试

| 测试场景 | 操作 | 初始内存 | 操作后内存 | GC后内存 | 状态 |
|---------|------|----------|-----------|----------|------|
| YES_NO 重复点击 100 次 | | | | | [ ] |
| NUMBER 重复输入 100 次 | | | | | [ ] |
| 切换题目 50 次 | | | | | [ ] |

**测试方法**: DevTools Memory 标签页，取 Heap Snapshot 对比

---

## 第三部分: 兼容性测试

### v1/v2 协议兼容性

| 测试用例 | 题目类型 | 预期结果 | 实际结果 | 状态 |
|---------|---------|---------|---------|------|
| COMPAT-001 | v1 协议题目 | 正常判题，使用 v1 引擎 | | [ ] |
| COMPAT-002 | v2 协议题目 | 正常判题，使用 v2 引擎 | | [ ] |
| COMPAT-003 | 混合模式 (自动检测) | 自动选择正确的判题引擎 | | [ ] |

**检测逻辑**: `lib/question-engine/judge.ts` 中的 `judgeStep()` 函数

---

## 测试执行步骤

### 前置准备

1. [ ] 启动开发服务器: `pnpm dev`
2. [ ] 打开浏览器: `http://localhost:3000`
3. [ ] 登录测试账号
4. [ ] 打开 DevTools (F12)
5. [ ] 准备测试数据 (各类型题目)

### 执行测试

1. **功能测试**: 按照测试用例逐一执行，记录实际结果
2. **性能测试**: 使用 DevTools Performance 标签页记录数据
3. **兼容性测试**: 测试 v1 和 v2 协议的题目

### 缺陷记录

发现问题时，记录以下信息:

| 缺陷ID | 组件 | 测试用例 | 问题描述 | 严重程度 | 状态 |
|--------|------|---------|---------|---------|------|
| BUG-001 | | | | Critical | [ ] |
| BUG-002 | | | | High | [ ] |

**严重程度定义**:
- Critical: 阻塞性问题，无法继续测试
- High: 主要功能缺陷，影响用户体验
- Medium: 次要功能缺陷
- Low: UI 细节问题

---

## 测试结果汇总

### 功能测试结果

- YES_NO 模式: [ ] 通过 / [ ] 失败
- MULTIPLE_CHOICE 模式: [ ] 通过 / [ ] 失败
- NUMBER 模式: [ ] 通过 / [ ] 失败
- COORDINATE 模式: [ ] 通过 / [ ] 失败
- TEXT_INPUT 模式: [ ] 通过 / [ ] 失败
- 错误提示: [ ] 通过 / [ ] 失败

### 性能测试结果

- 判题响应时间: 平均 ______ ms (目标 < 100ms) - [ ] 通过 / [ ] 失败
- UI 渲染时间: 平均 ______ ms (目标 < 50ms) - [ ] 通过 / [ ] 失败
- 内存泄漏: [ ] 未发现 / [ ] 发现

### 兼容性测试结果

- v1 协议题目: [ ] 正常判题 / [ ] 异常
- v2 协议题目: [ ] 正常判题 / [ ] 异常
- 混合模式: [ ] 自动检测 / [ ] 异常

---

## 发现的问题

### 问题列表

1. **问题描述**:
   - 组件:
   - 测试用例:
   - 严重程度:
   - 复现步骤:
   - 预期结果:
   - 实际结果:
   - 解决方案:

2. **问题描述**:
   - 组件:
   - 测试用例:
   - 严重程度:
   - 复现步骤:
   - 预期结果:
   - 实际结果:
   - 解决方案:

---

## 测试结论

- [ ] 所有功能测试通过，可以发布
- [ ] 发现次要问题，可以发布 (需记录)
- [ ] 发现主要问题，需修复后重新测试
- [ ] 发现阻塞性问题，不能发布

---

## 附录

### 相关文件

| 文件路径 | 说明 |
|---------|------|
| `lib/question-engine/protocol-v2.ts` | v2 协议类型定义 |
| `lib/question-engine/judge-v2.ts` | v2 判题引擎 |
| `lib/question-engine/types/judge.ts` | 判题结果类型 |
| `components/question-input/YesNoInput.tsx` | 是/否输入组件 |
| `components/question-input/ChoiceInput.tsx` | 选择输入组件 |
| `components/question-input/NumberInput.tsx` | 数字输入组件 |
| `components/question-input/CoordinateInput.tsx` | 坐标输入组件 |
| `components/question-input/error-messages.ts` | 错误提示配置 |

### AnswerMode 枚举值

```typescript
export enum AnswerMode {
  TEXT_INPUT = 'text',           // 文本输入框
  YES_NO = 'yes_no',             // 是/否 按钮
  MULTIPLE_CHOICE = 'choice',    // 选项按钮
  NUMBER = 'number',             // 数字输入
  COORDINATE = 'coordinate',     // 坐标输入
  EXPRESSION = 'expression',     // 数学表达式
  FILL_BLANK = 'fill_blank',     // 多个填空
  ORDER = 'order',               // 排序题
  MATCH = 'match',               // 匹配题
}
```

### ErrorType 类型

```typescript
export type ErrorType =
  | 'format_error'      // 格式错误
  | 'calculation_error' // 计算错误
  | 'concept_error'     // 概念错误
  | 'system_error'      // 系统错误
```
