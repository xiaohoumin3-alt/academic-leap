#!/usr/bin/env python3
"""
本地测试脚本 - 验证后端功能
"""
import requests
import uuid
import time

BASE_URL = "http://localhost:8000"

print("=" * 50)
print("学力跃迁 - 本地API测试")
print("=" * 50)

# 测试1: 健康检查
print("\n1️⃣ 健康检查...")
response = requests.get(f"{BASE_URL}/health")
print(f"   {response.json()}")

# 测试2: 创建用户
print("\n2️⃣ 创建用户...")
response = requests.post(f"{BASE_URL}/api/assessments/users?name=测试学生&grade=9")
user = response.json()
user_id = user["id"]
print(f"   ✅ 用户创建成功: {user_id}")

# 测试3: 获取下一题
print("\n3️⃣ 获取题目...")
response = requests.post(f"{BASE_URL}/api/questions/next", json={
    "user_id": user_id,
    "knowledge_id": 1
})
question = response.json()
print(f"   ✅ 题目: {question['content']}")
print(f"   难度: Level {question['level']}")
question_id = question["question_id"]

# 测试4: 提交答案（正确）
print("\n4️⃣ 提交答案...")
response = requests.post(f"{BASE_URL}/api/answers/submit", json={
    "user_id": user_id,
    "question_id": question_id,
    "answer": "5",
    "time_used": 30
})
result = response.json()
print(f"   ✅ 提交结果: {result['feedback']}")
print(f"   新等级: Level {result['new_level']}")

# 测试5: 连续答对，测试升级
print("\n5️⃣ 测试升级逻辑...")
for i in range(2):
    response = requests.post(f"{BASE_URL}/api/questions/next", json={
        "user_id": user_id,
        "knowledge_id": 1
    })
    question = response.json()
    question_id = question["question_id"]

    # 提交"正确"答案（简化测试）
    response = requests.post(f"{BASE_URL}/api/answers/submit", json={
        "user_id": user_id,
        "question_id": question_id,
        "answer": question.get("correct_answer", "3"),
        "time_used": 20
    })
    result = response.json()
    print(f"   第{i+1}题: {result['feedback']} (Level {result['new_level']})")

# 测试6: 获取用户能力
print("\n6️⃣ 获取用户能力...")
response = requests.get(f"{BASE_URL}/api/questions/abilities/{user_id}")
abilities = response.json()
for ab in abilities:
    print(f"   📚 {ab['knowledge_name']}: Level {ab['level']} (连续通过{ab['stable_pass_count']}次)")

# 测试7: 获取估分
print("\n7️⃣ 获取估分...")
response = requests.get(f"{BASE_URL}/api/answers/estimate-score/{user_id}")
estimate = response.json()
print(f"   📊 预估分数: {estimate['score']}")
print(f"   置信区间: {estimate['range']}")
print(f"   分项明细:")
for item in estimate.get("breakdown", []):
    print(f"      - {item['knowledge']}: {item['score']}分")

# 测试8: 开始测评
print("\n8️⃣ 开始测评...")
response = requests.post(f"{BASE_URL}/api/assessments/start?user_id={user_id}")
assessment = response.json()
print(f"   ✅ 测评ID: {assessment['assessment_id']}")
print(f"   题目数量: {len(assessment['questions'])}")

# 测试9: 性能测试
print("\n9️⃣ 性能测试...")
times = []
for i in range(5):
    start = time.time()
    response = requests.post(f"{BASE_URL}/api/questions/next", json={
        "user_id": user_id,
        "knowledge_id": 1
    })
    elapsed = time.time() - start
    times.append(elapsed)
avg_time = sum(times) / len(times)
print(f"   📈 平均响应时间: {avg_time*1000:.0f}ms")
if avg_time < 0.5:
    print("   ✅ 性能良好 (<500ms)")
else:
    print("   ⚠️ 响应较慢，建议优化")

print("\n" + "=" * 50)
print("✅ 测试完成！")
print("=" * 50)
print("\n💡 提示:")
print("   - 后端运行在: http://localhost:8000")
print("   - API文档: http://localhost:8000/docs")
print("   - 用户ID已保存，可以继续测试")
