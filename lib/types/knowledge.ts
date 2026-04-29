/**
 * Knowledge Point Level Data - 存储在 assessment.knowledgeData 中
 */

/**
 * 单个知识点等级数据
 */
export interface KnowledgeLevelData {
  name: string;
  level: number; // 0-4
}

/**
 * Assessment 的 knowledgeData 格式
 * 使用知识点 ID 作为主键
 */
export type AssessmentKnowledgeData = Record<string, KnowledgeLevelData>;

/**
 * 旧格式：使用知识点名称作为主键
 * 仅用于向后兼容
 */
export type LegacyKnowledgeData = Record<string, number>;

/**
 * 检测数据是否为新格式（基于 ID）
 */
export function isNewKnowledgeDataFormat(
  data: unknown
): data is AssessmentKnowledgeData {
  if (!data || typeof data !== 'object') return true;
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) return true;
  // 新格式的值是对象，旧的值的数字
  const firstValue = entries[0]?.[1];
  return typeof firstValue === 'object' && firstValue !== null;
}

/**
 * 从新格式获取知识点名称
 */
export function getKnowledgePointNameFromData(
  data: AssessmentKnowledgeData | LegacyKnowledgeData,
  id: string
): string {
  if (isNewKnowledgeDataFormat(data)) {
    return (data as AssessmentKnowledgeData)[id]?.name ?? id;
  }
  // 旧格式：key 本身就是名称
  return id;
}

/**
 * 从新格式获取等级
 */
export function getLevelFromData(
  data: AssessmentKnowledgeData | LegacyKnowledgeData,
  id: string
): number {
  if (isNewKnowledgeDataFormat(data)) {
    return (data as AssessmentKnowledgeData)[id]?.level ?? -1;
  }
  // 旧格式：值本身就是等级
  return (data as LegacyKnowledgeData)[id] ?? -1;
}

/**
 * 获取所有薄弱知识点（等级 <= 1）
 */
export function getWeakPoints(
  data: AssessmentKnowledgeData | LegacyKnowledgeData
): string[] {
  const weakPoints: string[] = [];

  if (isNewKnowledgeDataFormat(data)) {
    const newData = data as AssessmentKnowledgeData;
    for (const [id, item] of Object.entries(newData)) {
      if (item.level <= 1) {
        weakPoints.push(item.name);
      }
    }
  } else {
    const legacyData = data as LegacyKnowledgeData;
    for (const [name, level] of Object.entries(legacyData)) {
      if (level <= 1) {
        weakPoints.push(name);
      }
    }
  }

  return weakPoints;
}

/**
 * 获取所有薄弱知识点的 ID 和名称
 */
export function getWeakPointsWithIds(
  data: AssessmentKnowledgeData | LegacyKnowledgeData
): Array<{ id: string; name: string }> {
  const result: Array<{ id: string; name: string }> = [];

  if (isNewKnowledgeDataFormat(data)) {
    const newData = data as AssessmentKnowledgeData;
    for (const [id, item] of Object.entries(newData)) {
      if (item.level <= 1) {
        result.push({ id, name: item.name });
      }
    }
  } else {
    // 旧格式：key 是名称，无法获取 ID（向后兼容）
    const legacyData = data as LegacyKnowledgeData;
    for (const [name, level] of Object.entries(legacyData)) {
      if (level <= 1) {
        result.push({ id: name, name }); // 使用 name 作为 id 的 fallback
      }
    }
  }

  return result;
}
