"""
答案相关API（V2.0 - 行为校准版）
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Answer, GeneratedQuestion, UserAbility
from app.schemas import SubmitAnswerRequest, SubmitAnswerResponse
from app.engines.answer_judger import answer_judger
from app.engines.ability_evaluator import behavior_calibrator
import uuid

router = APIRouter()


@router.post("/submit", response_model=SubmitAnswerResponse)
async def submit_answer(request: SubmitAnswerRequest, db: Session = Depends(get_db)):
    """
    提交答案（V2.0 - 行为校准版）

    核心逻辑：
    1. 获取题目信息
    2. 校验答案
    3. 写入answers表（记录time_used, retry_count, behavior_type）
    4. 使用行为校准引擎更新能力
    5. 返回详细反馈
    """
    # 验证用户存在
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 获取题目
    question = db.query(GeneratedQuestion).filter(
        GeneratedQuestion.id == request.question_id
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    # 校验答案
    is_correct, _ = answer_judger.judge(
        request.answer,
        question.answer,
        "number"
    )

    # 使用行为校准引擎分析行为
    behavior_result = behavior_calibrator.analyze_behavior(
        is_correct=is_correct,
        time_used=request.time_used,
        retry_count=request.retry_count
    )

    # 获取当前能力
    ability = db.query(UserAbility).filter(
        UserAbility.user_id == request.user_id,
        UserAbility.knowledge_id == question.knowledge_id
    ).first()

    if not ability:
        ability = UserAbility(
            user_id=request.user_id,
            knowledge_id=question.knowledge_id,
            level=0,
            stable_pass_count=0
        )
        db.add(ability)
        db.flush()  # 确保ability被写入事务

    # 使用行为校准引擎更新能力
    current_state = {
        "level": ability.level,
        "stable_pass_count": ability.stable_pass_count
    }
    new_state = behavior_calibrator.evaluate(
        is_correct=is_correct,
        time_used=request.time_used,
        retry_count=request.retry_count,
        current_ability=current_state
    )

    # 更新能力
    ability.level = new_state["level"]
    ability.stable_pass_count = new_state["stable_pass_count"]

    # 创建答案记录（包含行为数据）
    answer_record = Answer(
        user_id=request.user_id,
        question_id=request.question_id,
        is_correct=is_correct,
        answer=request.answer,
        time_used=request.time_used,
        retry_count=request.retry_count,
        behavior_type=behavior_result.behavior_type.value
    )
    db.add(answer_record)
    db.commit()

    return SubmitAnswerResponse(
        is_correct=is_correct,
        new_level=new_state["level"],
        stable_pass_count=new_state["stable_pass_count"],
        feedback=new_state["feedback"],
        behavior_type=new_state["behavior_type"],
        mastery_score=new_state["mastery_score"],
        correct_answer=question.answer if not is_correct else None
    )


@router.get("/estimate-score/{user_id}")
async def estimate_score(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    获取用户估分（V2.0 - 稳健版）

    返回：
    - score: 预估分数
    - range: 可信区间（如 "71-77"）
    - stability: 稳定等级（high/medium/low）
    - confidence: 置信度 (0-1)
    - breakdown: 分项明细
    - strong_points: 强项
    - weak_points: 弱项
    - suggestions: 提分建议
    """
    from app.engines.score_estimator import score_estimator

    result = score_estimator.get_breakdown_with_insights(db, str(user_id))
    return result
