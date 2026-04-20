"""
测评相关API
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Assessment, KnowledgePoint
from app.engines.question_generator import question_generator
from app.schemas import StartAssessmentResponse, QuestionInAssessment
import uuid
import random

router = APIRouter()


@router.post("/start", response_model=StartAssessmentResponse)
async def start_assessment(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    开始测评

    返回10道题目，覆盖3个知识点
    """
    # 验证用户存在
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 创建测评记录
    assessment = Assessment(user_id=user_id)
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    # 获取所有知识点
    knowledge_points = db.query(KnowledgePoint).all()

    if not knowledge_points:
        raise HTTPException(status_code=400, detail="没有可用的知识点")

    # 生成10道题
    questions = []
    for i in range(10):
        # 轮流选择知识点
        kp = knowledge_points[i % len(knowledge_points)]
        level = 0  # 测评从最低难度开始

        # 生成题目数据
        q_data = question_generator.generate(kp.id, level)

        questions.append({
            "knowledge_id": kp.id,
            "knowledge_name": kp.name,
            "level": level,
            "content": q_data["content"],
            "answer": q_data["answer"],
            "input_type": q_data["input_type"]
        })

    # 保存题目到generated_questions
    from app.models import GeneratedQuestion
    question_responses = []
    for q in questions:
        gq = GeneratedQuestion(
            user_id=user_id,
            knowledge_id=q["knowledge_id"],
            level=q["level"],
            content=q["content"],
            answer=q["answer"]
        )
        db.add(gq)
        db.commit()
        db.refresh(gq)

        question_responses.append(QuestionInAssessment(
            question_id=gq.id,
            content=gq.content,
            level=gq.level,
            knowledge_id=gq.knowledge_id,
            knowledge_name=q["knowledge_name"],
            input_type=q["input_type"]
        ))

    return StartAssessmentResponse(
        assessment_id=assessment.id,
        questions=question_responses
    )


@router.get("/history/{user_id}")
async def get_assessment_history(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取用户测评历史"""
    assessments = db.query(Assessment).filter(
        Assessment.user_id == user_id
    ).order_by(Assessment.created_at.desc()).limit(10).all()

    return [{
        "id": str(a.id),
        "score_estimate": a.score_estimate,
        "score_range": a.score_range,
        "created_at": a.created_at.isoformat()
    } for a in assessments]


@router.post("/users", status_code=201)
async def create_user(name: str, grade: int = None, db: Session = Depends(get_db)):
    """创建新用户"""
    from app.models import User

    user = User(name=name, grade=grade)
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": str(user.id),
        "name": user.name,
        "grade": user.grade,
        "created_at": user.created_at.isoformat()
    }
