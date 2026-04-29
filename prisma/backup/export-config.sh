#!/bin/bash
# 导出关键配置数据到SQL备份文件
# 用法: bash export-config.sh

DB_PATH="./dev.db"
BACKUP_DIR="./backup"

mkdir -p "$BACKUP_DIR"

echo "-- ============================================"
echo "-- Academic Leap 配置数据备份"
echo "-- 导出时间: $(date)"
echo "-- ============================================"

# 导出 TextbookVersion
echo "-- 1. TextbookVersion (17条)"
sqlite3 "$DB_PATH" "SELECT * FROM TextbookVersion;" > "$BACKUP_DIR/textbookversion.csv"
echo "✓ TextbookVersion 导出完成"

# 导出 KnowledgeConcept
echo "-- 2. KnowledgeConcept (10条)"
sqlite3 "$DB_PATH" "SELECT * FROM KnowledgeConcept;" > "$BACKUP_DIR/knowledgeconcept.csv"
echo "✓ KnowledgeConcept 导出完成"

# 导出 Chapter
echo "-- 3. Chapter (26条)"
sqlite3 "$DB_PATH" "SELECT * FROM Chapter;" > "$BACKUP_DIR/chapter.csv"
echo "✓ Chapter 导出完成"

# 导出 KnowledgePoint
echo "-- 4. KnowledgePoint (40条)"
sqlite3 "$DB_PATH" "SELECT * FROM KnowledgePoint;" > "$BACKUP_DIR/knowledgepoint.csv"
echo "✓ KnowledgePoint 导出完成"

# 导出 Template
echo "-- 5. Template (39条)"
sqlite3 "$DB_PATH" "SELECT * FROM Template;" > "$BACKUP_DIR/template.csv"
echo "✓ Template 导出完成"

# 导出 TemplateVersion
echo "-- 6. TemplateVersion"
sqlite3 "$DB_PATH" "SELECT * FROM TemplateVersion;" > "$BACKUP_DIR/templateversion.csv"
echo "✓ TemplateVersion 导出完成"

# 导出 Skeleton
echo "-- 7. Skeleton (0条)"
sqlite3 "$DB_PATH" "SELECT * FROM Skeleton;" > "$BACKUP_DIR/skeleton.csv"
echo "✓ Skeleton 导出完成"

# 导出 User
echo "-- 8. User (3条)"
sqlite3 "$DB_PATH" "SELECT * FROM User;" > "$BACKUP_DIR/user.csv"
echo "✓ User 导出完成"

# 导出 Admin
echo "-- 9. Admin"
sqlite3 "$DB_PATH" "SELECT * FROM Admin;" > "$BACKUP_DIR/admin.csv"
echo "✓ Admin 导出完成"

# 导出 Account
echo "-- 10. Account"
sqlite3 "$DB_PATH" "SELECT * FROM Account;" > "$BACKUP_DIR/account.csv"
echo "✓ Account 导出完成"

# 导出 Question (大量数据，单独处理)
echo "-- 11. Question (990条)"
sqlite3 "$DB_PATH" "SELECT * FROM Question;" > "$BACKUP_DIR/question.csv"
echo "✓ Question 导出完成"

# 导出 QuestionStep
echo "-- 12. QuestionStep"
sqlite3 "$DB_PATH" "SELECT * FROM QuestionStep;" > "$BACKUP_DIR/questionstep.csv"
echo "✓ QuestionStep 导出完成"

# 导出统计信息
{
  echo "表名,记录数"
  for table in TextbookVersion KnowledgeConcept Chapter KnowledgePoint Template TemplateVersion Skeleton User Admin Account Question QuestionStep; do
    count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table;")
    echo "$table,$count"
  done
} > "$BACKUP_DIR/stats.csv"

echo ""
echo "=== 备份完成 ==="
echo "备份目录: $BACKUP_DIR"
echo ""
cat "$BACKUP_DIR/stats.csv"
