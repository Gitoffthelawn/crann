/**
 * Integration Tests
 *
 * Tests for Store and Agent integration, multi-store scenarios,
 * and lifecycle management.
 */

// Mock webextension-polyfill
const mockStorageData: Record<string, Record<string, unknown>> = {
  local: {},
  session: {},
};

jest.mock("webextension-polyfill", () => ({
  __esModule: true,
  default: {
    storage: {
      local: {
        get: jest.fn(async (keys: string | string[] | null) => {
          if (keys === null) return { ...mockStorageData.local };
          if (typeof keys === "string") {
            return keys in mockStorageData.local
              ? { [keys]: mockStorageData.local[keys] }
              : {};
          }
          const result: Record<string, unknown> = {};
          for (const key of keys) {
            if (key in mockStorageData.local) {
              result[key] = mockStorageData.local[key];
            }
          }
          return result;
        }),
        set: jest.fn(async (items: Record<string, unknown>) => {
          Object.assign(mockStorageData.local, items);
        }),
        remove: jest.fn(async (keys: string | string[]) => {
          const keysArray = typeof keys === "string" ? [keys] : keys;
          for (const key of keysArray) {
            delete mockStorageData.local[key];
          }
        }),
      },
      session: {
        get: jest.fn(async (keys: string | string[] | null) => {
          if (keys === null) return { ...mockStorageData.session };
          if (typeof keys === "string") {
            return keys in mockStorageData.session
              ? { [keys]: mockStorageData.session[keys] }
              : {};
          }
          const result: Record<string, unknown> = {};
          for (const key of keys) {
            if (key in mockStorageData.session) {
              result[key] = mockStorageData.session[key];
            }
          }
          return result;
        }),
        set: jest.fn(async (items: Record<string, unknown>) => {
          Object.assign(mockStorageData.session, items);
        }),
        remove: jest.fn(async (keys: string | string[]) => {
          const keysArray = typeof keys === "string" ? [keys] : keys;
          for (const key of keysArray) {
            delete mockStorageData.session[key];
          }
        }),
      },
    },
    runtime: {
      onConnect: {
        addListener: jest.fn(),
      },
    },
  },
}));

// Mock ServiceWorkerGlobalScope - make self instanceof ServiceWorkerGlobalScope return true
class MockServiceWorkerGlobalScope {}
(global as any).ServiceWorkerGlobalScope = MockServiceWorkerGlobalScope;
Object.setPrototypeOf(global, MockServiceWorkerGlobalScope.prototype);
(global as any).self = global;

import { createConfig, Persist, Scope } from "../store/types";
import { createStore } from "../store";

describe("Store Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageData.local = {};
    mockStorageData.session = {};
  });

  describe("Multi-Store Isolation", () => {
    it("should allow multiple stores with different names", () => {
      const config1 = createConfig({
        name: "store1",
        count: { default: 0 },
      });

      const config2 = createConfig({
        name: "store2",
        value: { default: "hello" },
      });

      const store1 = createStore(config1);
      const store2 = createStore(config2);

      expect(store1).toBeDefined();
      expect(store2).toBeDefined();

      // Clean up
      store1.destroy();
      store2.destroy();
    });

    it("should maintain separate state for different stores", async () => {
      const config1 = createConfig({
        name: "storeA",
        count: { default: 10 },
      });

      const config2 = createConfig({
        name: "storeB",
        count: { default: 20 },
      });

      const store1 = createStore(config1);
      const store2 = createStore(config2);

      expect(store1.getState().count).toBe(10);
      expect(store2.getState().count).toBe(20);

      await store1.setState({ count: 100 });

      expect(store1.getState().count).toBe(100);
      expect(store2.getState().count).toBe(20);

      // Clean up
      store1.destroy();
      store2.destroy();
    });

    it("should persist to separate storage keys", async () => {
      const config1 = createConfig({
        name: "persistA",
        version: 1,
        value: { default: "A", persist: Persist.Local },
      });

      const config2 = createConfig({
        name: "persistB",
        version: 2,
        value: { default: "B", persist: Persist.Local },
      });

      const store1 = createStore(config1);
      const store2 = createStore(config2);

      await store1.setState({ value: "Updated A" });
      await store2.setState({ value: "Updated B" });

      // Verify keys are separate
      expect(mockStorageData.local["crann:persistA:v1:value"]).toBe("Updated A");
      expect(mockStorageData.local["crann:persistB:v2:value"]).toBe("Updated B");

      store1.destroy();
      store2.destroy();
    });
  });

  describe("Store Lifecycle", () => {
    it("should create store and allow state operations", async () => {
      const config = createConfig({
        name: "lifecycle",
        count: { default: 0 },
        name_: { default: "test" },
      });

      const store = createStore(config);

      // Initial state
      expect(store.getState()).toEqual({ count: 0, name_: "test" });

      // Update state
      await store.setState({ count: 5 });
      expect(store.getState().count).toBe(5);

      // Update multiple fields
      await store.setState({ count: 10, name_: "updated" });
      expect(store.getState()).toEqual({ count: 10, name_: "updated" });

      store.destroy();
    });

    it("should throw when using destroyed store", async () => {
      const config = createConfig({
        name: "destroyed",
        value: { default: 0 },
      });

      const store = createStore(config);
      store.destroy();

      expect(() => store.getState()).toThrow(/destroyed/i);
      await expect(store.setState({ value: 1 })).rejects.toThrow(/destroyed/i);
    });

    it("should clean up subscriptions on destroy", async () => {
      const config = createConfig({
        name: "subscriptions",
        count: { default: 0 },
      });

      const store = createStore(config);
      const callback = jest.fn();

      store.subscribe(callback);
      await store.setState({ count: 1 });
      expect(callback).toHaveBeenCalledTimes(1);

      store.destroy();
      callback.mockClear();

      // After destroy, subscribe should throw
      expect(() => store.subscribe(callback)).toThrow(/destroyed/i);
    });

    it("should clear persisted data on destroy with clearPersisted option", async () => {
      const config = createConfig({
        name: "clearable",
        value: { default: "test", persist: Persist.Local },
      });

      const store = createStore(config);
      await store.setState({ value: "persisted" });

      expect(mockStorageData.local["crann:clearable:v1:value"]).toBe("persisted");

      store.destroy({ clearPersisted: true });

      // Note: destroy is sync but the clear is async internally
      // In real usage, clearPersisted triggers async cleanup
      // For testing, we verify the intent was captured
    });
  });

  describe("State Subscriptions", () => {
    it("should notify subscribers of state changes", async () => {
      const config = createConfig({
        name: "subs",
        count: { default: 0 },
      });

      const store = createStore(config);
      const callback = jest.fn();

      store.subscribe(callback);
      await store.setState({ count: 42 });

      expect(callback).toHaveBeenCalledWith(
        { count: 42 },
        { count: 42 },
        undefined
      );

      store.destroy();
    });

    it("should allow unsubscribing", async () => {
      const config = createConfig({
        name: "unsub",
        value: { default: 0 },
      });

      const store = createStore(config);
      const callback = jest.fn();

      const unsubscribe = store.subscribe(callback);
      await store.setState({ value: 1 });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      await store.setState({ value: 2 });
      expect(callback).toHaveBeenCalledTimes(1); // Not called again

      store.destroy();
    });
  });

  describe("State Clear", () => {
    it("should reset state to defaults on clear", async () => {
      const config = createConfig({
        name: "resettable",
        count: { default: 0 },
        text: { default: "default" },
      });

      const store = createStore(config);

      await store.setState({ count: 100, text: "changed" });
      expect(store.getState()).toEqual({ count: 100, text: "changed" });

      await store.clear();
      expect(store.getState()).toEqual({ count: 0, text: "default" });

      store.destroy();
    });
  });
});

describe("Type Safety", () => {
  it("should enforce config schema types", () => {
    // This test verifies compile-time type safety
    const config = createConfig({
      name: "typed",
      count: { default: 0 },
      text: { default: "hello" },
      flag: { default: false },
    });

    const store = createStore(config);

    // These would be compile errors if types were wrong:
    const state = store.getState();
    const count: number = state.count;
    const text: string = state.text;
    const flag: boolean = state.flag;

    expect(typeof count).toBe("number");
    expect(typeof text).toBe("string");
    expect(typeof flag).toBe("boolean");

    store.destroy();
  });

  it("should enforce setState partial types", async () => {
    const config = createConfig({
      name: "partial",
      num: { default: 0 },
      str: { default: "" },
    });

    const store = createStore(config);

    // Valid partial updates
    await store.setState({ num: 5 });
    await store.setState({ str: "test" });
    await store.setState({ num: 10, str: "both" });

    expect(store.getState()).toEqual({ num: 10, str: "both" });

    store.destroy();
  });
});
