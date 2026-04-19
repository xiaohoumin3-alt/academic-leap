# Supabase 设置指南

## 1. 注册 Supabase

访问 https://supabase.com 注册免费账户

## 2. 创建项目

1. 点击 "New Project"
2. 配置:
   - Name: `academic-leap` (或任意)
   - Database Password: 设置强密码并保存
   - Region: 选择最近的区域
3. 等待项目创建完成 (~2分钟)

## 3. 获取数据库连接字符串

1. 进入项目 → Settings → Database
2. 找到 "Connection string" → 选择 "URI" tab
3. 复制连接字符串，格式:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

## 4. 运行数据库迁移

```bash
# 设置生产数据库 URL
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@..."

# 生成 Prisma Client
pnpm prisma generate

# 推送 schema 到数据库
pnpm prisma db push
```

## 5. 获取项目 URL (可选)

用于客户端直连 (如需要):

Settings → API → Project URL
```
https://[PROJECT-REF].supabase.co
```

## 环境变量

添加到 Vercel 项目环境变量:

```bash
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres"
NEXTAUTH_SECRET="[生产密钥]"
NEXTAUTH_URL="https://your-app.vercel.app"
GEMINI_API_KEY="[已有]"
```
