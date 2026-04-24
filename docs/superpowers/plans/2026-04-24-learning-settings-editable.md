# 学习设置可编辑功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 允许用户随时更改学习设置（年级/科目/教材），提供清晰的编辑入口

**架构:** 在现有LearningSettings组件中添加编辑模式状态管理，通过`isEditing`状态控制显示编辑按钮/教材选择器/默认视图，添加警告对话框处理教材变更时的数据清空提示。

**技术栈:** React, TypeScript, Material Icons

---

### Task 1: 添加编辑模式状态和切换逻辑

**文件:**
- Modify: `components/LearningSettings.tsx`

- [ ] **Step 1: 添加新的状态变量**

在组件顶部，现有状态声明之后添加：

```typescript
// 编辑模式状态
const [isEditing, setIsEditing] = useState(false);
const [showWarning, setShowWarning] = useState(false);
const [pendingTextbookId, setPendingTextbookId] = useState<string | null>(null);
```

- [ ] **Step 2: 添加取消编辑函数**

在现有函数之后添加：

```typescript
const handleCancelEdit = () => {
  setIsEditing(false);
  setShowWarning(false);
  setPendingTextbookId(null);
  // 重置选择器状态
  setSelectedGrade(null);
  setSelectedSubject(null);
  setSelectedTextbookId(null);
};
```

- [ ] **Step 3: 修改handleSaveTextbook函数，添加编辑模式检测**

找到`handleSaveTextbook`函数，在开始处添加编辑模式逻辑：

```typescript
const handleSaveTextbook = async () => {
  if (!selectedTextbookId) return;

  // 如果是编辑模式且选择了不同的教材，显示警告
  if (settings?.selectedTextbookId &&
      settings.selectedTextbookId !== selectedTextbookId &&
      !showWarning) {
    setPendingTextbookId(selectedTextbookId);
    setShowWarning(true);
    return;
  }

  setSaving(true);
  try {
    const result = await userApi.updateSettings({
      selectedGrade: selectedGrade ?? undefined,
      selectedSubject: selectedSubject ?? undefined,
      selectedTextbookId,
    });

    if (!result.success) {
      console.error('保存教材设置失败:', result.error);
      if (result.error?.includes('未登录') || result.error?.includes('不存在')) {
        alert('登录已过期，请重新登录');
      }
      return;
    }

    await loadSettings();
    setIsEditing(false);  // 退出编辑模式
    setShowWarning(false);
    setPendingTextbookId(null);
    onRefresh?.();
  } catch (error) {
    console.error('保存教材设置失败:', error);
  } finally {
    setSaving(false);
  }
};
```

- [ ] **Step 4: 添加确认更换教材函数**

```typescript
const handleConfirmTextbookChange = async () => {
  if (!pendingTextbookId) return;

  setSaving(true);
  try {
    const result = await userApi.updateSettings({
      selectedGrade: selectedGrade ?? undefined,
      selectedSubject: selectedSubject ?? undefined,
      selectedTextbookId: pendingTextbookId,
    });

    if (!result.success) {
      console.error('保存教材设置失败:', result.error);
      return;
    }

    await loadSettings();
    setIsEditing(false);
    setShowWarning(false);
    setPendingTextbookId(null);
    onRefresh?.();
  } catch (error) {
    console.error('保存教材设置失败:', error);
  } finally {
    setSaving(false);
  }
};
```

- [ ] **Step 5: Commit**

```bash
git add components/LearningSettings.tsx
git commit -m "feat: add edit mode state and toggle logic for learning settings"
```

---

### Task 2: 添加编辑按钮到标题栏

**文件:**
- Modify: `components/LearningSettings.tsx`

- [ ] **Step 1: 修改标题栏，添加编辑按钮**

找到`return`语句中的标题部分（约第319-326行），修改为：

```typescript
return (
  <div className="bg-surface-container-low rounded-[2rem] p-6">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '22px' }} />
        </div>
        <h3 className="font-bold text-on-surface">学习设置</h3>
      </div>
      {!isEditing && (
        <button
          onClick={() => setIsEditing(true)}
          className="w-10 h-10 rounded-full bg-surface hover:bg-surface-container-high flex items-center justify-center transition-colors"
          aria-label="编辑设置"
        >
          <MaterialIcon icon="edit" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
        </button>
      )}
    </div>
```

- [ ] **Step 2: Commit**

```bash
git add components/LearningSettings.tsx
git commit -m "feat: add edit button to learning settings header"
```

---

### Task 3: 修改教材选择器，添加取消按钮

**文件:**
- Modify: `components/LearningSettings.tsx`

- [ ] **Step 1: 修改教材选择器标题**

找到教材选择器的`return`语句（约第185行），修改标题为：

```typescript
// 教材选择器
if (showTextbookSelector || isEditing) {
  return (
    <div className="bg-surface-container-low rounded-[2rem] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '22px' }} />
          </div>
          <h3 className="font-bold text-on-surface">
            {isEditing ? '更改学习教材' : '选择学习教材'}
          </h3>
        </div>
        {(isEditing || settings?.selectedTextbookId) && (
          <button
            onClick={handleCancelEdit}
            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            取消
          </button>
        )}
      </div>

      <p className="text-sm text-on-surface-variant mb-6">
        {isEditing ? '请选择新的年级和科目' : '请选择您的年级和科目，我们将为您推荐合适的学习内容'}
      </p>
```

- [ ] **Step 2: Commit**

```bash
git add components/LearningSettings.tsx
git commit -m "feat: add cancel button and dynamic title to textbook selector"
```

---

### Task 4: 添加警告对话框组件

**文件:**
- Modify: `components/LearningSettings.tsx`

- [ ] **Step 1: 在组件返回的最后添加警告对话框**

在`return`语句的最外层包裹`Fragment`，并在最后添加警告对话框：

```typescript
  return (
    <>
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        {/* 现有内容保持不变 */}
      </div>

      {/* 警告对话框 */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-low rounded-[2rem] p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center">
                <MaterialIcon icon="warning" className="text-on-error-container" style={{ fontSize: '22px' }} />
              </div>
              <h3 className="font-bold text-on-surface">确认更换教材？</h3>
            </div>

            <p className="text-on-surface-variant mb-6">
              更换教材将清空当前的知识点选择，需要重新勾选学习内容。
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWarning(false);
                  setPendingTextbookId(null);
                }}
                className="flex-1 py-3 rounded-xl font-medium bg-surface text-on-surface-variant transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmTextbookChange}
                disabled={saving}
                className="flex-1 py-3 rounded-xl font-medium bg-error text-on-error-container disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : '继续'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
```

注意：需要修改现有的`return`，在最外层添加`<>...</>`包裹。

- [ ] **Step 2: 修改现有return语句**

找到最后的`return (`语句，将其改为`return (`，并在最后添加`);`

- [ ] **Step 3: 在文件顶部导入Fragment**

如果需要，确保导入了Fragment（React 17+不需要显式导入）

- [ ] **Step 4: Commit**

```bash
git add components/LearningSettings.tsx
git commit -m "feat: add warning dialog for textbook change"
```

---

### Task 5: 初始化编辑模式时预填当前设置

**文件:**
- Modify: `components/LearningSettings.tsx`

- [ ] **Step 1: 修改进入编辑模式时的初始化**

添加一个新的useEffect或修改现有的编辑按钮点击处理：

```typescript
const handleEnterEditMode = () => {
  setIsEditing(true);
  // 预填当前设置
  if (settings) {
    setSelectedGrade(settings.selectedGrade ?? null);
    setSelectedSubject(settings.selectedSubject ?? null);
    setSelectedTextbookId(settings.selectedTextbookId ?? null);
  }
  // 加载教材列表（如果还没有）
  if (textbooks.length === 0) {
    loadTextbooks();
  }
};
```

- [ ] **Step 2: 修改编辑按钮的onClick**

将编辑按钮的`onClick={() => setIsEditing(true)}`改为`onClick={handleEnterEditMode}`

- [ ] **Step 3: Commit**

```bash
git add components/LearningSettings.tsx
git commit -m "feat: pre-fill current settings when entering edit mode"
```

---

### Task 6: 测试和验证

**文件:**
- Test: Manual browser testing

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 测试编辑功能**

测试场景：
1. 登录后进入"我的"页面
2. 确认显示学习设置卡片，右上角有编辑按钮
3. 点击编辑按钮，确认显示教材选择器
4. 选择相同教材，确认保存成功，无警告
5. 选择不同教材，确认显示警告对话框
6. 点击取消，确认保持原设置
7. 点击继续，确认设置更新，知识点清空

- [ ] **Step 3: 测试边界情况**

1. 无教材用户：确认不显示编辑按钮，直接显示选择器
2. 加载失败：确认显示错误提示
3. 快速点击：确认无状态错乱

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "test: verify editable learning settings functionality"
```

---

## 实施完成检查清单

- [ ] 编辑按钮显示在标题右侧
- [ ] 点击编辑按钮进入编辑模式
- [ ] 编辑模式显示当前选择（预填）
- [ ] 选择不同教材时显示警告
- [ ] 确认更换后更新设置并清空知识点
- [ ] 取消编辑保持原设置
- [ ] 无教材用户不显示编辑按钮
