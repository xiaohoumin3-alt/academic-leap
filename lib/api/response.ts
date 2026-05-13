/**
 * API 统一响应格式 (P1 HIGH)
 *
 * 提供一致的 API 响应格式，避免 success/data/error 混用
 *
 * @example
 * // 成功响应
 * return successResponse({ user }, { total: 1, page: 1, limit: 20 });
 *
 * // 错误响应
 * return errorResponse('用户不存在', 'NOT_FOUND', 404);
 *
 * // 简单错误响应
 * return errorResponse('权限不足');
 */

import { NextResponse } from 'next/server';

// ============ 类型定义 ============

/**
 * API 响应元数据 (用于分页等)
 */
export interface ApiMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  [key: string]: any;
}

/**
 * 统一 API 响应格式
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  meta?: ApiMeta;
}

/**
 * 成功响应配置
 */
export interface SuccessResponseOptions {
  meta?: ApiMeta;
  status?: number;
}

/**
 * 错误响应配置
 */
export interface ErrorResponseOptions {
  code?: string;
  status?: number;
}

// ============ 响应函数 ============

/**
 * 创建成功响应
 *
 * @param data 响应数据
 * @param options 配置选项 (可选的 meta)
 * @returns NextResponse.json
 *
 * @example
 * // 简单数据响应
 * return successResponse({ id: 1, name: 'test' });
 *
 * // 带分页元数据
 * return successResponse(items, { meta: { total: 100, page: 1, limit: 20 } });
 *
 * // 创建类资源 (201)
 * return successResponse(resource, { status: 201 });
 */
export function successResponse<T>(
  data: T,
  options: SuccessResponseOptions = {}
): NextResponse<ApiResponse<T>> {
  const { meta, status = 200 } = options;

  const body: ApiResponse<T> = {
    success: true,
    data
  };

  if (meta) {
    body.meta = meta;
  }

  return NextResponse.json(body, { status });
}

/**
 * 创建错误响应
 *
 * @param message 错误消息
 * @param code 错误码 (如 UNAUTHORIZED, NOT_FOUND)
 * @param options 配置选项
 * @returns NextResponse.json
 *
 * @example
 * // 基本错误
 * return errorResponse('请求失败');
 *
 * // 带错误码
 * return errorResponse('用户不存在', 'NOT_FOUND');
 *
 * // 带状态码
 * return errorResponse('无权限', 'FORBIDDEN', { status: 403 });
 *
 * // 完整配置
 * return errorResponse('验证失败', 'VALIDATION_ERROR', {
 *   code: 'VALIDATION_ERROR',
 *   status: 400
 * });
 */
export function errorResponse(
  message: string,
  code?: string,
  options: ErrorResponseOptions = {}
): NextResponse<ApiResponse> {
  const { status = 400 } = options;

  const body: ApiResponse = {
    success: false,
    error: message
  };

  if (code) {
    body.code = code;
  }

  return NextResponse.json(body, { status });
}

// ============ 便捷函数 ============

/**
 * 401 未授权响应
 */
export function unauthorizedResponse(message = '未授权'): NextResponse<ApiResponse> {
  return errorResponse(message, 'UNAUTHORIZED', { status: 401 });
}

/**
 * 403 禁止访问响应
 */
export function forbiddenResponse(message = '禁止访问'): NextResponse<ApiResponse> {
  return errorResponse(message, 'FORBIDDEN', { status: 403 });
}

/**
 * 404 未找到响应
 */
export function notFoundResponse(message = '资源不存在'): NextResponse<ApiResponse> {
  return errorResponse(message, 'NOT_FOUND', { status: 404 });
}

/**
 * 500 服务器错误响应
 */
export function serverErrorResponse(message = '服务器内部错误'): NextResponse<ApiResponse> {
  return errorResponse(message, 'INTERNAL_ERROR', { status: 500 });
}

/**
 * 创建分页响应
 *
 * @param data 当前页数据
 * @param total 总数
 * @param page 当前页
 * @param limit 每页数量
 * @returns 包含分页元数据的成功响应
 *
 * @example
 * return paginatedResponse(items, 100, 1, 20);
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): NextResponse<ApiResponse<T[]>> {
  return successResponse(data, {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
}

// ============ 导出类型供外部使用 ============
export type { NextResponse };