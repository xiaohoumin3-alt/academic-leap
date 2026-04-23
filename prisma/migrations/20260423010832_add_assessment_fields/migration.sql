-- AlterTable
ALTER TABLE "Question" ADD COLUMN "params" TEXT DEFAULT '{}';
ALTER TABLE "Question" ADD COLUMN "stepTypes" TEXT DEFAULT '[]';
ALTER TABLE "Question" ADD COLUMN "templateId" TEXT;

-- AlterTable
ALTER TABLE "QuestionStep" ADD COLUMN "inputType" TEXT;
ALTER TABLE "QuestionStep" ADD COLUMN "keyboard" TEXT;
ALTER TABLE "QuestionStep" ADD COLUMN "tolerance" REAL;
ALTER TABLE "QuestionStep" ADD COLUMN "type" TEXT;

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "scoreRangeLow" INTEGER NOT NULL,
    "scoreRangeHigh" INTEGER NOT NULL,
    "knowledgeData" JSONB NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "currentLevel" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_User" ("createdAt", "email", "grade", "id", "name", "password", "targetScore", "updatedAt") SELECT "createdAt", "email", "grade", "id", "name", "password", "targetScore", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
