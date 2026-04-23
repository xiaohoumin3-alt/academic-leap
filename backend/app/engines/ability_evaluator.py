"""
行为校准引擎（V2.1）- 根据用户答题行为修正能力判断

核心思想：
- 不只看对/错，而是看答题行为
- 秒答正确（<5秒）→ 能力+0.5 Level
- 正常正确（5-30秒）→ 能力+1 Level
- 超时正确（>30秒）→ 能力不提升
- 多次尝试 → 能力-0.5 Level
- 连续答对3题 → 升级
- 连续答错2题 → 降级
- 难度自动收敛到+4%~8%区间
"""
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum


class BehaviorType(Enum):
    """行为类型"""
    FAST_CORRECT = "fast_correct"      # 秒答正确 (<5s) - 验收标准
    NORMAL_CORRECT = "normal_correct"  # 正常正确 (5-30s)
    SLOW_CORRECT = "slow_correct"      # 超时正确 (>30s)
    RETRY_CORRECT = "retry_correct"    # 多次尝试后正确
    WRONG = "wrong"                    # 错误


@dataclass
class BehaviorResult:
    """行为分析结果"""
    behavior_type: BehaviorType
    mastery_score: float  # 掌握度分数 (0-1.2)
    level_adjustment: float  # Level调整值
    feedback: str


class BehaviorCalibrator:
    """
    行为校准引擎（V2.0）

    根据用户答题行为修正能力判断，防止难度漂移
    """

    # 行为权重（掌握度计算）
    MASTERY_WEIGHTS = {
        BehaviorType.FAST_CORRECT: 1.2,    # 秒答正确
        BehaviorType.NORMAL_CORRECT: 1.0,  # 正常正确
        BehaviorType.SLOW_CORRECT: 0.7,    # 超时正确
        BehaviorType.RETRY_CORRECT: 0.5,   # 多次尝试后正确
        BehaviorType.WRONG: 0.0,           # 错误
    }

    # Level调整值
    LEVEL_ADJUSTMENTS = {
        BehaviorType.FAST_CORRECT: +0.5,
        BehaviorType.NORMAL_CORRECT: +1.0,
        BehaviorType.SLOW_CORRECT: 0,
        BehaviorType.RETRY_CORRECT: -0.5,
        BehaviorType.WRONG: 0,
    }

    # 时间阈值（秒）
    TIME_THRESHOLDS = {
        "fast": 5,     # < 5秒（验收标准）
        "normal": 30,  # 5-30秒
        "slow": 999,   # > 30秒
    }

    # Level对应的掌握率（用于估分）
    LEVEL_MASTERY = {
        0: 0.4,   # 40%
        1: 0.7,   # 70%
        2: 0.9,   # 90%
        3: 1.0,   # 100%
        4: 1.0,   # 100%
    }

    def analyze_behavior(self, is_correct: bool, time_used: int,
                        retry_count: int = 0) -> BehaviorResult:
        """
        分析用户答题行为

        Args:
            is_correct: 是否答对
            time_used: 用时（秒）
            retry_count: 重试次数

        Returns:
            BehaviorResult对象
        """
        # 判断行为类型
        behavior_type = self._classify_behavior(is_correct, time_used, retry_count)

        # 计算掌握度分数
        mastery_score = self.MASTERY_WEIGHTS.get(behavior_type, 0.0)

        # 计算Level调整值
        level_adjustment = self.LEVEL_ADJUSTMENTS.get(behavior_type, 0)

        # 生成反馈
        feedback = self._generate_feedback(behavior_type, level_adjustment)

        return BehaviorResult(
            behavior_type=behavior_type,
            mastery_score=mastery_score,
            level_adjustment=level_adjustment,
            feedback=feedback
        )

    def _classify_behavior(self, is_correct: bool, time_used: int,
                          retry_count: int) -> BehaviorType:
        """分类用户行为"""
        if not is_correct:
            return BehaviorType.WRONG

        if retry_count > 0:
            return BehaviorType.RETRY_CORRECT

        # 5秒及以内算秒解（验收标准：5秒内）
        if time_used <= self.TIME_THRESHOLDS["fast"]:
            return BehaviorType.FAST_CORRECT
        elif time_used <= self.TIME_THRESHOLDS["normal"]:
            return BehaviorType.NORMAL_CORRECT
        else:
            return BehaviorType.SLOW_CORRECT

    def _generate_feedback(self, behavior_type: BehaviorType,
                          level_adjustment: float) -> str:
        """生成反馈信息"""
        feedbacks = {
            BehaviorType.FAST_CORRECT: "回答正确！速度很快，你完全掌握了！",
            BehaviorType.NORMAL_CORRECT: "回答正确！继续保持！",
            BehaviorType.SLOW_CORRECT: "回答正确，但用时较长，建议多练习提高速度",
            BehaviorType.RETRY_CORRECT: "经过多次尝试终于答对了，建议复习一下这个知识点",
            BehaviorType.WRONG: "回答错误。别灰心，继续加油！"
        }

        base_feedback = feedbacks.get(behavior_type, "")

        if level_adjustment > 0:
            base_feedback += f" (能力提升+{level_adjustment})"
        elif level_adjustment < 0:
            base_feedback += f" (能力调整{level_adjustment})"

        return base_feedback

    def evaluate(self, is_correct: bool, time_used: int, retry_count: int,
                current_ability: Dict[str, Any]) -> Dict[str, Any]:
        """
        根据答题行为评估并更新能力

        Args:
            is_correct: 是否答对
            time_used: 用时（秒）
            retry_count: 重试次数
            current_ability: 当前能力状态 {
                "level": int,
                "stable_pass_count": int
            }

        Returns:
            更新后的能力状态 {
                "level": int,
                "stable_pass_count": int,
                "changed": bool,
                "feedback": str,
                "behavior_type": str,
                "mastery_score": float
            }
        """
        # 分析行为
        behavior_result = self.analyze_behavior(is_correct, time_used, retry_count)

        level = current_ability.get("level", 0)
        stable_pass_count = current_ability.get("stable_pass_count", 0)
        consecutive_wrong_count = current_ability.get("consecutive_wrong_count", 0)

        # 基于行为类型更新能力
        if behavior_result.behavior_type == BehaviorType.WRONG:
            stable_pass_count = 0
            consecutive_wrong_count += 1
            # 连续答错2题，降级（验收标准）
            if consecutive_wrong_count >= 2 and level > 0:
                level -= 1
                consecutive_wrong_count = 0
                behavior_result.feedback += " 降级到更合适的难度"
        else:
            # 答对了，重置连续答错计数，并根据行为类型调整
            consecutive_wrong_count = 0
            if behavior_result.behavior_type in [BehaviorType.FAST_CORRECT,
                                                  BehaviorType.NORMAL_CORRECT,
                                                  BehaviorType.SLOW_CORRECT]:
                stable_pass_count += 1  # 答对就算1题（验收标准按题数）
            elif behavior_result.behavior_type == BehaviorType.RETRY_CORRECT:
                stable_pass_count += 0  # 重试不算

            # 连续答对3题，升级（验收标准）
            if stable_pass_count >= 3 and level < 4:
                level += 1
                stable_pass_count = 0
                behavior_result.feedback += f" 升级到Level {level}！"

        return {
            "level": level,
            "stable_pass_count": stable_pass_count,
            "consecutive_wrong_count": consecutive_wrong_count,
            "changed": level != current_ability.get("level", 0),
            "feedback": behavior_result.feedback,
            "behavior_type": behavior_result.behavior_type.value,
            "mastery_score": behavior_result.mastery_score
        }

    def get_mastery_rate(self, level: int) -> float:
        """获取Level对应的掌握率"""
        return self.LEVEL_MASTERY.get(level, 0.5)

    def calculate_stability(self, total_answers: int, variance: float) -> str:
        """
        计算估分稳定等级

        Args:
            total_answers: 总答题数
            variance: 分数方差

        Returns:
            "high", "medium", "low"
        """
        if total_answers < 10:
            return "low"
        elif total_answers < 30:
            return variance < 15 and "medium" or "low"
        else:
            return variance < 10 and "high" or "medium"


# 兼容旧API
class AbilityEvaluator(BehaviorCalibrator):
    """能力评估器（兼容旧版API）"""

    def evaluate(self, is_correct: bool, current_ability: Dict[str, Any]) -> Dict[str, Any]:
        """兼容旧版API（默认用时20秒）"""
        return super().evaluate(is_correct, time_used=20, retry_count=0,
                              current_ability=current_ability)


# 全局实例
behavior_calibrator = BehaviorCalibrator()
ability_evaluator = AbilityEvaluator()  # 兼容旧版
