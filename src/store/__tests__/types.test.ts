import { createConfig, Scope, Persist, isStateItem, isActionDefinition } from '../types';

describe('createConfig', () => {
  it('should create a config with required name', () => {
    const config = createConfig({
      name: 'testStore',
      count: { default: 0 },
    });

    expect(config.name).toBe('testStore');
    expect(config.version).toBe(1); // Default version
  });

  it('should preserve version if provided', () => {
    const config = createConfig({
      name: 'testStore',
      version: 2,
      count: { default: 0 },
    });

    expect(config.version).toBe(2);
  });

  it('should throw if name is missing', () => {
    expect(() => {
      createConfig({ count: { default: 0 } } as any);
    }).toThrow("requires a 'name' property");
  });

  it('should handle state items with scope', () => {
    const config = createConfig({
      name: 'test',
      sharedCount: { default: 0, scope: Scope.Shared },
      agentData: { default: null, scope: Scope.Agent },
    });

    expect(config.sharedCount.scope).toBe('shared');
    expect(config.agentData.scope).toBe('agent');
  });

  it('should handle persistence options', () => {
    const config = createConfig({
      name: 'test',
      localData: { default: '', persist: Persist.Local },
      sessionData: { default: '', persist: Persist.Session },
      memoryOnly: { default: '', persist: Persist.None },
    });

    expect(config.localData.persist).toBe('local');
    expect(config.sessionData.persist).toBe('session');
    expect(config.memoryOnly.persist).toBe('none');
  });

  it('should handle actions', () => {
    const config = createConfig({
      name: 'test',
      count: { default: 0 },
      actions: {
        increment: {
          handler: async (ctx) => {
            await ctx.setState({ count: (ctx.state as any).count + 1 });
          },
        },
      },
    });

    expect(config.actions).toBeDefined();
    expect(config.actions!.increment).toBeDefined();
    expect(typeof config.actions!.increment.handler).toBe('function');
  });
});

describe('type guards', () => {
  it('isStateItem should identify state items', () => {
    expect(isStateItem({ default: 0 })).toBe(true);
    expect(isStateItem({ default: 'hello', scope: 'shared' })).toBe(true);
    expect(isStateItem({ handler: async () => {} })).toBe(false);
    expect(isStateItem(null)).toBe(false);
    expect(isStateItem('string')).toBe(false);
  });

  it('isActionDefinition should identify actions', () => {
    expect(isActionDefinition({ handler: async () => {} })).toBe(true);
    expect(isActionDefinition({ handler: async () => {}, validate: () => {} })).toBe(true);
    expect(isActionDefinition({ default: 0 })).toBe(false);
    expect(isActionDefinition(null)).toBe(false);
  });
});

