#!/bin/bash

# 学力跃迁项目部署脚本
# 用于部署到 Vercel + Supabase

set -e

echo "🚀 学力跃迁项目部署脚本"
echo "================================"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查必要的环境变量
check_env() {
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}❌ 错误: DATABASE_URL 环境变量未设置${NC}"
        echo -e "${YELLOW}   请先设置 Supabase PostgreSQL 连接字符串${NC}"
        echo ""
        echo "   步骤:"
        echo "   1. 访问 https://supabase.com 注册并创建项目"
        echo "   2. 复制数据库连接字符串"
        echo "   3. 运行: export DATABASE_URL=\"postgresql://...\""
        echo ""
        echo "   参考文档: docs/SUPABASE_SETUP.md"
        exit 1
    fi

    if [ -z "$NEXTAUTH_SECRET" ]; then
        echo -e "${YELLOW}⚠️  警告: NEXTAUTH_SECRET 环境变量未设置${NC}"
        echo "   正在生成..."
        export NEXTAUTH_SECRET=$(openssl rand -base64 32)
        echo -e "${GREEN}✓ NEXTAUTH_SECRET=$NEXTAUTH_SECRET${NC}"
    fi

    if [ -z "$GEMINI_API_KEY" ]; then
        echo -e "${RED}❌ 错误: GEMINI_API_KEY 环境变量未设置${NC}"
        exit 1
    fi
}

# 验证数据库连接
verify_database() {
    echo ""
    echo "📊 验证数据库连接..."

    if PGPASSWORD=$(echo $DATABASE_URL | grep -oP 'postgres://postgres:\K[^@]+') psql -h $(echo $DATABASE_URL | grep -oP '@\K[^:]+') -U postgres -d postgres -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 数据库连接成功${NC}"
    else
        echo -e "${YELLOW}⚠️  无法直接验证数据库连接 (可能需要安装 psql)${NC}"
        echo "   继续部署..."
    fi
}

# 运行数据库迁移
run_migrations() {
    echo ""
    echo "📊 运行数据库迁移..."
    pnpm prisma generate
    pnpm prisma db push --skip-generate
    echo -e "${GREEN}✅ 数据库迁移完成${NC}"
}

# 部署到 Vercel
deploy_vercel() {
    echo ""
    echo "🌐 部署到 Vercel..."

    # 检查是否已链接 Vercel
    if [ ! -f ".vercel/project.json" ]; then
        echo "📦 链接 Vercel 项目..."
        npx vercel link
    fi

    # 设置环境变量
    echo "🔧 配置环境变量..."
    npx vercel env add DATABASE_URL production <<EOF
$DATABASE_URL
EOF

    npx vercel env add NEXTAUTH_SECRET production <<EOF
$NEXTAUTH_SECRET
EOF

    npx vercel env add NEXTAUTH_URL production <<EOF
$(npx vercel ls --scope $(vercel whoami | head -1) 2>/dev/null | grep -oP 'https://[^\s]+' | head -1 || echo "https://academic-leap.vercel.app")
EOF

    npx vercel env add GEMINI_API_KEY production <<EOF
$GEMINI_API_KEY
EOF

    # 部署
    npx vercel --prod

    echo -e "${GREEN}✅ 部署完成${NC}"
}

# 获取部署 URL
get_deploy_url() {
    if [ -f ".vercel/project.json" ]; then
        PROD_URL=$(jq -r '.prodUrl' .vercel/project.json 2>/dev/null || echo "")
        if [ -n "$PROD_URL" ]; then
            echo ""
            echo -e "${GREEN}🌍 部署 URL: $PROD_URL${NC}"
            echo "   NEXTAUTH_URL=$PROD_URL"
        fi
    fi
}

# 创建测试用户提示
create_test_user_hint() {
    echo ""
    echo "📝 下一步：创建测试用户"
    echo "   1. 访问部署的应用并注册账户"
    echo "   2. 运行以下命令生成认证状态："
    echo ""
    echo "   BASE_URL=https://your-app.vercel.app \\"
    echo "   TEST_USER_EMAIL=test@example.com \\"
    echo "   TEST_USER_PASSWORD=your_password \\"
    echo "   npx tsx e2e/utils/auth-setup.ts"
    echo ""
}

# 主流程
main() {
    check_env
    verify_database
    run_migrations
    deploy_vercel
    get_deploy_url
    create_test_user_hint
}

# 运行主流程
main "$@"
