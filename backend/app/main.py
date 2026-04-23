"""
学力跃迁 - FastAPI 后端入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.api import questions, answers, assessments, admin
import os

# 创建FastAPI应用
app = FastAPI(
    title="学力跃迁 API",
    description="自适应学习系统后端",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
app.include_router(answers.router, prefix="/api/answers", tags=["answers"])
app.include_router(assessments.router, prefix="/api/assessments", tags=["assessments"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/")
async def root():
    return {"message": "学力跃迁 API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
