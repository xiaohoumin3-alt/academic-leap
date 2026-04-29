#!/bin/bash
# 从CSV备份还原配置数据
# 用法: bash import-config.sh
#
# 注意事项：
# 1. 必须在运行迁移后执行
# 2. 必须按依赖顺序导入
# 3. ID使用原有值以保持关系完整性

DB_PATH="./dev.db"
BACKUP_DIR="./backup"

echo "=== Academic Leap 配置数据还原 ==="
echo "数据库: $DB_PATH"
echo "备份目录: $BACKUP_DIR"
echo ""

# 导入顺序（按依赖关系）：
# 1. TextbookVersion (无依赖)
# 2. KnowledgeConcept (无依赖)
# 3. Chapter (依赖 TextbookVersion)
# 4. KnowledgePoint (依赖 Chapter, KnowledgeConcept)
# 5. Template (依赖 KnowledgeConcept, Admin)
# 6. TemplateVersion (依赖 Template)
# 7. Skeleton (无依赖)
# 8. User (无依赖)
# 9. Admin (依赖 User)
# 10. Account (依赖 User)
# 11. Question (无依赖)
# 12. QuestionStep (依赖 Question)

# 注意：Prisma 的 @default(cuid()) 会自动生成ID
# 所以导入时需要处理ID冲突

echo "开始还原..."
echo ""

# 1. 还原 TextbookVersion
if [ -f "$BACKUP_DIR/textbookversion.csv" ]; then
  echo "1. 还原 TextbookVersion..."
  # 使用 REPLACE 策略（如果ID冲突则替换）
  sqlite3 "$DB_PATH" "
    .mode csv
    .import --skip 1 $BACKUP_DIR/textbookversion.csv TextbookVersion
  "
  echo "   ✓ TextbookVersion 完成"
fi

# 2. 还原 KnowledgeConcept
if [ -f "$BACKUP_DIR/knowledgeconcept.csv" ]; then
  echo "2. 还原 KnowledgeConcept..."
  sqlite3 "$DB_PATH" "
    .mode csv
    .import --skip 1 $BACKUP_DIR/knowledgeconcept.csv KnowledgeConcept
  "
  echo "   ✓ KnowledgeConcept 完成"
fi

# 3. 还原 Chapter
if [ -f "$BACKUP_DIR/chapter.csv" ]; then
  echo "3. 还原 Chapter..."
  sqlite3 "$DB_PATH" "
    .mode csv
    .import --skip 1 $BACKUP_DIR/chapter.csv Chapter
  "
  echo "   ✓ Chapter 完成"
fi

# 4. 还原 KnowledgePoint
if [ -f "$BACKUP_DIR/knowledgepoint.csv" ]; then
  echo "4. 还原 KnowledgePoint..."
  sqlite3 "$DB_PATH" "
    .mode csv
    .import --skip 1 $BACKUP_DIR/knowledgepoint.csv KnowledgePoint
  "
  echo "   ✓ KnowledgePoint 完成"
fi

# 5. 还原 User (先于 Admin 和 Account)
if [ -f "$BACKUP_DIR/user.csv" ]; then
  echo "5. 还原 User..."
  sqlite3 "$DB_PATH" "
    .mode csv
    .import --skip 1 $BACKUP_DIR/user.csv User
  "
  echo "   ✓ User 完成"
fi

# 6. 还原 Admin (依赖 User)
if [ -f "$BACKUP_DIR/admin.csv" ]; then
  echo "6. 还原 Admin..."
  sqlite3 "$DB_PATH" "
    .mode csv
    .import --skip 1 $BACKUP_DIR/admin.csv Admin
  "
  echo "   ✓ Admin 完成"
fi

# 7. 还原 Account (依赖 User)
if [ -f "$BACKUP_DIR/account.csv" ]; then
  echo "7. 还原 Account..."
  sqlite3 "$DB_PATH" "
    .mode csv
    .import --skip 1 $BACKUP_DIR/account.csv Account
  "
  echo "   ✓ Account 完成"
fi

# 8. 还原 Template (依赖 KnowledgeConcept, Admin)
if [ -f "$BACKUP_DIR/template.csv" ]; then
  echo "8. 还原 Template..."
  sqlite3 "$DB_PATH" "
    .mode csv
    .import --skip 1 $BACKUP_DIR/template.csv Template
  "
  echo "   ✓ Template 完成"
fi

# 9. 还原 TemplateVersion (依赖 Template)
if [ -f "$BACKUP_DIR/templateversion.csv" ]; then
  echo "9. 还原 TemplateVersion..."
  sqlite3 "$DB_PATH" "
    .mode csv
    .import --skip 1 $BACKUP_DIR/templateversion.csv TemplateVersion
  "
  echo "   ✓ TemplateVersion 完成"
fi

# 10. 还原 Skeleton
if [ -f "$BACKUP_DIR/skeleton.csv" ]; then
  echo "10. 还原 Skeleton..."
  sqlite3 "$DB_PATH" "
    .mode csv
    .import --skip 1 $BACKUP_DIR/skeleton.csv Skeleton
  "
  echo "   ✓ Skeleton 完成"
fi

# 11. 还原 Question
if [ -f "$BACKUP_DIR/question.csv" ]; then
  echo "11. 还原 Question..."
  sqlite3 "$DB_PATH" "
    .mode csv
    .import --skip 1 $BACKUP_DIR/question.csv Question
  "
  echo "   ✓ Question 完成"
fi

# 12. 还原 QuestionStep (依赖 Question)
if [ -f "$BACKUP_DIR/questionstep.csv" ]; then
  echo "12. 还原 QuestionStep..."
  sqlite3 "$DB_PATH" "
    .mode csv
    .import --skip 1 $BACKUP_DIR/questionstep.csv QuestionStep
  "
  echo "   ✓ QuestionStep 完成"
fi

echo ""
echo "=== 还原完成 ==="
echo ""
echo "验证数据："
for table in TextbookVersion KnowledgeConcept Chapter KnowledgePoint Template User Question; do
  count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table;")
  echo "  $table: $count 条"
done
