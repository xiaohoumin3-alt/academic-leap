-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "theme" TEXT NOT NULL DEFAULT 'magic-academy',
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "streakLastUpdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCriticalHits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Streak" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "leDelta" REAL NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Streak_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Achievement_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CriticalHitLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "xpMultiplier" REAL NOT NULL,
    "baseXP" INTEGER NOT NULL,
    "bonusXP" INTEGER NOT NULL,
    "triggerReason" TEXT NOT NULL,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ParentalControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "gamificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyXPCap" INTEGER NOT NULL DEFAULT 500,
    "allowedTimeStart" TEXT DEFAULT '08:00',
    "allowedTimeEnd" TEXT DEFAULT '21:00',
    "showRankings" BOOLEAN NOT NULL DEFAULT true,
    "rewardThreshold" INTEGER NOT NULL DEFAULT 100,
    CONSTRAINT "ParentalControl_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GamificationFailure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "leDelta" REAL NOT NULL,
    "duration" INTEGER NOT NULL,
    "error" TEXT NOT NULL,
    "failedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retryCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_userId_key" ON "PlayerProfile"("userId");

-- CreateIndex
CREATE INDEX "PlayerProfile_userId_totalXP_idx" ON "PlayerProfile"("userId", "totalXP");

-- CreateIndex
CREATE INDEX "PlayerProfile_level_idx" ON "PlayerProfile"("level");

-- CreateIndex
CREATE INDEX "Streak_userId_startedAt_idx" ON "Streak"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "Streak_profileId_idx" ON "Streak"("profileId");

-- CreateIndex
CREATE INDEX "Achievement_userId_idx" ON "Achievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_userId_type_key" ON "Achievement"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "CriticalHitLog_eventId_key" ON "CriticalHitLog"("eventId");

-- CreateIndex
CREATE INDEX "CriticalHitLog_userId_loggedAt_idx" ON "CriticalHitLog"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "CriticalHitLog_attemptId_idx" ON "CriticalHitLog"("attemptId");

-- CreateIndex
CREATE INDEX "CriticalHitLog_eventId_idx" ON "CriticalHitLog"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentalControl_profileId_key" ON "ParentalControl"("profileId");

-- CreateIndex
CREATE INDEX "ParentalControl_profileId_idx" ON "ParentalControl"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "GamificationFailure_eventId_key" ON "GamificationFailure"("eventId");

-- CreateIndex
CREATE INDEX "GamificationFailure_userId_failedAt_idx" ON "GamificationFailure"("userId", "failedAt");

-- CreateIndex
CREATE INDEX "GamificationFailure_eventId_idx" ON "GamificationFailure"("eventId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

-- CreateIndex
CREATE INDEX "PasswordResetToken_code_idx" ON "PasswordResetToken"("code");
