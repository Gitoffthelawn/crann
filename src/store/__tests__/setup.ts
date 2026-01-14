/**
 * Jest setup for store tests
 * Mocks browser extension APIs
 */

// Mock webextension-polyfill
jest.mock('webextension-polyfill', () => ({
  __esModule: true,
  default: {
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
      },
      session: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
      },
    },
    runtime: {
      onConnect: {
        addListener: jest.fn(),
      },
    },
  },
}));

// Mock ServiceWorkerGlobalScope for porter utils
(global as any).ServiceWorkerGlobalScope = class {};
(global as any).self = global;

