-- Change Template.knowledge foreign key from KnowledgePoint to KnowledgeConcept
-- This enables cross-textbook template reuse by binding templates to abstract concepts
-- rather than textbook-specific knowledge point instances.

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
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    CONSTRAINT "Template_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Template_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "KnowledgeConcept" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Template" ("createdAt", "createdBy", "id", "name", "params", "publishedAt", "status", "steps", "structure", "templateKey", "type", "updatedAt", "version", "knowledgeId") SELECT "createdAt", "createdBy", "id", "name", "params", "publishedAt", "status", "steps", "structure", "templateKey", "type", "updatedAt", "version", "knowledgeId" FROM "Template";

DROP TABLE "Template";

ALTER TABLE "new_Template" RENAME TO "Template";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
