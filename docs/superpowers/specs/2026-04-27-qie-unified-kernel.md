# QIE Unified Observability Kernel (UOK)

**日期**: 2026-04-27
**状态**: v1.0 极限版

---

## 核心定位

> 一个状态机 + 四个函数

```
input → encode → state → act → action → feedback → learn → state'
                  ↓
              explain (可观测)
```

**第一性原理**：
1. **不是分层系统**：L1/L3/L5 不是独立系统，是能力
2. **状态中心**：state 是唯一事实源
3. **可观测**：explain(state) 全链路可解释

---

## UOK 核心（100 行）

```typescript
// lib/qie/uok/kernel.ts

/**
 * 统一可观测内核
 *
 * 融合 L1(理解) + L3(建模) + L5(策略)
 *
 * 核心思想：
 * - 不是 5 层系统，而是 1 个状态机
 * - state 是唯一事实源
 * - 所有决策基于 state
 */
export class UOK {
  // 状态（唯一事实源）
  private state: State = {
    questions: new Map(),      // questionId → QuestionState
    students: new Map(),       // studentId → StudentState
    space: new SpaceState(),   // 知识空间
    trace: [],                 // 可追溯轨迹
  };

  /**
   * 1. Encode：输入 → 状态（融合 L1 + L3）
   *
   * 题目入库：理解 + 空间更新
   */
  encodeQuestion(question: { id: string; content: string; topics: string[] }): void {
    // L1: 理解题目 → 特征
    const features = this.extractFeatures(question.content);

    // L3: 更新空间状态
    const qState: QuestionState = {
      id: question.id,
      topics: question.topics,
      features,
      quality: 0.5, // 初始质量分数
      attemptCount: 0,
      correctCount: 0,
    };

    this.state.questions.set(question.id, qState);
    this.state.space.update(question.topics, features);
    this.state.trace.push({ type: 'encode', questionId: question.id, time: Date.now() });
  }

  /**
   * 2. Encode：答题 → 状态
   *
   * 记录答题，更新所有相关状态
   */
  encodeAnswer(
    studentId: string,
    questionId: string,
    correct: boolean
  ): void {
    // 更新题目状态
    const q = this.state.questions.get(questionId);
    if (q) {
      q.attemptCount++;
      if (correct) q.correctCount++;
      q.quality = q.correctCount / q.attemptCount; // 简化质量指标
    }

    // 更新学生状态（L3）
    const s = this.state.students.get(studentId) ?? this.createStudent(studentId);
    if (q) {
      for (const topic of q.topics) {
        const current = s.knowledge.get(topic) ?? 0.5;
        const updated = 0.95 * current + 0.05 * (correct ? 1 : 0);
        s.knowledge.set(topic, updated);
      }
      s.attemptCount++;
      s.correctCount += correct ? 1 : 0;
    }
    this.state.students.set(studentId, s);

    this.state.trace.push({
      type: 'answer',
      studentId,
      questionId,
      correct,
      time: Date.now(),
    });
  }

  /**
   * 3. Explain：状态解释（可观测性核心）
   *
   * 任何人调用 explain 都能获得当前系统的完整解释
   */
  explain(target?: { studentId?: string; questionId?: string }): Explanation {
    if (target?.studentId) {
      return this.explainStudent(target.studentId);
    }
    if (target?.questionId) {
      return this.explainQuestion(target.questionId);
    }
    return this.explainSystem();
  }

  /**
   * 4. Act：策略决策（融合 L5）
   *
   * 基于状态做出决策（出题/推荐）
   */
  act(intent: 'next_question' | 'gap_analysis', studentId: string): Action {
    const student = this.state.students.get(studentId);
    if (!student) {
      return { type: 'error', reason: 'Student not found' };
    }

    if (intent === 'next_question') {
      // 找最弱知识点
      const weakTopic = this.findWeakestTopic(student);
      if (!weakTopic) {
        return { type: 'done', reason: 'All topics mastered' };
      }
      return {
        type: 'recommend',
        topic: weakTopic,
        reason: `Weakest topic (mastery: ${student.knowledge.get(weakTopic)?.toFixed(2)})`,
      };
    }

    if (intent === 'gap_analysis') {
      const gaps = this.findGaps(student);
      return { type: 'gap_report', gaps };
    }

    return { type: 'error', reason: 'Unknown intent' };
  }

  /**
   * 5. Learn：在线更新（闭环）
   *
   * 收到反馈后更新状态
   */
  learn(feedback: {
    studentId: string;
    questionId: string;
    predicted: number;
    actual: boolean;
  }): void {
    // 简化：更新就是重新编码答案
    this.encodeAnswer(feedback.studentId, feedback.questionId, feedback.actual);
  }

  // ========== 内部方法 ==========

  /**
   * L1: 特征提取（题目理解）
   */
  private extractFeatures(content: string): QuestionFeatures {
    // 认知负荷（关键词计数）
    const cognitiveWords = ['同时', '分别', '至少', '所有'];
    let cognitiveLoad = 0;
    for (const w of cognitiveWords) {
      cognitiveLoad += (content.match(new RegExp(w, 'g')) || []).length * 0.2;
    }

    // 推理深度（关键词）
    const reasoningWords: [string, number][] = [
      ['证明', 2],
      ['推导', 1.5],
      ['分析', 1],
      ['计算', 0.5],
    ];
    let reasoningDepth = 0;
    for (const [w, weight] of reasoningWords) {
      if (content.includes(w)) reasoningDepth += weight;
    }

    // 复杂度（嵌套层级）
    const nests = (content.match(/[()（）]/g) || []).length / 2;

    return {
      cognitiveLoad: Math.min(1, cognitiveLoad),
      reasoningDepth: Math.min(5, reasoningDepth),
      complexity: Math.min(1, nests / 5),
      difficulty: 0.5, // 初始值，会从答题中学习
    };
  }

  /**
   * 找最弱知识点
   */
  private findWeakestTopic(student: StudentState): string | null {
    let weakest: string | null = null;
    let minMastery = 1;

    for (const [topic, mastery] of student.knowledge) {
      if (mastery < minMastery) {
        minMastery = mastery;
        weakest = topic;
      }
    }

    return weakest;
  }

  /**
   * 找缺口
   */
  private findGaps(student: StudentState): Gap[] {
    const gaps: Gap[] = [];

    for (const [topic, mastery] of student.knowledge) {
      if (mastery < 0.6) {
        gaps.push({ topic, mastery, type: 'weak_knowledge' });
      }
    }

    // 找题库缺口
    for (const topic of this.state.space.topics) {
      const count = this.state.space.getCount(topic);
      if (count < 5) {
        gaps.push({ topic, mastery: 0, type: 'missing_questions', count });
      }
    }

    return gaps;
  }

  private createStudent(id: string): StudentState {
    return {
      id,
      knowledge: new Map(),
      attemptCount: 0,
      correctCount: 0,
    };
  }

  private explainStudent(studentId: string): Explanation {
    const s = this.state.students.get(studentId);
    if (!s) return { type: 'error', message: 'Student not found' };

    const weakTopics = Array.from(s.knowledge.entries())
      .filter(([_, m]) => m < 0.6)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([t, m]) => ({ topic: t, mastery: m }));

    return {
      type: 'student',
      studentId,
      ability: s.attemptCount > 0 ? s.correctCount / s.attemptCount : 0.5,
      weakTopics,
      totalAttempts: s.attemptCount,
    };
  }

  private explainQuestion(questionId: string): Explanation {
    const q = this.state.questions.get(questionId);
    if (!q) return { type: 'error', message: 'Question not found' };

    return {
      type: 'question',
      questionId,
      topics: q.topics,
      quality: q.quality,
      attempts: q.attemptCount,
      features: q.features,
    };
  }

  private explainSystem(): Explanation {
    const totalQuestions = this.state.questions.size;
    const totalStudents = this.state.students.size;
    const totalAttempts = Array.from(this.state.students.values())
      .reduce((sum, s) => sum + s.attemptCount, 0);

    return {
      type: 'system',
      totalQuestions,
      totalStudents,
      totalAttempts,
      topics: Array.from(this.state.space.topics),
      traceLength: this.state.trace.length,
    };
  }
}

// ========== 状态定义 ==========

interface State {
  questions: Map<string, QuestionState>;
  students: Map<string, StudentState>;
  space: SpaceState;
  trace: TraceEntry[];
}

interface QuestionState {
  id: string;
  topics: string[];
  features: QuestionFeatures;
  quality: number;
  attemptCount: number;
  correctCount: number;
}

interface StudentState {
  id: string;
  knowledge: Map<string, number>; // topic → mastery
  attemptCount: number;
  correctCount: number;
}

interface QuestionFeatures {
  cognitiveLoad: number;
  reasoningDepth: number;
  complexity: number;
  difficulty: number;
}

class SpaceState {
  topics = new Set<string>();
  topicCounts = new Map<string, number>();

  update(topics: string[], features: QuestionFeatures): void {
    for (const t of topics) {
      this.topics.add(t);
      this.topicCounts.set(t, (this.topicCounts.get(t) ?? 0) + 1);
    }
  }

  getCount(topic: string): number {
    return this.topicCounts.get(topic) ?? 0;
  }
}

type TraceEntry =
  | { type: 'encode'; questionId: string; time: number }
  | { type: 'answer'; studentId: string; questionId: string; correct: boolean; time: number };

// ========== 输出定义 ==========

type Explanation =
  | { type: 'student'; studentId: string; ability: number; weakTopics: { topic: string; mastery: number }[]; totalAttempts: number }
  | { type: 'question'; questionId: string; topics: string[]; quality: number; attempts: number; features: QuestionFeatures }
  | { type: 'system'; totalQuestions: number; totalStudents: number; totalAttempts: number; topics: string[]; traceLength: number }
  | { type: 'error'; message: string };

type Action =
  | { type: 'recommend'; topic: string; reason: string }
  | { type: 'gap_report'; gaps: Gap[] }
  | { type: 'done'; reason: string }
  | { type: 'error'; reason: string };

interface Gap {
  topic: string;
  mastery: number;
  type: 'weak_knowledge' | 'missing_questions';
  count?: number;
}
```

---

## API（极简）

```
# 题目入库
POST /api/qie/encode/question
{ id, content, topics }
→ { ok: true }

# 记录答题
POST /api/qie/encode/answer
{ studentId, questionId, correct }
→ { ok: true }

# 查询状态（可观测）
GET /api/qie/explain?studentId=xxx
→ { type: 'student', ability, weakTopics, ... }

# 决策（出题/推荐）
POST /api/qie/act
{ intent: 'next_question', studentId }
→ { type: 'recommend', topic, reason }

# 反馈学习
POST /api/qie/learn
{ studentId, questionId, predicted, actual }
→ { ok: true }
```

---

## 实施计划

| 内容 | 时间 |
|------|------|
| UOK 核心 | 1 天 |
| API 集成 | 0.5 天 |
| 测试 | 0.5 天 |

**总计：2 天**

---

## 验收标准

- [ ] state 是唯一事实源
- [ ] explain() 可解释任何状态
- [ ] act() 基于状态决策
- [ ] trace 全链路可追溯

---

**文档版本**: v1.0
**代码量**: ~200 行（UOK 核心）
**核心变化**: L1/L3/L5 合并为统一状态机
