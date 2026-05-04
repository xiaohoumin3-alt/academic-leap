-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TextbookVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "publisher" TEXT,
    "grade" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "subjectId" TEXT,
    "year" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TextbookVersion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TextbookVersion" ("createdAt", "grade", "id", "name", "publisher", "status", "subject", "updatedAt", "year") SELECT "createdAt", "grade", "id", "name", "publisher", "status", "subject", "updatedAt", "year" FROM "TextbookVersion";
DROP TABLE "TextbookVersion";
ALTER TABLE "new_TextbookVersion" RENAME TO "TextbookVersion";
CREATE INDEX "TextbookVersion_grade_subject_status_idx" ON "TextbookVersion"("grade", "subject", "status");
CREATE INDEX "TextbookVersion_subjectId_idx" ON "TextbookVersion"("subjectId");
CREATE UNIQUE INDEX "TextbookVersion_grade_subject_name_key" ON "TextbookVersion"("grade", "subject", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Subject_grade_status_idx" ON "Subject"("grade", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_grade_code_key" ON "Subject"("grade", "code");
