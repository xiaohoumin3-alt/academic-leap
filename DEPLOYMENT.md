# 学力跃迁 - 部署指南

## 部署选项

### 选项1: Vercel (推荐)

1. **准备数据库**
   - 在Vercel项目中添加 [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
   - 或使用 [Supabase](https://supabase.com/) / [Neon](https://neon.tech)

2. **配置环境变量**
   ```
   DATABASE_URL=你的数据库连接字符串
   NEXTAUTH_URL=https://你的域名.vercel.app
   NEXTAUTH_SECRET=生成的密钥
   GEMINI_API_KEY=你的Gemini API密钥
   APP_URL=https://你的域名.vercel.app
   ```

3. **部署**
   ```bash
   vercel deploy
   ```

4. **运行数据库迁移**
   ```bash
   vercel env pull .env.local
   npx prisma migrate deploy
   ```

### 选项2: Docker 自托管

1. **启动服务**
   ```bash
   docker-compose up -d
   ```

2. **运行数据库迁移**
   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```

3. **访问应用**
   ```
   http://localhost:3000
   ```

### 选项3: VPS 自托管

1. **安装依赖**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install -y nodejs npm postgresql

   # 安装 pnpm
   npm install -g pnpm
   ```

2. **配置数据库**
   ```bash
   sudo -u postgres createdb academic_leap
   sudo -u postgres createuser academic_leap
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件
   ```

4. **安装依赖并构建**
   ```bash
   pnpm install
   pnpm build
   ```

5. **运行迁移**
   ```bash
   npx prisma migrate deploy
   ```

6. **启动应用**
   ```bash
   pnpm start
   ```

7. **使用 PM2 守护进程**
   ```bash
   npm install -g pm2
   pm2 start npm --name "academic-leap" -- start
   pm2 save
   pm2 startup
   ```

## 环境变量说明

| 变量 | 说明 | 必需 |
|------|------|------|
| DATABASE_URL | PostgreSQL连接字符串 | 是 |
| NEXTAUTH_URL | 应用URL | 是 |
| NEXTAUTH_SECRET | 认证密钥 | 是 |
| GEMINI_API_KEY | Google Gemini API密钥 | 是 |
| APP_URL | 应用URL | 是 |

## 数据库迁移

```bash
# 开发环境
npx prisma migrate dev

# 生产环境
npx prisma migrate deploy

# 重置数据库（危险操作）
npx prisma migrate reset
```

## 健康检查

部署后检查：
- [ ] 首页可访问
- [ ] API端点响应正常
- [ ] 数据库连接成功
- [ ] Gemini API可用
