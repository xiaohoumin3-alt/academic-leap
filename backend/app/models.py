"""
SQLAlchemy 数据模型
"""
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    grade = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关系
    abilities = relationship("UserAbility", back_populates="user", cascade="all, delete-orphan")
    generated_questions = relationship("GeneratedQuestion", back_populates="user", cascade="all, delete-orphan")
    answers = relationship("Answer", back_populates="user", cascade="all, delete-orphan")
    assessments = relationship("Assessment", back_populates="user", cascade="all, delete-orphan")


class KnowledgePoint(Base):
    """知识点表"""
    __tablename__ = "knowledge_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    subject = Column(String(50), nullable=False)
    score_weight = Column(Float, nullable=False)

    # 关系
    abilities = relationship("UserAbility", back_populates="knowledge_point")
    templates = relationship("QuestionTemplate", back_populates="knowledge_point")


class UserAbility(Base):
    """用户能力表（核心）"""
    __tablename__ = "user_ability"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    knowledge_id = Column(Integer, ForeignKey("knowledge_points.id"), primary_key=True)
    level = Column(Integer, default=0, nullable=False)
    stable_pass_count = Column(Integer, default=0, nullable=False)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 约束
    __table_args__ = (
        CheckConstraint("level >= 0 AND level <= 4", name="check_level_range"),
    )

    # 关系
    user = relationship("User", back_populates="abilities")
    knowledge_point = relationship("KnowledgePoint", back_populates="abilities")


class QuestionTemplate(Base):
    """题目模板表"""
    __tablename__ = "question_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    knowledge_id = Column(Integer, ForeignKey("knowledge_points.id"), nullable=False)
    template_type = Column(String(50), nullable=False)
    level = Column(Integer, nullable=False)
    template_json = Column(JSON, nullable=False)

    # 约束
    __table_args__ = (
        CheckConstraint("level >= 0 AND level <= 4", name="check_template_level"),
    )

    # 关系
    knowledge_point = relationship("KnowledgePoint", back_populates="templates")


class GeneratedQuestion(Base):
    """生成题目记录"""
    __tablename__ = "generated_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    knowledge_id = Column(Integer, nullable=False)
    level = Column(Integer, nullable=False)
    content = Column(String, nullable=False)
    answer = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关系
    user = relationship("User", back_populates="generated_questions")
    answers = relationship("Answer", back_populates="question")


class Answer(Base):
    """作答记录表"""
    __tablename__ = "answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("generated_questions.id"), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    answer = Column(String)
    time_used = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关系
    user = relationship("User", back_populates="answers")
    question = relationship("GeneratedQuestion", back_populates="answers")


class Assessment(Base):
    """测评记录表"""
    __tablename__ = "assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    score_estimate = Column(Float)
    score_range = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关系
    user = relationship("User", back_populates="assessments")
