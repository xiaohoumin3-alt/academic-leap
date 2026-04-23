"""
估分稳定性专项测试

目标：验证G1-③估分可信 - 同用户两次估分波动≤5分

测试覆盖：
- 同用户两次估分波动
- 估分包含可信区间
- 稳定等级计算
"""
import pytest
from sqlalchemy.orm import Session
from app.database import SessionLocal, Base, engine
from app.models import User, UserAbility, KnowledgePoint, Answer, GeneratedQuestion
from app.engines.score_estimator import score_estimator
from app.engines.question_generator import question_generator
from app.engines.answer_judger import answer_judger
from app.engines.ability_evaluator import behavior_calibrator
import uuid


class TestScoreStability:
    """估分稳定性测试"""

    def setUp(self):
        """创建测试数据"""
        # 创建所有表
        Base.metadata.create_all(bind=engine)

        db = SessionLocal()

        try:
            # 创建测试用户
            self.user_id = uuid.uuid4()
            user = User(id=self.user_id, name="测试用户", grade=7)
            db.add(user)

            # 确保有知识点
            kp = db.query(KnowledgePoint).first()
            if not kp:
                kp = KnowledgePoint(id=1, name="代数运算", subject="数学", score_weight=0.33)
                db.add(kp)
                db.commit()

            self.knowledge_id = kp.id

            # 创建一些答题记录（用于有足够数据计算估分）
            for i in range(20):
                # 生成题目
                q_data = question_generator.generate(self.knowledge_id, 0)

                question = GeneratedQuestion(
                    user_id=self.user_id,
                    knowledge_id=self.knowledge_id,
                    level=0,
                    content=q_data.content,
                    answer=q_data.answer
                )
                db.add(question)
                db.commit()
                db.refresh(question)

                # 模拟答题（70%正确率）
                import random
                is_correct = random.random() < 0.7
                time_used = random.randint(10, 40)

                # 创建答案记录
                answer = Answer(
                    user_id=self.user_id,
                    question_id=question.id,
                    is_correct=is_correct,
                    answer=str(int(q_data.answer)) if is_correct else str(int(q_data.answer) + 1),
                    time_used=time_used,
                    retry_count=0,
                    behavior_type="correct" if is_correct else "wrong"
                )
                db.add(answer)

            # 设置用户能力
            ability = UserAbility(
                user_id=self.user_id,
                knowledge_id=self.knowledge_id,
                level=1,
                stable_pass_count=1
            )
            db.add(ability)

            db.commit()

        finally:
            db.close()

    def tearDown(self):
        """清理测试数据"""
        db = SessionLocal()
        try:
            # 删除测试数据
            db.query(Answer).filter(Answer.user_id == self.user_id).delete()
            db.query(GeneratedQuestion).filter(GeneratedQuestion.user_id == self.user_id).delete()
            db.query(UserAbility).filter(UserAbility.user_id == self.user_id).delete()
            db.query(User).filter(User.id == self.user_id).delete()
            db.commit()
        finally:
            db.close()

    def test_score_has_confidence_interval(self):
        """测试估分包含可信区间"""
        self.setUp()
        db = SessionLocal()

        try:
            estimate = score_estimator.estimate(db, str(self.user_id))

            # 验证返回结构
            assert hasattr(estimate, 'score'), "估分应包含score"
            assert hasattr(estimate, 'range'), "估分应包含range"
            assert hasattr(estimate, 'stability'), "估分应包含stability"
            assert hasattr(estimate, 'confidence'), "估分应包含confidence"

            # 验证可信区间格式
            assert '-' in estimate.range, f"可信区间格式应为'X-Y'，实际为{estimate.range}"

            # 解析区间
            range_parts = estimate.range.split('-')
            lower = int(range_parts[0])
            upper = int(range_parts[1])

            # 验证区间合理性
            assert 0 <= lower <= estimate.score <= upper <= 100, \
                f"区间[{lower}, {upper}]应包含分数{estimate.score}且在[0,100]范围内"

            # 验证稳定等级
            assert estimate.stability in ['high', 'medium', 'low'], \
                f"稳定等级应为high/medium/low，实际为{estimate.stability}"

            # 验证置信度
            assert 0 <= estimate.confidence <= 1, \
                f"置信度应在[0,1]范围内，实际为{estimate.confidence}"

            print(f"✓ 估分: {estimate.score}, 可信区间: {estimate.range}, "
                  f"稳定等级: {estimate.stability}, 置信度: {estimate.confidence}")

        finally:
            self.tearDown()
            db.close()

    def test_score_stability_same_user(self):
        """测试同用户两次估分波动≤5分"""
        self.setUp()
        db = SessionLocal()

        try:
            # 第一次估分
            estimate1 = score_estimator.estimate(db, str(self.user_id))
            score1 = estimate1.score

            # 第二次估分（模拟时间间隔，数据不变）
            estimate2 = score_estimator.estimate(db, str(self.user_id))
            score2 = estimate2.score

            # 计算波动
            score_difference = abs(score1 - score2)

            print(f"第一次估分: {score1}")
            print(f"第二次估分: {score2}")
            print(f"估分波动: {score_difference}")

            # 验收标准：波动≤5分
            # 注意：由于数据未变，波动应该为0
            assert score_difference <= 5, f"估分波动{score_difference}超过5分阈值"

        finally:
            self.tearDown()
            db.close()

    def test_breakdown_with_insights(self):
        """测试带洞察的估分明细"""
        self.setUp()
        db = SessionLocal()

        try:
            result = score_estimator.get_breakdown_with_insights(db, str(self.user_id))

            # 验证返回结构
            assert 'score' in result
            assert 'range' in result
            assert 'stability' in result
            assert 'confidence' in result
            assert 'breakdown' in result
            assert 'strong_points' in result
            assert 'weak_points' in result
            assert 'suggestions' in result

            # 验证breakdown格式
            for item in result['breakdown']:
                assert 'knowledge' in item
                assert 'score' in item
                assert 'level' in item
                assert 'mastery' in item

            # 验证强项和弱项是列表
            assert isinstance(result['strong_points'], list)
            assert isinstance(result['weak_points'], list)
            assert isinstance(result['suggestions'], list)

            print(f"✓ 强项: {result['strong_points']}")
            print(f"✓ 弱项: {result['weak_points']}")
            print(f"✓ 建议: {result['suggestions']}")

        finally:
            self.tearDown()
            db.close()

    def test_stability_level_calculation(self):
        """测试稳定等级计算"""
        db = SessionLocal()

        try:
            # 创建测试用户
            user_id = uuid.uuid4()
            user = User(id=user_id, name="稳定等级测试", grade=7)
            db.add(user)

            kp = db.query(KnowledgePoint).first()
            if kp:
                # 创建用户能力
                ability = UserAbility(
                    user_id=user_id,
                    knowledge_id=kp.id,
                    level=1,
                    stable_pass_count=1
                )
                db.add(ability)
                db.commit()

                # 测试不同答题数量的稳定等级
                test_cases = [
                    (5, 'low'),     # <10题
                    (15, 'medium'), # 10-49题
                    (60, 'high'),   # >=50题
                ]

                for answer_count, expected_stability in test_cases:
                    # 清除旧数据
                    db.query(Answer).filter(Answer.user_id == user_id).delete()
                    db.commit()

                    # 创建答题记录
                    for i in range(answer_count):
                        question = GeneratedQuestion(
                            user_id=user_id,
                            knowledge_id=kp.id,
                            level=0,
                            content=f"测试题{i}",
                            answer="1"
                        )
                        db.add(question)
                        db.commit()
                        db.refresh(question)

                        answer = Answer(
                            user_id=user_id,
                            question_id=question.id,
                            is_correct=True,
                            answer="1",
                            time_used=20,
                            retry_count=0,
                            behavior_type="correct"
                        )
                        db.add(answer)
                    db.commit()

                    # 获取估分
                    estimate = score_estimator.estimate(db, str(user_id))

                    print(f"答题数={answer_count}, 预期稳定等级={expected_stability}, "
                          f"实际={estimate.stability}")

                    # 验证稳定等级
                    assert estimate.stability == expected_stability, \
                        f"答题数{answer_count}时，稳定等级应为{expected_stability}，实际为{estimate.stability}"

                # 清理
                db.query(Answer).filter(Answer.user_id == user_id).delete()
                db.query(UserAbility).filter(UserAbility.user_id == user_id).delete()
                db.query(User).filter(User.id == user_id).delete()
                db.commit()

        finally:
            db.close()


def run_all_tests():
    """运行所有测试"""
    test = TestScoreStability()

    print("=" * 60)
    print("估分稳定性专项测试")
    print("=" * 60)

    print("\n1. 测试估分包含可信区间...")
    test.test_score_has_confidence_interval()
    print("✓ 通过")

    print("\n2. 测试同用户两次估分波动...")
    test.test_score_stability_same_user()
    print("✓ 通过")

    print("\n3. 测试带洞察的估分明细...")
    test.test_breakdown_with_insights()
    print("✓ 通过")

    print("\n4. 测试稳定等级计算...")
    test.test_stability_level_calculation()
    print("✓ 通过")

    print("\n" + "=" * 60)
    print("所有测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()
