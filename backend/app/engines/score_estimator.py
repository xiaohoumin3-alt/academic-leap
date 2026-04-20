"""
估分引擎 - 基于用户能力计算预估分数
"""
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models import UserAbility, KnowledgePoint


class ScoreEstimator:
    """估分器"""

    # Level对应的得分率
    LEVEL_SCORE_RATE = {
        0: 0.2,   # 未测试给最低分
        1: 0.4,   # 初步了解
        2: 0.6,   # 基本掌握
        3: 0.8,   # 熟练
        4: 0.95,  # 精通
    }

    def estimate(self, db: Session, user_id: str) -> Dict[str, Any]:
        """
        估算用户分数

        Args:
            db: 数据库会话
            user_id: 用户ID

        Returns:
            {
                "score": float,  # 预估总分
                "range": str,    # 置信区间
                "breakdown": [   # 分项明细
                    {"knowledge": str, "score": float}
                ]
            }
        """
        # 获取用户所有能力记录
        abilities = db.query(UserAbility).filter(
            UserAbility.user_id == user_id
        ).all()

        if not abilities:
            return {
                "score": 0.0,
                "range": "±10",
                "breakdown": []
            }

        # 获取所有知识点
        knowledge_points = db.query(KnowledgePoint).all()
        kp_dict = {kp.id: kp for kp in knowledge_points}

        breakdown = []
        total_score = 0.0
        total_weight = 0.0

        for ab in abilities:
            kp = kp_dict.get(ab.knowledge_id)
            if not kp:
                continue

            # 计算该知识点得分
            score_rate = self.LEVEL_SCORE_RATE.get(ab.level, 0.2)
            kp_score = kp.score_weight * score_rate

            breakdown.append({
                "knowledge": kp.name,
                "score": round(kp_score, 1)
            })

            total_score += kp_score
            total_weight += kp.score_weight

        # 计算置信区间
        range_str = self._calculate_range(len(abilities))

        return {
            "score": round(total_score, 1),
            "range": range_str,
            "breakdown": breakdown
        }

    def _calculate_range(self, ability_count: int) -> str:
        """根据能力记录数量计算置信区间"""
        if ability_count >= 5:
            return "±3"
        elif ability_count >= 3:
            return "±5"
        else:
            return "±10"


# 全局实例
score_estimator = ScoreEstimator()
