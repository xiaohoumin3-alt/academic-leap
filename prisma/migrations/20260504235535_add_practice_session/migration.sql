-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "answers" TEXT NOT NULL DEFAULT '[]',
    "subject" TEXT,
    "questionCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "PracticeSession_userId_status_idx" ON "PracticeSession"("userId", "status");

-- CreateIndex
CREATE INDEX "PracticeSession_userId_updatedAt_idx" ON "PracticeSession"("userId", "updatedAt");
