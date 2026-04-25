-- Migration: Add Skeleton model and extend Template model
-- Created: 2026-04-26

-- Step 1: Add source and skeletonIds fields to Template model
ALTER TABLE "Template" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Template" ADD COLUMN "skeletonIds" TEXT NOT NULL DEFAULT '[]';

-- Step 2: Create Skeleton model table
CREATE TABLE IF NOT EXISTS "Skeleton" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT
);

-- Create index for status field
CREATE INDEX "Skeleton_status_idx" ON "Skeleton"("status");

-- Create index for stepType field
CREATE INDEX "Skeleton_stepType_idx" ON "Skeleton"("stepType");

-- Create index for source field
CREATE INDEX "Skeleton_source_idx" ON "Skeleton"("source");