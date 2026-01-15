import { createConfig, Scope } from '../../store/types';
import { Agent, connectStore } from '../Agent';

// Mock the porter transport
const mockPorter = {
  on: jest.fn(),
  post: jest.fn(),
  onDisconnect: jest.fn().mockReturnValue(() => {}),
  onReconnect: jest.fn().mockReturnValue(() => {}),
  getAgentInfo: jest.fn(),
};

jest.mock('../../transport', () => ({
  connect: jest.fn(() => mockPorter),
}));

describe('Agent', () => {
  const config = createConfig({
    name: 'testStore',
    version: 1,
    count: { default: 0, scope: Scope.Shared },
    userName: { default: 'guest', scope: Scope.Shared },
    actions: {
      increment: {
        handler: async (ctx) => ctx.state.count + 1,
      },
    },
  });

  let messageHandlers: Record<string, (message: any) => void> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    messageHandlers = {};
    
    // Capture message handlers registered via porter.on
    mockPorter.on.mockImplementation((handlers: Record<string, any>) => {
      messageHandlers = { ...messageHandlers, ...handlers };
      return () => {};
    });
  });

  describe('connectStore', () => {
    it('should create an Agent instance', () => {
      const agent = connectStore(config);
      expect(agent).toBeDefined();
      expect(typeof agent.ready).toBe('function');
      expect(typeof agent.getState).toBe('function');
    });
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const agent = connectStore(config);
      const state = agent.getState();
      
      expect(state.count).toBe(0);
      expect(state.userName).toBe('guest');
    });
  });

  describe('ready', () => {
    it('should resolve when initialState is received', async () => {
      const agent = connectStore(config);
      
      // Simulate initialState message from store
      setTimeout(() => {
        messageHandlers.initialState?.({
          payload: {
            state: { count: 5, userName: 'alice' },
            info: {
              id: 'agent-1',
              location: { context: 'contentscript', tabId: 1, frameId: 0 },
            },
          },
        });
      }, 10);

      const state = await agent.ready();
      
      expect(state.count).toBe(5);
      expect(state.userName).toBe('alice');
    });

    it('should call onReady callbacks', async () => {
      const agent = connectStore(config);
      const callback = jest.fn();
      
      agent.onReady(callback);
      
      // Simulate initialState
      messageHandlers.initialState?.({
        payload: {
          state: { count: 10, userName: 'bob' },
          info: {
            id: 'agent-1',
            location: { context: 'contentscript', tabId: 1, frameId: 0 },
          },
        },
      });

      // Wait for async callback
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(callback).toHaveBeenCalledWith({ count: 10, userName: 'bob' });
    });
  });

  describe('state', () => {
    it('should update state on stateUpdate message', () => {
      const agent = connectStore(config);
      
      // Initialize
      messageHandlers.initialState?.({
        payload: {
          state: { count: 0, userName: 'guest' },
          info: { id: 'a', location: { context: 'c', tabId: 1, frameId: 0 } },
        },
      });

      // Update
      messageHandlers.stateUpdate?.({
        payload: { state: { count: 42 } },
      });

      expect(agent.getState().count).toBe(42);
      expect(agent.getState().userName).toBe('guest'); // Unchanged
    });

    it('should send setState message to store', async () => {
      const agent = connectStore(config);
      
      await agent.setState({ count: 100 });
      
      expect(mockPorter.post).toHaveBeenCalledWith({
        action: 'setState',
        payload: { state: { count: 100 } },
      });
    });

    it('should update local state optimistically', async () => {
      const agent = connectStore(config);
      
      await agent.setState({ count: 50 });
      
      expect(agent.getState().count).toBe(50);
    });
  });

  describe('subscribe', () => {
    it('should call subscriber on state changes', () => {
      const agent = connectStore(config);
      const callback = jest.fn();
      
      agent.subscribe(callback);
      
      // Initialize
      messageHandlers.initialState?.({
        payload: {
          state: { count: 0, userName: 'guest' },
          info: { id: 'a', location: { context: 'c', tabId: 1, frameId: 0 } },
        },
      });

      // Initial state triggers subscriber
      expect(callback).toHaveBeenCalledTimes(1);
      
      // Update
      messageHandlers.stateUpdate?.({
        payload: { state: { count: 10 } },
      });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(
        { count: 10 },
        expect.objectContaining({ count: 10 })
      );
    });

    it('should filter by keys when specified', () => {
      const agent = connectStore(config);
      const callback = jest.fn();
      
      // Subscribe only to 'count'
      agent.subscribe(['count'], callback);
      
      // Initialize
      messageHandlers.initialState?.({
        payload: {
          state: { count: 0, userName: 'guest' },
          info: { id: 'a', location: { context: 'c', tabId: 1, frameId: 0 } },
        },
      });
      
      callback.mockClear();

      // Update userName only - should NOT trigger
      messageHandlers.stateUpdate?.({
        payload: { state: { userName: 'alice' } },
      });
      expect(callback).not.toHaveBeenCalled();

      // Update count - should trigger
      messageHandlers.stateUpdate?.({
        payload: { state: { count: 5 } },
      });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const agent = connectStore(config);
      const callback = jest.fn();
      
      const unsubscribe = agent.subscribe(callback);
      
      // Initialize
      messageHandlers.initialState?.({
        payload: {
          state: { count: 0, userName: 'guest' },
          info: { id: 'a', location: { context: 'c', tabId: 1, frameId: 0 } },
        },
      });
      
      callback.mockClear();
      unsubscribe();
      
      // Update should not trigger callback
      messageHandlers.stateUpdate?.({
        payload: { state: { count: 99 } },
      });
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('actions', () => {
    it('should send RPC message when action is called', async () => {
      const agent = connectStore(config);
      
      // Don't await - just trigger the call
      const promise = agent.actions.increment();
      
      expect(mockPorter.post).toHaveBeenCalledWith({
        action: 'rpc',
        payload: expect.objectContaining({
          actionName: 'increment',
          args: [],
        }),
      });
      
      // Simulate response to avoid hanging promise
      messageHandlers.rpcResult?.({
        payload: { callId: '0', result: 1, success: true },
      });
      
      await promise;
    });

    it('should pass arguments to action', async () => {
      const configWithArgs = createConfig({
        name: 'test',
        count: { default: 0 },
        actions: {
          add: {
            handler: async (ctx, amount: number) => ctx.state.count + amount,
          },
        },
      });
      
      const agent = connectStore(configWithArgs);
      
      const promise = agent.actions.add(5);
      
      expect(mockPorter.post).toHaveBeenCalledWith({
        action: 'rpc',
        payload: expect.objectContaining({
          actionName: 'add',
          args: [5],
        }),
      });
      
      messageHandlers.rpcResult?.({
        payload: { callId: '0', result: 5, success: true },
      });
      
      const result = await promise;
      expect(result).toBe(5);
    });

    it('should reject on RPC error', async () => {
      const agent = connectStore(config);
      
      const promise = agent.actions.increment();
      
      messageHandlers.rpcResult?.({
        payload: { callId: '0', error: 'Something went wrong', success: false },
      });
      
      await expect(promise).rejects.toThrow('Something went wrong');
    });
  });

  describe('getInfo', () => {
    it('should return null before connection', () => {
      const agent = connectStore(config);
      expect(agent.getInfo()).toBeNull();
    });

    it('should return agent info after connection', () => {
      const agent = connectStore(config);
      
      messageHandlers.initialState?.({
        payload: {
          state: { count: 0, userName: 'guest' },
          info: {
            id: 'agent-123',
            location: { context: 'popup', tabId: 42, frameId: 0 },
          },
        },
      });

      const info = agent.getInfo();
      expect(info).toEqual({
        id: 'agent-123',
        tabId: 42,
        frameId: 0,
        context: 'popup',
      });
    });
  });

  describe('disconnect', () => {
    it('should prevent further operations after disconnect', () => {
      const agent = connectStore(config);
      
      agent.disconnect();
      
      expect(() => agent.getState()).toThrow('disconnected');
      expect(() => agent.subscribe(() => {})).toThrow('disconnected');
    });

    it('should clear all callbacks', () => {
      const agent = connectStore(config);
      const callback = jest.fn();
      
      agent.subscribe(callback);
      agent.disconnect();
      
      // Even if stateUpdate comes in, callback shouldn't be called
      // (because we've disconnected and cleared callbacks)
    });
  });
});

