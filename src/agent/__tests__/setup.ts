/**
 * Jest setup for agent tests
 * Mocks browser extension APIs and porter
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
      connect: jest.fn().mockReturnValue({
        onMessage: { addListener: jest.fn() },
        onDisconnect: { addListener: jest.fn() },
        postMessage: jest.fn(),
      }),
    },
  },
}));

// Mock ServiceWorkerGlobalScope
(global as any).ServiceWorkerGlobalScope = class {};
(global as any).self = global;

// Mock window for content script context detection
(global as any).window = {
  location: {
    protocol: 'https:',
  },
};

