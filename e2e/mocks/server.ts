import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW Server Configuration for E2E Tests
 *
 * 提供mock服务器实例，需要在测试文件中手动管理生命周期
 */

export const mockServer = setupServer(...handlers);
