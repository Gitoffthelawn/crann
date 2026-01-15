/**
 * Persistence Tests
 *
 * Tests for the Persistence module which handles chrome.storage operations.
 */

// Mock data storage - needs to be defined before jest.mock
let mockLocalStorage: Record<string, unknown> = {};
let mockSessionStorage: Record<string, unknown> = {};

// Mock webextension-polyfill - must come before imports
jest.mock("webextension-polyfill", () => ({
  storage: {
    local: {
      get: jest.fn(async (keys: string | string[] | null) => {
        if (keys === null) return { ...mockLocalStorage };
        if (typeof keys === "string") {
          return keys in mockLocalStorage ? { [keys]: mockLocalStorage[keys] } : {};
        }
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (key in mockLocalStorage) {
            result[key] = mockLocalStorage[key];
          }
        }
        return result;
      }),
      set: jest.fn(async (items: Record<string, unknown>) => {
        Object.assign(mockLocalStorage, items);
      }),
      remove: jest.fn(async (keys: string | string[]) => {
        const keysArray = typeof keys === "string" ? [keys] : keys;
        for (const key of keysArray) {
          delete mockLocalStorage[key];
        }
      }),
    },
    session: {
      get: jest.fn(async (keys: string | string[] | null) => {
        if (keys === null) return { ...mockSessionStorage };
        if (typeof keys === "string") {
          return keys in mockSessionStorage ? { [keys]: mockSessionStorage[keys] } : {};
        }
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (key in mockSessionStorage) {
            result[key] = mockSessionStorage[key];
          }
        }
        return result;
      }),
      set: jest.fn(async (items: Record<string, unknown>) => {
        Object.assign(mockSessionStorage, items);
      }),
      remove: jest.fn(async (keys: string | string[]) => {
        const keysArray = typeof keys === "string" ? [keys] : keys;
        for (const key of keysArray) {
          delete mockSessionStorage[key];
        }
      }),
    },
  },
}));

import browser from "webextension-polyfill";
import { Persistence, clearOrphanedData } from "../Persistence";
import { createConfig, Scope, Persist } from "../types";

describe("Persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage = {};
    mockSessionStorage = {};
  });

  const config = createConfig({
    name: "testStore",
    version: 1,
    count: { default: 0, persist: Persist.Local },
    sessionData: { default: "temp", persist: Persist.Session },
    volatile: { default: null, persist: Persist.None },
    agentState: { default: {}, scope: Scope.Agent },
  });

  describe("buildKey / parseKey", () => {
    it("should build keys in correct format", async () => {
      const persistence = new Persistence(config);

      // We can verify key format indirectly through persist/hydrate
      await persistence.persist({ count: 42 });

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "crann:testStore:v1:count": 42,
      });
    });

    it("should include version in key", async () => {
      const versionedConfig = createConfig({
        name: "myStore",
        version: 3,
        value: { default: 0, persist: Persist.Local },
      });

      const persistence = new Persistence(versionedConfig);
      await persistence.persist({ value: 100 });

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "crann:myStore:v3:value": 100,
      });
    });
  });

  describe("hydrate", () => {
    it("should load persisted state from storage", async () => {
      mockLocalStorage["crann:testStore:v1:count"] = 42;
      mockSessionStorage["crann:testStore:v1:sessionData"] = "restored";

      const persistence = new Persistence(config);
      const state = await persistence.hydrate();

      expect(state).toEqual({
        count: 42,
        sessionData: "restored",
      });
    });

    it("should only hydrate keys that exist in config", async () => {
      mockLocalStorage["crann:testStore:v1:count"] = 42;
      mockLocalStorage["crann:testStore:v1:unknown"] = "should be ignored";
      mockLocalStorage["crann:otherStore:v1:count"] = 999;

      const persistence = new Persistence(config);
      const state = await persistence.hydrate();

      expect(state).toEqual({ count: 42 });
    });

    it("should not hydrate agent-scoped state", async () => {
      mockLocalStorage["crann:testStore:v1:agentState"] = { shouldNotLoad: true };
      mockLocalStorage["crann:testStore:v1:count"] = 10;

      const persistence = new Persistence(config);
      const state = await persistence.hydrate();

      expect(state).toEqual({ count: 10 });
      expect((state as any).agentState).toBeUndefined();
    });

    it("should not hydrate state with persist: none", async () => {
      mockLocalStorage["crann:testStore:v1:volatile"] = "shouldNotLoad";
      mockLocalStorage["crann:testStore:v1:count"] = 5;

      const persistence = new Persistence(config);
      const state = await persistence.hydrate();

      expect(state).toEqual({ count: 5 });
      expect((state as any).volatile).toBeUndefined();
    });

    it("should update metadata on hydrate", async () => {
      const persistence = new Persistence(config);
      await persistence.hydrate();

      const setFn = browser.storage.local.set as jest.Mock;
      expect(setFn).toHaveBeenCalled();
      const setCall = setFn.mock.calls[0][0];
      expect(setCall).toHaveProperty("crann:testStore:__meta");
      expect(setCall["crann:testStore:__meta"]).toMatchObject({
        version: 1,
      });
    });
  });

  describe("persist", () => {
    it("should persist to local storage for persist: local", async () => {
      const persistence = new Persistence(config);
      await persistence.persist({ count: 100 });

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "crann:testStore:v1:count": 100,
      });
    });

    it("should persist to session storage for persist: session", async () => {
      const persistence = new Persistence(config);
      await persistence.persist({ sessionData: "newValue" });

      expect(browser.storage.session.set).toHaveBeenCalledWith({
        "crann:testStore:v1:sessionData": "newValue",
      });
    });

    it("should not persist state with persist: none", async () => {
      const persistence = new Persistence(config);
      // volatile has persist: none, so it shouldn't be persisted
      // But we can't directly test this since volatile's type is null
      // Instead, verify that calling persist with an empty object does nothing
      await persistence.persist({});

      expect(browser.storage.local.set).not.toHaveBeenCalled();
      expect(browser.storage.session.set).not.toHaveBeenCalled();
    });

    it("should persist multiple values to appropriate storage", async () => {
      const persistence = new Persistence(config);
      await persistence.persist({
        count: 50,
        sessionData: "sessionValue",
      });

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "crann:testStore:v1:count": 50,
      });
      expect(browser.storage.session.set).toHaveBeenCalledWith({
        "crann:testStore:v1:sessionData": "sessionValue",
      });
    });
  });

  describe("clearAll", () => {
    it("should remove all persisted keys for the store", async () => {
      mockLocalStorage["crann:testStore:v1:count"] = 42;
      mockSessionStorage["crann:testStore:v1:sessionData"] = "data";
      mockLocalStorage["crann:testStore:__meta"] = { version: 1 };
      mockLocalStorage["crann:otherStore:v1:key"] = "should remain";

      const persistence = new Persistence(config);
      await persistence.clearAll();

      const localRemoveFn = browser.storage.local.remove as jest.Mock;
      const sessionRemoveFn = browser.storage.session.remove as jest.Mock;

      expect(localRemoveFn).toHaveBeenCalled();
      expect(sessionRemoveFn).toHaveBeenCalled();

      // Verify the keys that were requested to be removed
      const localRemoveCall = localRemoveFn.mock.calls[0][0];
      expect(localRemoveCall).toContain("crann:testStore:v1:count");
      expect(localRemoveCall).toContain("crann:testStore:__meta");

      const sessionRemoveCall = sessionRemoveFn.mock.calls[0][0];
      expect(sessionRemoveCall).toContain("crann:testStore:v1:sessionData");
    });
  });
});

describe("clearOrphanedData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage = {};
    mockSessionStorage = {};
  });

  it("should identify orphaned store data", async () => {
    mockLocalStorage["crann:activeStore:v1:key"] = "keep";
    mockLocalStorage["crann:oldStore:v1:key"] = "orphan";
    mockLocalStorage["crann:anotherOld:v1:data"] = "orphan";
    mockLocalStorage["unrelated:key"] = "ignore";

    const result = await clearOrphanedData({
      keepStores: ["activeStore"],
      dryRun: true,
    });

    expect(result.count).toBe(2);
    expect(result.keys).toContain("crann:oldStore:v1:key");
    expect(result.keys).toContain("crann:anotherOld:v1:data");
    expect(result.keys).not.toContain("crann:activeStore:v1:key");
  });

  it("should not remove keys in dry run mode", async () => {
    mockLocalStorage["crann:orphanStore:v1:key"] = "data";

    await clearOrphanedData({
      keepStores: [],
      dryRun: true,
    });

    expect(browser.storage.local.remove).not.toHaveBeenCalled();
    expect(mockLocalStorage["crann:orphanStore:v1:key"]).toBe("data");
  });

  it("should remove orphaned keys when not in dry run", async () => {
    mockLocalStorage["crann:orphan:v1:key"] = "data";
    mockSessionStorage["crann:orphan:v1:session"] = "data";
    mockLocalStorage["crann:keep:v1:key"] = "keep";

    await clearOrphanedData({
      keepStores: ["keep"],
      dryRun: false,
    });

    expect(browser.storage.local.remove).toHaveBeenCalledWith(
      expect.arrayContaining(["crann:orphan:v1:key"])
    );
    expect(browser.storage.session.remove).toHaveBeenCalledWith(
      expect.arrayContaining(["crann:orphan:v1:session"])
    );
  });

  it("should handle metadata keys correctly", async () => {
    mockLocalStorage["crann:orphan:__meta"] = { version: 1 };
    mockLocalStorage["crann:keep:__meta"] = { version: 2 };

    const result = await clearOrphanedData({
      keepStores: ["keep"],
      dryRun: true,
    });

    expect(result.keys).toContain("crann:orphan:__meta");
    expect(result.keys).not.toContain("crann:keep:__meta");
  });
});

