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
    }).toThrow("'name' is required");
  });

  it('should throw if name is empty', () => {
    // Empty string is falsy, so it triggers the "required" check
    expect(() => {
      createConfig({ name: '', count: { default: 0 } });
    }).toThrow("'name' is required");
  });

  it('should throw if name has invalid characters', () => {
    expect(() => {
      createConfig({ name: '123invalid', count: { default: 0 } });
    }).toThrow("'name' must start with a letter");

    expect(() => {
      createConfig({ name: 'has spaces', count: { default: 0 } });
    }).toThrow("'name' must start with a letter");
  });

  it('should accept valid name formats', () => {
    expect(() => createConfig({ name: 'myStore' })).not.toThrow();
    expect(() => createConfig({ name: 'my-store' })).not.toThrow();
    expect(() => createConfig({ name: 'my_store' })).not.toThrow();
    expect(() => createConfig({ name: 'MyStore123' })).not.toThrow();
  });

  it('should throw if version is invalid', () => {
    expect(() => {
      createConfig({ name: 'test', version: 0 } as any);
    }).toThrow("'version' must be a positive integer");

    expect(() => {
      createConfig({ name: 'test', version: -1 } as any);
    }).toThrow("'version' must be a positive integer");

    expect(() => {
      createConfig({ name: 'test', version: 1.5 } as any);
    }).toThrow("'version' must be a positive integer");
  });

  it('should throw if scope is invalid', () => {
    expect(() => {
      createConfig({ name: 'test', item: { default: 0, scope: 'invalid' as any } });
    }).toThrow("Invalid scope");
  });

  it('should throw if persist is invalid', () => {
    expect(() => {
      createConfig({ name: 'test', item: { default: 0, persist: 'invalid' as any } });
    }).toThrow("Invalid persist");
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

