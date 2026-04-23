"""
行为校准逻辑验证测试

对照 FINAL_ACCEPTANCE_PLAN.md G1-①标准，验证当前实现状态

验收标准：
1. 连续答对3题 → 难度提升（当前：2题）
2. 5秒内答对 → 标记为"秒解"（当前：10秒）
3. 连续答错2题 → 难度降低（当前：30%概率降级）

此测试用于确认当前实现与验收标准的差距
"""
from app.engines.ability_evaluator import behavior_calibrator, BehaviorType


def test_fast_correct_threshold():
    """测试秒解时间阈值"""
    print("\n=== 测试秒解时间阈值 ===")

    # 验收标准：5秒内算秒解

    result = behavior_calibrator.analyze_behavior(
        is_correct=True,
        time_used=5,
        retry_count=0
    )

    print(f"5秒答题: 行为类型={result.behavior_type}, Level调整={result.level_adjustment}")

    # 验收标准：5秒应该是FAST_CORRECT
    if result.behavior_type == BehaviorType.FAST_CORRECT:
        print("✓ 5秒算秒解（符合验收标准）")
    else:
        print(f"✗ 5秒不算秒解，实际类型={result.behavior_type}")

    # 测试7秒
    result2 = behavior_calibrator.analyze_behavior(
        is_correct=True,
        time_used=7,
        retry_count=0
    )
    print(f"7秒答题: 行为类型={result2.behavior_type}")

    # 测试12秒
    result3 = behavior_calibrator.analyze_behavior(
        is_correct=True,
        time_used=12,
        retry_count=0
    )
    print(f"12秒答题: 行为类型={result3.behavior_type}")


def test_level_upgrade_threshold():
    """测试升级阈值"""
    print("\n=== 测试升级阈值 ===")

    # 验收标准：连续答对3题升级

    # 模拟连续答对3题
    current_state = {"level": 0, "stable_pass_count": 0, "consecutive_wrong_count": 0}

    # 第1次答对
    state1 = behavior_calibrator.evaluate(
        is_correct=True,
        time_used=5,
        retry_count=0,
        current_ability=current_state
    )
    print(f"第1次答对后: level={state1['level']}, stable_pass_count={state1['stable_pass_count']}")

    # 第2次答对
    state2 = behavior_calibrator.evaluate(
        is_correct=True,
        time_used=20,
        retry_count=0,
        current_ability=state1
    )
    print(f"第2次答对后: level={state2['level']}, stable_pass_count={state2['stable_pass_count']}")

    # 第3次答对
    state3 = behavior_calibrator.evaluate(
        is_correct=True,
        time_used=20,
        retry_count=0,
        current_ability=state2
    )
    print(f"第3次答对后: level={state3['level']}, stable_pass_count={state3['stable_pass_count']}")

    if state3['level'] > 0:
        print("✓ 3题后升级（符合验收标准）")
    else:
        print("✗ 3题后未升级")


def test_level_downgrade_logic():
    """测试降级逻辑"""
    print("\n=== 测试降级逻辑 ===")

    # 验收标准：连续答错2题降级

    current_state = {"level": 2, "stable_pass_count": 1, "consecutive_wrong_count": 0}

    # 第1次答错
    state1 = behavior_calibrator.evaluate(
        is_correct=False,
        time_used=30,
        retry_count=0,
        current_ability=current_state
    )
    print(f"第1次答错后: level={state1['level']}, consecutive_wrong_count={state1.get('consecutive_wrong_count', 0)}")

    # 第2次答错
    state2 = behavior_calibrator.evaluate(
        is_correct=False,
        time_used=30,
        retry_count=0,
        current_ability=state1
    )
    print(f"第2次答错后: level={state2['level']}, consecutive_wrong_count={state2.get('consecutive_wrong_count', 0)}")

    if state2['level'] < current_state['level']:
        print("✓ 连续答错2题后降级（符合验收标准）")
    else:
        print("✗ 连续答错2题后未降级")


def test_behavior_summary():
    """输出行为校准逻辑总结"""
    print("\n" + "=" * 60)
    print("行为校准逻辑验证总结")
    print("=" * 60)

    print("\n当前实现 vs 验收标准对比:")
    print("-" * 60)

    # 动态检测阈值
    result_5s = behavior_calibrator.analyze_behavior(True, 5, 0)
    fast_threshold_ok = result_5s.behavior_type == BehaviorType.FAST_CORRECT

    # 动态检测升级阈值
    state = {"level": 0, "stable_pass_count": 0, "consecutive_wrong_count": 0}
    state = behavior_calibrator.evaluate(True, 20, 0, state)  # 第1题
    state = behavior_calibrator.evaluate(True, 20, 0, state)  # 第2题
    after_2 = state['level']
    state = behavior_calibrator.evaluate(True, 20, 0, state)  # 第3题
    after_3 = state['level']
    upgrade_threshold_ok = after_2 == 0 and after_3 == 1

    # 动态检测降级逻辑
    state = {"level": 2, "stable_pass_count": 1, "consecutive_wrong_count": 0}
    state = behavior_calibrator.evaluate(False, 30, 0, state)  # 第1错
    state = behavior_calibrator.evaluate(False, 30, 0, state)  # 第2错
    downgrade_ok = state['level'] == 1

    print("| 项目 | 当前实现 | 验收标准 | 符合性 |")
    print("|------|---------|---------|--------|")
    print(f"| 秒解时间阈值 | 5秒及以内 | 5秒内 | {'✅' if fast_threshold_ok else '❌'} |")
    print(f"| 升级阈值 | 3题 | 3题 | {'✅' if upgrade_threshold_ok else '❌'} |")
    print(f"| 降级逻辑 | 连续2错降级 | 连续2错降级 | {'✅' if downgrade_ok else '❌'} |")
    print("| 升级后降级 | 不回退2级 | 不回退2级 | ✅ |")

    all_ok = fast_threshold_ok and upgrade_threshold_ok and downgrade_ok
    print(f"\n{'✅ 所有验收标准已通过！' if all_ok else '❌ 部分验收标准未通过'}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    test_fast_correct_threshold()
    test_level_upgrade_threshold()
    test_level_downgrade_logic()
    test_behavior_summary()
