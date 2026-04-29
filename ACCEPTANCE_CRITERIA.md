# 学力跃迁 - 验收标准 (Acceptance Criteria)

## 版本: v1.0
**目标**: 生产级可用，真实用户可使用

> **产品目标来源**: 本验收标准验证 [PRODUCT.md](./PRODUCT.md) 中定义的产品目标是否达成。
> 核心KPI: LE (学习能力提升) > 15%, CS (收敛稳定性) > 85%, DFI (数据完整度) > 99%

---

## 一、功能验收标准 (Functional Acceptance)

### 1.1 用户认证 (MUST)

| 验收项 | 测试方法 | 预期结果 |
|--------|----------|----------|
| 用户注册 | POST /api/auth/register | 返回用户ID，数据库创建记录 |
| 登录状态 | GET /api/auth/session | 返回当前用户信息或null |
| 退出登录 | POST /api/auth/signout | 清除会话，重定向到首页 |
| 无密码无法登录 | 尝试错误密码登录 | 返回401错误 |

**测试命令**:
```bash
# 注册测试
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","grade":8}'

# 验证数据库
psql $DATABASE_URL -c "SELECT * FROM \"User\" WHERE email='test@example.com'"
```

### 1.2 题目系统 (MUST)

| 验收项 | 测试方法 | 预期结果 |
|--------|----------|----------|
| AI生成题目 | POST /api/questions/generate | 返回有效题目JSON，包含steps |
| 题目结构正确 | 检查返回的question | 包含id, type, difficulty, content, answer, steps |
| 难度分级 | 生成difficulty=1和5的题目 | L1题目简单，L5题目复杂 |
| 知识点覆盖 | 生成不同knowledgePoint | 返回对应知识点题目 |

**测试命令**:
```bash
curl -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{"type":"calculation","difficulty":2,"knowledgePoint":"一元一次方程","count":1}'
```

### 1.3 练习流程 (MUST)

| 验收项 | 测试方法 | 预期结果 |
|--------|----------|----------|
| 开始练习 | POST /api/practice/start | 返回attemptId |
| 提交答案 | POST /api/practice/submit | 保存到AttemptStep表 |
| 完成练习 | POST /api/practice/finish | 更新Attempt.score和completedAt |
| 练习历史 | GET /api/practice/history | 返回用户所有练习记录 |

### 1.4 AI批改 (MUST)

| 验收项 | 测试方法 | 预期结果 |
|--------|----------|----------|
| 正确答案识别 | 提交正确答案 | isCorrect=true |
| 错误答案识别 | 提交错误答案 | isCorrect=false，包含反馈 |
| 部分正确 | 提交中间步骤 | 返回有意义的反馈 |
| 超时处理 | duration>300000ms | 仍然返回结果 |

### 1.5 自适应难度 (MUST)

| 验收项 | 测试方法 | 预期结果 |
|--------|----------|----------|
| 连续3题正确 | 连续提交3个正确答案 | 难度+1，显示提升通知 |
| 连续2题错误 | 连续提交2个错误答案 | 难度-1，显示降低通知 |
| 行为标签 | 答题时间<5s正确 | 显示"秒解"标签 |
| 难度边界 | 难度=1时答错2题 | 保持难度1，不再降低 |

### 1.6 学习分析 (MUST)

| 验收项 | 测试方法 | 预期结果 |
|--------|----------|----------|
| 概览数据 | GET /api/analytics/overview | 返回totalAttempts, averageScore等 |
| 知识点掌握 | GET /api/analytics/knowledge | 返回每个知识点的mastery |
| 时间线数据 | GET /api/analytics/timeline?days=7 | 返回7天数据 |
| AI建议 | GET /api/analytics/recommendations | 返回recommendations数组 |

### 1.7 手写OCR (SHOULD)

| 验收项 | 测试方法 | 预期结果 |
|--------|----------|----------|
| 图片上传 | POST /api/ocr/recognize + base64图片 | 返回识别文本 |
| 数学公式提取 | 上传包含公式的图片 | expressions数组非空 |
| 置信度 | 检查返回的confidence | 0-1之间的数值 |

---

## 二、性能验收标准 (Performance Acceptance)

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| 首页加载 | < 2s | Lighthouse LCP |
| API响应时间 | P95 < 500ms | API日志统计 |
| AI生成题目 | < 10s | 计时POST /api/questions/generate |
| 数据库查询 | < 100ms | Prisma日志 |
| 首屏JS大小 | < 200KB | Next.js build output |

**测试命令**:
```bash
# 构建分析
pnpm build

# 检查bundle大小
ls -lh .next/static/chunks/

# Lighthouse测试
npx lighthouse http://localhost:3000 --view
```

---

## 三、安全验收标准 (Security Acceptance)

### 3.1 认证安全 (MUST)

| 验收项 | 测试方法 | 预期结果 |
|--------|----------|----------|
| 密码不为明文 | 检查数据库 | password字段是hash |
| SQL注入防护 | 输入恶意SQL | 返回400或404，不崩溃 |
| XSS防护 | 输入`<script>alert(1)</script>` | 被转义，不执行 |
| CSRF防护 | 检查API | 使用NextAuth的CSRF保护 |

### 3.2 数据安全 (MUST)

| 验收项 | 测试方法 | 预期结果 |
|--------|----------|----------|
| 环境变量隔离 | 检查构建输出 | .env文件不被打包 |
| API密钥保护 | 检查客户端代码 | GEMINI_API_KEY不在客户端 |
| 用户数据隔离 | 用户A查询用户B数据 | 返回403或空数据 |

**测试命令**:
```bash
# 检查密钥泄露
grep -r "GEMINI_API_KEY" .next/static
# 应该返回空

# 检查环境变量
cat .env
# 不应该出现在git历史中
```

---

## 四、代码质量标准 (Code Quality Acceptance)

### 4.1 测试覆盖率 (SHOULD)

| 类型 | 目标覆盖率 |
|------|-----------|
| API路由 | 80% |
| 工具函数 | 90% |
| 组件 | 60% |
| E2E测试 | 覆盖主流程 |

**测试命令**:
```bash
# 单元测试
pnpm test

# E2E测试
pnpm test:e2e

# 覆盖率报告
pnpm test -- --coverage
```

### 4.2 类型安全 (MUST)

| 验收项 | 标准 |
|--------|------|
| TypeScript | 无`any`类型（除已知位置） |
| 严格模式 | strict: true |
| 构建检查 | tsc --noEmit 通过 |

### 4.3 代码规范 (SHOULD)

| 验收项 | 标准 |
|--------|------|
| ESLint | 0 errors, < 10 warnings |
| Prettier | 所有文件格式化 |
| 文件大小 | 单文件 < 500行 |

---

## 五、部署验收标准 (Deployment Acceptance)

### 5.1 本地开发 (MUST)

| 验收项 | 命令 | 预期结果 |
|--------|------|----------|
| 依赖安装 | pnpm install | 无错误 |
| 数据库迁移 | npx prisma migrate dev | 表创建成功 |
| 启动开发服务器 | pnpm dev | http://localhost:3000 可访问 |
| 热重载 | 修改文件 | 浏览器自动刷新 |

### 5.2 生产构建 (MUST)

| 验收项 | 命令 | 预期结果 |
|--------|------|----------|
| 构建 | pnpm build | 无错误，生成.next |
| 生产启动 | pnpm start | 应用正常运行 |
| 环境变量 | 检查 | 所有必需变量已设置 |

### 5.3 Docker部署 (SHOULD)

| 验收项 | 命令 | 预期结果 |
|--------|------|----------|
| 构建镜像 | docker-compose build | 无错误 |
| 启动服务 | docker-compose up -d | 容器运行 |
| 健康检查 | docker ps | 所有容器healthy |

---

## 六、E2E测试场景 (End-to-End Scenarios)

### 场景1: 新用户注册到首次练习

1. 访问首页 → 看到"开始今日训练"按钮
2. 点击"开始今日训练" → 跳转到练习页面
3. 系统生成题目 → 显示题目内容
4. 输入答案提交 → 显示正确/错误反馈
5. 完成所有步骤 → 显示成绩总结
6. 返回首页 → 分数已更新

### 场景2: 自适应难度调整

1. 开始练习(难度=2)
2. 连续答对3题 → 看到难度提升通知
3. 下一题难度=3 → 题目更复杂
4. 连续答错2题 → 看到难度降低通知
5. 下一题难度=2 → 题目变简单

### 场景3: 查看学习分析

1. 完成至少3次练习
2. 点击"学情解构" → 跳转到分析页面
3. 查看知识点掌握 → 显示各知识点掌握度
4. 查看本周趋势 → 显示练习曲线
5. 查看AI建议 → 显示个性化建议

---

## 七、验收检查清单

### 发布前必须检查 (MUST)

- [ ] 所有API端点响应正常
- [ ] 数据库迁移成功执行
- [ ] Gemini API密钥有效且额度充足
- [ ] 生产环境变量已配置
- [ ] 构建无错误无警告
- [ ] 主流程E2E测试通过
- [ ] 无已知严重bug
- [ ] 错误边界能捕获异常

### 发布前建议检查 (SHOULD)

- [ ] 测试覆盖率 > 70%
- [ ] Lighthouse分数 > 80
- [ ] 所有页面响应式适配
- [ ] 无console错误或警告
- [ ] 代码已review
- [ ] 文档已更新

---

## 八、不通过标准 (Failure Criteria)

以下任何一项存在即**不通过**验收：

1. **Critical**: 应用无法启动
2. **Critical**: 核心API返回500错误
3. **Critical**: 数据库连接失败
4. **Critical**: 用户数据丢失
5. **Critical**: 安全漏洞（SQL注入、XSS等）
6. **High**: AI功能完全不工作
7. **High**: 构建失败
8. **High**: 类型错误 > 10个

---

## 九、验收流程

```
1. 开发自测
   ↓
2. 运行测试套件 (pnpm test)
   ↓
3. 本地E2E测试 (pnpm test:e2e)
   ↓
4. 性能测试 (Lighthouse)
   ↓
5. 安全扫描 (pnpm audit)
   ↓
6. 部署到Staging
   ↓
7. Staging环境验收测试
   ↓
8. 修复发现的问题
   ↓
9. 重新验收
   ↓
10. 部署到生产环境
```

---

## 附录：快速验收脚本

```bash
#!/bin/bash
# quick-acceptance.sh

echo "🚀 开始快速验收..."

# 1. 类型检查
echo "📝 类型检查..."
pnpm tsc --noEmit || exit 1

# 2. 构建检查
echo "🏗️ 构建检查..."
pnpm build || exit 1

# 3. 单元测试
echo "🧪 单元测试..."
pnpm test || exit 1

# 4. E2E测试
echo "🎭 E2E测试..."
pnpm test:e2e || exit 1

# 5. 安全检查
echo "🔒 安全检查..."
pnpm audit || exit 1

echo "✅ 快速验收通过！"
```

使用方法：
```bash
chmod +x quick-acceptance.sh
./quick-acceptance.sh
```
