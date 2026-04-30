# 游戏化系统快速参考 (Gamification Quick Reference)

**Last Updated:** 2026-04-30

## 🚀 快速开始

### 核心API调用示例

#### 1. 处理游戏化事件

```bash
curl -X POST http://localhost:3000/api/gaming \
  -H "Content-Type: application/json" \
  -d '{
    "event": "practice_completed",
    "eventId": "evt_123456",
    "data": {
      "userId": "user_123",
      "accuracy": 0.95,
      "duration": 300,
      "problemCount": 10,
      "experience": 150
    }
  }'
```

#### 2. 获取排行榜

```bash
curl http://localhost:3000/api/gaming/leaderboard?limit=10&type=daily
```

#### 3. 更新家长设置

```bash
curl -X PATCH http://localhost:3000/api/gaming/parental/settings \
  -H "Content-Type: application/json" \
  -d '{
    "dailyMinutes": 60,
    "dailyProblems": 50,
    "showRanking": false
  }'
```

## 📊 核心概念

### 等级系统

- **等级计算**: 经验值达到 `BASE_LEVEL × EXP_MULTIPLIER^level`
- **升级奖励**: 解锁新功能和成就
- **最大等级**: 100级

### 经验值获得

| 条件 | 基础经验 | 加成比例 | 实际获得 |
|------|----------|----------|----------|
| 完成练习 | 50 | - | 50 |
| 100%准确率 | 50 | +100 | 150 |
| 3天连续 | 50 | +20% | 60 |
| 7天连续 | 50 | +50% | 75 |
| 成就解锁 | - | +200 | 200 |

### 成就类型

| 类型 | 示例 | 触发条件 |
|------|------|----------|
| 学习成就 | 初试牛刀 | 完成第一次练习 |
|  | 完美表现 | 连续5题全对 |
| 连续成就 | 三日连击 | 连续3天学习 |
|  | 月冠军 | 连续30天学习 |
| 精度成就 | 神枪手 | 单次100%准确率 |
|  | 稳定优秀 | 连续10次>90% |
| 探索成就 | 知识猎人 | 探索10个知识点 |
|  | 多元学习者 | 5个知识点熟练 |

### 排行榜类型

| 类型 | 重置频率 | 保存期限 |
|------|----------|----------|
| 每日榜 | 每天00:00 | 7天 |
| 周榜 | 每周一00:00 | 30天 |
| 总榜 | 不重置 | 永久 |

## 🛠️ 开发指南

### 1. 添加新成就

在 `lib/gaming/constants.ts` 中定义：

```typescript
export const ACHIEVEMENTS = {
  // ... 现有成就
  CUSTOM: {
    NEW_ACHIEVEMENT: {
      id: 'new_achievement',
      name: '新成就名称',
      description: '成就描述',
      points: 100,
      category: 'learning',
    },
  },
} as const;
```

### 2. 处理自定义事件

在 `lib/gaming/event-listener.ts` 中添加处理器：

```typescript
class GamingEventListener {
  register(eventType: string, handler: EventHandler) {
    // 注册事件处理器
    this.handlers.set(eventType, handler);
  }
  
  // 处理自定义事件
  async processCustomEvent(event: CustomEvent) {
    const handler = this.handlers.get(event.type);
    if (handler) {
      return await handler(event);
    }
  }
}
```

### 3. 监控系统健康

使用 `lib/gaming/monitoring/health`：

```typescript
import { HealthMonitor } from '@/lib/gaming/monitoring';

const monitor = new HealthMonitor();
const health = await monitor.check();

if (health.status === 'danger') {
  // 触发降级行动
  await handleDegradation();
}
```

## 🔧 配置参考

### 环境变量

```env
# 游戏化系统配置
GAMIFICATION_ENABLED=true
REDIS_URL=redis://localhost:6379

# 监控配置
MONITORING_ENABLED=true
HEALTH_CHECK_INTERVAL=60

# 实验配置
EXPERIMENTS_ENABLED=true
DAILY_BONUS_TEST=true
```

### 重要阈值

| 指标 | 目标值 | 警告值 | 严重值 |
|------|--------|--------|--------|
| **DFI** | > 99% | > 95% | > 90% |
| **LE** | > 15% | > 10% | > 5% |
| **CS** | > 85% | > 75% | > 60% |
| **错误率** | < 5% | < 10% | < 15% |
| **响应时间** | < 100ms | < 500ms | < 1000ms |

## 🚨 故障排查

### 常见错误

#### 1. 事件处理失败

**错误**: `PROCESSING_FAILED`
**原因**: Redis 连接失败或数据库错误
**解决**: 
```bash
# 检查 Redis 连接
redis-cli ping

# 检查数据库连接
npx prisma db seed
```

#### 2. 排行榜不更新

**问题**: 排行榜数据陈旧
**解决**: 
```bash
# 手动触发排行榜更新
curl -X POST http://localhost:3000/api/gaming/leaderboard/update
```

#### 3. 成就无法解锁

**问题**: 条件判断错误
**解决**: 
1. 检查事件数据是否完整
2. 验证成就条件逻辑
3. 查看 Dead Letter Queue 日志

### 性能优化

#### 1. 减少数据库查询

- 使用 Redis 缓存排行榜数据
- 批量处理更新操作
- 使用读写分离

#### 2. 提高并发处理

```typescript
// 调整并发配置
export const RATE_LIMIT_CONFIG = {
  EVENT_PROCESSING: {
    MAX_CONCURRENT: 200,  // 增加并发数
    BATCH_SIZE: 100,     // 增加批处理大小
  },
};
```

## 📈 监控指标

### 关键指标查询

```bash
# 查看系统健康状态
curl http://localhost:3000/api/gaming/monitoring/health

# 查看处理统计
curl http://localhost:3000/api/gaming/monitoring/stats

# 查看错误日志
curl http://localhost:3000/api/gaming/monitoring/errors
```

### 日志格式

```json
{
  "timestamp": "2026-04-30T10:00:00Z",
  "eventId": "evt_123456",
  "event": "practice_completed",
  "userId": "user_123",
  "status": "success",
  "duration": 45,
  "metadata": {
    "accuracy": 0.95,
    "experience": 150
  }
}
```

---

**Note**: 此文档提供快速参考，详细实现请查看对应的源代码文件。