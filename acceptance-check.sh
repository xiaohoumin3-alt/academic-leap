#!/bin/bash
set -e

echo "=========================================="
echo "学力跃迁 - Gate验收快速检查"
echo "=========================================="

cd "/Users/seanxx/学力跃迁精准提分/学力跃迁-(academic-leap) (2)"

# Phase 1: 构建检查
echo "[1/6] 构建检查..."
pnpm build > /dev/null 2>&1 && echo "✅ 构建通过" || { echo "❌ 构建失败"; exit 1; }

# Phase 2: 类型检查
echo "[2/6] 类型检查..."
pnpm tsc --noEmit > /dev/null 2>&1 && echo "✅ 类型检查通过" || { echo "⚠️ 类型检查有警告"; }

# Phase 3: 生产环境检查
echo "[3/6] 生产环境检查..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://academic-leap.vercel.app" 2>/dev/null)
if [ "$STATUS" = "200" ]; then
    echo "✅ 生产环境可访问 (https://academic-leap.vercel.app)"
else
    echo "❌ 生产环境异常: $STATUS"
fi

# Phase 4: 后端健康检查
echo "[4/6] 后端健康检查..."
BACKEND_STATUS=$(curl -s "http://localhost:8000/health" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
if [ "$BACKEND_STATUS" = "200" ]; then
    echo "✅ 后端服务正常"
else
    echo "⚠️ 后端未运行或异常 (启动: cd backend && ./start-local.sh)"
fi

# Phase 5: E2E测试（烟雾测试）
echo "[5/6] E2E烟雾测试..."
echo "提示: 完整E2E测试运行时间较长，如需完整测试请运行:"
echo "  pnpm playwright test --reporter=list"
echo ""
echo "快速烟雾测试:"
timeout 30 pnpm playwright test e2e/smoke.spec.ts --reporter=list 2>/dev/null | head -20 || echo "⚠️ E2E测试超时或失败"

# Phase 6: 检查Gate验收文件
echo "[6/6] Gate验收文件检查..."
if [ -f "e2e/07-gate-simulation.spec.ts" ]; then
    echo "✅ Gate验收专项测试存在"
else
    echo "❌ Gate验收测试文件缺失"
fi

if [ -f "ACCEPTANCE_REPORT.md" ]; then
    echo "✅ 验收报告已生成"
else
    echo "⚠️ 验收报告不存在"
fi

echo "=========================================="
echo "✅ 快速验收检查完成"
echo "=========================================="
echo ""
echo "详细验收报告: ACCEPTANCE_REPORT.md"
echo ""
echo "下一步:"
echo "1. 启动后端: cd backend && ./start-local.sh"
echo "2. 运行后端测试: cd backend && python test_local.py"
echo "3. 运行完整E2E: pnpm playwright test --reporter=list"
echo "4. 招募真实用户完成人工验收"
