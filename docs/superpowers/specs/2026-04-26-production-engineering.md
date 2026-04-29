# v1.0 Production Engineering Architecture

**日期**: 2026-04-26
**状态**: 工程可上线版本
**原则**: Prediction is truth, Explanation is post-hoc, Causality is offline

---

## 🧭 可上线架构图

```
┌──────────────────────────────────────────────────────────────┐
│                     Client / App Layer                      │
│   (Web / Mobile / Teacher Dashboard / Student App)         │
└───────────────▲───────────────────────────────▲─────────────┘
                │                               │
                │ REST / GraphQL API           │ WebSocket
                │                               │
┌───────────────┴───────────────────────────────┴─────────────┐
│                    API Gateway (BFF Layer)                   │
│     - Auth / Rate Limit / Routing / Logging                 │
└───────────────▲───────────────────────────────▲─────────────┘
                │                               │
     ┌──────────┴──────────┐        ┌──────────┴──────────┐
     │ Prediction Service   │        │ Explanation Service │
     │ (Layer 1 Core)       │        │ (Layer 2 Weak)      │
     └──────────▲──────────┘        └──────────▲──────────┘
                │                               │
                └──────────────┬────────────────┘
                               │
                 ┌─────────────▼─────────────┐
                 │ Feature / Data Service    │
                 │ - student history         │
                 │ - question features       │
                 │ - ability estimation      │
                 └─────────────▲─────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│ Online DB       │  │ Feature Store   │  │ Event Stream     │
│ (Postgres)      │  │ (Redis / Feast) │  │ (Kafka)          │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 🚫 Research Sandbox（彻底隔离）

```
┌──────────────────────────────────────────────┐
│         Research Sandbox (Offline)          │
│  - SCM Model                                │
│  - Falsification Engine                     │
│  - Equivalence Class Analysis               │
│  - Counterfactual Simulation                │
└──────────────────────────────────────────────┘
        ↓（只输出报告，不进生产）
   Human review / batch analysis
```

---

## 🔒 4条工程原则

1. **Prediction is truth layer** - 生产只信 prediction service
2. **Explanation is post-hoc** - 解释 ≠ 决策依据
3. **Causality is offline only** - SCM / falsification 永远不进生产链路
4. **Features > Theory** - feature improvement 永远优先于模型哲学

---

## 📦 Monorepo 结构

```
academic-leap/
├── apps/
│   ├── api-gateway/           # API Gateway (NestJS)
│   ├── prediction-service/    # ⭐ Layer 1 (Fastify/Node)
│   ├── explanation-service/   # Layer 2 (Fastify/Node)
│   ├── feature-service/       # Feature Service (Fastify/Node)
│   └── research-sandbox/      # 🔬 Research (isolated)
│
├── packages/
│   ├── shared-types/          # TypeScript types
│   ├── database/              # DB schemas & repositories
│   ├── cache/                 # Redis clients
│   └── events/                # Kafka schemas
│
├── infra/
│   ├── docker/                # Dockerfiles
│   ├── k8s/                   # Kubernetes manifests
│   └── terraform/             # Infrastructure as Code
│
└── docs/
    └── architecture/
```

---

## 🚀 部署策略

### Prediction Service
- autoscaling: YES
- stateless: YES
- latency target: <100ms
- CPU: 2-4 cores
- Memory: 4GB

### Explanation Service
- CPU only
- cache heavy
- async acceptable

### Feature Service
- memory optimized
- high read throughput
- batch + streaming hybrid

### Research Sandbox
- ❌ 不进入 production cluster
- ✔ 独立 VPC / offline environment
- ✔ Jupyter / batch jobs

---

## 📌 一句话版本

> "一个以预测为核心、解释为辅助、因果研究完全隔离的教育预测系统"
