# E2E 测试设置指南

## 首次设置

### 1. 配置测试环境

复制 `.env.test` 为 `.env.test.local` 并填入实际值:

```bash
cp .env.test .env.test.local
```

编辑 `.env.test.local`:
```bash
BASE_URL=https://your-app.vercel.app  # 部署的应用 URL
TEST_USER_EMAIL=test@example.com       # 测试用户邮箱
TEST_USER_PASSWORD=your_password       # 测试用户密码
```

### 2. 生成认证状态

运行认证脚本生成登录状态:

```bash
# 加载环境变量并运行
source .env.test.local && npx tsx e2e/utils/auth-setup.ts
```

或直接使用环境变量:
```bash
BASE_URL=https://your-app.vercel.app \
TEST_USER_EMAIL=test@example.com \
TEST_USER_PASSWORD=your_password \
npx tsx e2e/utils/auth-setup.ts
```

脚本会:
1. 打开浏览器访问登录页面
2. 自动填写测试账户信息
3. 提交登录表单
4. 保存登录状态到 `e2e/storage-state.json`

### 3. 运行测试

```bash
# 使用部署环境测试
pnpm playwright test

# 或指定环境变量
BASE_URL=https://your-app.vercel.app pnpm playwright test
```

## 本地开发测试

如果要在本地开发环境测试:

```bash
# 1. 启动开发服务器
pnpm dev

# 2. 在另一个终端生成认证状态 (使用 localhost)
BASE_URL=http://localhost:3000 \
TEST_USER_EMAIL=test@example.com \
TEST_USER_PASSWORD=your_password \
npx tsx e2e/utils/auth-setup.ts

# 3. 运行测试
pnpm playwright test
```

## 常见问题

### Q: 测试失败显示 "未登录"
A: 重新运行 `auth-setup.ts` 生成新的认证状态

### Q: 如何创建测试用户?
A:
- 方法1: 在应用中手动注册
- 方法2: 通过数据库直接创建用户记录

### Q: storage-state.json 要提交到 Git 吗?
A: 不要! 将其添加到 `.gitignore`

## 更新测试

修改测试后:
```bash
# 运行特定测试文件
pnpm playwright test e2e/01-home-page.spec.ts

# 查看测试报告
pnpm playwright show-report
```
