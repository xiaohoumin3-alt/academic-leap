/*
  Warnings:

  - You are about to drop the column `category` on the `KnowledgePoint` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `KnowledgePoint` table. All the data in the column will be lost.
  - Added the required column `chapterId` to the `KnowledgePoint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `conceptId` to the `KnowledgePoint` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "KnowledgeConcept" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TextbookVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "publisher" TEXT,
    "grade" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "year" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "textbookId" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "chapterName" TEXT NOT NULL,
    "sectionNumber" INTEGER,
    "sectionName" TEXT,
    "parentId" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Chapter_textbookId_fkey" FOREIGN KEY ("textbookId") REFERENCES "TextbookVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Chapter_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Chapter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserEnabledKnowledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserEnabledKnowledge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KnowledgePoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "inAssess" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "KnowledgePoint_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KnowledgePoint_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "KnowledgeConcept" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_KnowledgePoint" ("createdAt", "deletedAt", "id", "inAssess", "name", "status", "updatedAt", "weight") SELECT "createdAt", "deletedAt", "id", "inAssess", "name", "status", "updatedAt", "weight" FROM "KnowledgePoint";
DROP TABLE "KnowledgePoint";
ALTER TABLE "new_KnowledgePoint" RENAME TO "KnowledgePoint";
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
    "selectedGrade" INTEGER,
    "selectedSubject" TEXT,
    "selectedTextbookId" TEXT,
    "studyProgress" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_User" ("createdAt", "currentLevel", "email", "grade", "id", "initialAssessmentCompleted", "initialAssessmentDate", "initialAssessmentScore", "name", "password", "reviewAssessmentCompleted", "reviewAssessmentDate", "reviewAssessmentScore", "targetScore", "updatedAt") SELECT "createdAt", "currentLevel", "email", "grade", "id", "initialAssessmentCompleted", "initialAssessmentDate", "initialAssessmentScore", "name", "password", "reviewAssessmentCompleted", "reviewAssessmentDate", "reviewAssessmentScore", "targetScore", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TextbookVersion_grade_subject_status_idx" ON "TextbookVersion"("grade", "subject", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TextbookVersion_grade_subject_name_key" ON "TextbookVersion"("grade", "subject", "name");

-- CreateIndex
CREATE INDEX "Chapter_textbookId_parentId_idx" ON "Chapter"("textbookId", "parentId");

-- CreateIndex
CREATE INDEX "UserEnabledKnowledge_userId_nodeType_idx" ON "UserEnabledKnowledge"("userId", "nodeType");

-- CreateIndex
CREATE UNIQUE INDEX "UserEnabledKnowledge_userId_nodeId_key" ON "UserEnabledKnowledge"("userId", "nodeId");
