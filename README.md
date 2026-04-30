# 学力跃迁 (Academic Leap)

> 基于强化学习的自适应数学学习平台

## 📖 快速导航

| 文档 | 说明 |
|------|------|
| **[PRODUCT.md](./PRODUCT.md)** | 🎯 产品定义、目标、KPI、权衡原则 - **所有决策的源头** |
| [CLAUDE.md](./CLAUDE.md) | 开发规范、CI门禁、技术标准 |
| [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md) | 功能/性能/安全验收标准 |
| [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | 功能清单和技术栈 |

## 🎯 产品愿景

**让每个学生都能获得最适合自己当前能力的学习路径**

- 不是"更智能的题库"，而是能真正理解学生能力的自适应引擎
- 基于项目反应理论(IRT)量化学生能力
- 使用强化学习(Thompson Sampling)动态调整推荐策略

## 🚀 快速开始

### 前置要求

- Node.js 18+
- PostgreSQL 数据库

### 安装

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 设置 GEMINI_API_KEY 和 DATABASE_URL

# 数据库迁移
npx prisma migrate dev

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000

## 📊 核心指标

| 指标 | 目标 | 说明 |
|------|------|------|
| **LE** | > 15% | 学生能力提升幅度 (主KPI) |
| **CS** | > 85% | 推荐稳定性 |
| **DFI** | > 99% | 数据链完整度 |

详见 [PRODUCT.md#核心KPI](./PRODUCT.md#5-核心kpi-key-metrics)

## 🎮 游戏化系统

系统包含完整的游戏化激励机制，提升学习动力：

### 核心特性

- **等级与经验** - 练习获得经验，升级解锁新奖励
- **成就系统** - 基于学习效果的多维度成就（学习、坚持、精度、探索）
- **排行榜** - 每日/周/总榜竞争，激发学习热情
- **连续学习** - 连续打卡获得额外奖励
- **家长控制** - 可配置的每日限额、时间限制、隐私设置
- **A/B实验** - 持续优化激励机制效果

### API 端点

```bash
# 游戏化事件处理
POST /api/gaming
GET /api/gaming/leaderboard
POST /api/gaming/achievements

# 家长控制
PATCH /api/gaming/parental/settings
GET /api/gaming/parental/trend
GET /api/gaming/parental/report

# 监控
GET /api/gaming/monitoring/health
GET /api/gaming/monitoring/noise
GET /api/gaming/monitoring/experiment
```

详见 [docs/CODEMAPS/gamification.md](./docs/CODEMAPS/gamification.md)

## 🧪 测试

```bash
# 单元测试
npm test

# E2E测试
npm run test:e2e

# 收敛验证
npm run test:convergence

# 对抗式验证
npm run test:rl-adversarial

# 破坏性验证
npm run test:rl-destruction

# 游戏化系统测试
npm run test:gaming
npm run test:gaming-integration
```

## 📦 部署

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm run start
```

## 🏗️ 系统架构

### 核心组件

- **学习引擎** - 基于IRT和强化学习的自适应推荐
- **游戏化系统** - 完整的激励机制（等级、成就、排行榜）
- **健康监控** - RL系统健康状态监测与自动降级
- **数据完整性** - DFI ≥ 99% 的全链路追踪
- **家长控制** - 安全的使用限制和隐私保护

### 架构图与详情

详见 [docs/CODEMAPS/INDEX.md](./docs/CODEMAPS/INDEX.md)  
游戏化系统详情见 [docs/CODEMAPS/gamification.md](./docs/CODEMAPS/gamification.md)

## 🛠️ 技术栈

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **AI**: Google Gemini API
- **Database**: PostgreSQL (Supabase)
- **Auth**: NextAuth.js v5
- **Cache**: Redis (排行榜、缓存)
- **Monitoring**: 自定义健康监控系统

## 📝 许可证

MIT
