"""
答案相关API
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Answer, GeneratedQuestion, UserAbility
from app.schemas import SubmitAnswerRequest, SubmitAnswerResponse
from app.engines.answer_judger import answer_judger
from app.engines.ability_evaluator import ability_evaluator
import uuid

router = APIRouter()


@router.post("/submit", response_model=SubmitAnswerResponse)
async def submit_answer(request: SubmitAnswerRequest, db: Session = Depends(get_db)):
    """
    提交答案

    核心逻辑：
    1. 获取题目信息
    2. 校验答案
    3. 写入answers表
    4. 更新user_ability：
       - 正确: stable_pass_count += 1, 如果>=2则level+1
       - 错误: stable_pass_count = 0
    5. 返回反馈
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
    is_correct, feedback = answer_judger.judge(
        request.answer,
        question.answer,
        "number"  # 根据input_type判断
    )

    # 创建答案记录
    answer_record = Answer(
        user_id=request.user_id,
        question_id=request.question_id,
        is_correct=is_correct,
        answer=request.answer,
        time_used=request.time_used
    )
    db.add(answer_record)

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

    # 更新能力
    current_state = {
        "level": ability.level,
        "stable_pass_count": ability.stable_pass_count
    }
    new_state = ability_evaluator.evaluate(is_correct, current_state)

    ability.level = new_state["level"]
    ability.stable_pass_count = new_state["stable_pass_count"]

    db.commit()

    return SubmitAnswerResponse(
        is_correct=is_correct,
        new_level=new_state["level"],
        feedback=new_state["feedback"],
        correct_answer=question.answer if not is_correct else None
    )


@router.get("/estimate-score/{user_id}")
async def estimate_score(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取用户估分"""
    from app.engines.score_estimator import score_estimator

    result = score_estimator.estimate(db, str(user_id))
    return result
