# 学力跃迁 - 后端服务

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置数据库

创建 `.env` 文件：

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/academic_leap
```

### 3. 初始化数据库

```bash
psql -U postgres -c "CREATE DATABASE academic_leap;"
psql -U postgres -d academic_leap -f database/schema.sql
```

### 4. 启动服务

```bash
python -m app.main
```

服务将在 http://localhost:8000 启动

### 5. 运行测试

```bash
pytest tests/test_integration/standard_test_scenarios.py -v -s
```

## API 文档

启动服务后访问 http://localhost:8000/docs 查看完整API文档

## 核心API

### POST /api/questions/next
获取下一题

### POST /api/answers/submit
提交答案

### GET /api/answers/estimate-score/{user_id}
获取估分

### POST /api/assessments/start
开始测评

### POST /api/assessments/users
创建用户
