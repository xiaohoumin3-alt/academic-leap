# 真实上线系统 - 完整测试指南

## 快速开始

### 方式1: 使用脚本自动启动

```bash
cd backend
./start-local.sh
```

脚本会自动：
1. 启动 PostgreSQL 数据库
2. 初始化数据表
3. 安装 Python 依赖
4. 启动后端服务

### 方式2: 手动启动

```bash
# 1. 启动数据库
docker run -d --name academic-leap-db \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=academic_leap \
    -p 5432:5432 \
    postgres:16-alpine

# 2. 初始化数据库
docker exec academic-leap-db psql -U postgres -d academic_leap -f database/schema.sql

# 3. 安装依赖
pip install -r requirements.txt

# 4. 启动后端
python -m app.main
```

---

## 测试后端API

```bash
cd backend
python test_local.py
```

预期输出：
```
==================================================
学力跃迁 - 本地API测试
==================================================

1️⃣ 健康检查...
   {'status': 'healthy'}

2️⃣ 创建用户...
   ✅ 用户创建成功: xxx-xxx-xxx

3️⃣ 获取题目...
   ✅ 题目: 解方程: 2x = 10, x = ?
   难度: Level 0

4️⃣ 提交答案...
   ✅ 提交结果: 回答错误。正确答案是: 5
   新等级: Level 0

5️⃣ 测试升级逻辑...
   第1题: 回答错误。降级到Level 0，巩固基础！ (Level 0)
   第2题: 回答错误。降级到Level 0，巩固基础！ (Level 0)

6️⃣ 获取用户能力...
   📚 一元一次方程: Level 0 (连续通过0次)

7️⃣ 获取估分...
   📊 预估分数: 0.0
   置信区间: ±10

8️⃣ 开始测评...
   ✅ 测评ID: xxx-xxx-xxx
   题目数量: 10

9️⃣ 性能测试...
   📈 平均响应时间: 45ms
   ✅ 性能良好 (<500ms)

==================================================
✅ 测试完成！
==================================================
```

---

## 测试前端

```bash
# 启动前端（新终端）
cd /Users/seanxx/学力跃迁精准提分/学力跃迁-(academic-leap) (2)
npm run dev
```

访问 http://localhost:3000

验证：
1. ✅ 首页显示真实数据（从后端获取）
2. ✅ 用户ID保存到 localStorage
3. ✅ 点击"开始今日训练"进入练习页
4. ✅ 答题后能力等级正确更新

---

## API文档

启动后端后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 部署到Railway

### 1. 准备代码

```bash
cd backend
git init
git add .
git commit -m "feat: 后端API完整实现"
```

### 2. 推送到GitHub

```bash
gh repo create academic-leap-backend --public --source=. --remote=origin
git push -u origin main
```

### 3. 在Railway部署

1. 访问 https://railway.app
2. 点击 "New Project" → "Deploy from GitHub repo"
3. 选择 `academic-leap-backend`
4. Railway会自动检测Python项目并部署
5. 添加PostgreSQL插件

### 4. 获取API地址

部署完成后，Railway会提供API地址，例如：
```
https://academic-leap-backend.up.railway.app
```

### 5. 更新前端API地址

修改 `lib/real-api.ts`:

```typescript
const API_BASE = 'https://academic-leap-backend.up.railway.app';
```

---

## 数据库Schema

7张核心表：

| 表名 | 说明 |
|------|------|
| users | 用户表 |
| knowledge_points | 知识点表 |
| user_ability | 用户能力表（核心） |
| question_templates | 题目模板表 |
| generated_questions | 生成题目记录 |
| answers | 作答记录表 |
| assessments | 测评记录表 |

---

## 故障排查

### 数据库连接失败
```bash
# 检查PostgreSQL是否运行
docker ps | grep postgres

# 查看数据库日志
docker logs academic-leap-db
```

### 后端启动失败
```bash
# 检查端口占用
lsof -i :8000

# 查看详细错误
python -m app.main --log-level debug
```

### 前端无法连接后端
1. 检查后端是否运行: `curl http://localhost:8000/health`
2. 检查CORS配置
3. 查看浏览器控制台错误信息
