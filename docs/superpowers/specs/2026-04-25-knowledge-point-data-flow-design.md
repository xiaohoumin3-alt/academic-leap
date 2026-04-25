# 知识点数据流重构设计

**日期**: 2026-04-25
**目标**: 确保四个核心知识点（一元一次方程、二次函数、勾股定理、概率统计）在系统中一以贯之

## 问题诊断

### 当前状态

| 知识点 | ID | 题目数 | weight | inAssess |
|--------|-----|--------|--------|----------|
| 一元一次方程 | cmodriw6i00031ysgweziqjz5 | 2 | 0 | true |
| 二次函数 | cmodriw6k00091ysgd3c6c0dw | 15 | 0 | true |
| 勾股定理 | cmodriw6j00061ysgkaljpa5w | 2 | 0 | true |
| 概率统计 | cmodriw6l000c1ysgumeluray | 2 | 0 | true |

### 数据流问题

1. **Question.knowledgePoints** 混乱：之前用 name，迁移后用 id，但 API 未同步
2. **Templates**：5个模板无 knowledgeId，存在重复条目
3. **weight 全为 0**：无法控制练习推荐优先级

## 设计方案：数据流重构

### 1. 数据模型层

#### 知识点权重设置
```
一元一次方程: weight = 3
二次函数:     weight = 4 (核心，权重最高)
勾股定理:     weight = 3
概率统计:     weight = 2
```

#### Templates 清理
- 合并 5 个重复的"二次函数顶点坐标"模板为 1 个
- 确保核心模板都有 knowledgeId

### 2. API 层统一

| API | 修改 |
|-----|------|
| `assessment/start` | 使用 `kp.id` 查 Question |
| `practice/recommend` | 使用 `kp.id` 查 Question |
| `practice/finish` | 移除 name→id 转换 |
| `user/settings` | 新增权重管理接口 |

### 3. 权重管理界面

在 `LearningSettings.tsx` 添加：
- 滑块控制权重（1-5）
- 实时保存
- 显示当前权重值

### 4. 错误处理

- 无效 knowledgePoints id 记录警告但不中断
- 提供 `/api/admin/validate-knowledge` 验证接口
- weight 边界验证（1-5）

### 5. 迁移脚本

```
scripts/set-knowledge-weights.ts
scripts/cleanup-duplicate-templates.ts
scripts/validate-data-flow.ts
```

### 6. 测试策略

1. 单元测试：权重计算
2. 集成测试：测评→练习→完成流程
3. E2E测试：完整用户流程

## 实施顺序

1. 设置知识点权重
2. 清理重复 Templates
3. 更新 API（assessment, practice）
4. 添加权重管理界面
5. 验证数据流
