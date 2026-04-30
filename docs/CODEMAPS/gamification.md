# 游戏化系统架构图 (Gamification System Architecture)

**Last Updated:** 2026-04-30
**Entry Points:** app/api/gaming/route.ts

## 游戏化系统架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                         用户触发事件                               │
│                 (练习完成/成就解锁/排行榜更新)                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                   游戏化事件监听器                                │
│                lib/gaming/event-listener.ts                       │
│                     (观察者模式)                                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    游戏化核心处理器                                │
│                    - 属性更新                                      │
│                    - 成就检测                                      │
│                    - 排行榜计算                                    │
│                    - 家长控制                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
   ┌─────────────────────────┼─────────────────────────┐
   │                         │                         │
┌───▼─────┐           ┌────▼─────┐            ┌────▼─────┐
│属性更新  │           │ 成就系统  │            │排行榜服务 │
│module   │           │module   │            │module   │
└───┬─────┘           └────┬─────┘            └────┬─────┘
   │                      │                       │
   └────────┬─────────────┘                       └────┬─────────────┘
            │                                      │
            ▼                                      ▼
┌─────────────────────┐                    ┌─────────────────────┐
│  数据持久层         │                    │    Redis 缓存      │
│  - PlayerProfile    │                    │    - Top N 玩家    │
│  - Streak           │                    │    - 排行榜更新    │
│  - Achievement      │                    │    - 成就缓存      │
└─────────────────────┘                    └─────────────────────┘
```

## API 路由 (API Routes)

### 核心游戏化API

| 路由 | 方法 | 功能 | 请求示例 | 响应示例 |
|------|------|------|----------|----------|
| `/api/gaming` | POST | 处理游戏化事件 | `{ "event": "practice_completed", "eventId": "123", "data": {...} }` | `{ "success": true, "player": {...} }` |
| `/api/gaming` | PATCH | 批量更新属性 | `{ "updates": [{ "field": "experience", "value": 100 }] }` | `{ "success": true }` |
| `/api/gaming/leaderboard` | GET | 获取排行榜 | `?limit=10&type=daily` | `[{ "rank": 1, "player": "user1", "score": 1000 }]` |
| `/api/gaming/achievements` | POST | 成就追踪 | `{ "achievementId": "first_win", "eventId": "123" }` | `{ "unlocked": true }` |
| `/api/gaming/parental/settings` | PATCH | 更新家长设置 | `{ "dailyLimit": 30, "showRanking": false }` | `{ "success": true }` |
| `/api/gaming/parental/trend` | GET | 学习趋势 | `?userId=user1&period=week` | `{"date": "2026-04-30", "score": 850}` |
| `/api/gaming/parental/report` | GET | 家长报告 | `?userId=user1&period=week` | `{"totalScore": 5600, "achievements": 5}` |
| `/api/gaming/monitoring/health` | GET | 健康监控 | - | `{"status": "healthy", "events_processed": 1000}` |
| `/api/gaming/monitoring/noise` | GET | 噪音监测 | `?date=2026-04-30` | `{"errors": 2, "total": 100}` |
| `/api/gaming/monitoring/experiment` | GET | 实验状态 | `?exp_id=daily_bonus` | `{"active": true, "conversion": 0.15}` |

### API 响应格式

```typescript
// 成功响应
{
  "success": true,
  "data": {
    "player": {
      "level": 5,
      "experience": 1000,
      "streak": 3
    },
    "achievements": ["first_win", "perfect_streak"],
    "rank": 10
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "PLAYER_NOT_FOUND",
    "message": "用户未找到"
  }
}
```

## 核心库文件 (Core Libraries)

### 事件监听器 (Event Listener)

```typescript
// lib/gaming/event-listener.ts
class GamingEventListener {
  // 注册事件处理器
  register(eventType: string, handler: EventHandler)
  
  // 处理游戏化事件
  processEvent(event: GamingEvent): Promise<GamingResult>
  
  // 批量处理事件
  batchProcess(events: GamingEvent[]): Promise<GamingResult[]>
}
```

**主要事件类型:**
- `practice_completed` - 练习完成
- `achievement_unlocked` - 成就解锁
- `level_up` - 升级
- `streak_broken` - 连续中断
- `perfect_session` - 完美会话

### 排行榜服务 (Leaderboard)

```typescript
// lib/gaming/leaderboard.ts
class LeaderboardService {
  // 更新排行榜
  updateRankings(playerId: string, score: number): Promise<void>
  
  // 获取排行榜
  getRankings(type: 'daily' | 'weekly' | 'alltime', limit: number): Promise<LeaderboardEntry[]>
  
  // 清除缓存
  clearCache(): Promise<void>
}
```

**排行榜类型:**
- **每日榜** - 重置时间为每天 00:00
- **每周榜** - 重置时间为每周一 00:00
- **总榜** - 不重置，永久保存

### 成就系统 (Achievements)

```typescript
// lib/gaming/achievements.ts
class AchievementSystem {
  // 检查成就
  checkAchievements(event: GamingEvent): Promise<Achievement[]>
  
  // 解锁成就
  unlockAchievement(playerId: string, achievementId: string): Promise<void>
  
  // 获取用户成就
  getPlayerAchievements(playerId: string): Promise<Achievement[]>
}
```

**成就分类:**
- **学习成就** - 基于学习效果
- **坚持成就** - 基于连续学习
- **精度成就** - 基于答题准确率
- **探索成就** - 基于知识点覆盖

### 家长控制 (Parental Control)

```typescript
// lib/gaming/parental-control.ts
class ParentalControlService {
  // 检查时间限制
  checkTimeLimit(userId: string): Promise<boolean>
  
  // 检查每日限额
  checkDailyLimit(userId: string): Promise<boolean>
  
  // 更新设置
  updateSettings(userId: string, settings: ParentalSettings): Promise<void>
  
  // 获取使用报告
  generateReport(userId: string, period: string): Promise<ParentalReport>
}
```

**控制功能:**
- **每日时长限制** - 防止过度学习
- **每日题目限额** - 控制学习量
- **排行榜显示** - 隐私保护
- **时间段限制** - 学习时间管理

### 实验系统 (Experiments)

```typescript
// lib/gaming/experiments.ts
class ExperimentSystem {
  // 记录实验事件
  record(userId: string, experimentId: string, variant: string): Promise<void>
  
  // 获取实验状态
  getExperimentStatus(experimentId: string): Promise<ExperimentStatus>
  
  // 计算转化率
  calculateConversion(experimentId: string): Promise<number>
}
```

**A/B测试:**
- **每日奖励** - 不同奖励金额效果对比
- **成就通知** - 通知方式效果对比
- **排行榜显示** - 显示方式效果对比

### 监控系统 (Monitoring)

```typescript
// lib/gaming/monitoring.ts
class GamingMonitor {
  // 记录处理事件
  recordEvent(event: string, success: boolean, duration?: number): void
  
  // 检查系统健康
  checkHealth(): Promise<HealthStatus>
  
  // 获取统计信息
  getStats(): Promise<MonitoringStats>
}
```

**监控指标:**
- **事件处理成功率**
- **平均处理时间**
- **错误率**
- **并发处理量**

### 死信队列 (Dead Letter Queue)

```typescript
// lib/gaming/dead-letter-queue.ts
class DeadLetterQueue {
  // 记录失败事件
  recordFailed(event: GamingEvent, error: Error): Promise<void>
  
  // 重试失败事件
  retryFailedEvents(): Promise<void>
  
  // 获取统计
  getStats(): Promise<DeadLetterStats>
}
```

**DFI 保证:**
- 失败事件自动记录
- 定期重试机制
- 完整错误追踪

## 数据模型 (Data Models)

### PlayerProfile

```typescript
// 玩家档案
{
  id: string           // 用户ID
  level: number        // 当前等级
  experience: number   // 当前经验值
  totalScore: number   // 总分
  rank: number         // 当前排名
  lastActive: Date     // 最后活跃时间
}
```

### Streak

```typescript
// 连续学习记录
{
  id: string          // 记录ID
  userId: string      // 用户ID
  streakCount: number // 连续天数
  lastDate: Date      // 最后日期
  maxStreak: number   // 最大连续天数
}
```

### Achievement

```typescript
// 成就记录
{
  id: string              // 记录ID
  userId: string          // 用户ID
  achievementId: string   // 成就ID
  unlockedAt: Date         // 解锁时间
  metadata?: object        // 元数据
}
```

### GamificationFailure

```typescript
// 死信队列记录
{
  id: string       // 记录ID
  eventId: string  // 事件ID
  failedAt: Date   // 失败时间
  error: string    // 错误信息
  retries: number  // 重试次数
}
```

## 设计原则 (Design Principles)

### 1. DFI (Data Flow Integrity) >= 0.99

- 每个游戏化事件必须有唯一 eventId
- 失败事件进入死信队列
- 支持事件重试机制

### 2. 观察者模式

- 游戏化系统作为观察者监听学习事件
- 不阻塞主学习流程
- 异步处理提高性能

### 3. 学习有效性导向

- 基于系统 LE > 15% 的成就奖励
- 奖励与学习效果正相关
- 鼓励深度学习

### 4. 家长控制优先

- 安全第一，防护过度使用
- 可配置的限额和限制
- 透明的使用报告

## 性能优化 (Performance)

### 缓存策略

```typescript
// Redis 缓存设计
CACHE_KEYS = {
  LEADERBOARD_DAILY: 'leaderboard:daily',
  LEADERBOARD_WEEKLY: 'leaderboard:weekly',
  PLAYER_PROFILE: 'player:{userId}',
  ACHIEVEMENTS: 'achievements:{userId}',
  EXPERIMENT_VARIANTS: 'experiments:variants'
}
```

### 批量处理

- 事件批量处理减少数据库压力
- 排行榜批量更新
- 定时任务处理非实时数据

### 异步处理

- 所有游戏化事件异步处理
- 使用队列机制避免阻塞
- 错误隔离不影响主流程

## 监控与告警 (Monitoring & Alerts)

### 关键指标

| 指标 | 目标值 | 告警阈值 |
|------|--------|----------|
| **事件处理成功率** | > 99% | < 95% |
| **平均处理时间** | < 100ms | > 500ms |
| **死信队列大小** | 0 | > 10 |
| **并发处理量** | 100 | > 500 |

### 告警规则

```yaml
alerts:
  - name: "事件处理失败率过高"
    condition: "error_rate > 0.05"
    duration: "5m"
    action: "send_alert"
    
  - name: "死信队列积压"
    condition: "dead_letter_count > 10"
    duration: "1m"
    action: "alert_admin"
```

## 扩展设计 (Extension Design)

### 未来功能

1. **社交功能**
   - 好友排行榜
   - 学习小组
   - 团队挑战

2. **个性化游戏化**
   - 基于学习风格的游戏元素
   - 自定义奖励系统
   - 动态难度调整

3. **高级分析**
   - 学习模式分析
   - 兴趣追踪
   - 预测性奖励

---

**Note**: 此文档应与实际代码保持同步，确保架构设计的一致性。