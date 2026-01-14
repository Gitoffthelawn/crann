import { ActionExecutor } from '../ActionExecutor';
import { createConfig } from '../types';
import type { AgentInfo } from '../../transport';

describe('ActionExecutor', () => {
  const createAgentInfo = (): AgentInfo => ({
    id: 'agent-1',
    location: {
      context: 'contentscript' as any,
      tabId: 1,
      frameId: 0,
    },
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  });

  describe('execute', () => {
    it('should execute an action and return result', async () => {
      const config = createConfig({
        name: 'test',
        count: { default: 0 },
        actions: {
          increment: {
            handler: async (ctx) => {
              return (ctx.state as any).count + 1;
            },
          },
        },
      });

      const getState = jest.fn().mockReturnValue({ count: 5 });
      const setState = jest.fn().mockResolvedValue(undefined);

      const executor = new ActionExecutor(config, getState, setState);
      const result = await executor.execute('increment', [], createAgentInfo());

      expect(result).toBe(6);
    });

    it('should pass arguments to handler', async () => {
      const config = createConfig({
        name: 'test',
        count: { default: 0 },
        actions: {
          add: {
            handler: async (ctx, amount: number) => {
              return (ctx.state as any).count + amount;
            },
          },
        },
      });

      const getState = jest.fn().mockReturnValue({ count: 10 });
      const setState = jest.fn().mockResolvedValue(undefined);

      const executor = new ActionExecutor(config, getState, setState);
      const result = await executor.execute('add', [5], createAgentInfo());

      expect(result).toBe(15);
    });

    it('should provide setState in context', async () => {
      const config = createConfig({
        name: 'test',
        count: { default: 0 },
        actions: {
          setCount: {
            handler: async (ctx, value: number) => {
              await ctx.setState({ count: value } as any);
              return value;
            },
          },
        },
      });

      const getState = jest.fn().mockReturnValue({ count: 0 });
      const setState = jest.fn().mockResolvedValue(undefined);

      const executor = new ActionExecutor(config, getState, setState);
      await executor.execute('setCount', [42], createAgentInfo());

      expect(setState).toHaveBeenCalledWith({ count: 42 }, 'agent-1');
    });

    it('should throw for unknown action', async () => {
      const config = createConfig({
        name: 'test',
        count: { default: 0 },
        actions: {},
      });

      const executor = new ActionExecutor(
        config,
        () => ({ count: 0 }),
        jest.fn()
      );

      await expect(
        executor.execute('nonExistent', [], createAgentInfo())
      ).rejects.toThrow('Unknown action "nonExistent"');
    });

    it('should throw if no actions defined', async () => {
      const config = createConfig({
        name: 'test',
        count: { default: 0 },
      });

      const executor = new ActionExecutor(
        config,
        () => ({ count: 0 }),
        jest.fn()
      );

      await expect(
        executor.execute('anything', [], createAgentInfo())
      ).rejects.toThrow('No actions defined');
    });

    it('should run validation if provided', async () => {
      const config = createConfig({
        name: 'test',
        count: { default: 0 },
        actions: {
          setPositive: {
            handler: async (ctx, value: number) => value,
            validate: (value: number) => {
              if (value < 0) throw new Error('Must be positive');
            },
          },
        },
      });

      const executor = new ActionExecutor(
        config,
        () => ({ count: 0 }),
        jest.fn()
      );

      await expect(
        executor.execute('setPositive', [-5], createAgentInfo())
      ).rejects.toThrow('Validation failed');

      // Should succeed with valid input
      const result = await executor.execute('setPositive', [10], createAgentInfo());
      expect(result).toBe(10);
    });
  });

  describe('hasAction', () => {
    it('should check if action exists', () => {
      const config = createConfig({
        name: 'test',
        actions: {
          doSomething: { handler: async () => {} },
        },
      });

      const executor = new ActionExecutor(config, () => ({}), jest.fn());

      expect(executor.hasAction('doSomething')).toBe(true);
      expect(executor.hasAction('nonExistent')).toBe(false);
    });
  });

  describe('getActionNames', () => {
    it('should return list of action names', () => {
      const config = createConfig({
        name: 'test',
        actions: {
          action1: { handler: async () => {} },
          action2: { handler: async () => {} },
          action3: { handler: async () => {} },
        },
      });

      const executor = new ActionExecutor(config, () => ({}), jest.fn());
      const names = executor.getActionNames();

      expect(names).toEqual(['action1', 'action2', 'action3']);
    });
  });
});

