# 场景化题目增强设计方案（最小可行方案）

**日期**: 2026-05-10  
**版本**: v2.0（基于 Swarm Review 反馈修订）  
**状态**: 已批准  
**方案类型**: 最小可行方案（MVP）  
**预计周期**: 0.5-1 天

---

## 一、问题分析

### 1.1 核心问题
用户反馈：academic-leap 的题目"非常简单非常幼稚，题型非常单一"

### 1.2 根因分析（基于代码审查）

通过深入分析现有代码，发现问题不在于"没有场景化能力"，而是：

**现有资产**：
- ✅ 50+ 模板，按章节组织（Chapter 16-20）
- ✅ 场景化模板已存在：`pythagoras_word_problem.ts` 包含 5 种应用场景
  - ladder（梯子）、shortest_path（最短路径）、pole_wire（电线杆）
  - diagonal（对角线）、staircase（楼梯）
- ✅ 双轨制架构：模板引擎 + AI 生成引擎
- ✅ 质量机制：复杂度特征提取（cognitiveLoad, reasoningDepth, complexity）

**问题根源**：
1. **场景化模板覆盖不足**：只有勾股定理有应用题模板（1/50 = 2%）
2. **模式已验证**：`pythagoras_word_problem.ts` 证明了场景化模板的可行性

### 1.3 参考项目研究

**kidding-study**：
- 模板引擎优先，AI 补充
- 流式生成，章节智能分块

**DeepTutor**：
- 13 种 block types
- 双管道耦合（Problem Solving + Question Generation）

**关键借鉴**：
- ✅ 场景化是可复制的模式
- ✅ 直接复制已验证的模式，风险最低

---

## 二、设计方案：最小可行方案（MVP）

### 2.1 设计原则

**核心原则**：
1. **YAGNI**（You Aren't Gonna Need It）：不过度设计
2. **快速验证**：1 天内验证模式可行性
3. **用户反馈优先**：先收集反馈，再决定是否扩展
4. **基于现有资产**：复制 `pythagoras_word_problem.ts` 的成功模式

**三原则审视**：
```
【三原则审视】
1. 2/8：
   - 核心20%：复制1个场景化模板（quadratic_word_problem）
   - 剩余80%：其他知识点后续迭代
   - 为什么不做的80%：先验证模式是否有效，避免过度投入

2. 第一性原理：
   - 根本问题：题目缺乏实际应用场景
   - 为什么这样设计：直接复制已验证的 pythagoras_word_problem 模式
   - 最简单的方式：复制文件 → 修改内容 → 验证 → 收集反馈

3. 收益递减：
   - 当前方案：1个模板 → 覆盖率从2%提升到4%
   - 边界：验证模式可行性（而非追求覆盖率）
   - 何时停止：用户反馈"比之前有趣"后，再决定是否扩展
```

### 2.2 实施方案

#### Step 1：复制现有模式（2小时）

**目标**：复制 `pythagoras_word_problem.ts` 创建一元二次方程应用题模板

**操作**：
```bash
# 1. 复制模板文件
cp lib/question-engine/templates/chapter17/pythagoras_word_problem.ts \
   lib/question-engine/templates/chapter19/quadratic_word_problem.ts

# 2. 修改内容
# - 替换知识点名称：pythagoras → quadratic_function
# - 替换场景：
#   ladder → projectile_motion（抛物运动）
#   shortest_path → area_optimization（面积优化）
#   pole_wire → max_profit（最大利润）
#   diagonal → bridge_design（桥梁设计）
#   staircase → water_flow（水流问题）
# - 调整参数生成逻辑（使用二次函数相关参数）
# - 更新 templateId：pythagoras_word_problem → quadratic_word_problem

# 3. 文件结构（~300行）
# - generateParams(): 根据难度选择场景
# - buildSteps(): 构建答题步骤
# - render(): 渲染题目内容
```

**验收标准**：
- ✅ 文件创建成功：`lib/question-engine/templates/chapter19/quadratic_word_problem.ts`
- ✅ 文件包含 5 个场景化场景
- ✅ TypeScript 编译无错误

#### Step 2：注册新模板（5分钟）

**目标**：将新模板注册到 TEMPLATE_REGISTRY

**操作**：
```typescript
// lib/question-engine/templates/index.ts

// 1. 添加导入（第41行附近）
import { QuadraticWordProblemTemplate } from './chapter19/quadratic_word_problem';

// 2. 注册到 TEMPLATE_REGISTRY（第111行附近）
export const TEMPLATE_REGISTRY: Record<string, QuestionTemplate> = {
  // ... 现有模板
  pythagoras_word_problem: PythagorasWordProblemTemplate,
  quadratic_word_problem: QuadraticWordProblemTemplate,  // 新增
};
```

**验收标准**：
- ✅ 导入语句添加成功
- ✅ TEMPLATE_REGISTRY 包含新模板
- ✅ TypeScript 编译无错误

#### Step 3：API 验证（10分钟）

**目标**：验证新模板可以成功生成题目

**操作**：
```bash
# 启动开发服务器
npm run dev

# 调用 API 生成题目
curl -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePoint": "quadratic_function",
    "difficulty": 3,
    "count": 5,
    "renderStyle": "standard"
  }' | jq '.questions'
```

**可执行的验证脚本**：
```bash
#!/bin/bash
# verify-quadratic-template.sh

echo "=== 验证一元二次方程场景化模板 ==="

# 调用 API
response=$(curl -s -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePoint": "quadratic_function",
    "difficulty": 3,
    "count": 5,
    "renderStyle": "standard"
  }')

# 检查响应
success=$(echo "$response" | jq '.success')
if [ "$success" != "true" ]; then
  echo "❌ API 调用失败"
  echo "$response" | jq '.error'
  exit 1
fi

# 检查题目数量
total_count=$(echo "$response" | jq '.questions | length')
if [ "$total_count" -lt 5 ]; then
  echo "❌ 题目数量不足：$total_count < 5"
  exit 1
fi

# 检查是否使用新模板
template_id=$(echo "$response" | jq '.questions[0].templateId')
if [ "$template_id" != "quadratic_word_problem" ]; then
  echo "⚠️ 警告：未使用新模板，实际使用：$template_id"
fi

# 检查题目内容是否包含场景化描述
first_question_context=$(echo "$response" | jq '.questions[0].content.context')
echo "✅ 第一题场景：$first_question_context"

# 统计场景化覆盖率（包含场景关键词的题目）
scenario_count=$(echo "$response" | jq '[.questions[].content.context] | 
  map(select(. != null and (. | test("抛物|面积|利润|桥梁|水流")))) | length')

coverage=$(awk "BEGIN {printf \"%.0f\", ($scenario_count / $total_count) * 100}")
echo "✅ 场景化覆盖率: $coverage% ($scenario_count/$total_count)"

if [ "$coverage" -ge 60 ]; then
  echo "✅ 验证通过：场景化覆盖率 ≥ 60%"
  exit 0
else
  echo "❌ 验证失败：场景化覆盖率 < 60%"
  exit 1
fi
```

**验收标准**：
- ✅ API 返回 `success: true`
- ✅ 返回 5 道题目
- ✅ 至少 60% 的题目包含场景化描述
- ✅ 题目包含实际应用场景（抛物运动、面积优化等）

#### Step 4：用户反馈收集（持续）

**目标**：收集用户对新场景化题目的反馈

**操作**：
```bash
# 1. 部署到测试环境
npm run build

# 2. 邀请 5-10 个用户试用
# - 通过测试链接访问
# - 完成 5-10 道一元二次方程题目
# - 填写反馈问卷

# 3. 反馈问卷问题
# - Q1: 新题目是否比之前的题目更有趣？(1-5分)
# - Q2: 场景化描述是否有助于理解数学概念？(1-5分)
# - Q3: 你希望哪些知识点也有类似的场景化题目？(开放题)
# - Q4: 其他建议 (开放题)

# 4. 收集反馈后，决定下一步
# - 如果评分 ≥ 4.0：扩展到其他知识点
# - 如果评分 < 4.0：调整场景内容或难度
```

**验收标准**：
- ✅ 收集至少 5 份用户反馈
- ✅ 平均评分 ≥ 4.0/5.0
- ✅ 用户明确表示希望扩展到其他知识点

---

## 三、不做的内容（明确删除）

基于 Swarm Review 反馈，以下内容**明确不做**：

### ❌ 删除的过度设计

1. **场景化模板基类**（`BaseWordProblemTemplate`）
   - 理由：违反 YAGNI 原则，当前只有 1 个新模板，不需要抽象层
   - 替代方案：直接复制 `pythagoras_word_problem.ts`

2. **设计模式总结文档**
   - 理由：代码本身就是最好的文档
   - 替代方案：在代码注释中说明关键设计决策

3. **AI 提示词优化**
   - 理由：非当前瓶颈，优先验证模板引擎效果
   - 替代方案：延后到用户反馈验证通过后

4. **一次性扩展 3 个知识点**
   - 理由：1-2 周时间不够，先验证模式再扩展
   - 替代方案：只做 1 个知识点（一元二次方程）

5. **复杂度特征提取优化**
   - 理由：现有机制已足够
   - 替代方案：使用现有机制

---

## 四、上下游依赖分析

### 4.1 影响范围

**下游（调用方）**：
- ✅ `/api/questions/generate` - 无需修改（兼容现有模板）
- ⚠️ 前端调用方（需验证）：可能需要更新知识点选项

**核心引擎**：
- 📝 `/lib/question-engine/templates/chapter19/quadratic_word_problem.ts` - 新增
- 📝 `/lib/question-engine/templates/index.ts` - 添加导入和注册

**上游（依赖）**：
- ✅ 模板系统 - 扩展，不修改
- ✅ 判题引擎 - 无需修改
- ✅ 渲染层 - 无需修改
- ✅ 数据库 - 无需修改（新模板通过代码注册，无需数据库迁移）

### 4.2 风险控制

**低风险**：
- ✅ 只新增文件，不修改现有代码
- ✅ 复制已验证的模式，风险最低
- ✅ 如果新模板有问题，删除文件即可回退

**已知风险**：
- ⚠️ 模板注册错误：可能导致所有模板加载失败
  - 缓解：先在开发环境验证，确认编译通过后再部署
- ⚠️ 场景化内容质量：可能用户觉得仍然"幼稚"
  - 缓解：收集用户反馈，根据反馈调整

### 4.3 调用方分析

**API 调用方**（基于代码审查）：
- ✅ `/app/api/questions/generate/route.ts` - 使用模板引擎生成题目
- ⚠️ **前端组件**（需验证）：
  - 可能需要更新知识点选择器
  - 可能需要更新题目预览组件

**测试调用方**（需验证）：
- ⚠️ 集成测试：可能需要更新测试数据
- ⚠️ E2E 测试：可能需要更新测试用例

---

## 五、预期效果

### 5.1 量化指标

| 指标 | 当前 | 阶段1目标 | 最终目标 |
|------|------|----------|----------|
| 场景化模板覆盖率 | 2% (1/50) | 4% (2/50) | 20% (10/50) |
| 场景化题目数量 | 1个 | 2个 | 10个 |
| 实施时间 | - | 0.5-1天 | 1-2周（如果扩展） |

### 5.2 用户体验改善（假设）

- ✅ 题目更贴近实际应用（抛物运动、面积优化）
- ✅ 激发学习兴趣（如果用户反馈评分 ≥ 4.0）
- ✅ 培养数学建模思维（如果场景描述足够具体）

### 5.3 可扩展性（如果验证成功）

**后续迭代路径**（基于用户反馈）：
```
如果用户反馈 ≥ 4.0：
  Step 1: 扩展到第 2 个知识点（Chapter 18: 四边形）
  Step 2: 扩展到第 3 个知识点（Chapter 20: 数据分析）
  Step 3: 考虑"场景化模板基类"（如果有 ≥ 5 个场景化模板）

如果用户反馈 < 4.0：
  Step 1: 调整场景内容（更具体、更贴近学生生活）
  Step 2: 调整难度分布（降低或提高难度）
  Step 3: 重新收集反馈
```

---

## 六、关键优势

1. **极简实施**：0.5-1 天完成，快速验证
2. **低风险**：复制已验证的模式，不修改核心架构
3. **用户反馈优先**：先验证再扩展，避免过度投入
4. **符合 2/8 原则**：用最小的成本验证核心假设

---

## 七、时间表

| 阶段 | 预计时间 | 缓冲时间 | 总计 |
|------|----------|----------|------|
| Step 1: 复制模式 | 2小时 | +30分钟 | 2.5小时 |
| Step 2: 注册模板 | 5分钟 | +5分钟 | 10分钟 |
| Step 3: API验证 | 10分钟 | +20分钟 | 30分钟 |
| Step 4: 用户反馈 | 持续 | - | 1-3天 |
| **总计** | **2.5小时** | **+55分钟** | **3.5小时** |

---

## 八、成功标准

### 阶段 1 验收（实施完成后）

- ✅ 新模板文件创建成功
- ✅ API 调用成功返回题目
- ✅ 场景化覆盖率 ≥ 60%
- ✅ TypeScript 编译无错误
- ✅ 现有功能未受影响（回归测试）

### 阶段 2 验证（用户反馈后）

- ✅ 收集至少 5 份用户反馈
- ✅ 平均评分 ≥ 4.0/5.0
- ✅ 用户明确表示希望扩展到其他知识点

**如果阶段 2 验证失败**：
- 调整场景内容或难度
- 重新收集反馈
- 或放弃场景化方向

---

## 九、审批

**设计审批**：
- ✅ 用户审核（已批准 - 采用方案 A）
- ⏳ 技术审核（待定）
- ⏳ 产品审核（待定）

**下一步**：
1. 开始实施（Step 1-3）
2. 收集用户反馈（Step 4）
3. 根据反馈决定是否扩展

---

**文档修订历史**：
- v1.0（2026-05-10）：初始版本（过度设计）
- v2.0（2026-05-10）：基于 Swarm Review 反馈修订（最小可行方案）
