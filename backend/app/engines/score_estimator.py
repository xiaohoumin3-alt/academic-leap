"""
稳健估分引擎（V2.0）- 输出分数+可信区间+稳定等级

核心思想：
- 不是固定分数，而是动态分数
- 包含可信区间（反映不确定性）
- 包含稳定等级（反映数据可靠性）
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from sqlalchemy.orm import Session
from app.models import UserAbility, KnowledgePoint, Answer


@dataclass
class ScoreEstimate:
    """估分结果"""
    score: float           # 预估分数
    range: str            # 可信区间，如 "71-77"
    stability: str        # 稳定等级: high, medium, low
    breakdown: List[Dict]  # 分项明细
    confidence: float     # 置信度 (0-1)


class ScoreEstimator:
    """
    稳健估分引擎（V2.0）

    输出：分数 + 可信区间 + 稳定等级
    """

    # Level对应的掌握率（更新版）
    LEVEL_MASTERY = {
        0: 0.4,   # 40%
        1: 0.7,   # 70%
        2: 0.9,   # 90%
        3: 1.0,   # 100%
        4: 1.0,   # 100%
    }

    # 稳定系数（基于数据量）
    STABILITY_COEFFICIENTS = {
        "low": 0.9,      # 数据少，打折
        "medium": 0.95,   # 数据中等
        "high": 1.0       # 数据充足，不打折
    }

    def estimate(self, db: Session, user_id: str) -> ScoreEstimate:
        """
        估算用户分数（稳健版）

        Args:
            db: 数据库会话
            user_id: 用户ID

        Returns:
            ScoreEstimate对象
        """
        # 获取用户所有能力记录
        abilities = db.query(UserAbility).filter(
            UserAbility.user_id == user_id
        ).all()

        if not abilities:
            return ScoreEstimate(
                score=0.0,
                range="0-10",
                stability="low",
                breakdown=[],
                confidence=0.0
            )

        # 获取所有知识点
        knowledge_points = db.query(KnowledgePoint).all()
        kp_dict = {kp.id: kp for kp in knowledge_points}

        # 计算总分
        breakdown = []
        total_score = 0.0
        total_weight = 0.0

        for ab in abilities:
            kp = kp_dict.get(ab.knowledge_id)
            if not kp:
                continue

            # 计算该知识点得分
            mastery_rate = self.LEVEL_MASTERY.get(ab.level, 0.5)
            kp_score = kp.score_weight * mastery_rate

            breakdown.append({
                "knowledge": kp.name,
                "score": round(kp_score, 1),
                "level": ab.level,
                "mastery": round(mastery_rate * 100, 0)
            })

            total_score += kp_score
            total_weight += kp.score_weight

        # 归一化到100分
        if total_weight > 0:
            total_score = (total_score / total_weight) * 100

        # 计算稳定等级
        stability = self._calculate_stability(db, user_id, abilities)

        # 应用稳定系数
        stability_coeff = self.STABILITY_COEFFICIENTS.get(stability, 0.9)
        adjusted_score = total_score * stability_coeff

        # 计算可信区间
        score_range = self._calculate_range(adjusted_score, stability)

        # 计算置信度
        confidence = self._calculate_confidence(db, user_id)

        return ScoreEstimate(
            score=round(adjusted_score, 1),
            range=score_range,
            stability=stability,
            breakdown=breakdown,
            confidence=confidence
        )

    def _calculate_stability(self, db: Session, user_id: str,
                           abilities: List[UserAbility]) -> str:
        """
        计算稳定等级

        Args:
            db: 数据库会话
            user_id: 用户ID
            abilities: 用户能力记录

        Returns:
            "high", "medium", "low"
        """
        # 统计总答题数
        total_answers = db.query(Answer).filter(
            Answer.user_id == user_id
        ).count()

        # 基于答题数判断稳定等级
        if total_answers >= 50:
            return "high"
        elif total_answers >= 20:
            return "medium"
        else:
            return "low"

    def _calculate_range(self, score: float, stability: str) -> str:
        """
        计算可信区间

        Args:
            score: 预估分数
            stability: 稳定等级

        Returns:
            可信区间字符串，如 "71-77"
        """
        # 根据稳定等级确定区间大小
        variance_map = {
            "high": 5,     # ±5
            "medium": 10,  # ±10
            "low": 20      # ±20
        }

        variance = variance_map.get(stability, 15)
        lower = max(0, int(score - variance))
        upper = min(100, int(score + variance))

        return f"{lower}-{upper}"

    def _calculate_confidence(self, db: Session, user_id: str) -> float:
        """
        计算估分置信度 (0-1)

        Args:
            db: 数据库会话
            user_id: 用户ID

        Returns:
            置信度 (0-1)
        """
        total_answers = db.query(Answer).filter(
            Answer.user_id == user_id
        ).count()

        # 基于答题数计算置信度
        if total_answers >= 50:
            return 0.95
        elif total_answers >= 20:
            return 0.80
        elif total_answers >= 10:
            return 0.60
        else:
            return 0.30

    def get_breakdown_with_insights(self, db: Session, user_id: str) -> Dict[str, Any]:
        """
        获取带洞察的分数明细

        Args:
            db: 数据库会话
            user_id: 用户ID

        Returns:
            包含洞察的明细
        """
        estimate = self.estimate(db, user_id)

        # 分析强项和弱项
        strong_points = []
        weak_points = []

        for item in estimate.breakdown:
            if item.get("mastery", 0) >= 90:
                strong_points.append(item["knowledge"])
            elif item.get("mastery", 0) < 70:
                weak_points.append(item["knowledge"])

        return {
            "score": estimate.score,
            "range": estimate.range,
            "stability": estimate.stability,
            "confidence": estimate.confidence,
            "breakdown": estimate.breakdown,
            "strong_points": strong_points,
            "weak_points": weak_points,
            "suggestions": self._generate_suggestions(weak_points)
        }

    def _generate_suggestions(self, weak_points: List[str]) -> List[str]:
        """生成提分建议"""
        suggestions = []

        if not weak_points:
            suggestions.append("你的知识掌握得很全面，继续保持！")
        else:
            for wp in weak_points[:3]:  # 最多3个建议
                suggestions.append(f"建议重点复习「{wp}」，预计能提升2-3分")

        return suggestions


# 全局实例
score_estimator = ScoreEstimator()
