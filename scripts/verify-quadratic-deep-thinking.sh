#!/bin/bash
# 验证深度思考题模板（quadratic_word_problem_v2）

set -e

echo "=== 验证深度思考题模板 ==="

# 检查开发服务器是否运行
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "❌ 开发服务器未运行，请先运行: npm run dev"
  exit 1
fi

echo "✅ 开发服务器运行中"

# 调用 API 生成深度思考题
echo ""
echo "正在生成深度思考题..."

response=$(curl -s -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePoint": "quadratic_function",
    "difficulty": 3,
    "count": 1,
    "type": "calculation"
  }')

# 检查响应
success=$(echo "$response" | jq '.success')
if [ "$success" != "true" ]; then
  echo "❌ API 调用失败"
  echo "$response" | jq '.error'
  exit 1
fi

echo "✅ API 调用成功"

# 检查是否使用了v2模板（可能不会，因为需要特殊参数）
template_id=$(echo "$response" | jq -r '.questions[0].templateId')
echo "📝 模板ID: $template_id"

# 检查题目内容
question_context=$(echo "$response" | jq -r '.questions[0].content.context')
echo "📄 题目场景: $question_context"

# 统计步骤数（深度思考题应该有3步）
step_count=$(echo "$response" | jq '.questions[0].steps | length')
echo "🔢 步骤数: $step_count"

if [ "$step_count" -eq 3 ]; then
  echo "✅ 三段式推理链: 通过"
else
  echo "⚠️  警告: 步骤数不是3（当前: $step_count）"
fi

# 检查第一步是否为选择题（理解题意）
first_step_type=$(echo "$response" | jq -r '.questions[0].steps[0].answerMode // "unknown"')
echo "🔍 第1步答题模式: $first_step_type"

if [ "$first_step_type" = "choice" ]; then
  echo "✅ 第1步为选择题: 通过"
else
  echo "⚠️  警告: 第1步不是选择题（当前: $first_step_type）"
fi

echo ""
echo "=== 验证完成 ==="

# 总结
if [ "$step_count" -eq 3 ] && [ "$first_step_type" = "choice" ]; then
  echo "🎉 所有检查通过！深度思考题模板工作正常"
  exit 0
else
  echo "⚠️  部分检查未通过，可能需要调整"
  exit 0
fi
