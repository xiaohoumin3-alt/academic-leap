# 真实上线标准检查清单

## ✅ 已完成

### 后端架构
- [x] FastAPI 项目搭建
- [x] 目录结构完整
- [x] 数据库连接配置
- [x] SQLAlchemy 模型定义
- [x] Pydantic 验证模型

### 数据库
- [x] 7张核心数据表SQL
- [x] 索引配置
- [x] 初始数据（3个知识点）

### 核心引擎
- [x] 题目生成引擎 (`engines/question_generator.py`)
- [x] 判题引擎 (`engines/answer_judger.py`)
- [x] 能力评估引擎 (`engines/ability_evaluator.py`)
- [x] 估分引擎 (`engines/score_estimator.py`)

### API
- [x] POST /api/questions/next - 获取下一题
- [x] POST /api/answers/submit - 提交答案
- [x] GET /api/answers/estimate-score - 获取估分
- [x] POST /api/assessments/start - 开始测评
- [x] POST /api/assessments/users - 创建用户

### 测试
- [x] 5个标准测试场景
- [x] 场景1: 新用户首次测评
- [x] 场景2: 题目生成验证
- [x] 场景3: 性能SLA (<1s)
- [x] 场景4: 估分验证
- [x] 场景5: 错误处理

---

## 🚧 待完成（部署前）

### 1. 部署数据库
- [ ] 选择云PostgreSQL服务（Supabase/Neon/Railway）
- [ ] 执行schema.sql
- [ ] 配置连接字符串

### 2. 部署后端
- [ ] 选择部署平台（Railway/Render/Fly.io）
- [ ] 配置环境变量
- [ ] 验证API可访问

### 3. 前端对接
- [ ] 更新 `lib/api.ts` 指向真实后端
- [ ] 移除Mock数据
- [ ] 添加错误处理

### 4. 端到端测试
- [ ] 本地运行后端
- [ ] 前端连接本地后端测试
- [ ] 验证完整流程

---

## 📁 文件结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI入口 ✅
│   ├── database.py             # 数据库连接 ✅
│   ├── models.py               # SQLAlchemy模型 ✅
│   ├── schemas.py              # Pydantic模型 ✅
│   ├── api/                    # API路由 ✅
│   │   ├── __init__.py
│   │   ├── questions.py
│   │   ├── answers.py
│   │   └── assessments.py
│   └── engines/                # 核心引擎 ✅
│       ├── __init__.py
│       ├── question_generator.py
│       ├── answer_judger.py
│       ├── ability_evaluator.py
│       └── score_estimator.py
├── database/
│   └── schema.sql              # 数据库Schema ✅
├── tests/
│   └── test_integration/
│       └── standard_test_scenarios.py  # 标准测试 ✅
├── requirements.txt            # Python依赖 ✅
└── README.md                   # 快速开始文档 ✅
```

---

## 🧪 本地测试命令

```bash
# 1. 进入后端目录
cd backend

# 2. 安装依赖
pip install -r requirements.txt

# 3. 启动服务（需要先配置数据库）
python -m app.main

# 4. 运行测试（在另一个终端）
pytest tests/test_integration/standard_test_scenarios.py -v -s

# 5. 查看API文档
# 浏览器访问 http://localhost:8000/docs
```
