-- Migration: Merge selectedGrade into grade
-- Date: 2026-04-24

-- Step 1: 将 selectedGrade 的值合并到 grade (如果 selectedGrade 存在且 grade 为默认值)
UPDATE "User"
SET grade = selectedGrade
WHERE selectedGrade IS NOT NULL
  AND (grade IS NULL OR grade = 0);

-- Step 2: 备份 selectedGrade 数据到日志（可选，用于审计）
-- 此步骤在开发环境可跳过

-- Step 3: 验证数据完整性
-- 确保所有用户都有有效的 grade 值
