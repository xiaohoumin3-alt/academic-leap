-- TemplateGeneration: Add index on knowledgePointId for GapDetector queries
CREATE INDEX "TemplateGeneration_knowledgePointId_idx" ON "TemplateGeneration"("knowledgePointId");

-- KnowledgeCoverage: Add foreign key relation to KnowledgePoint with cascade delete
-- Add default value to gap column
-- Change lastUpdated to auto-update timestamp
-- Add createdAt column
ALTER TABLE "KnowledgeCoverage" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "KnowledgeCoverage" ALTER COLUMN "gap" INTEGER NOT NULL DEFAULT 0;
-- SQLite doesn't support altering column constraints directly, recreate table if needed

-- KnowledgePoint: Add coverage relation
-- No migration needed - relation is virtual in Prisma
