# 游戏化完整产品实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标**: 完整实现四主题游戏化系统 + 社交装逼 + 连胜防护 + 成就暴击

**架构**: 游戏化层与学习核心完全解耦，通过API交互

**技术栈**: Next.js 15, React 19, Prisma, Framer Motion, Zustand, WebSocket (实时排行榜)

---

## 文件结构（完整版）

```
academic-leap/
├── prisma/
│   └── schema.prisma                      # 修改：完整游戏化表
├── lib/
│   ├── gaming/                            # 游戏化核心逻辑
│   │   ├── theme-engine.ts                # 主题引擎（支持4主题）
│   │   ├── themes/                        # 四个主题配置
│   │   │   ├── magic-academy.ts           # 魔法学院
│   │   │   ├── career.ts                  # 职业养成
│   │   │   ├── racing.ts                  # 极限竞速
│   │   │   └── detective.ts               # 特工行动
│   │   ├── streak-tracker.ts              # 连胜追踪器（带防护）
│   │   ├── achievement-system.ts          # 成就系统（完整）
│   │   ├── ranking-system.ts              # 排行榜系统（全服+班级）
│   │   ├── challenge-system.ts            # 挑战系统（PK）
│   │   ├── team-system.ts                 # 组队系统
│   │   └── critical-hit.ts                # 暴击系统（RNG）
│   ├── stores/
│   │   └── gaming-store.ts                # 游戏化状态
│   └── api.ts                             # 修改：添加游戏化API
├── components/
│   ├── gaming/
│   │   ├── theme/
│   │   │   ├── ThemeProvider.tsx          # 主题上下文
│   │   │   ├── ThemeSelector.tsx          # 主题选择器
│   │   │   ├── magic-academy/             # 魔法学院主题
│   │   │   ├── career/                    # 职业养成主题
│   │   │   ├── racing/                    # 极限竞速主题
│   │   │   └── detective/                 # 特工行动主题
│   │   ├── feedback/
│   │   │   ├── FeedbackAnimator.tsx       # 即时反馈动画
│   │   │   ├── StreakDisplay.tsx          # 连胜展示
│   │   │   ├── CriticalHitOverlay.tsx     # 暴击特效
│   │   │   └── ReboundCard.tsx            # 反弹提示卡
│   │   ├── rankings/
│   │   │   ├── RankingCard.tsx            # 排行榜卡片
│   │   │   ├── GlobalRanking.tsx          # 全服排行榜（残酷版）
│   │   │   └── ClassRanking.tsx           # 班级排行榜
│   │   ├── challenges/
│   │   │   ├── ChallengeList.tsx          # 挑战列表
│   │   │   ├── ChallengeDialog.tsx        # 发起挑战
│   │   │   └── IncomingChallenge.tsx      # 接收挑战通知
│   │   ├── teams/
│   │   │   ├── TeamFormation.tsx          # 组队界面
│   │   │   └── BossBattle.tsx             # Boss战界面
│   │   ├── achievements/
│   │   │   ├── AchievementGrid.tsx        # 成就展示
│   │   │   ├── AchievementUnlock.tsx      # 成就解锁动画
│   │   │   └── BadgeDisplay.tsx           # 徽章展示
│   │   └── sound/
│   │       ├── SoundManager.tsx           # 音效管理器
│   │       └── useSoundToggle.ts          # 音效开关
│   ├── ExercisePage.tsx                   # 修改：集成所有游戏化反馈
│   └── HomePage.tsx                        # 修改：主题化首页
├── app/api/
│   └── gaming/                             # 游戏化API路由
│       ├── streak/route.ts
│       ├── rankings/route.ts
│       ├── challenges/route.ts
│       ├── teams/route.ts
│       ├── achievements/route.ts
│       └── theme/route.ts
└── types/
    └── gaming.ts                           # 游戏化类型定义
```

---

## 完整数据库设计

### Task 1: 添加完整游戏化数据表

**文件:** `prisma/schema.prisma`

```prisma
// ============ 游戏化配置 ============
model GamingProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  activeThemeId   String   @default("magic-academy")
  soundEnabled    Boolean  @default(false)
  selectedCareer  String?  // 职业养成主题：选择的职业
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// ============ 连胜记录（带防护） ============
model StreakRecord {
  id              String   @id @default(cuid())
  userId          String
  currentStreak   Int      @default(0)
  bestStreak      Int      @default(0)
  lastStreakAt    DateTime?
  isInRebound     Boolean  @default(false)
  reboundCount    Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId])
  @@index([userId, bestStreak])
}

// ============ 答题历史（连胜验证） ============
model QuestionRecord {
  id              String   @id @default(cuid())
  userId          String
  questionId      String
  isCorrect       Boolean
  isRecommended   Boolean  @default(true)
  streakCount     Int      @default(0)
  isCriticalHit   Boolean  @default(false)
  answeredAt      DateTime @default(now())

  @@index([userId, answeredAt])
  @@index([userId, isCorrect])
}

// ============ 成就系统 ============
model Achievement {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String
  description String
  icon        String?
  rarity      String   @default("common")  // common | rare | epic | legendary
  points      Int      @default(0)
  category    String   // streak | progress | social | special
  requirement  String   @default("{}")       // JSON: 解锁条件
}

model UserAchievement {
  id            String      @id @default(cuid())
  userId        String
  achievementId String
  unlockedAt    DateTime    @default(now())
  showcaseOrder Int?        // 展示顺序
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievement   Achievement @relation(fields: [achievementId], references: [id])

  @@unique([userId, achievementId])
  @@index([userId])
}

// ============ 社交系统 ============
model ClassMembership {
  id        String   @id @default(cuid())
  userId    String
  className String
  grade     Int
  role      String   @default("student")
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId])
  @@index([className, grade])
}

// 挑战记录
model Challenge {
  id              String   @id @default(cuid())
  challengerId    String
  receiverId      String
  questionId      String
  difficulty      Int
  challengerStake Int      @default(10)
  receiverStake   Int      @default(20)
  status          String   @default("pending")  // pending | accepted | declined | completed
  winnerId        String?
  completedAt     DateTime?
  createdAt       DateTime @default(now())

  @@index([receiverId, status])
  @@index([challengerId, status])
}

// 组队记录
model Team {
  id          String   @id @default(cuid())
  name        String
  bossId      String   // Boss问题ID
  status      String   @default("forming")  // forming | active | completed | failed
  createdAt   DateTime @default(now())
  members     TeamMember[]
}

model TeamMember {
  id          String   @id @default(cuid())
  teamId      String
  userId      String
  role        String   @default("member")
  status      String   @default("ready")    // ready | in_progress | completed | failed
  joinedAt    DateTime @default(now())
  team        Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@index([teamId, status])
}

// 更新User模型
model User {
  // ... 现有字段保持不变 ...
  gamingProfile    GamingProfile?
  streakRecord     StreakRecord?
  classMembership  ClassMembership?
  challengesSent   Challenge[]      @relation("Challenger")
  challengesReceived Challenge[]    @relation("Receiver")
  achievements     UserAchievement[]
  teamMemberships  TeamMember[]
}
```

运行迁移：
```bash
npx prisma migrate dev --name add_full_gamification
npx prisma generate
```

---

## 核心系统实现

### Task 2: 完整类型定义

**文件:** `types/gaming.ts`

```typescript
/**
 * 主题ID
 */
export type ThemeId = 'magic-academy' | 'career' | 'racing' | 'detective';

/**
 * 职业类型（职业养成主题）
 */
export type CareerType = 'scientist' | 'doctor' | 'engineer' | 'analyst';

/**
 * 主题配置接口
 */
export interface ThemeConfig {
  id: ThemeId;
  name: string;
  displayName: string;
  description: string;
  colors: ThemeColors;
  terminology: ThemeTerminology;
  icons: ThemeIcons;
  mechanics: ThemeMechanics;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
}

export interface ThemeTerminology {
  player: string;
  level: string;
  progress: string;
  challenge: string;
  correct: string;
  wrong: string;
  boss: string;
  team: string;
}

export interface ThemeIcons {
  badge: string;
  progress: string;
  reward: string;
  boss: string;
}

export interface ThemeMechanics {
  maxLevel: number;
  levelFormula: (progress: number) => number;
  scoreMultiplier: (level: number) => number;
}

/**
 * 连胜状态
 */
export interface StreakState {
  current: number;
  best: number;
  isInRebound: boolean;
  reboundCount: number;
}

/**
 * 连胜更新结果
 */
export interface StreakUpdateResult {
  newStreak: number;
  isBroken: boolean;
  multiplier: number;
  message: string;
  shouldShowAnimation: boolean;
  enterRebound?: boolean;
  isNewBest?: boolean;
}

/**
 * 排行榜条目
 */
export interface RankingEntry {
  userId: string;
  userName: string;
  score: number;
  streak: number;
  rank: number;
  change: number;
  themeId: ThemeId;
  level: number;
}

/**
 * 排行榜类型
 */
export type RankingType = 'global' | 'class' | 'theme';

/**
 * 挑战状态
 */
export interface Challenge {
  id: string;
  challengerId: string;
  challengerName: string;
  receiverId: string;
  receiverName: string;
  questionId: string;
  difficulty: number;
  challengerStake: number;
  receiverStake: number;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  winnerId?: string;
  createdAt: Date;
}

/**
 * 组队信息
 */
export interface TeamInfo {
  id: string;
  name: string;
  bossId: string;
  status: 'forming' | 'active' | 'completed' | 'failed';
  members: TeamMemberInfo[];
  createdAt: Date;
}

export interface TeamMemberInfo {
  userId: string;
  userName: string;
  status: 'ready' | 'in_progress' | 'completed' | 'failed';
  role: 'leader' | 'member';
}

/**
 * 成就
 */
export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  category: 'streak' | 'progress' | 'social' | 'special';
  requirement: any;
  unlockedAt?: Date;
}

/**
 * 暴击结果
 */
export interface CriticalHitResult {
  isCritical: boolean;
  multiplier: number;
  points: number;
  animation: 'normal' | 'rare' | 'epic' | 'legendary';
}

/**
 * 反馈类型
 */
export type FeedbackType =
  | 'correct'
  | 'wrong'
  | 'streak-3'
  | 'streak-5'
  | 'streak-10'
  | 'rebound'
  | 'critical'
  | 'achievement'
  | 'boss-defeated';

/**
 * 游戏化用户状态
 */
export interface GamingProfileState {
  userId: string;
  activeThemeId: ThemeId;
  soundEnabled: boolean;
  streak: StreakState;
  level: number;
  progress: number;
  achievements: Achievement[];
  showcaseBadges: string[];
  classRanking?: RankingEntry[];
  globalRanking?: RankingEntry[];
  teamInfo?: TeamInfo;
}
```

---

### Task 3: 四主题配置

**文件:** `lib/gaming/themes/*.ts`

**3.1 魔法学院主题**
```typescript
// lib/gaming/themes/magic-academy.ts

import type { ThemeConfig } from '@/types/gaming';

export const magicAcademyTheme: ThemeConfig = {
  id: 'magic-academy',
  name: 'magic-academy',
  displayName: '魔法学院',
  description: '像哈利波特一样学习魔法',
  colors: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#f59e0b',
    background: '#1a1a2e',
    surface: '#302b63',
  },
  terminology: {
    player: '魔法学徒',
    level: '学院等级',
    progress: '魔法值',
    challenge: '魔法课',
    correct: '掌握魔法！',
    wrong: '需要补习',
    boss: '期末考试',
    team: '学院小队',
  },
  icons: {
    badge: '🎓',
    progress: '✨',
    reward: '⭐',
    boss: '📚',
  },
  mechanics: {
    maxLevel: 50,
    levelFormula: (progress) => Math.floor(progress / 100) + 1,
    scoreMultiplier: (level) => 1 + (level * 0.05),
  },
};
```

**3.2 职业养成主题**
```typescript
// lib/gaming/themes/career.ts

import type { ThemeConfig, CareerType } from '@/types/gaming';

const CAREER_CONFIG: Record<CareerType, { name: string; icon: string; color: string }> = {
  scientist: { name: '科学家', icon: '🔬', color: '#3b82f6' },
  doctor: { name: '医生', icon: '🏥', color: '#ef4444' },
  engineer: { name: '工程师', icon: '👨‍💻', color: '#10b981' },
  analyst: { name: '数据分析师', icon: '📊', color: '#f59e0b' },
};

export function getCareerTheme(careerType: CareerType = 'scientist'): ThemeConfig {
  const config = CAREER_CONFIG[careerType];

  return {
    id: 'career',
    name: `career-${careerType}`,
    displayName: `职业养成 - ${config.name}`,
    description: '提前体验职业，建立目标感',
    colors: {
      primary: config.color,
      secondary: '#64748b',
      accent: '#22c55e',
      background: '#0f172a',
      surface: '#1e293b',
    },
    terminology: {
      player: config.name,
      level: '职业等级',
      progress: '经验值',
      challenge: '工作任务',
      correct: '完成工作！',
      wrong: '需要指导',
      boss: '重要项目',
      team: '项目组',
    },
    icons: {
      badge: config.icon,
      progress: '📈',
      reward: '💼',
      boss: '🏆',
    },
    mechanics: {
      maxLevel: 100,
      levelFormula: (progress) => Math.floor(progress / 50) + 1,
      scoreMultiplier: (level) => 1 + (level * 0.03),
    },
  };
}

export const careerTheme = getCareerTheme('scientist');
```

**3.3 极限竞速主题**
```typescript
// lib/gaming/themes/racing.ts

import type { ThemeConfig } from '@/types/gaming';

export const racingTheme: ThemeConfig = {
  id: 'racing',
  name: 'racing',
  displayName: '极限竞速',
  description: '竞技体育精神，目标感和拼搏',
  colors: {
    primary: '#ef4444',
    secondary: '#f97316',
    accent: '#eab308',
    background: '#18181b',
    surface: '#27272a',
  },
  terminology: {
    player: '赛车手',
    level: '赛车等级',
    progress: '加速',
    challenge: '练习',
    correct: '加速！',
    wrong: '车辆故障',
    boss: '冠军赛',
    team: '车队',
  },
  icons: {
    badge: '🏎️',
    progress: '⚡',
    reward: '🏁',
    boss: '🏆',
  },
  mechanics: {
    maxLevel: 40,
    levelFormula: (progress) => Math.floor(progress / 80) + 1,
    scoreMultiplier: (level) => 1 + (level * 0.08),
  },
};
```

**3.4 特工行动主题**
```typescript
// lib/gaming/themes/detective.ts

import type { ThemeConfig } from '@/types/gaming';

export const detectiveTheme: ThemeConfig = {
  id: 'detective',
  name: 'detective',
  displayName: '特工行动',
  description: '智力挑战，培养专注力和反应',
  colors: {
    primary: '#06b6d4',
    secondary: '#0891b2',
    accent: '#14b8a6',
    background: '#0f172a',
    surface: '#1e293b',
  },
  terminology: {
    player: '特工学员',
    level: '特工等级',
    progress: '情报',
    challenge: '任务',
    correct: '获取情报！',
    wrong: '任务中断',
    boss: '终极任务',
    team: '小队',
  },
  icons: {
    badge: '🕵️',
    progress: '📡',
    reward: '🔍',
    boss: '🎯',
  },
  mechanics: {
    maxLevel: 60,
    levelFormula: (progress) => Math.floor(progress / 60) + 1,
    scoreMultiplier: (level) => 1 + (level * 0.04),
  },
};
```

**3.5 主题引擎**
```typescript
// lib/gaming/theme-engine.ts

import type { ThemeConfig, ThemeId, CareerType } from '@/types/gaming';
import { magicAcademyTheme } from './themes/magic-academy';
import { careerTheme, getCareerTheme } from './themes/career';
import { racingTheme } from './themes/racing';
import { detectiveTheme } from './themes/detective';

const THEMES: Record<string, ThemeConfig> = {
  'magic-academy': magicAcademyTheme,
  'career': careerTheme,
  'career-scientist': getCareerTheme('scientist'),
  'career-doctor': getCareerTheme('doctor'),
  'career-engineer': getCareerTheme('engineer'),
  'career-analyst': getCareerTheme('analyst'),
  'racing': racingTheme,
  'detective': detectiveTheme,
};

export function getTheme(themeId: string): ThemeConfig {
  return THEMES[themeId] || THEMES['magic-academy'];
}

export function getAllThemes(): ThemeConfig[] {
  return [
    magicAcademyTheme,
    getCareerTheme('scientist'),
    getCareerTheme('doctor'),
    getCareerTheme('engineer'),
    getCareerTheme('analyst'),
    racingTheme,
    detectiveTheme,
  ];
}

export function getThemeColors(themeId: string) {
  return getTheme(themeId).colors;
}

export function getThemeTerm(themeId: string, termKey: keyof ThemeConfig['terminology']): string {
  return getTheme(themeId).terminology[termKey];
}

export function calculateLevel(themeId: string, progress: number): number {
  const theme = getTheme(themeId);
  return Math.min(theme.mechanics.levelFormula(progress), theme.mechanics.maxLevel);
}

export function calculateScoreMultiplier(themeId: string, level: number): number {
  const theme = getTheme(themeId);
  return theme.mechanics.scoreMultiplier(level);
}
```

---

### Task 4: 连胜系统（防护版）

**文件:** `lib/gaming/streak-tracker.ts`

```typescript
import type { StreakState, StreakUpdateResult, QuestionRecordInput } from '@/types/gaming';

const STREAK_THRESHOLDS = [
  { streak: 3, multiplier: 1.5, message: '状态来了！', animation: 'streak-3' },
  { streak: 5, multiplier: 2.0, message: '势不可挡！', animation: 'streak-5' },
  { streak: 10, multiplier: 3.0, message: '超神模式！', animation: 'streak-10' },
];

function calculateMultiplier(streak: number): number {
  for (const t of [...STREAK_THRESHOLDS].reverse()) {
    if (streak >= t.streak) return t.multiplier;
  }
  return 1.0;
}

function getStreakInfo(streak: number) {
  for (const t of [...STREAK_THRESHOLDS].reverse()) {
    if (streak === t.streak) return t;
  }
  return null;
}

export function updateStreak(
  currentStreak: StreakState,
  record: QuestionRecordInput
): StreakUpdateResult {
  const { isCorrect, isRecommended } = record;

  // 防护：非推荐题不计入
  if (!isRecommended) {
    return {
      newStreak: currentStreak.current,
      isBroken: false,
      multiplier: 1.0,
      message: '推荐题答题才能计入连胜哦',
      shouldShowAnimation: false,
    };
  }

  if (isCorrect) {
    const newStreak = currentStreak.isInRebound
      ? currentStreak.reboundCount + 1
      : currentStreak.current + 1;

    const multiplier = calculateMultiplier(newStreak);
    const streakInfo = getStreakInfo(newStreak);
    const isNewBest = newStreak > currentStreak.best;

    return {
      newStreak,
      isBroken: false,
      multiplier,
      message: streakInfo?.message || `${newStreak}连对`,
      shouldShowAnimation: !!streakInfo,
      isNewBest,
    };
  }

  // 答错处理
  if (!currentStreak.isInRebound) {
    return {
      newStreak: 0,
      isBroken: true,
      multiplier: 0,
      message: '连胜中断了...',
      shouldShowAnimation: true,
      enterRebound: true,
    };
  }

  // 反弹失败
  return {
    newStreak: 0,
    isBroken: true,
    multiplier: 0,
    message: '反弹失败，加油！',
    shouldShowAnimation: true,
  };
}

export function activateRebound(currentStreak: StreakState): StreakState {
  return {
    ...currentStreak,
    isInRebound: true,
    reboundCount: 0,
  };
}

export function completeRebound(currentStreak: StreakState): StreakState {
  return {
    ...currentStreak,
    isInRebound: false,
    reboundCount: 0,
    current: 3,
  };
}

export function createInitialStreakState(): StreakState {
  return { current: 0, best: 0, isInRebound: false, reboundCount: 0 };
}
```

---

### Task 5: 暴击系统（RNG）

**文件:** `lib/gaming/critical-hit.ts`

```typescript
import type { CriticalHitResult } from '@/types/gaming';

// 暴击概率（简单题更容易暴击，让简单题也有惊喜）
const CRIT_RATES = {
  easy: 0.05,     // 5%
  medium: 0.02,   // 2%
  hard: 0.01,     // 1%
};

const CRIT_MULTIPLIERS = {
  normal: { multiplier: 1, animation: 'normal' },
  rare: { multiplier: 2, animation: 'rare' },
  epic: { multiplier: 3, animation: 'epic' },
  legendary: { multiplier: 5, animation: 'legendary' },
};

export function rollCriticalHit(difficulty: number): CriticalHitResult {
  // 难度1-3: easy, 4-6: medium, 7-10: hard
  const difficultyLevel =
    difficulty <= 3 ? 'easy' :
    difficulty <= 6 ? 'medium' : 'hard';

  const critRate = CRIT_RATES[difficultyLevel];
  const roll = Math.random();

  if (roll < critRate * 0.1) {
    // 10%概率触发传说暴击
    return {
      isCritical: true,
      multiplier: CRIT_MULTIPLIERS.legendary.multiplier,
      points: 0, // 由调用者计算
      animation: 'legendary',
    };
  }

  if (roll < critRate * 0.3) {
    return {
      isCritical: true,
      multiplier: CRIT_MULTIPLIERS.epic.multiplier,
      points: 0,
      animation: 'epic',
    };
  }

  if (roll < critRate) {
    return {
      isCritical: true,
      multiplier: CRIT_MULTIPLIERS.rare.multiplier,
      points: 0,
      animation: 'rare',
    };
  }

  return {
    isCritical: false,
    multiplier: 1,
    points: 0,
    animation: 'normal',
  };
}

export function calculateCriticalPoints(basePoints: number, crit: CriticalHitResult): number {
  return Math.floor(basePoints * crit.multiplier);
}
```

---

### Task 6: 挑战系统

**文件:** `lib/gaming/challenge-system.ts`

```typescript
import type { Challenge, ChallengeResult } from '@/types/gaming';

export async function createChallenge(
  challengerId: string,
  receiverId: string,
  questionId: string,
  difficulty: number
): Promise<Challenge> {
  // 调用API创建挑战
  const res = await fetch('/api/gaming/challenges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengerId, receiverId, questionId, difficulty }),
  });
  return res.json();
}

export async function acceptChallenge(challengeId: string): Promise<void> {
  await fetch(`/api/gaming/challenges/${challengeId}/accept`, { method: 'POST' });
}

export async function declineChallenge(challengeId: string): Promise<void> {
  await fetch(`/api/gaming/challenges/${challengeId}/decline`, { method: 'POST' });
}

export async function submitChallengeResult(
  challengeId: string,
  receiverAnswered: boolean
): Promise<ChallengeResult> {
  const res = await fetch(`/api/gaming/challenges/${challengeId}/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverAnswered }),
  });
  return res.json();
}

// 挑战规则：
// - 发起者选择一道难题
// - 接收者必须在1小时内答题
// - 接收者答错 = 发起者获得接收者20%积分
// - 接收者答对 = 发起者失去10%积分
// - 接收者拒绝 = 损失5分
```

---

### Task 7: 组队Boss战

**文件:** `lib/gaming/team-system.ts`

```typescript
import type { TeamInfo, TeamMemberInfo } from '@/types/gaming';

export async function createTeam(bossQuestionId: string): Promise<TeamInfo> {
  const res = await fetch('/api/gaming/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bossQuestionId }),
  });
  return res.json();
}

export async function joinTeam(teamId: string): Promise<void> {
  await fetch(`/api/gaming/teams/${teamId}/join`, { method: 'POST' });
}

export async function startBossBattle(teamId: string): Promise<void> {
  await fetch(`/api/gaming/teams/${teamId}/start`, { method: 'POST' });
}

export async function submitTeamProgress(
  teamId: string,
  isCorrect: boolean
): Promise<void> {
  await fetch(`/api/gaming/teams/${teamId}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isCorrect }),
  });
}

// Boss战规则：
// - 3人一组
// - 每人分配不同类型题目（计算题、应用题、证明题）
// - 全员完成 = 每人+100分
// - 任意失败 = 无奖励
```

---

### Task 8: 成就系统

**文件:** `lib/gaming/achievement-system.ts`

```typescript
import type { Achievement } from '@/types/gaming';

const ACHIEVEMENTS: Omit<Achievement, 'id' | 'unlockedAt'>[] = [
  // 连胜类
  { code: 'streak-3', name: '状态来了', description: '达成3连胜', icon: '🔥', rarity: 'common', points: 10, category: 'streak', requirement: { streak: 3 } },
  { code: 'streak-5', name: '势不可挡', description: '达成5连胜', icon: '⚡', rarity: 'rare', points: 30, category: 'streak', requirement: { streak: 5 } },
  { code: 'streak-10', name: '超神模式', description: '达成10连胜', icon: '👑', rarity: 'epic', points: 100, category: 'streak', requirement: { streak: 10 } },

  // 进度类
  { code: 'first-win', name: '初入学院', description: '答对第一道题', icon: '🌟', rarity: 'common', points: 5, category: 'progress', requirement: { correctCount: 1 } },
  { code: 'knowledge-10', name: '知识探险家', description: '解锁10个知识点', icon: '🗺️', rarity: 'rare', points: 50, category: 'progress', requirement: { knowledgePoints: 10 } },
  { code: 'comeback', name: '逆袭之王', description: '从60分提升到80分', icon: '🚀', rarity: 'legendary', points: 200, category: 'progress', requirement: { scoreImprovement: 20, minScore: 80 } },

  // 社交类
  { code: 'challenger', name: '挑战者', description: '发起3次挑战', icon: '⚔️', rarity: 'rare', points: 40, category: 'social', requirement: { challengesSent: 3 } },
  { code: 'team-player', name: '团队核心', description: '完成5次组队Boss战', icon: '👥', rarity: 'epic', points: 80, category: 'social', requirement: { teamBattles: 5 } },
  { code: 'class-first', name: '班级第一', description: '班级排名达到第1', icon: '🏆', rarity: 'legendary', points: 300, category: 'social', requirement: { classRank: 1 } },
];

export function getAllAchievements(): Omit<Achievement, 'id' | 'unlockedAt'>[] {
  return ACHIEVEMENTS;
}

export function checkAchievement(
  userState: {
    currentStreak: number;
    bestStreak: number;
    correctCount: number;
    knowledgePoints: number;
    score: number;
    initialScore: number;
    challengesSent: number;
    teamBattles: number;
    classRank: number;
  }
): Achievement[] {
  const unlocked: Achievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (checkRequirement(userState, achievement.requirement)) {
      unlocked.push({
        ...achievement,
        id: achievement.code,
        unlockedAt: new Date(),
      });
    }
  }

  return unlocked;
}

function checkRequirement(userState: any, requirement: any): boolean {
  // 实现各种成就的解锁条件检查
  if (requirement.streak) return userState.currentStreak >= requirement.streak;
  if (requirement.correctCount) return userState.correctCount >= requirement.correctCount;
  if (requirement.knowledgePoints) return userState.knowledgePoints >= requirement.knowledgePoints;
  if (requirement.scoreImprovement) {
    return (userState.score - userState.initialScore) >= requirement.scoreImprovement &&
           userState.score >= requirement.minScore;
  }
  if (requirement.challengesSent) return userState.challengesSent >= requirement.challengesSent;
  if (requirement.teamBattles) return userState.teamBattles >= requirement.teamBattles;
  if (requirement.classRank) return userState.classRank === requirement.classRank;
  return false;
}
```

---

## UI组件实现

### Task 9: 主题选择器

**文件:** `components/gaming/theme/ThemeSelector.tsx`

```typescript
'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useGamingStore } from '@/lib/stores/gaming-store';
import { gamingApi } from '@/lib/api';
import { getAllThemes } from '@/lib/gaming/theme-engine';
import type { ThemeId } from '@/types/gaming';

export function ThemeSelector() {
  const activeThemeId = useGamingStore((state) => state.activeThemeId);
  const setTheme = useGamingStore((state) => state.setTheme);

  const themes = getAllThemes();

  const handleSelect = async (themeId: ThemeId) => {
    setTheme(themeId);
    await gamingApi.setTheme({ themeId });
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {themes.map((theme) => (
        <motion.button
          key={theme.id}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSelect(theme.id as ThemeId)}
          className={`
            relative p-4 rounded-xl border-2 transition-all
            ${activeThemeId === theme.id || activeThemeId.startsWith(theme.id)
              ? 'border-purple-500 bg-purple-500/20'
              : 'border-white/10 bg-surface-variant/10 hover:border-white/20'}
          `}
          style={{
            background: activeThemeId === theme.id || activeThemeId.startsWith(theme.id)
              ? theme.colors.surface
              : undefined,
          }}
        >
          <div className="text-4xl mb-2">{theme.icons.badge}</div>
          <div className="font-bold text-white">{theme.displayName}</div>
          <div className="text-xs text-on-surface-variant mt-1">{theme.description}</div>
        </motion.button>
      ))}
    </div>
  );
}
```

---

### Task 10: 全服排行榜（残酷版）

**文件:** `components/gaming/rankings/GlobalRanking.tsx`

```typescript
'use client';

import React from 'react';
import { motion } from 'motion/react';
import MaterialIcon from '../MaterialIcon';
import type { RankingEntry } from '@/types/gaming';

interface GlobalRankingProps {
  rankings: RankingEntry[];
  yourRank?: number;
}

export function GlobalRanking({ rankings, yourRank }: GlobalRankingProps) {
  const top10 = rankings.slice(0, 10);

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-xl p-6 border border-purple-500/30">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-6">
        <MaterialIcon icon="emoji_events" className="text-yellow-400 text-3xl" />
        <h3 className="text-xl font-bold text-white">全服风云榜 - 本周</h3>
      </div>

      {/* 排行榜 */}
      <div className="space-y-2">
        {top10.map((entry, index) => (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center justify-between p-3 rounded-lg bg-black/20"
          >
            <div className="flex items-center gap-4">
              {/* 排名 */}
              <div className="w-10 text-center font-bold text-lg">
                {getRankIcon(index + 1)}
              </div>

              {/* 用户信息 */}
              <div>
                <div className="font-medium text-white">{entry.userName}</div>
                <div className="text-xs text-on-surface-variant">
                  {getThemeName(entry.themeId)} Lv.{entry.level}
                </div>
              </div>
            </div>

            {/* 统计 */}
            <div className="flex items-center gap-4">
              {entry.streak >= 3 && (
                <div className="text-orange-400 text-sm">🔥 {entry.streak}</div>
              )}
              <div className="text-white font-bold">{entry.score}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 你的位置 */}
      {yourRank && yourRank > 10 && (
        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-purple-300">
            你还差 <strong className="text-white">{yourRank - 10}</strong> 名就能进入前十！
          </p>
        </div>
      )}
    </div>
  );
}

function getRankIcon(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function getThemeName(themeId: string): string {
  const names: Record<string, string> = {
    'magic-academy': '魔法学院',
    'career': '职业养成',
    'racing': '极限竞速',
    'detective': '特工行动',
  };
  return names[themeId] || themeId;
}
```

---

### Task 11: 挑战对话框

**文件:** `components/gaming/challenges/ChallengeDialog.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { gamingApi } from '@/lib/api';
import type { Challenge } from '@/types/gaming';

interface ChallengeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availablePlayers: Array<{ userId: string; userName: string; level: number; themeId: string }>;
  currentStreak: number;
  myPoints: number;
}

export function ChallengeDialog({
  isOpen,
  onClose,
  availablePlayers,
  currentStreak,
  myPoints,
}: ChallengeDialogProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSendChallenge = async () => {
    if (!selectedPlayer) return;

    setIsSending(true);
    try {
      // 生成一道难题作为挑战
      const questionRes = await fetch('/api/questions/recommend?difficulty=8&count=1');
      const { questions } = await questionRes.json();

      await gamingApi.createChallenge(
        selectedPlayer,
        questions[0].id,
        8  // 困难等级
      );

      onClose();
    } catch (error) {
      console.error('发送挑战失败:', error);
    } finally {
      setIsSending(false);
    }
  };

  const getStrengthLabel = (level: number) => {
    if (level > 15) return { text: '强', color: 'text-red-400' };
    if (level > 10) return { text: '中等', color: 'text-yellow-400' };
    return { text: '可战胜', color: 'text-green-400' };
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-surface rounded-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4">⚔️ 向同学发起挑战</h3>

            <div className="mb-4">
              <p className="text-sm text-on-surface-variant mb-2">选择对手：</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availablePlayers.map((player) => {
                  const strength = getStrengthLabel(player.level);
                  return (
                    <button
                      key={player.userId}
                      onClick={() => setSelectedPlayer(player.userId)}
                      className={`
                        w-full flex items-center justify-between p-3 rounded-lg text-left transition-all
                        ${selectedPlayer === player.userId
                          ? 'bg-purple-500/30 border border-purple-500'
                          : 'bg-surface-variant/20 hover:bg-surface-variant/30'}
                      `}
                    >
                      <div>
                        <div className="font-medium text-white">{player.userName}</div>
                        <div className="text-xs text-on-surface-variant">
                          {getThemeName(player.themeId)} Lv.{player.level}
                        </div>
                      </div>
                      <div className={`text-sm ${strength.color}`}>{strength.text}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 挑战规则 */}
            <div className="bg-surface-variant/10 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-white mb-2">挑战规则：</p>
              <ul className="text-xs text-on-surface-variant space-y-1">
                <li>• 你选一道难题发给对方</li>
                <li>• 对方必须在1小时内答题</li>
                <li>• 对方答错 = 你获得 Ta 20%积分</li>
                <li>• 对方答对 = 你失去 10%积分</li>
              </ul>
            </div>

            {/* 你的信息 */}
            <div className="flex items-center justify-between text-sm mb-4">
              <span className="text-on-surface-variant">你的连胜：</span>
              <span className="text-orange-400 font-bold">🔥 {currentStreak}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-6">
              <span className="text-on-surface-variant">你的积分：</span>
              <span className="text-white font-bold">{myPoints}</span>
            </div>

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg bg-surface-variant text-white"
              >
                取消
              </button>
              <button
                onClick={handleSendChallenge}
                disabled={!selectedPlayer || isSending}
                className="flex-1 px-4 py-2 rounded-lg bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? '发送中...' : '发起挑战'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function getThemeName(themeId: string): string {
  const names: Record<string, string> = {
    'magic-academy': '魔法',
    'career': '职业',
    'racing': '竞速',
    'detective': '特工',
  };
  return names[themeId] || '';
}
```

---

### Task 12: 组队Boss战

**文件:** `components/gaming/teams/BossBattle.tsx`

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { gamingApi } from '@/lib/api';
import type { TeamInfo, TeamMemberInfo } from '@/types/gaming';

export function BossBattle() {
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [isForming, setIsForming] = useState(false);

  useEffect(() => {
    // 获取当前队伍信息
    loadTeamInfo();
  }, []);

  const loadTeamInfo = async () => {
    try {
      const res = await fetch('/api/gaming/teams/current');
      if (res.ok) {
        const data = await res.json();
        setTeam(data.team);
      }
    } catch (error) {
      console.error('获取队伍信息失败:', error);
    }
  };

  const handleCreateTeam = async () => {
    setIsForming(true);
    try {
      // 获取一道Boss题（最薄弱的知识点）
      const res = await fetch('/api/questions/weakness-boss');
      const { question } = await res.json();

      const newTeam = await gamingApi.createTeam(question.id);
      setTeam(newTeam);
    } catch (error) {
      console.error('创建队伍失败:', error);
    } finally {
      setIsForming(false);
    }
  };

  if (!team) {
    return (
      <div className="bg-surface-variant/20 rounded-xl p-6 text-center">
        <div className="text-4xl mb-4">👥</div>
        <h3 className="text-lg font-bold text-white mb-2">组队挑战 - 弱点Boss战</h3>
        <p className="text-sm text-on-surface-variant mb-4">
          3人组队，每人完成不同类型题目，全员成功才能获得奖励！
        </p>
        <button
          onClick={handleCreateTeam}
          disabled={isForming}
          className="px-6 py-2 rounded-lg bg-purple-500 text-white disabled:opacity-50"
        >
          {isForming ? '创建中...' : '创建队伍'}
        </button>
      </div>
    );
  }

  return <TeamView team={team} onUpdate={loadTeamInfo} />;
}

function TeamView({ team, onUpdate }: { team: TeamInfo; onUpdate: () => void }) {
  const [myTask, setMyTask] = useState<'calc' | 'application' | 'proof' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStartBattle = async () => {
    try {
      await gamingApi.startBossBattle(team.id);
      onUpdate();
    } catch (error) {
      console.error('开始Boss战失败:', error);
    }
  };

  const handleSubmitTask = async (isCorrect: boolean) => {
    setIsSubmitting(true);
    try {
      await gamingApi.submitTeamProgress(team.id, isCorrect);
      onUpdate();
    } catch (error) {
      console.error('提交任务失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canStart = team.members.length === 3 && team.status === 'forming';
  const allReady = team.members.length === 3 &&
    team.members.every(m => m.status === 'completed');

  return (
    <div className="bg-surface-variant/20 rounded-xl p-6">
      {/* 队伍信息 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">👥 队伍</h3>
        <div className={`px-3 py-1 rounded-full text-sm ${
          team.status === 'forming' ? 'bg-yellow-500/20 text-yellow-400' :
          team.status === 'active' ? 'bg-red-500/20 text-red-400' :
          team.status === 'completed' ? 'bg-green-500/20 text-green-400' :
          'bg-gray-500/20 text-gray-400'
        }`}>
          {team.status === 'forming' ? '组队中' :
           team.status === 'active' ? '战斗中' :
           team.status === 'completed' ? '已完成' : '失败'}
        </div>
      </div>

      {/* 成员列表 */}
      <div className="space-y-3 mb-6">
        {team.members.map((member) => (
          <div
            key={member.userId}
            className="flex items-center justify-between p-3 rounded-lg bg-black/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                {member.userName[0]}
              </div>
              <div>
                <div className="font-medium text-white">{member.userName}</div>
                <div className="text-xs text-on-surface-variant">
                  {member.role === 'leader' ? '队长' : '队员'}
                </div>
              </div>
            </div>
            <div className={`text-sm px-2 py-1 rounded ${
              member.status === 'ready' ? 'bg-blue-500/20 text-blue-400' :
              member.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
              member.status === 'completed' ? 'bg-green-500/20 text-green-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {member.status === 'ready' ? '准备中' :
               member.status === 'in_progress' ? '进行中' :
               member.status === 'completed' ? '已完成' : '失败'}
            </div>
          </div>
        ))}
      </div>

      {/* Boss血量 */}
      {team.status === 'active' && (
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white">Boss血量</span>
            <span className="text-red-400">
              {team.members.filter(m => m.status === 'completed').length * 25}%
            </span>
          </div>
          <div className="h-3 bg-black/30 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${team.members.filter(m => m.status === 'completed').length * 25}%`
              }}
              className="h-full bg-gradient-to-r from-red-500 to-orange-500"
            />
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      {team.status === 'forming' && canStart && (
        <button
          onClick={handleStartBattle}
          className="w-full px-4 py-3 rounded-lg bg-red-500 text-white font-bold"
        >
          开始Boss战
        </button>
      )}

      {team.status === 'completed' && (
        <div className="text-center">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-green-400 font-bold">Boss战胜利！每人+100分</p>
        </div>
      )}

      {team.status === 'failed' && (
        <div className="text-center">
          <div className="text-4xl mb-2">💔</div>
          <p className="text-red-400">Boss战失败，下次加油！</p>
        </div>
      )}
    </div>
  );
}
```

---

### Task 13: 成就展示与解锁

**文件:** `components/gaming/achievements/AchievementGrid.tsx`

```typescript
'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { gamingApi } from '@/lib/api';
import { getAllAchievements } from '@/lib/gaming/achievement-system';
import type { Achievement } from '@/types/gaming';

export function AchievementGrid() {
  const [unlocked, setUnlocked] = useState<Achievement[]>([]);
  const [showUnlock, setShowUnlock] = useState<Achievement | null>(null);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      const res = await fetch('/api/gaming/achievements');
      const data = await res.json();
      setUnlocked(data.achievements || []);

      // 检查是否有新解锁的成就
      const newUnlocks = data.newUnlocks || [];
      if (newUnlocks.length > 0) {
        setShowUnlock(newUnlocks[0]);
      }
    } catch (error) {
      console.error('获取成就失败:', error);
    }
  };

  const allAchievements = getAllAchievements();
  const unlockedCodes = new Set(unlocked.map(a => a.code));

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {allAchievements.map((achievement) => {
          const isUnlocked = unlockedCodes.has(achievement.code);

          return (
            <motion.div
              key={achievement.code}
              whileHover={{ scale: 1.05 }}
              className={`
                relative p-4 rounded-xl border-2 transition-all
                ${isUnlocked
                  ? getRarityBorder(achievement.rarity)
                  : 'border-white/10 opacity-50'}
              `}
            >
              {/* 图标 */}
              <div className={`text-3xl mb-2 ${isUnlocked ? '' : 'grayscale'}`}>
                {achievement.icon || '🏆'}
              </div>

              {/* 名称 */}
              <div className={`font-bold text-sm mb-1 ${
                isUnlocked ? 'text-white' : 'text-gray-400'
              }`}>
                {achievement.name}
              </div>

              {/* 描述 */}
              <div className="text-xs text-on-surface-variant">
                {achievement.description}
              </div>

              {/* 稀有度 */}
              <div className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded ${
                isUnlocked ? getRarityBadge(achievement.rarity) : 'bg-gray-500/20 text-gray-400'
              }`}>
                {getRarityLabel(achievement.rarity)}
              </div>

              {/* 未解锁遮罩 */}
              {!isUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                  <span className="text-2xl">🔒</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 成就解锁动画 */}
      <AnimatePresence>
        {showUnlock && (
          <AchievementUnlock
            achievement={showUnlock}
            onClose={() => setShowUnlock(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function AchievementUnlock({
  achievement,
  onClose,
}: {
  achievement: Achievement;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.5, opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
    >
      <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm rounded-2xl p-8 text-center border-2 border-yellow-500/50">
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
          transition={{ duration: 0.5 }}
          className="text-6xl mb-4"
        >
          🏆
        </motion.div>
        <div className="text-2xl font-bold text-white mb-2">
          新成就解锁！
        </div>
        <div className={`text-xl mb-2 ${getRarityText(achievement.rarity)}`}>
          [{achievement.name}]
        </div>
        <div className="text-sm text-on-surface-variant">
          {achievement.description}
        </div>
        <div className="mt-4 text-sm text-purple-300">
          全班只有 5% 的人获得这个成就！
        </div>
      </div>
    </motion.div>
  );
}

function getRarityBorder(rarity: string): string {
  switch (rarity) {
    case 'common': return 'border-gray-500';
    case 'rare': return 'border-blue-500';
    case 'epic': return 'border-purple-500';
    case 'legendary': return 'border-yellow-500 shadow-lg shadow-yellow-500/20';
    default: return 'border-white/10';
  }
}

function getRarityBadge(rarity: string): string {
  switch (rarity) {
    case 'common': return 'bg-gray-500/20 text-gray-400';
    case 'rare': return 'bg-blue-500/20 text-blue-400';
    case 'epic': return 'bg-purple-500/20 text-purple-400';
    case 'legendary': return 'bg-yellow-500/20 text-yellow-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
}

function getRarityLabel(rarity: string): string {
  switch (rarity) {
    case 'common': return '普通';
    case 'rare': return '稀有';
    case 'epic': return '史诗';
    case 'legendary': return '传说';
    default: return '未知';
  }
}

function getRarityText(rarity: string): string {
  switch (rarity) {
    case 'common': return 'text-gray-400';
    case 'rare': return 'text-blue-400';
    case 'epic': return 'text-purple-400';
    case 'legendary': return 'text-yellow-400';
    default: return 'text-white';
  }
}
```

---

### Task 14: 完整反馈系统（含暴击）

**文件:** `components/gaming/feedback/FeedbackAnimator.tsx`

```typescript
'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGamingStore } from '@/lib/stores/gaming-store';
import type { FeedbackType, CriticalHitResult } from '@/types/gaming';
import './feedback-animations.css';

interface FeedbackAnimatorProps {
  type: FeedbackType;
  message: string;
  points?: number;
  criticalHit?: CriticalHitResult;
  streak?: number;
  duration?: number;
  onComplete?: () => void;
}

const FEEDBACK_CONFIG: Record<FeedbackType, { emoji: string; color: string; bg: string }> = {
  'correct': { emoji: '✨', color: 'text-green-400', bg: 'bg-green-500/20' },
  'wrong': { emoji: '💭', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  'streak-3': { emoji: '🔥', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  'streak-5': { emoji: '⚡', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  'streak-10': { emoji: '👑', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  'rebound': { emoji: '💪', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  'critical': { emoji: '💥', color: 'text-red-400', bg: 'bg-red-500/20' },
  'achievement': { emoji: '🏆', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  'boss-defeated': { emoji: '🎉', color: 'text-green-400', bg: 'bg-green-500/20' },
};

export function FeedbackAnimator({
  type,
  message,
  points,
  criticalHit,
  streak,
  duration = 2000,
  onComplete,
}: FeedbackAnimatorProps) {
  const [isVisible, setIsVisible] = useState(true);
  const soundEnabled = useGamingStore((state) => state.soundEnabled);
  const config = FEEDBACK_CONFIG[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  // 暴击特效
  const isCritical = criticalHit?.isCritical && type === 'correct';
  const critMultiplier = criticalHit?.multiplier || 1;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: isCritical ? 2 : 1.5, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
        >
          <div
            className={`
              rounded-2xl p-8 text-center relative overflow-hidden
              ${isCritical ? getCriticalBg(criticalHit.animation) : config.bg}
              backdrop-blur-sm border-2 ${isCritical ? getCriticalBorder(criticalHit.animation) : 'border-white/10'}
            `}
          >
            {/* 暴击背景特效 */}
            {isCritical && (
              <div className="absolute inset-0 opacity-30">
                <div className={getCriticalAnimation(criticalHit.animation)} />
              </div>
            )}

            {/* Emoji */}
            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                rotate: isCritical ? [0, -5, 5, -5, 0] : 0,
              }}
              transition={{ duration: isCritical ? 0.8 : 0.5, repeat: isCritical ? 1 : 0 }}
              className="text-6xl mb-4 relative z-10"
            >
              {isCritical ? '💥' : config.emoji}
            </motion.div>

            {/* Message */}
            <div className={`text-2xl font-bold mb-2 relative z-10 ${config.color}`}>
              {isCritical ? '暴击！' : message}
            </div>

            {/* Points */}
            {points !== undefined && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xl text-white relative z-10"
              >
                +{Math.floor(points * critMultiplier)} 积分
                {critMultiplier > 1 && (
                  <span className="text-yellow-400 ml-2">x{critMultiplier}</span>
                )}
              </motion.div>
            )}

            {/* Streak */}
            {streak && streak >= 3 && (
              <div className="text-sm text-orange-400 mt-2 relative z-10">
                🔥 {streak} 连胜
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function getCriticalBg(animation: string): string {
  switch (animation) {
    case 'rare': return 'bg-blue-500/30';
    case 'epic': return 'bg-purple-500/30';
    case 'legendary': return 'bg-gradient-to-br from-yellow-500/30 to-orange-500/30';
    default: return 'bg-white/10';
  }
}

function getCriticalBorder(animation: string): string {
  switch (animation) {
    case 'rare': return 'border-blue-400';
    case 'epic': return 'border-purple-400';
    case 'legendary': return 'border-yellow-400';
    default: return 'border-white/20';
  }
}

function getCriticalAnimation(animation: string): string {
  switch (animation) {
    case 'rare': return 'critical-rare';
    case 'epic': return 'critical-epic';
    case 'legendary': return 'critical-legendary';
    default: return '';
  }
}

// 快捷组件
export function CorrectFeedback({
  points,
  criticalHit,
  streak,
  onComplete,
}: {
  points?: number;
  criticalHit?: CriticalHitResult;
  streak?: number;
  onComplete?: () => void;
}) {
  return (
    <FeedbackAnimator
      type={criticalHit?.isCritical ? 'critical' : 'correct'}
      message="答对啦！"
      points={points}
      criticalHit={criticalHit}
      streak={streak}
      onComplete={onComplete}
    />
  );
}

export function WrongFeedback({ onComplete }: { onComplete?: () => void }) {
  return (
    <FeedbackAnimator
      type="wrong"
      message="还没掌握，加油！"
      onComplete={onComplete}
    />
  );
}
```

---

### Task 15: API路由完整实现

**15.1 挑战API**
```typescript
// app/api/gaming/challenges/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET - 获取挑战列表
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'all'; // sent | received | all

  const where: any = {};
  if (type === 'sent') {
    where.challengerId = session.user.id;
  } else if (type === 'received') {
    where.receiverId = session.user.id;
  } else {
    where.OR = [
      { challengerId: session.user.id },
      { receiverId: session.user.id },
    ];
  }

  const challenges = await prisma.challenge.findMany({
    where,
    include: {
      challenger: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ challenges });
}

// POST - 创建挑战
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { receiverId, questionId, difficulty } = await req.json();

  // 检查积分是否足够
  const challengerStreak = await prisma.streakRecord.findUnique({
    where: { userId: session.user.id },
  });

  if (!challengerStreak || challengerStreak.currentStreak < 3) {
    return NextResponse.json({ error: '需要至少3连胜才能发起挑战' }, { status: 400 });
  }

  const challenge = await prisma.challenge.create({
    data: {
      challengerId: session.user.id,
      receiverId,
      questionId,
      difficulty,
      challengerStake: Math.floor(challengerStreak.currentStreak * 5),
      receiverStake: Math.floor(challengerStreak.currentStreak * 10),
    },
  });

  // TODO: 发送通知给接收者

  return NextResponse.json({ challenge });
}
```

**15.2 Boss题API**
```typescript
// app/api/questions/weakness-boss/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 获取用户最薄弱的知识点
  const weakKnowledge = await prisma.userKnowledge.findMany({
    where: { userId: session.user.id },
    orderBy: { mastery: 'asc' },
    take: 1,
  });

  if (weakKnowledge.length === 0) {
    return NextResponse.json({ error: '没有找到薄弱知识点' }, { status: 404 });
  }

  // 获取该知识点下最难的题目
  const question = await prisma.question.findFirst({
    where: {
      knowledgePoints: { contains: weakKnowledge[0].knowledgePointId },
      difficulty: { gte: 7 }, // 高难度
    },
    orderBy: { difficulty: 'desc' },
  });

  if (!question) {
    return NextResponse.json({ error: '没有找到合适的Boss题' }, { status: 404 });
  }

  return NextResponse.json({ question });
}
```

**15.3 排行榜API（实时）**
```typescript
// app/api/gaming/rankings/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'global'; // global | class | theme

  if (type === 'global') {
    return getGlobalRankings(session.user.id);
  } else if (type === 'class') {
    return getClassRankings(session.user.id);
  } else {
    return getThemeRankings(session.user.id, searchParams.get('themeId'));
  }
}

async function getGlobalRankings(userId: string) {
  // 获取前10名
  const topUsers = await prisma.streakRecord.findMany({
    orderBy: [
      { bestStreak: 'desc' },
      { currentStreak: 'desc' },
    ],
    take: 10,
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });

  const rankings = topUsers.map((record, index) => ({
    userId: record.user.id,
    userName: record.user.name || '同学',
    score: record.currentStreak * 10 + record.bestStreak * 5,
    streak: record.currentStreak,
    rank: index + 1,
    change: 0, // TODO: 从历史记录计算
    themeId: 'magic-academy', // TODO: 从用户设置获取
    level: 1, // TODO: 从用户进度计算
  }));

  // 获取自己的排名
  const myRank = await prisma.streakRecord.count({
    where: {
      OR: [
        {
          bestStreak: { gt: rankings[rankings.length - 1]?.score || 0 },
        },
        {
          bestStreak: { equals: rankings[rankings.length - 1]?.score },
          currentStreak: { gt: 0 },
        },
      ],
    },
  });

  return NextResponse.json({
    type: 'global',
    rankings,
    yourRank: myRank + 1,
  });
}

async function getClassRankings(userId: string) {
  const classMembership = await prisma.classMembership.findUnique({
    where: { userId },
  });

  if (!classMembership) {
    return NextResponse.json({
      type: 'class',
      rankings: [],
      yourRank: null,
      classAverage: 0,
    });
  }

  // 获取班级所有成员
  const members = await prisma.classMembership.findMany({
    where: {
      className: classMembership.className,
      grade: classMembership.grade,
    },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });

  const userIds = members.map(m => m.userId);

  // 获取这些用户的连胜记录
  const streakRecords = await prisma.streakRecord.findMany({
    where: { userId: { in: userIds } },
  });

  const rankings = members.map((member) => {
    const streak = streakRecords.find(s => s.userId === member.userId);
    const score = streak ? streak.currentStreak * 10 + streak.bestStreak * 5 : 0;

    return {
      userId: member.userId,
      userName: member.user.name || '同学',
      score,
      streak: streak?.currentStreak || 0,
      rank: 0,
      change: 0,
    };
  });

  rankings.sort((a, b) => b.score - a.score);
  rankings.forEach((r, i) => r.rank = i + 1);

  const yourRanking = rankings.find(r => r.userId === userId);
  const classAverage = rankings.reduce((sum, r) => sum + r.score, 0) / rankings.length;

  return NextResponse.json({
    type: 'class',
    className: classMembership.className,
    grade: classMembership.grade,
    rankings,
    yourRank: yourRanking?.rank || null,
    classAverage: Math.round(classAverage),
  });
}
```

---

### Task 16: 集成到练习页面（完整版）

**修改文件:** `components/ExercisePage.tsx`

在答题结果处理中：

```typescript
// 答题结果处理
const handleAnswerResult = async (isCorrect: boolean) => {
  // 1. 检查暴击
  const criticalHit = rollCriticalHit(currentQuestion.difficulty);
  const points = calculatePoints(isCorrect, currentQuestion.difficulty, criticalHit);

  // 2. 更新连胜
  const streakUpdate = await updateStreakAPI({
    isCorrect,
    isRecommended: currentQuestion.isRecommended,
  });

  // 3. 检查成就解锁
  const newAchievements = await checkAchievements();

  // 4. 显示反馈
  if (isCorrect) {
    setShowFeedback({
      type: criticalHit.isCritical ? 'critical' : 'correct',
      message: getThemeTerm(activeThemeId, 'correct'),
      points,
      criticalHit,
      streak: streakUpdate.newStreak,
    });
  } else {
    setShowFeedback({
      type: 'wrong',
      message: getThemeTerm(activeThemeId, 'wrong'),
    });
  }

  // 5. 播放音效
  if (soundEnabled) {
    playSound(isCorrect ? 'correct' : 'wrong');
    if (criticalHit.isCritical) playSound('streak');
  }
};
```

---

## 验收标准

### 功能完整性
- [ ] 四个主题全部可用（魔法学院、职业养成、极限竞速、特工行动）
- [ ] 主题切换即时生效，设置持久化
- [ ] 连胜系统正常工作（带防护机制）
- [ ] 暴击系统正常工作（简单题5%、中等2%、困难1%）
- [ ] 全服排行榜实时更新（前10名）
- [ ] 班级排行榜正确显示
- [ ] 挑战系统完整（发起、接收、结算）
- [ ] 组队Boss战完整（组队、分配任务、结算）
- [ ] 成就系统完整（解锁、展示、炫耀）
- [ ] 反馈动画完整（答对、答错、暴击、连胜、成就）
- [ ] 音效默认静音，可切换

### 性能要求
- [ ] 主题切换 < 100ms
- [ ] 反馈动画延迟 < 50ms
- [ ] 排行榜加载 < 500ms
- [ ] 暴击计算 < 10ms
- [ ] 成就检查 < 100ms

### 社交功能
- [ ] 排行榜实时更新（WebSocket或轮询）
- [ ] 挑战通知及时送达
- [ ] 组队状态实时同步
- [ ] 成就解锁可分享

### 数据完整性
- [ ] DFI ≥ 0.99（学习事件链完整）
- [ ] LE > 0.15（学习有效性不降低）
- [ ] CS ≥ 0.85（推荐稳定性不降低）

---

*计划版本: 2.0 (完整产品)*
*作者: Claude Code*
*创建日期: 2026-04-30*
*基于: 游戏化设计方案 V2*
