"""
能力评估引擎 - 根据答题情况更新用户能力等级
"""
from typing import Dict, Any
from datetime import datetime


class AbilityEvaluator:
    """能力评估器"""

    # Level对应的掌握率
    LEVEL_MASTERY = {
        0: 0.0,   # 未测试
        1: 0.3,   # 初步了解
        2: 0.5,   # 基本掌握
        3: 0.7,   # 熟练
        4: 0.9,   # 精通
    }

    def evaluate(self, is_correct: bool, current_ability: Dict[str, Any]) -> Dict[str, Any]:
        """
        根据答题结果评估并更新能力

        Args:
            is_correct: 是否答对
            current_ability: 当前能力状态 {
                "level": int,
                "stable_pass_count": int
            }

        Returns:
            更新后的能力状态 {
                "level": int,
                "stable_pass_count": int,
                "changed": bool,
                "feedback": str
            }
        """
        level = current_ability.get("level", 0)
        stable_pass_count = current_ability.get("stable_pass_count", 0)

        if is_correct:
            stable_pass_count += 1
            feedback = "回答正确！"

            # 连续答对2题，升级
            if stable_pass_count >= 2 and level < 4:
                level += 1
                stable_pass_count = 0
                feedback = f"太棒了！连续答对，升级到Level {level}！"
            else:
                feedback += f" 继续保持，再答对{2 - stable_pass_count}题即可升级！"
        else:
            stable_pass_count = 0
            feedback = "回答错误。别灰心，继续加油！"

            # Level > 0 时答错，可能降级
            if level > 0:
                # 30%概率降级（给用户容错空间）
                import random
                if random.random() < 0.3:
                    level -= 1
                    feedback = f"回答错误。降级到Level {level}，巩固基础！"

        return {
            "level": level,
            "stable_pass_count": stable_pass_count,
            "changed": level != current_ability.get("level", 0),
            "feedback": feedback
        }

    def get_mastery_rate(self, level: int) -> float:
        """获取Level对应的掌握率"""
        return self.LEVEL_MASTERY.get(level, 0.0)


# 全局实例
ability_evaluator = AbilityEvaluator()
