"""
后台管理API（V2.0）

核心功能：
1. 模板管理 - 创建/编辑/删除参数化模板
2. 难度校准面板 - 实时查看各Level行为数据
3. 题目生成预览 - 测试模板生成效果
4. 模板健康度 - 检测异常/重复/无解题
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from app.database import get_db
from app.models import (
    KnowledgePoint, KnowledgeTemplate, GeneratedQuestion,
    Answer, DifficultyCalibration, UserAbility
)
from app.engines.question_generator import QuestionGenerator, Template
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import uuid

router = APIRouter()


# ==================== Schema ====================

class TemplateCreate(BaseModel):
    """创建模板请求"""
    knowledge_id: int
    name: str
    structure: str  # 如 "[a]x + [b] = [c]"
    parameters: Dict[str, Any]  # 参数定义
    level_rules: Dict[str, Any]  # Level规则
    validation_rules: Optional[Dict[str, Any]] = None


class TemplateUpdate(BaseModel):
    """更新模板请求"""
    name: Optional[str] = None
    structure: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    level_rules: Optional[Dict[str, Any]] = None
    validation_rules: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class GeneratePreviewRequest(BaseModel):
    """生成预览请求"""
    template_id: int
    level: int
    count: int = 5  # 生成数量


# ==================== 模板管理 ====================

@router.get("/templates")
async def list_templates(db: Session = Depends(get_db)):
    """获取所有模板"""
    templates = db.query(KnowledgeTemplate).order_by(
        KnowledgeTemplate.knowledge_id,
        KnowledgeTemplate.id
    ).all()

    result = []
    for t in templates:
        kp = db.query(KnowledgePoint).filter(
            KnowledgePoint.id == t.knowledge_id
        ).first()
        result.append({
            "id": t.id,
            "knowledge_id": t.knowledge_id,
            "knowledge_name": kp.name if kp else "未知",
            "name": t.name,
            "structure": t.structure,
            "is_active": t.is_active,
            "created_at": t.created_at.isoformat()
        })

    return result


@router.get("/templates/{template_id}")
async def get_template(template_id: int, db: Session = Depends(get_db)):
    """获取模板详情"""
    template = db.query(KnowledgeTemplate).filter(
        KnowledgeTemplate.id == template_id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    kp = db.query(KnowledgePoint).filter(
        KnowledgePoint.id == template.knowledge_id
    ).first()

    return {
        "id": template.id,
        "knowledge_id": template.knowledge_id,
        "knowledge_name": kp.name if kp else "未知",
        "name": template.name,
        "structure": template.structure,
        "parameters": template.parameters,
        "level_rules": template.level_rules,
        "validation_rules": template.validation_rules,
        "is_active": template.is_active,
        "created_at": template.created_at.isoformat()
    }


@router.post("/templates", status_code=201)
async def create_template(request: TemplateCreate, db: Session = Depends(get_db)):
    """创建新模板"""
    # 验证知识点存在
    kp = db.query(KnowledgePoint).filter(
        KnowledgePoint.id == request.knowledge_id
    ).first()
    if not kp:
        raise HTTPException(status_code=404, detail="知识点不存在")

    template = KnowledgeTemplate(
        knowledge_id=request.knowledge_id,
        name=request.name,
        structure=request.structure,
        parameters=request.parameters,
        level_rules=request.level_rules,
        validation_rules=request.validation_rules
    )

    db.add(template)
    db.commit()
    db.refresh(template)

    return {
        "id": template.id,
        "knowledge_id": template.knowledge_id,
        "name": template.name
    }


@router.put("/templates/{template_id}")
async def update_template(
    template_id: int,
    request: TemplateUpdate,
    db: Session = Depends(get_db)
):
    """更新模板"""
    template = db.query(KnowledgeTemplate).filter(
        KnowledgeTemplate.id == template_id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    # 更新字段
    if request.name is not None:
        template.name = request.name
    if request.structure is not None:
        template.structure = request.structure
    if request.parameters is not None:
        template.parameters = request.parameters
    if request.level_rules is not None:
        template.level_rules = request.level_rules
    if request.validation_rules is not None:
        template.validation_rules = request.validation_rules
    if request.is_active is not None:
        template.is_active = request.is_active

    db.commit()

    return {"id": template.id, "updated": True}


@router.delete("/templates/{template_id}")
async def delete_template(template_id: int, db: Session = Depends(get_db)):
    """删除模板"""
    template = db.query(KnowledgeTemplate).filter(
        KnowledgeTemplate.id == template_id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    db.delete(template)
    db.commit()

    return {"id": template_id, "deleted": True}


# ==================== 题目生成预览 ====================

@router.post("/templates/preview")
async def preview_generate(request: GeneratePreviewRequest, db: Session = Depends(get_db)):
    """
    预览生成题目

    测试模板在不同Level下的生成效果
    """
    template = db.query(KnowledgeTemplate).filter(
        KnowledgeTemplate.id == request.template_id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    # 创建Template对象
    tpl = Template(
        id=template.id,
        knowledge_id=template.knowledge_id,
        name=template.name,
        structure=template.structure,
        parameters=template.parameters,
        level_rules=template.level_rules,
        validation_rules=template.validation_rules
    )

    # 使用题目生成器
    generator = QuestionGenerator()
    questions = []

    for i in range(request.count):
        try:
            q = generator.generate(request.template_id, request.level)
            questions.append({
                "index": i + 1,
                "content": q.content,
                "answer": q.answer,
                "input_type": q.input_type
            })
        except Exception as e:
            questions.append({
                "index": i + 1,
                "error": str(e)
            })

    return {
        "template_id": request.template_id,
        "level": request.level,
        "questions": questions
    }


# ==================== 难度校准面板 ====================

@router.get("/calibration/{knowledge_id}")
async def get_calibration_data(
    knowledge_id: int,
    days: int = 7,
    db: Session = Depends(get_db)
):
    """
    获取难度校准数据

    返回各Level的行为数据：
    - 正确率
    - 平均用时
    - 重试率
    - 样本数量
    - 状态判断
    """
    # 查询最近N天的数据
    since_date = datetime.now() - timedelta(days=days)

    # 从Answer表聚合数据
    calibration_data = []
    for level in range(5):  # 0-4
        # 查询该Level的答题记录
        answers = db.query(Answer).join(
            GeneratedQuestion,
            Answer.question_id == GeneratedQuestion.id
        ).filter(
            GeneratedQuestion.knowledge_id == knowledge_id,
            GeneratedQuestion.level == level,
            Answer.created_at >= since_date
        ).all()

        if not answers:
            calibration_data.append({
                "level": level,
                "correct_rate": None,
                "avg_time_used": None,
                "retry_rate": None,
                "sample_count": 0,
                "status": "no_data"
            })
            continue

        total = len(answers)
        correct = sum(1 for a in answers if a.is_correct)
        avg_time = sum(a.time_used or 0 for a in answers) / total
        retry_count = sum(a.retry_count or 0 for a in answers)
        retry_rate = retry_count / total

        correct_rate = correct / total

        # 判断状态
        if correct_rate >= 0.8:
            status = "easy"
        elif correct_rate >= 0.4:
            status = "normal"
        elif correct_rate >= 0.2:
            status = "hard"
        else:
            status = "too_hard"

        calibration_data.append({
            "level": level,
            "correct_rate": round(correct_rate, 3),
            "avg_time_used": round(avg_time, 1),
            "retry_rate": round(retry_rate, 3),
            "sample_count": total,
            "status": status
        })

    return {
        "knowledge_id": knowledge_id,
        "days": days,
        "data": calibration_data
    }


@router.get("/calibration/{knowledge_id}/behavior-distribution")
async def get_behavior_distribution(
    knowledge_id: int,
    level: int,
    days: int = 7,
    db: Session = Depends(get_db)
):
    """
    获取行为类型分布

    返回各行为类型的数量和占比
    """
    since_date = datetime.now() - timedelta(days=days)

    answers = db.query(Answer).join(
        GeneratedQuestion,
        Answer.question_id == GeneratedQuestion.id
    ).filter(
        GeneratedQuestion.knowledge_id == knowledge_id,
        GeneratedQuestion.level == level,
        Answer.created_at >= since_date
    ).all()

    behavior_counts = {
        "fast_correct": 0,
        "normal_correct": 0,
        "slow_correct": 0,
        "retry_correct": 0,
        "wrong": 0
    }

    for a in answers:
        behavior_type = a.behavior_type or "unknown"
        if behavior_type in behavior_counts:
            behavior_counts[behavior_type] += 1

    total = sum(behavior_counts.values())

    return {
        "knowledge_id": knowledge_id,
        "level": level,
        "days": days,
        "counts": behavior_counts,
        "total": total,
        "percentages": {
            k: round(v / total, 3) if total > 0 else 0
            for k, v in behavior_counts.items()
        }
    }


# ==================== 模板健康度 ====================

@router.get("/health/overview")
async def get_health_overview(db: Session = Depends(get_db)):
    """
    获取模板健康度概览

    检查：
    - 无模板的知识点
    - 重复题目检测
    - 异常数据
    """
    # 检查无模板的知识点
    all_kp = db.query(KnowledgePoint).all()
    kp_with_template = db.query(KnowledgeTemplate.knowledge_id).distinct().all()
    kp_ids_with_template = {t[0] for t in kp_with_template}

    missing_templates = [
        {"id": kp.id, "name": kp.name}
        for kp in all_kp
        if kp.id not in kp_ids_with_template
    ]

    # 检查重复题目（相同内容）
    duplicate_questions = db.query(
        GeneratedQuestion.content,
        func.count(GeneratedQuestion.id).label('count')
    ).group_by(
        GeneratedQuestion.content
    ).having(
        func.count(GeneratedQuestion.id) > 1
    ).all()

    duplicates = [
        {"content": content, "count": count}
        for content, count in duplicate_questions
    ]

    # 异常数据检测
    # 1. time_used异常（<1秒或>10分钟）
    abnormal_time = db.query(Answer).filter(
        or_(
            Answer.time_used < 1,
            Answer.time_used > 600
        )
    ).count()

    # 2. retry_count异常（>5）
    abnormal_retry = db.query(Answer).filter(
        Answer.retry_count > 5
    ).count()

    return {
        "missing_templates": missing_templates,
        "duplicate_questions": {
            "count": len(duplicates),
            "items": duplicates[:10]  # 最多返回10个
        },
        "abnormal_data": {
            "abnormal_time_count": abnormal_time,
            "abnormal_retry_count": abnormal_retry
        },
        "total_knowledge_points": len(all_kp),
        "total_templates": db.query(KnowledgeTemplate).count()
    }


@router.get("/health/knowledge-points")
async def list_knowledge_points(db: Session = Depends(get_db)):
    """列出所有知识点及其模板状态"""
    knowledge_points = db.query(KnowledgePoint).order_by(
        KnowledgePoint.subject,
        KnowledgePoint.id
    ).all()

    result = []
    for kp in knowledge_points:
        templates = db.query(KnowledgeTemplate).filter(
            KnowledgeTemplate.knowledge_id == kp.id
        ).all()

        result.append({
            "id": kp.id,
            "name": kp.name,
            "subject": kp.subject,
            "score_weight": kp.score_weight,
            "template_count": len(templates),
            "has_template": len(templates) > 0
        })

    return result


# ==================== 数据导出 ====================

@router.get("/export/abilities")
async def export_abilities(db: Session = Depends(get_db)):
    """导出所有用户能力数据"""
    abilities = db.query(UserAbility, KnowledgePoint).join(
        KnowledgePoint,
        UserAbility.knowledge_id == KnowledgePoint.id
    ).order_by(
        UserAbility.user_id,
        UserAbility.knowledge_id
    ).all()

    result = []
    for ability, kp in abilities:
        result.append({
            "user_id": str(ability.user_id),
            "knowledge_id": ability.knowledge_id,
            "knowledge_name": kp.name,
            "level": ability.level,
            "stable_pass_count": ability.stable_pass_count,
            "last_updated": ability.last_updated.isoformat()
        })

    return {
        "total": len(result),
        "data": result
    }
