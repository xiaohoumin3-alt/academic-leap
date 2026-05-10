# 反馈收集系统设计文档

**版本**: v1.0
**创建日期**: 2026-05-06
**状态**: MVP实现
**负责人**: Product Manager

---

## 1. 系统概述

### 1.1 目的

建立有效的用户反馈收集机制，收集功能建议、Bug报告、用户体验反馈和性能问题，为产品迭代提供数据支撑。

### 1.2 背景

根据 `PRODUCT.md` 定义的产品目标，我们需要持续收集用户（学生）反馈，确保产品迭代方向正确。Beta测试阶段需要系统化的反馈收集流程。

### 1.3 核心指标对齐

| 反馈类型 | 关联产品KPI | 优先级 |
|---------|-------------|--------|
| 功能建议 | LE（学习效果提升） | 高 |
| Bug报告 | CS（收敛稳定性） | 最高 |
| 用户体验 | 留存率、完课率 | 高 |
| 性能问题 | CS、DFI | 中 |

---

## 2. 反馈分类体系

### 2.1 四类反馈定义

#### 2.1.1 功能建议 (Feature Request)

**定义**: 用户希望产品增加的新功能或改进现有功能

**典型场景**:
- "希望能有错题本功能"
- "希望能查看历史学习记录"
- "希望能有语音读题功能"

**数据收集要点**:
- 功能描述
- 使用场景
- 期望效果
- 用户需求强度（1-5分）

#### 2.1.2 Bug报告 (Bug Report)

**定义**: 产品功能异常或不符合预期的情况

**典型场景**:
- "点击答案没有反应"
- "题目显示乱码"
- "答案正确但系统判定错误"

**数据收集要点**:
- 问题描述
- 复现步骤
- 环境信息（设备、版本）
- 截图/录屏
- 发生频率

#### 2.1.3 用户体验 (UX Feedback)

**定义**: 用户对产品使用过程中的感受和意见

**典型场景**:
- "界面太复杂，找不到在哪里提交答案"
- "题目做完后不知道下一步该做什么"
- "鼓励不够，做对了也没成就感"

**数据收集要点**:
- 具体感受
- 遇到困难的地方
- 改进建议
- NPS评分（0-10）

#### 2.1.4 性能问题 (Performance Issue)

**定义**: 产品运行时的性能、稳定性问题

**典型场景**:
- "加载很慢，要等好几秒"
- "做题的时候页面卡顿"
- "页面经常白屏"

**数据收集要点**:
- 问题现象
- 网络环境
- 设备信息
- 时间戳

---

## 3. 反馈收集机制

### 3.1 MVP方案：应用内反馈表单 + 微信群收集

我们采用「方案 A」的简化实现，确保快速上线并能收集有效数据。

#### 3.1.1 数据流向

```
用户提交反馈
    ↓
应用内表单（截图+描述）
    ↓
存储到 Supabase
    ↓
每日汇总报告生成
    ↓
优先级分类 + 分配处理
```

#### 3.1.2 反馈表单字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | select | 是 | 功能建议/Bug报告/用户体验/性能问题 |
| title | text | 是 | 简洁描述（50字以内） |
| description | textarea | 是 | 详细描述 |
| screenshot | file | 否 | 截图（最多3张） |
| contact | text | 否 | 联系方式（微信/邮箱） |
| user_id | auto | 是 | 匿名用户ID |
| timestamp | auto | 是 | 提交时间 |
| page_url | auto | 是 | 发生问题的页面 |

---

## 4. 反馈模板

### 4.1 反馈表单模板 (docs/kr2-beta-materials/feedback-form.md)

详细模板内容见附件：`docs/kr2-beta-materials/feedback-form.md`

### 4.2 Bug报告模板

```
## Bug报告

### 基本信息
- 反馈类型: Bug报告
- 提交时间: [自动记录]
- 用户ID: [自动记录]

### 问题描述
[请详细描述遇到的问题]

### 复现步骤
1. [第一步]
2. [第二步]
3. [第三步]

### 期望行为
[您期望应该是什么样的]

### 实际行为
[实际发生了什么]

### 环境信息
- 设备: [手机型号]
- 系统: [iOS/Android]
- App版本: [版本号]
- 网络环境: [WiFi/4G/5G]

### 截图/录屏
[如有截图请上传]
```

### 4.3 用户访谈问题清单

```
## 用户访谈问题清单

### 开场（5分钟）
1. 请简单介绍一下您自己（年级、使用时长）
2. 您通常在什么场景下使用这个App？

### 核心体验（20分钟）
3. 您最近一次使用App是做什么？感觉怎么样？
4. 有什么功能让您觉得特别好用？
5. 有什么功能让您感到困惑或不便？

### 深入探索（10分钟）
6. 如果让您提一个改进建议，您会说什么？
7. 您有没有向朋友推荐过这个App？为什么/为什么不？

### 结束（5分钟）
8. 您对这个App整体满意吗？给个分数（0-10分）
9. 还有什么想说的吗？

### 记录要点
- 用户原话（verbatim quotes）
- 情绪反应
- 未表达的需求
```

---

## 5. 反馈处理流程

### 5.1 响应时间承诺

| 优先级 | 响应时间 | 处理时间 | 处理目标 |
|--------|---------|---------|---------|
| P0 - 严重Bug | 2小时内 | 24小时内 | 紧急修复 |
| P1 - 普通Bug | 8小时内 | 48小时内 | 下个版本修复 |
| P2 - 功能建议 | 48小时内 | 1周内 | 评估是否纳入 |
| P3 - UX优化 | 48小时内 | 2周内 | 排期优化 |

### 5.2 优先级分类规则

```
优先级判定矩阵：

        严重影响使用？     是否普遍问题？
              ↓                ↓
         是 → P0/P1      是 → P1
         否 → P2/P3      否 → P2/P3

P0: 核心功能不可用 + 大量用户受影响
P1: 功能异常 + 部分用户受影响
P2: 功能建议 + 非核心体验问题
P3: UI优化 + 低频场景问题
```

### 5.3 状态跟踪

| 状态 | 说明 | 触发条件 |
|------|------|---------|
| 新建 (New) | 刚提交的反馈 | 提交时 |
| 已确认 (Confirmed) | 确认问题存在 | PM确认 |
| 进行中 (In Progress) | 正在处理 | 开始修复 |
| 待验证 (Pending Verify) | 等待用户验证 | 修复完成 |
| 已关闭 (Closed) | 问题已解决 | 用户确认 |
| 延期 (Deferred) | 暂时不处理 | 评估后决定 |

### 5.4 处理流程图

```
反馈提交
    ↓
自动分类（基于type字段）
    ↓
PM每日审核
    ↓
优先级判定
    ↓
分配处理（开发/产品/设计）
    ↓
处理状态更新
    ↓
用户通知（48小时内）
    ↓
问题解决
    ↓
反馈收集验证（是否满意）
    ↓
关闭
```

---

## 6. 数据存储设计

### 6.1 Supabase 数据表

```sql
-- 反馈收集表
CREATE TABLE feedback (
    id UUID DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('feature', 'bug', 'ux', 'performance')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    screenshot_urls TEXT[], -- JSON array of URLs
    user_id VARCHAR(100),
    contact VARCHAR(200),
    page_url VARCHAR(500),
    priority VARCHAR(10) DEFAULT 'P2',
    status VARCHAR(20) DEFAULT 'new',
    assigned_to VARCHAR(100),
    resolution TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- 关联到产品分析
    session_id VARCHAR(100), -- 学习会话ID
    ability_score DECIMAL(5,2), -- 当时的能力值
    learning_effect DECIMAL(5,2) -- 当时的学习效果
);

-- 反馈评论表（用户和PM都可以留言）
CREATE TABLE feedback_comments (
    id UUID DEFAULT gen_random_uuid(),
    feedback_id UUID REFERENCES feedback(id),
    author VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 反馈统计视图
CREATE VIEW feedback_stats AS
SELECT
    type,
    priority,
    status,
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as count
FROM feedback
GROUP BY type, priority, status, DATE_TRUNC('day', created_at);
```

### 6.2 索引优化

```sql
-- 高频查询索引
CREATE INDEX idx_feedback_type ON feedback(type);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_priority ON feedback(priority);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);
```

---

## 7. 每日汇总报告

### 7.1 自动生成内容

```markdown
## 反馈日报 - YYYY-MM-DD

### 概览
- 新增反馈: X条
- 待处理: Y条
- 累计处理: Z条

### 分类统计
| 类型 | 数量 | 占比 |
|------|------|------|
| Bug报告 | X | XX% |
| 功能建议 | X | XX% |
| 用户体验 | X | XX% |
| 性能问题 | X | XX% |

### 优先级分布
| 优先级 | 数量 | 说明 |
|--------|------|------|
| P0 | X | 需紧急处理 |
| P1 | X | 下版本修复 |
| P2 | X | 评估中 |
| P3 | X | 低优先级 |

### 高优先级反馈（Top 5）
1. [标题] - [状态] - [处理人]
2. [标题] - [状态] - [处理人]
...

### 用户NPS分布
- NPS: XX分
- 评分分布: [0-10的分布]

### 行动项
- [ ] 处理P0反馈：xxx
- [ ] 确认P1反馈：xxx
- [ ] 与用户沟通：xxx
```

---

## 8. 实施计划

### 8.1 MVP阶段（第1周）

| 任务 | 负责人 | 截止日期 | 状态 |
|------|--------|---------|------|
| 创建Supabase表 | Dev | Day 1 | TODO |
| 实现反馈表单UI | Frontend | Day 2 | TODO |
| 实现API保存功能 | Backend | Day 2 | TODO |
| 配置RLS权限 | Dev | Day 2 | TODO |
| 测试反馈提交 | PM | Day 3 | TODO |
| 编写使用说明 | PM | Day 3 | TODO |

### 8.2 优化阶段（第2-3周）

| 任务 | 负责人 | 截止日期 | 状态 |
|------|--------|---------|------|
| 添加截图上传 | Dev | Week 2 | TODO |
| 实现自动分类 | Dev | Week 2 | TODO |
| 配置邮件通知 | Dev | Week 2 | TODO |
| 开发每日报告 | Dev | Week 2 | TODO |
| 收集早期用户反馈 | PM | Week 3 | TODO |
| 迭代改进 | All | Week 3 | TODO |

---

## 9. 成功指标

### 9.1 量化指标

| 指标 | 目标值 | 测量方式 |
|------|-------|---------|
| 反馈收集量 | 每周 > 20条 | 统计新增 |
| 响应时间达标率 | > 90% | 48小时内回复 |
| 问题解决率 | > 80% | 2周内解决 |
| 用户满意度 | > 4/5 | 反馈后调研 |

### 9.2 质量指标

- 反馈内容完整度 > 80%
- 分类准确度 > 90%
- 优先级判断准确度 > 85%

---

## 10. 附录

### 10.1 相关文档

- `docs/kr2-beta-materials/feedback-form.md` - 详细反馈表单模板
- `docs/kr2-beta-recruitment-plan.md` - Beta用户招募计划
- `PRODUCT.md` - 产品定义文档

### 10.2 联系人

| 角色 | 职责 | 联系方式 |
|------|------|---------|
| 产品经理 | 反馈审核、优先级判定 | [待定] |
| 开发负责人 | 技术实现、问题修复 | [待定] |
| 用户运营 | 用户沟通、访谈组织 | [待定] |

---

**文档状态**: 完成
**下次评审**: 2026-05-13