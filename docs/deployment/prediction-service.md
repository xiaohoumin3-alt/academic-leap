# Prediction Service 部署指南

## 概述

Prediction Service 是教育预测系统的核心服务，提供基于 IRT 模型的答题正确率预测。

## 本地开发

```bash
cd apps/prediction-service
npm install
npm run dev
```

服务运行在 http://localhost:3001

## Docker 部署

```bash
docker-compose up -d prediction-service
```

## API 端点

### Health Check
```bash
curl http://localhost:3001/health
```

### 单题预测
```bash
curl -X POST http://localhost:3001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": 1,
    "questionFeatures": {
      "difficulty": 0.5,
      "knowledgeNodes": ["algebra"]
    }
  }'
```

### 批量预测
```bash
curl -X POST http://localhost:3001/predict/batch \
  -H "Content-Type: application/json" \
  -d '{"studentId": 1, "count": 5}'
```

### 学生画像
```bash
curl http://localhost:3001/students/1
```

### 反馈记录
```bash
curl -X POST http://localhost:3001/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": 1,
    "questionId": "q1",
    "correct": true,
    "difficulty": 0.5,
    "knowledgeNodes": ["algebra"]
  }'
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3001 | 服务端口 |
| `NODE_ENV` | development | 运行环境 |
| `PREDICTION_SERVICE_URL` | http://localhost:3001 | 服务地址 |

## 监控

服务内置 metrics 端点用于监控：
```bash
curl http://localhost:3001/metrics
```