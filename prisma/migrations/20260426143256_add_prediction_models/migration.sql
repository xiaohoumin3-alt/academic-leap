/*
  Warnings:

  - You are about to drop the column `knowledgePoint` on the `UserKnowledge` table. All the data in the column will be lost.
  - Added the required column `knowledgePointId` to the `UserKnowledge` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "knowledgeData" TEXT NOT NULL DEFAULT '[]',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearningPath_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PathAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pathId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "changes" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PathAdjustment_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pathId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "weekEnd" DATETIME NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '{}',
    "staleKnowledge" TEXT NOT NULL DEFAULT '[]',
    "recommendations" TEXT NOT NULL DEFAULT '{}',
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyReport_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skeleton" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT
);

-- CreateTable
CREATE TABLE "StudentAbility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "ability" REAL NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentAbility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PredictionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT,
    "predicted" REAL NOT NULL,
    "actual" BOOLEAN,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PredictionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "templateKey" TEXT,
    "structure" JSONB NOT NULL,
    "params" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "knowledgeId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "skeletonIds" TEXT NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    CONSTRAINT "Template_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "KnowledgeConcept" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Template_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Template" ("createdAt", "createdBy", "id", "knowledgeId", "name", "params", "publishedAt", "status", "steps", "structure", "templateKey", "type", "updatedAt", "version") SELECT "createdAt", "createdBy", "id", "knowledgeId", "name", "params", "publishedAt", "status", "steps", "structure", "templateKey", "type", "updatedAt", "version" FROM "Template";
DROP TABLE "Template";
ALTER TABLE "new_Template" RENAME TO "Template";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "targetScore" INTEGER NOT NULL DEFAULT 90,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "initialAssessmentCompleted" BOOLEAN NOT NULL DEFAULT false,
    "initialAssessmentScore" INTEGER,
    "initialAssessmentDate" DATETIME,
    "reviewAssessmentCompleted" BOOLEAN NOT NULL DEFAULT false,
    "reviewAssessmentScore" INTEGER,
    "reviewAssessmentDate" DATETIME,
    "currentLevel" INTEGER NOT NULL DEFAULT 0,
    "startingScoreCalibrated" BOOLEAN NOT NULL DEFAULT false,
    "calibratedStartingScore" INTEGER,
    "selectedSubject" TEXT,
    "selectedTextbookId" TEXT,
    "studyProgress" INTEGER NOT NULL DEFAULT 0,
    "semesterStart" DATETIME,
    "semesterEnd" DATETIME,
    "includeStale" BOOLEAN NOT NULL DEFAULT false,
    "pathUpdateMode" TEXT NOT NULL DEFAULT 'auto',
    "weeklyReportDay" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_User" ("calibratedStartingScore", "createdAt", "currentLevel", "email", "grade", "id", "initialAssessmentCompleted", "initialAssessmentDate", "initialAssessmentScore", "name", "password", "reviewAssessmentCompleted", "reviewAssessmentDate", "reviewAssessmentScore", "selectedSubject", "selectedTextbookId", "startingScoreCalibrated", "studyProgress", "targetScore", "updatedAt") SELECT "calibratedStartingScore", "createdAt", "currentLevel", "email", "grade", "id", "initialAssessmentCompleted", "initialAssessmentDate", "initialAssessmentScore", "name", "password", "reviewAssessmentCompleted", "reviewAssessmentDate", "reviewAssessmentScore", "selectedSubject", "selectedTextbookId", "startingScoreCalibrated", "studyProgress", "targetScore", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "new_UserKnowledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "knowledgePointId" TEXT NOT NULL,
    "mastery" REAL NOT NULL,
    "lastPractice" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "practiceCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserKnowledge_knowledgePointId_fkey" FOREIGN KEY ("knowledgePointId") REFERENCES "KnowledgePoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserKnowledge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserKnowledge" ("id", "lastPractice", "mastery", "practiceCount", "userId") SELECT "id", "lastPractice", "mastery", "practiceCount", "userId" FROM "UserKnowledge";
DROP TABLE "UserKnowledge";
ALTER TABLE "new_UserKnowledge" RENAME TO "UserKnowledge";
CREATE UNIQUE INDEX "UserKnowledge_userId_knowledgePointId_key" ON "UserKnowledge"("userId", "knowledgePointId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "LearningPath_userId_status_idx" ON "LearningPath"("userId", "status");

-- CreateIndex
CREATE INDEX "PathAdjustment_pathId_createdAt_idx" ON "PathAdjustment"("pathId", "createdAt");

-- CreateIndex
CREATE INDEX "WeeklyReport_pathId_weekStart_idx" ON "WeeklyReport"("pathId", "weekStart");

-- CreateIndex
CREATE INDEX "StudentAbility_userId_idx" ON "StudentAbility"("userId");

-- CreateIndex
CREATE INDEX "StudentAbility_nodeId_idx" ON "StudentAbility"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAbility_userId_nodeId_key" ON "StudentAbility"("userId", "nodeId");

-- CreateIndex
CREATE INDEX "PredictionLog_userId_createdAt_idx" ON "PredictionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PredictionLog_createdAt_idx" ON "PredictionLog"("createdAt");
