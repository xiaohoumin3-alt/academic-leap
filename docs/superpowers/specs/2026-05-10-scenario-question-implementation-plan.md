# 实施计划：一元二次方程场景化应用题模板（MVP - 修订版）

**版本**: v1.1（修订版）  
**日期**: 2026-05-10  
**预计时间**: 2.75 小时（开发 + 验证）

---

## 概述

复制 `pythagoras_word_problem.ts` 的成功模式，创建一元二次方程场景化应用题模板，验证场景化题目的用户反馈。

**核心原则**：
- ✅ YAGNI：不过度设计
- ✅ 快速验证：1 天内完成
- ✅ 用户反馈优先：先验证再扩展

---

## Phase 1: 创建新模板文件（2 小时）

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 1.1 | 复制模板文件 `cp lib/question-engine/templates/chapter17/pythagoras_word_problem.ts lib/question-engine/templates/chapter19/quadratic_word_problem.ts` | `test -f lib/question-engine/templates/chapter19/quadratic_word_problem.ts` → exit 0 |
| 1.2 | 修改文件头注释为"一元二次方程应用题模板" | `head -5 lib/question-engine/templates/chapter19/quadratic_word_problem.ts \| grep -q "一元二次方程应用题"` → exit 0 |
| 1.3 | 修改类型定义：`WordProblemType = 'projectile_motion' \| 'area_optimization' \| 'max_profit' \| 'bridge_design' \| 'water_flow'` | `grep -E "projectile_motion\|area_optimization\|max_profit\|bridge_design\|water_flow" lib/question-engine/templates/chapter19/quadratic_word_problem.ts \| wc -l` → ≥ 5 |
| 1.4 | 修改模板 ID：`id: 'quadratic_word_problem'` 和 `knowledgePoint: 'quadratic_word_problem'` | `grep "quadratic_word_problem" lib/question-engine/templates/chapter19/quadratic_word_problem.ts \| grep -E "id:\|knowledgePoint:" \| wc -l` → 2 |
| 1.5 | 修改 WORD_PROBLEM_TYPES 配置为 5 个新场景 | `grep -A 1 "type:" lib/question-engine/templates/chapter19/quadratic_word_problem.ts \| grep -E "projectile_motion\|area_optimization\|max_profit\|bridge_design\|water_flow" \| wc -l` → 5 |
| 1.6 | 修改难度配置引用：`DIFFICULTY_CONFIG.quadratic_word_problem`（如果配置不存在，先添加到 `difficulty.ts`） | `grep "DIFFICULTY_CONFIG.quadratic_word_problem" lib/question-engine/templates/chapter19/quadratic_word_problem.ts \| wc -l` → ≥ 1 |
| 1.7 | 重写 generateWordProblemData 函数的 5 个场景逻辑 | `grep -E "抛物运动\|面积优化\|最大利润\|桥梁设计\|水流问题" lib/question-engine/templates/chapter19/quadratic_word_problem.ts \| wc -l` → 5 |
| 1.8 | 重写 render 函数的场景描述文本 | `grep -E "抛物运动\|面积优化\|最大利润\|桥梁设计\|水流问题" lib/question-engine/templates/chapter19/quadratic_word_problem.ts \| wc -l` → ≥ 5 |
| 1.9 | TypeScript 编译检查 | `npx tsc --noEmit 2>&1 \| grep -i "quadratic_word_problem" \| wc -l` → 0 |

---

## Phase 2: 注册模板（5 分钟）

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 2.1 | 在 `lib/question-engine/templates/index.ts` 添加导入：`import { QuadraticWordProblemTemplate } from './chapter19/quadratic_word_problem';` | `grep "QuadraticWordProblemTemplate" lib/question-engine/templates/index.ts \| wc -l` → 1 |
| 2.2 | 在 TEMPLATE_REGISTRY 中添加：`quadratic_word_problem: QuadraticWordProblemTemplate,` | `grep "quadratic_word_problem:" lib/question-engine/templates/index.ts \| wc -l` → 1 |
| 2.3 | TypeScript 编译检查 | `npx tsc --noEmit 2>&1 \| grep -i "error" \| wc -l` → 0 |

---

## Phase 3: API 验证（15 分钟）

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 3.1 | 启动开发服务器 `npm run dev`（后台运行） | `sleep 5 && curl -s http://localhost:3000/api/health \| head -1` → 返回 HTTP 200 |
| 3.2 | 调用生成 API | `curl -s -X POST http://localhost:3000/api/questions/generate -H "Content-Type: application/json" -d '{"knowledgePoint":"quadratic_function","difficulty":3,"count":5,"renderStyle":"standard"}' \| jq '.success'` → `true` |
| 3.3 | 验证返回 5 道题目 | `curl -s -X POST http://localhost:3000/api/questions/generate -H "Content-Type: application/json" -d '{"knowledgePoint":"quadratic_function","difficulty":3,"count":5,"renderStyle":"standard"}' \| jq '.questions \| length'` → `5` |
| 3.4 | 验证模板 ID | `curl -s -X POST http://localhost:3000/api/questions/generate -H "Content-Type: application/json" -d '{"knowledgePoint":"quadratic_function","difficulty":3,"count":1,"renderStyle":"standard"}' \| jq '.questions[0].templateId'` → `"quadratic_word_problem"` |
| 3.5 | 验证场景化覆盖率 ≥ 60% | `curl -s -X POST http://localhost:3000/api/questions/generate -H "Content-Type: application/json" -d '{"knowledgePoint":"quadratic_function","difficulty":3,"count":5,"renderStyle":"standard"}' \| jq '[.questions[].content.context] \| map(select(. != null and (. \| test("抛物\\|面积\\|利润\\|桥梁\\|水流")))) \| length'` → ≥ 3 |
| 3.6 | 验证题目内容长度 | `curl -s -X POST http://localhost:3000/api/questions/generate -H "Content-Type: application/json" -d '{"knowledgePoint":"quadratic_function","difficulty":3,"count":1,"renderStyle":"standard"}' \| jq '.questions[0].content.context' \| wc -c` → ≥ 50 |

---

## Phase 4: 回归测试（5 分钟）

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 4.1 | 验证勾股定理模板仍正常工作 | `curl -s -X POST http://localhost:3000/api/questions/generate -H "Content-Type: application/json" -d '{"knowledgePoint":"pythagoras","difficulty":2,"count":1}' \| jq '.success'` → `true` |
| 4.2 | 验证模板总数 ≥ 50 | `grep -c ":" lib/question-engine/templates/index.ts` → ≥ 50 |

---

## Phase 5: 用户反馈收集（持续）

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 5.1 | 创建验证脚本 `scripts/verify-quadratic-template.sh` | `test -f scripts/verify-quadratic-template.sh` → exit 0 |
| 5.2 | 运行验证脚本 | `bash scripts/verify-quadratic-template.sh` → exit 0 |
| 5.3 | 生成样本题目 | `curl -s -X POST http://localhost:3000/api/questions/generate -H "Content-Type: application/json" -d '{"knowledgePoint":"quadratic_function","difficulty":3,"count":5,"renderStyle":"standard"}' \| jq '.questions\[] \| {id, templateId, context: .content.context}' > /tmp/quadratic_samples.json` → file created |

---

## 验证脚本

**文件**: `scripts/verify-quadratic-template.sh`

```bash
#!/bin/bash
# 验证一元二次方程场景化模板

set -e

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
  echo "⚠️  警告：未使用新模板，实际使用：$template_id"
fi

# 检查题目内容
first_question_context=$(echo "$response" | jq -r '.questions[0].content.context')
echo "✅ 第一题场景：$first_question_context"

# 统计场景化覆盖率
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

---

## 场景化内容映射

| 原场景 | 新场景 | 描述示例 |
|--------|--------|----------|
| ladder | projectile_motion | "一个球以 20 m/s 的速度被抛出，抛出角度为 45°。求球能飞行的最大高度（g=10m/s²）" |
| shortest_path | area_optimization | "用 20 米长的篱笆围成一个矩形菜园，一边靠墙。求菜园的最大面积" |
| pole_wire | max_profit | "某商品售价为 50 元时，每天可售 100 件。每降价 1 元，每天多售 2 件。求定价为多少时利润最大" |
| diagonal | bridge_design | "一座拱桥的跨度为 100 米，拱高为 10 米。假设拱形为抛物线，求拱形方程" |
| staircase | water_flow | "水箱以每分钟 5 升的速度注水，同时以每分钟 x 升的速度排水。20 分钟后水箱空了。求排水速度" |

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 模板注册错误 | 中 | 高 | Phase 2 验证 TypeScript 编译 |
| 场景化数学模型不准确 | 低 | 中 | 使用标准二次函数应用题模型 |
| 用户反馈仍"幼稚" | 中 | 低 | 收集反馈后再决定是否调整 |

---

## 成功标准

### 开发完成
- [ ] TypeScript 编译无错误
- [ ] 新模板文件创建成功
- [ ] TEMPLATE_REGISTRY 包含新模板

### 功能验证
- [ ] API 返回 `success: true`
- [ ] 返回 5 道题目
- [ ] 场景化覆盖率 ≥ 60%
- [ ] 题目包含实际应用场景

### 回归验证
- [ ] 现有勾股定理模板正常
- [ ] 模板总数 ≥ 50

---

## 修订说明

**v1.1（修订版）变更**：
- ❌ 删除 Phase 4（数据库注册）- 实际验证表明不需要
- ✅ 简化 Phase 2（合并到 Phase 1）- 避免过度实施
- ✅ 简化 Phase 6（从 3 个测试减少到 2 个）- 聚焦核心验证
- ⏱️ 总时间：3.5小时 → 2.75小时

**符合设计方案的要点**：
- ✅ 只添加新模板，不修改数据库
- ✅ 复制已验证的模式，不过度设计
- ✅ 快速验证，收集用户反馈
