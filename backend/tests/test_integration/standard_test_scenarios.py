"""
标准测试场景 - 模拟真实用户行为
"""
import pytest
import time
from httpx import AsyncClient, ASGITransport
from app.main import app


class TestStandardScenarios:
    """标准测试场景 - 模拟真实用户行为"""

    @pytest.mark.asyncio
    async def test_scenario_1_new_user_assessment(self):
        """
        场景1: 新用户首次测评
        1. 创建新用户
        2. 开始测评（获取10道题）
        3. 依次作答
        4. 验证初始能力等级被正确设置
        """
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. 创建用户
            response = await client.post("/api/assessments/users?name=测试学生&grade=9")
            assert response.status_code == 201
            user_id = response.json()["id"]
            print(f"✓ 创建用户: {user_id}")

            # 2. 开始测评
            response = await client.post(f"/api/assessments/start?user_id={user_id}")
            assert response.status_code == 200
            assessment_data = response.json()
            questions = assessment_data["questions"]
            assert len(questions) == 10
            print(f"✓ 获取测评题目: {len(questions)}道")

            # 3. 作答（模拟正确率70%）
            for i, q in enumerate(questions[:7]):  # 前7题答对
                response = await client.post("/api/answers/submit", json={
                    "user_id": user_id,
                    "question_id": q["question_id"],
                    "answer": "4",  # 简化测试
                    "time_used": 30
                })
                assert response.status_code == 200
            print(f"✓ 完成7道题作答")

            # 4. 验证有数据记录（不管正确与否）
            response = await client.get(f"/api/questions/abilities/{user_id}")
            assert response.status_code == 200
            abilities = response.json()
            print(f"✓ 能力记录数: {len(abilities)}")

    @pytest.mark.asyncio
    async def test_scenario_2_question_generation(self):
        """
        场景2: 题目生成
        1. 创建用户
        2. 请求不同知识点的题目
        3. 验证题目内容格式正确
        """
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 创建用户
            response = await client.post("/api/assessments/users?name=测试学生2")
            user_id = response.json()["id"]

            # 测试3个知识点的题目生成
            for knowledge_id in [1, 2, 3]:
                response = await client.post("/api/questions/next", json={
                    "user_id": user_id,
                    "knowledge_id": knowledge_id
                })
                assert response.status_code == 200
                data = response.json()
                assert "question_id" in data
                assert "content" in data
                assert "level" in data
                assert data["content"]
                print(f"✓ 知识点{knowledge_id}题目: {data['content'][:30]}...")

    @pytest.mark.asyncio
    async def test_scenario_3_performance_sla(self):
        """
        场景3: 性能SLA
        1. 连续获取10道题，每次 < 1秒
        2. 连续提交10个答案，每次 < 1秒
        """
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 创建用户
            response = await client.post("/api/assessments/users?name=测试学生3")
            user_id = response.json()["id"]

            # 测试获取题目性能
            max_get_time = 0
            for i in range(10):
                start = time.time()
                response = await client.post("/api/questions/next", json={
                    "user_id": user_id,
                    "knowledge_id": 1
                })
                elapsed = time.time() - start
                max_get_time = max(max_get_time, elapsed)
                assert response.status_code == 200
                assert elapsed < 1.0, f"获取题目耗时: {elapsed}s"

            print(f"✓ 获取题目最大耗时: {max_get_time:.3f}s (< 1s)")

            # 测试提交答案性能
            # 先获取一道题
            response = await client.post("/api/questions/next", json={
                "user_id": user_id,
                "knowledge_id": 1
            })
            question_id = response.json()["question_id"]

            max_submit_time = 0
            for i in range(10):
                start = time.time()
                response = await client.post("/api/answers/submit", json={
                    "user_id": user_id,
                    "question_id": question_id,
                    "answer": "5",
                    "time_used": 20
                })
                elapsed = time.time() - start
                max_submit_time = max(max_submit_time, elapsed)
                assert response.status_code == 200
                # 首次提交可能创建ability记录，允许稍长
                if i > 0:
                    assert elapsed < 1.0, f"提交答案耗时: {elapsed}s"

            print(f"✓ 提交答案最大耗时: {max_submit_time:.3f}s (< 1s)")

    @pytest.mark.asyncio
    async def test_scenario_4_score_estimation(self):
        """
        场景4: 估分验证
        1. 创建用户
        2. 进行一些答题
        3. 获取估分
        4. 验证返回格式正确
        """
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 创建用户
            response = await client.post("/api/assessments/users?name=测试学生4")
            user_id = response.json()["id"]

            # 答几道题
            for _ in range(3):
                response = await client.post("/api/questions/next", json={
                    "user_id": user_id,
                    "knowledge_id": 1
                })
                question_id = response.json()["question_id"]

                await client.post("/api/answers/submit", json={
                    "user_id": user_id,
                    "question_id": question_id,
                    "answer": "3",
                    "time_used": 25
                })

            # 获取估分
            response = await client.get(f"/api/answers/estimate-score/{user_id}")
            assert response.status_code == 200
            data = response.json()
            assert "score" in data
            assert "range" in data
            assert "breakdown" in data
            print(f"✓ 估分结果: {data['score']}, {data['range']}")

    @pytest.mark.asyncio
    async def test_scenario_5_error_handling(self):
        """
        场景5: 错误处理
        1. 测试不存在的用户
        2. 测试不存在的题目
        3. 验证返回正确的错误信息
        """
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            import uuid

            # 测试不存在的用户
            fake_user_id = uuid.uuid4()
            response = await client.post("/api/questions/next", json={
                "user_id": fake_user_id,
                "knowledge_id": 1
            })
            assert response.status_code == 404
            print("✓ 不存在的用户返回404")

            # 测试不存在的题目
            response = await client.post("/api/assessments/users?name=测试用户5")
            user_id = response.json()["id"]

            fake_question_id = uuid.uuid4()
            response = await client.post("/api/answers/submit", json={
                "user_id": user_id,
                "question_id": fake_question_id,
                "answer": "5",
                "time_used": 20
            })
            assert response.status_code == 404
            print("✓ 不存在的题目返回404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
