#!/bin/bash
# 本地测试脚本 - 启动后端 + 前端

set -e

echo "================================"
echo "学力跃迁 - 本地测试环境"
echo "================================"

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

echo ""
echo "📦 启动PostgreSQL数据库..."

# 启动PostgreSQL
docker run -d \
    --name academic-leap-db \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=academic_leap \
    -p 5432:5432 \
    postgres:16-alpine > /dev/null 2>&1 || echo "数据库已存在"

echo "⏳ 等待数据库启动..."
sleep 5

echo ""
echo "🗄️ 初始化数据库..."
docker exec academic-leap-db psql -U postgres -d academic_leap -c "
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    grade INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_points (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(50) NOT NULL,
    score_weight FLOAT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_ability (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    knowledge_id INTEGER REFERENCES knowledge_points(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 0 CHECK (level >= 0 AND level <= 4),
    stable_pass_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, knowledge_id)
);

CREATE TABLE IF NOT EXISTS generated_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    knowledge_id INTEGER NOT NULL,
    level INTEGER NOT NULL,
    content TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES generated_questions(id) ON DELETE CASCADE,
    is_correct BOOLEAN NOT NULL,
    answer TEXT,
    time_used INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    score_estimate FLOAT,
    score_range VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO knowledge_points (name, subject, score_weight) VALUES
    ('一元一次方程', '数学', 30.0),
    ('有理数运算', '数学', 25.0),
    ('三角形角度', '数学', 20.0)
ON CONFLICT DO NOTHING;
" > /dev/null 2>&1

echo "✅ 数据库初始化完成"

echo ""
echo "🔧 配置环境变量..."
cd "$(dirname "$0")"
echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/academic_leap" > .env
echo "PORT=8000" >> .env

echo ""
echo "📦 安装Python依赖..."
pip install -q -r requirements.txt

echo ""
echo "🚀 启动后端服务..."
echo "   后端: http://localhost:8000"
echo "   API文档: http://localhost:8000/docs"
echo ""
echo "================================"
echo "✅ 后端已启动！"
echo ""
echo "在另一个终端启动前端:"
echo "   cd .. && npm run dev"
echo "================================"

python -m app.main
