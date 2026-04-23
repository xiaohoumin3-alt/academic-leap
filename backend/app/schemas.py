"""
Pydantic 数据验证模型
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid


class UserCreate(BaseModel):
    """创建用户请求"""
    name: str = Field(..., min_length=1, max_length=100)
    grade: Optional[int] = None


class UserResponse(BaseModel):
    """用户响应"""
    id: uuid.UUID
    name: str
    grade: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NextQuestionRequest(BaseModel):
    """获取下一题请求"""
    user_id: uuid.UUID
    knowledge_id: int


class NextQuestionResponse(BaseModel):
    """获取下一题响应"""
    question_id: uuid.UUID
    content: str
    level: int
    input_type: str  # "expression", "number", "choice", "steps"


class SubmitAnswerRequest(BaseModel):
    """提交答案请求"""
    user_id: uuid.UUID
    question_id: uuid.UUID
    answer: str
    time_used: int = Field(..., ge=0, description="答题用时（秒）")
    retry_count: int = Field(default=0, ge=0, description="重试次数")


class SubmitAnswerResponse(BaseModel):
    """提交答案响应"""
    is_correct: bool
    new_level: int
    stable_pass_count: int
    feedback: str
    behavior_type: str  # fast_correct, normal_correct, slow_correct, retry_correct, wrong
    mastery_score: float  # 掌握度分数 (0-1.2)
    correct_answer: Optional[str] = None


class AbilityResponse(BaseModel):
    """能力响应"""
    user_id: uuid.UUID
    knowledge_id: int
    knowledge_name: str
    level: int
    stable_pass_count: int
    last_updated: datetime


class ScoreBreakdown(BaseModel):
    """分数明细"""
    knowledge: str
    score: float


class ScoreBreakdown(BaseModel):
    """分数明细"""
    knowledge: str
    score: float
    level: int
    mastery: float  # 掌握度百分比


class EstimateScoreResponse(BaseModel):
    """估分响应"""
    score: float
    range: str
    stability: str  # high, medium, low
    confidence: float  # 置信度 (0-1)
    breakdown: List[ScoreBreakdown]
    strong_points: List[str]  # 强项
    weak_points: List[str]  # 弱项
    suggestions: List[str]  # 提分建议


class QuestionInAssessment(BaseModel):
    """测评中的题目"""
    question_id: uuid.UUID
    content: str
    level: int
    knowledge_id: int
    knowledge_name: str
    input_type: str


class StartAssessmentResponse(BaseModel):
    """开始测评响应"""
    assessment_id: uuid.UUID
    questions: List[QuestionInAssessment]
