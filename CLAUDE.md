# 产品愿景 — "让每个学生都能获得最适合自己当前能力的学习路径"


# 这个项目是什么

**自适应数学学习推荐引擎** — 不是题库，不是练习软件，是让学生"真正学会"的智能系统。

# 核心问题：如何确保推荐给学生的题目既不太难（放弃）、也不太简单（无聊）、而是刚好在"最近发展区"？


# 核心原则

## 1. 目标导向：有目标才能开始，没有目标，任何一项任务，都必须围绕最终目标。

## 2. 标准先行：在开始行动前，先根据目标定义验收标准；没有标准，禁止任何行动。

## 3. 2/8原则：用20%的核心工作解决80%的问题。警惕过度设计。

## 4. 第一性原理：剥离假设和惯例，回到最根本的问题。

## 5. 再优化收益递减：承认完美主义的边际成本。

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **academic-leap** (14025 symbols, 20946 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/academic-leap/context` | Codebase overview, check index freshness |
| `gitnexus://repo/academic-leap/clusters` | All functional areas |
| `gitnexus://repo/academic-leap/processes` | All execution flows |
| `gitnexus://repo/academic-leap/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

---

# Productivity Kit — Daily Rhythm

**Powered by [productivity-kit](https://github.com/hendrikhemken/claude-plugin-productivity-kit)**

## Daily Workflow

| When | Skill | What |
|------|-------|------|
| Morning (Mon) | `/productivity-kit:okr-monday` → `/productivity-kit:good-morning` | Weekly goals + day start |
| Morning (Tue-Sun) | `/productivity-kit:good-morning` | Yesterday review + plan today |
| During day | automatic | Claude tracks activities in journal `## Notes` |
| Anytime | `/productivity-kit:journal` | Quick update: add note, check off todo |
| Friday | `/productivity-kit:okr-friday` | Celebrate wins, capture learnings |

## File Structure

```
academic-leap/
├── journal/                          # Daily journal files
│   └── {YYYY-MM-DD}.md
├── okrs/                             # OKR tracking
│   ├── CURRENT_WEEK.md               # This week's focus
│   └── Q{X}-{YYYY}.md               # Quarterly OKR file
├── dashboards/
│   └── OPPORTUNITIES.md              # Pipeline tracking
└── user_context/
    └── COMPANY_CONTEXT.md            # Business context (提分神器)
```

## Key Principles

- **Outcomes > Outputs** — measure impact, not activity
- **Weekly Cadence** — Monday commitments, Friday celebrations (Wodtke method)
- **5/10 Confidence** — OKRs should be ambitious (0.6-0.7 = success!)
- **Journal tracking** — after notable work, add entry to `## Notes`

---
