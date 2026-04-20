"""
题目相关API
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserAbility, KnowledgePoint, GeneratedQuestion
from app.schemas import NextQuestionRequest, NextQuestionResponse
from app.engines.question_generator import question_generator
import uuid

router = APIRouter()


@router.post("/next", response_model=NextQuestionResponse)
async def get_next_question(request: NextQuestionRequest, db: Session = Depends(get_db)):
    """
    获取下一题

    核心逻辑：
    1. 查询用户当前能力等级
    2. 决定出题难度（当前level或level+1）
    3. 调用题目生成引擎
    4. 保存题目记录
    """
    # 验证用户存在
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 验证知识点存在
    knowledge = db.query(KnowledgePoint).filter(
        KnowledgePoint.id == request.knowledge_id
    ).first()
    if not knowledge:
        raise HTTPException(status_code=404, detail="知识点不存在")

    # 获取用户当前能力
    ability = db.query(UserAbility).filter(
        UserAbility.user_id == request.user_id,
        UserAbility.knowledge_id == request.knowledge_id
    ).first()

    current_level = 0
    if ability:
        current_level = ability.level

    # 决定出题难度（80%概率当前level，20%概率level+1）
    import random
    question_level = current_level + 1 if (random.random() < 0.2 and current_level < 4) else current_level

    # 生成题目
    question_data = question_generator.generate(request.knowledge_id, question_level)

    # 保存题目记录
    generated = GeneratedQuestion(
        user_id=request.user_id,
        knowledge_id=request.knowledge_id,
        level=question_level,
        content=question_data["content"],
        answer=question_data["answer"]
    )
    db.add(generated)
    db.commit()
    db.refresh(generated)

    return NextQuestionResponse(
        question_id=generated.id,
        content=question_data["content"],
        level=question_level,
        input_type=question_data["input_type"]
    )


@router.get("/abilities/{user_id}")
async def get_user_abilities(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取用户所有能力数据"""
    abilities = db.query(UserAbility, KnowledgePoint).join(
        KnowledgePoint, UserAbility.knowledge_id == KnowledgePoint.id
    ).filter(
        UserAbility.user_id == user_id
    ).all()

    result = []
    for ability, knowledge in abilities:
        result.append({
            "user_id": str(ability.user_id),
            "knowledge_id": ability.knowledge_id,
            "knowledge_name": knowledge.name,
            "level": ability.level,
            "stable_pass_count": ability.stable_pass_count,
            "last_updated": ability.last_updated.isoformat()
        })

    return result
