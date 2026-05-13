/**
 * Knowledge point parsing utilities
 */

/**
 * Parse knowledge points from various formats (string, array, object, or null)
 * @param kp - Knowledge points in JSON string, array, object, or null format
 * @returns Array of knowledge point names
 */
export function parseKnowledgePointNames(kp: unknown): string[] {
  if (!kp) return [];
  if (Array.isArray(kp)) {
    // Fast path: if all items are strings, return as-is
    if (kp.every(item => typeof item === 'string')) {
      return kp as string[];
    }
    // Slow path: map objects to their id/name
    return kp.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return (item as { id?: string; name?: string }).id || (item as { id?: string; name?: string }).name || '';
      }
      return String(item);
    });
  }
  if (typeof kp === 'string') {
    try {
      const parsed = JSON.parse(kp);
      if (Array.isArray(parsed)) {
        if (parsed.every(item => typeof item === 'string')) {
          return parsed as string[];
        }
        return parsed.map(item => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            return (item as { id?: string; name?: string }).id || (item as { id?: string; name?: string }).name || '';
          }
          return String(item);
        });
      }
      return [];
    } catch {
      return [];
    }
  }
  if (typeof kp === 'object') {
    // Single object, not array - return its id or name
    const obj = kp as { id?: string; name?: string };
    return [obj.id || obj.name || ''];
  }
  return [];
}