-- Migration: Remove selectedGrade column
-- Date: 2026-04-24

-- Drop the selectedGrade column (data has been merged to grade)
ALTER TABLE "User" DROP COLUMN "selectedGrade";
