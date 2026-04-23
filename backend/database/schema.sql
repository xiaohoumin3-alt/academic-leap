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

-- 4. 参数化模板表（核心 - 替代教研出题）
CREATE TABLE IF NOT EXISTS knowledge_templates (
    id SERIAL PRIMARY KEY,
    knowledge_id INTEGER REFERENCES knowledge_points(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    structure TEXT NOT NULL,          -- 题目结构，如 "[a]x + [b] = [c]"
    parameters JSONB NOT NULL,         -- 参数定义 {"a": {"type": "int", "range": [1, 5]}}
    level_rules JSONB NOT NULL,        -- Level规则 {"0": {"a": 1}, "1": {"a": [1, 3]}}
    validation_rules JSONB,            -- 验证规则（避免无解等）
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. 题目模板表（旧版，保留兼容）
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

-- 6. 作答记录表（扩展 - 添加行为数据）
CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES generated_questions(id) ON DELETE CASCADE,
    is_correct BOOLEAN NOT NULL,
    answer TEXT,
    time_used INTEGER,
    retry_count INTEGER DEFAULT 0,       -- 重试次数
    behavior_type VARCHAR(20),          -- fast_correct, normal_correct, slow_correct, retry_correct, wrong
    created_at TIMESTAMP DEFAULT NOW()
);

-- 7. 测评记录表
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    score_estimate FLOAT,
    score_range VARCHAR(20),
    stability_level VARCHAR(10),         -- high, medium, low
    created_at TIMESTAMP DEFAULT NOW()
);

-- 8. 难度校准记录表（新增 - 行为数据驱动）
CREATE TABLE IF NOT EXISTS difficulty_calibration (
    id SERIAL PRIMARY KEY,
    knowledge_id INTEGER REFERENCES knowledge_points(id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level >= 0 AND level <= 4),
    date DATE NOT NULL,
    correct_rate FLOAT NOT NULL,         -- 正确率
    avg_time_used FLOAT NOT NULL,       -- 平均用时
    retry_rate FLOAT NOT NULL,           -- 重试率
    sample_count INTEGER NOT NULL,       -- 样本数量
    status VARCHAR(20),                  -- easy, normal, hard, too_hard
    created_at TIMESTAMP DEFAULT NOW()
);

-- 初始化3个知识点
INSERT INTO knowledge_points (name, subject, score_weight) VALUES
    ('一元一次方程', '数学', 30.0),
    ('有理数运算', '数学', 25.0),
    ('三角形角度', '数学', 20.0)
ON CONFLICT DO NOTHING;

-- 初始化参数化模板（一元一次方程）
INSERT INTO knowledge_templates (knowledge_id, name, structure, parameters, level_rules, validation_rules) VALUES
(1, '一元一次方程基础模板', '[a]x + [b] = [c]',
 '{"a": {"type": "int", "range": [1, 5]}, "b": {"type": "int", "range": [-10, 10]}, "c": {"type": "derived", "formula": "a*x+b"}}',
 '{"0": {"a": 1, "allow_negative": false}, "1": {"a": [1, 3], "allow_negative": true}, "2": {"both_sides": true}, "3": {"fractions": true}, "4": {"parentheses": true}}',
 '{"avoid_no_solution": true, "avoid_infinite_solution": true, "integer_answer": true}'
)
ON CONFLICT DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_ability_user ON user_ability(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ability_knowledge ON user_ability(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_generated_questions_user ON generated_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_user ON assessments(user_id);

-- 新索引 - 参数化模板相关
CREATE INDEX IF NOT EXISTS idx_knowledge_templates_knowledge ON knowledge_templates(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_templates_active ON knowledge_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_difficulty_calibration_knowledge ON difficulty_calibration(knowledge_id, level);
CREATE INDEX IF NOT EXISTS idx_answers_behavior ON answers(behavior_type);
