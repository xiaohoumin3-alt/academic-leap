# 深度思考题API使用指南

**日期**: 2026-05-11
**状态**: ⚠️ 待数据库迁移

---

## 已完成的改造

### 1. 数据库Schema扩展

**文件**: `prisma/schema.prisma`

```prisma
model Question {
  // ... 现有字段
  
  // 深度思考题字段（新增）
  isDeepThinking      Boolean  @default(false)
  deepType            String?  // 'optimization' | 'growth' | 'geometry' | 'special'
  cognitiveLevel      String?  @default("{}") // JSON: {understanding: 1-5, modeling: 1-5, solving: 1-5}
}
```

**状态**: ✅ Schema已更新
**待完成**: 运行数据库迁移（见下文）

### 2. 生成API改造

**文件**: `app/api/questions/generate/route.ts`

**新增功能**：
- ✅ 支持 `mode` 参数（'simple' | 'deep' | 'mixed'）
- ✅ `mode='deep'` 时使用 quadratic_word_problem_v2 模板
- ✅ `mode='mixed'` 时30%深度题 + 70%简单题
- ✅ 保存深度思考题元数据到数据库

---

## API使用方法

### 1. 生成简单题（默认行为）

```bash
curl -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePoint": "二次函数",
    "difficulty": 3,
    "count": 5
  }'
```

**响应**：
```json
{
  "success": true,
  "questions": [
    {
      "id": "...",
      "templateId": "quadratic_word_problem",
      "isDeepThinking": false,
      ...
    }
  ]
}
```

### 2. 生成深度思考题

```bash
curl -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePoint": "二次函数",
    "difficulty": 3,
    "count": 5,
    "mode": "deep"
  }'
```

**响应**：
```json
{
  "success": true,
  "questions": [
    {
      "id": "...",
      "templateId": "quadratic_word_problem_v2",
      "isDeepThinking": true,
      "deepType": "optimization",
      "cognitiveLevel": {"understanding": 4, "modeling": 3, "solving": 2},
      "reasoningDepth": 0.6,
      "steps": [
        {
          "stepId": "s1",
          "answerMode": "choice",
          "ui": {"instruction": "这个问题的核心是求什么的最值？"},
          "expectedAnswer": {"type": "choice", "value": "面积"}
        },
        {
          "stepId": "s2",
          "answerMode": "choice",
          "ui": {"instruction": "设矩形与墙平行的一边长为x米..."},
          "expectedAnswer": {"type": "choice", "value": "40-2x"}
        },
        {
          "stepId": "s3",
          "answerMode": "number",
          "ui": {"instruction": "要使面积最大，x应取多少米？"},
          "expectedAnswer": {"type": "number", "value": 10}
        }
      ]
    }
  ]
}
```

### 3. 生成混合题目

```bash
curl -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePoint": "二次函数",
    "difficulty": 3,
    "count": 10,
    "mode": "mixed"
  }'
```

**响应**：
```json
{
  "success": true,
  "questions": [
    {
      "templateId": "quadratic_word_problem_v2",
      "isDeepThinking": true,
      ...
    },
    {
      "templateId": "quadratic_word_problem",
      "isDeepThinking": false,
      ...
    },
    ...
  ]
}
```

**比例**：约30%深度题（3题）+ 70%简单题（7题）

---

## 数据库迁移

### 问题

当前项目存在数据库提供者不匹配问题：
- Schema配置：PostgreSQL
- 迁移锁文件：SQLite

### 解决方案

**选项1：重置迁移历史**（推荐用于开发环境）

```bash
# 1. 备份现有数据（重要！）
pg_dump academic_leap > backup.sql

# 2. 删除现有迁移目录
rm -rf prisma/migrations

# 3. 重新初始化
npx prisma migrate dev --name init

# 4. 应用新Schema
npx prisma migrate dev
```

**选项2：手动迁移**（推荐用于生产环境）

```sql
-- 手动添加新字段
ALTER TABLE "Question" 
ADD COLUMN "isDeepThinking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deepType" TEXT,
ADD COLUMN "cognitiveLevel" TEXT NOT NULL DEFAULT '{}';

-- 创建索引
CREATE INDEX "Question_isDeepThinking_idx" ON "Question"("isDeepThinking");
```

### 验证迁移

```bash
# 检查字段是否创建成功
npx prisma studio
# 在Studio中查看Question表，应该有新字段
```

---

## 验证测试

### 测试1：生成深度思考题

```bash
# 启动开发服务器
npm run dev

# 在另一个终端运行测试
curl -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePoint": "二次函数",
    "difficulty": 3,
    "count": 1,
    "mode": "deep"
  }' | jq '.questions[0] | {isDeepThinking, deepType, cognitiveLevel}'
```

**预期输出**：
```json
{
  "isDeepThinking": true,
  "deepType": "optimization",
  "cognitiveLevel": "{\"understanding\":4,\"modeling\":3,\"solving\":2}"
}
```

### 测试2：混合模式

```bash
curl -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePoint": "二次函数",
    "difficulty": 3,
    "count": 10,
    "mode": "mixed"
  }' | jq '.questions | map(.isDeepThinking) | group_by(.) | map({count: length})'
```

**预期输出**：
```json
[
  {"false": 7},
  {"true": 3}
]
```

### 测试3：三段式推理链

```bash
curl -s -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePoint": "二次函数",
    "difficulty": 3,
    "count": 1,
    "mode": "deep"
  }' | jq '.questions[0].steps | length'
```

**预期输出**：`3`

---

## 前端集成示例

### 调用深度思考题API

```typescript
// 生成深度思考题
async function loadDeepThinkingQuestions() {
  const response = await fetch('/api/questions/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      knowledgePoint: '二次函数',
      difficulty: 3,
      count: 5,
      mode: 'deep',  // 深度思考题
    }),
  });

  const { questions } = await response.json();

  // 过滤出深度思考题
  const deepQuestions = questions.filter((q: any) => q.isDeepThinking);

  console.log(`深度思考题: ${deepQuestions.length}/${questions.length}`);
  return deepQuestions;
}
```

### 显示深度标识

```typescript
function QuestionCard({ question }: { question: any }) {
  const isDeepThinking = question.isDeepThinking;

  return (
    <div className="question-card">
      {isDeepThinking && (
        <div className="deep-thinking-badge">
          🧠 深度思考题
        </div>
      )}

      <div className="question-content">
        {question.content.context}
      </div>

      {isDeepThinking && (
        <div className="cognitive-level">
          <div>理解: {question.cognitiveLevel.understanding}/5</div>
          <div>建模: {question.cognitiveLevel.modeling}/5</div>
          <div>求解: {question.cognitiveLevel.solving}/5</div>
        </div>
      )}
    </div>
  );
}
```

---

## 当前限制

### 已知问题

1. **数据库迁移未完成**
   - Schema已更新，但迁移未执行
   - 临时方案：API代码已写好，等待迁移后即可使用

2. **TypeScript类型未更新**
   - Prisma客户端类型需要重新生成
   - 临时方案：使用类型断言或 `@ts-ignore`

3. **仅支持二次函数知识点**
   - 当前只有 quadratic_word_problem_v2 模板
   - 扩展其他知识点需要创建对应v2模板

### 下一步优化

1. ✅ 完成数据库迁移
2. ✅ 创建更多知识点的深度题模板
3. ✅ 改造推荐API（深度题占比≥30%）
4. ✅ UI组件改造（显示🧠标识和推理链）

---

## 总结

✅ **已完成**：
- Schema扩展
- API改造（mode参数支持）
- 文档和示例

⏳ **待完成**：
- 数据库迁移
- Prisma类型生成
- 前端UI改造
- 推荐API改造

---

**文档完成**
