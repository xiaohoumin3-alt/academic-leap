-- 学力跃迁 - 数据库Schema
-- PostgreSQL

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    grade INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 知识点表
CREATE TABLE IF NOT EXISTS knowledge_points (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(50) NOT NULL,
    score_weight FLOAT NOT NULL
);

-- 3. 用户能力表（核心）
CREATE TABLE IF NOT EXISTS user_ability (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    knowledge_id INTEGER REFERENCES knowledge_points(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 0 CHECK (level >= 0 AND level <= 4),
    stable_pass_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, knowledge_id)
);

-- 4. 题目模板表
CREATE TABLE IF NOT EXISTS question_templates (
    id SERIAL PRIMARY KEY,
    knowledge_id INTEGER REFERENCES knowledge_points(id) ON DELETE CASCADE,
    template_type VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL CHECK (level >= 0 AND level <= 4),
    template_json JSONB NOT NULL
);

-- 5. 生成题目记录
CREATE TABLE IF NOT EXISTS generated_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    knowledge_id INTEGER NOT NULL,
    level INTEGER NOT NULL,
    content TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. 作答记录表
CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES generated_questions(id) ON DELETE CASCADE,
    is_correct BOOLEAN NOT NULL,
    answer TEXT,
    time_used INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 7. 测评记录表
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    score_estimate FLOAT,
    score_range VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 初始化3个知识点
INSERT INTO knowledge_points (name, subject, score_weight) VALUES
    ('一元一次方程', '数学', 30.0),
    ('有理数运算', '数学', 25.0),
    ('三角形角度', '数学', 20.0)
ON CONFLICT DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_ability_user ON user_ability(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ability_knowledge ON user_ability(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_generated_questions_user ON generated_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_user ON assessments(user_id);
