# 知识点覆盖优化实施计划

## 【三原则审视】

1. **2/8原则**：核心20%是轮询取题逻辑（第146-179行替换），只需修改一个文件的一小段代码即可解决80%的知识点覆盖问题。不需要新建文件、不需要重构现有架构。

2. **第一性原理**：根本问题是"每知识点取多题导致覆盖集中"，解决方案是"每知识点每轮只取1题，多轮轮询直到满足题目数"。

3. **收益递减**：当前v4设计已达到极简实施（零新增文件），进一步优化（如批量查询）属于性能优化，非当前必须。

---

## Phase 1: 准备（代码审查与类型定义）

| Step | Action | Verification |
|------|--------|--------------|
| 1.1 | 确认当前代码第146-179行为需要替换的取题逻辑 | `sed -n '146,179p' app/api/assessment/start/route.ts \| head -5` 输出以 `for (const kp of selectedKnowledgePoints)` 开头 |
| 1.2 | 在文件顶部添加 `QuestionContent` 接口定义 | 添加接口后 `tsc --noEmit` 通过 |
| 1.3 | 确认 `questions` 数组类型与新代码兼容 | 类型检查无报错 |

---

## Phase 2: 核心实施（轮询取题逻辑替换）

| Step | Action | Verification |
|------|--------|--------------|
| 2.1 | 删除第146-179行的旧取题逻辑（for循环块） | Git diff 显示删除34行 |
| 2.2 | 插入新的轮询取题代码（含 maxRounds 计算） | `pnpm prettier --write app/api/assessment/start/route.ts` 无报错 |
| 2.3 | 验证 `targetCount` 变量位置（移入替换代码块内） | 确认删除第182行的重复定义 |
| 2.4 | 验证 `usedQuestionIds` Set 去重逻辑 | `grep -n 'usedQuestionIds.add' app/api/assessment/start/route.ts` 存在且在循环内 |
| 2.5 | 验证 `maxRounds` 计算公式正确性 | `grep 'maxRounds.*Math.ceil' app/api/assessment/start/route.ts` 输出不包含 `+ 1` |

---

## Phase 3: 边界情况处理

| Step | Action | Verification |
|------|--------|--------------|
| 3.1 | 验证 `selectedKnowledgePoints.length === 0` 错误处理 | 现有第130-132行已处理，无需修改 |
| 3.2 | 验证 `questions.length === 0` 降级逻辑 | 现有第288-294行已处理，无需修改 |
| 3.3 | 验证题目内容解析失败时的降级 | `catch { content = { question: '题目解析失败' }; }` 存在 |
| 3.4 | 验证 AI 生成补充逻辑保持不变 | 第183-285行 AI 生成代码无修改 |

---

## Phase 4: 编译验证

| Step | Action | Verification |
|------|--------|--------------|
| 4.1 | 运行 `tsc --noEmit` | 无类型错误 |
| 4.2 | 运行 `pnpm lint` | 无 ESLint 错误 |
| 4.3 | 运行 `pnpm build` | 构建成功 |

---

## Phase 5: 功能测试（手动验证）

| Step | Action | Verification |
|------|--------|--------------|
| 5.1 | 准备测试数据：确保≥10个测评知识点 | 数据库查询 `SELECT COUNT(*) FROM knowledge_points WHERE inAssess = true` |
| 5.2 | 调用 API `POST /api/assessment/start` | HTTP 200，返回10题 |
| 5.3 | 检查响应中的知识点分布 | `jq '.data.questions | map(.knowledgePoint) | unique | length'` ≥ 8 |
| 5.4 | 测试 retry 模式 `POST /api/assessment/start?retry=true` | 难度正确调整，知识点分布均匀 |
| 5.5 | 测试知识点不足场景（临时限制为3个） | 每个知识点 2-4 题，分布均匀 |

---

## Phase 6: 代码清理

| Step | Action | Verification |
|------|--------|--------------|
| 6.1 | 删除第182行重复的 `const targetCount = 10;` | Git diff 显示删除 |
| 6.2 | 运行最终格式化 `pnpm prettier --write` | 文件格式统一 |

---

## 修改文件清单

| 文件路径 | 修改类型 | 行数变化 |
|----------|----------|----------|
| `/Users/seanxx/academic-leap/academic-leap/app/api/assessment/start/route.ts` | 替换 | ~40行 |

---

## 核心代码变更（第146-179行替换为）

```typescript
// 第一步：轮询取题（每知识点每轮取1道，确保均匀分布）
const targetCount = 10;  // 目标题目数
const usedQuestionIds = new Set<string>();
const maxRounds = Math.ceil(targetCount / selectedKnowledgePoints.length);

for (let round = 0; round < maxRounds && questions.length < targetCount; round++) {
  for (const kp of selectedKnowledgePoints) {
    if (questions.length >= targetCount) break;

    const queryDifficulty = retry ? startDifficulty : minDifficulty;

    const question = await prisma.question.findFirst({
      where: {
        knowledgePoints: { contains: kp.id },
        id: { notIn: Array.from(usedQuestionIds) },
        difficulty: {
          gte: queryDifficulty,
          lte: retry ? queryDifficulty + 1 : maxDifficulty,
        },
      },
      select: {
        id: true,
        type: true,
        difficulty: true,
        content: true,
        answer: true,
        steps: true,
      },
    });

    if (question) {
      let content: QuestionContent;
      try {
        const parsed = typeof question.content === 'string'
          ? JSON.parse(question.content)
          : question.content;
        content = {
          question: parsed.question || '',
          options: parsed.options || [],
          explanation: parsed.explanation || '',
        };
      } catch {
        content = { question: '题目解析失败' };
      }

      questions.push({
        id: question.id,
        type: question.type,
        difficulty: startDifficulty,
        content,
        knowledgePoint: kp.name,
        stepCount: question.steps?.length ?? 1,
        answer: question.answer,
      });
      usedQuestionIds.add(question.id);
    }
  }
}
```

---

## 顶部新增类型定义（第7行后插入）

```typescript
// 题目内容类型
interface QuestionContent {
  question: string;
  options?: string[];
  explanation?: string;
}
```

---

## 验证脚本（快速验证）

```bash
# 验证知识点覆盖率
curl -X POST http://localhost:3000/api/assessment/start \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=YOUR_TOKEN" \
  | jq '.data.questions | map(.knowledgePoint) | unique | length'
# 预期输出: >= 8

# 验证分布均匀度
curl -X POST http://localhost:3000/api/assessment/start \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=YOUR_TOKEN" \
  | jq '.data.questions | group_by(.knowledgePoint) | map(length) | max'
# 预期输出: <= 2 (当知识点充足时)
```

---

## 风险检查清单

| 风险 | 缓解措施 | 状态 |
|------|----------|------|
| maxRounds 计算错误导致无限循环 | 使用 `Math.ceil` 不加 `+1`，外层有 `questions.length < targetCount` 保护 | 已缓解 |
| usedQuestionIds 去重失效 | 使用 Set 数据结构，`notIn` 查询 | 已缓解 |
| 题目关联多知识点导致重复 | `usedQuestionIds` 全局去重已考虑 | 已缓解 |
| AI 生成逻辑被意外修改 | 只替换第146-179行，AI 生成代码在第183-285行不动 | 已缓解 |

---

## 完成标准

- [ ] TypeScript 编译通过 (`tsc --noEmit`)
- [ ] ESLint 检查通过 (`pnpm lint`)
- [ ] 构建成功 (`pnpm build`)
- [ ] 知识点覆盖率 ≥ 80% (10题覆盖≥8个不同知识点)
- [ ] 分布均匀 (无知识点超过2题，当知识点充足时)
- [ ] Retry 模式正常工作
- [ ] AI 生成降级逻辑保持不变
