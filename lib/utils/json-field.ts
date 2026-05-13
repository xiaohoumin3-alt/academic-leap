/**
 * Json field utilities for Prisma Json type handling
 * Handles the transition from String to Json types in schema
 */

/**
 * Safely parse a Json field that might be a string or already-parsed object/array
 */
export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'object') {
    return value as T;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/**
 * Safely parse a Json field that should be an array
 */
export function parseJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed as T[];
      }
    } catch {
      // Fall through to return fallback
    }
  }
  return fallback;
}

/**
 * Safely parse knowledge points from Json field
 * Returns array of knowledge point IDs/names
 */
export function parseKnowledgePoints(value: unknown): string[] {
  const arr = parseJsonArray<unknown>(value);
  return arr.map(item => {
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null) {
      const obj = item as { id?: string; name?: string };
      return obj.id || obj.name || '';
    }
    return String(item);
  }).filter(Boolean);
}

/**
 * Safely parse question content from Json field
 */
export function parseQuestionContent(value: unknown): Record<string, unknown> {
  return parseJsonField<Record<string, unknown>>(value, {});
}

/**
 * Convert any value to string for JSON.stringify
 */
export function toJsonString(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '{}';
  }
}

/**
 * Create a Json-safe value for database storage
 */
export function toJsonValue<T>(value: T): T {
  // Json type in Prisma accepts objects and arrays directly
  if (value === null || value === undefined) {
    return {} as T;
  }
  return value;
}