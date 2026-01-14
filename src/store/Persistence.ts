/**
 * Persistence - Handles chrome.storage operations
 *
 * Responsibilities:
 * - Hydrate state from storage on startup
 * - Persist state changes to storage
 * - Manage storage key structure: crann:{name}:v{version}:{key}
 */

import browser from "webextension-polyfill";
import {
  ConfigSchema,
  ValidatedConfig,
  DerivedSharedState,
  StoreOptions,
  isStateItem,
  Persist,
} from "./types";

export class Persistence<TConfig extends ConfigSchema> {
  private readonly config: ValidatedConfig<TConfig>;
  private readonly options: StoreOptions;

  constructor(config: ValidatedConfig<TConfig>, options: StoreOptions = {}) {
    this.config = config;
    this.options = options;
  }

  // ===========================================================================
  // Storage Key Management
  // ===========================================================================

  /**
   * Build a storage key with the structured format.
   * Format: crann:{name}:v{version}:{key}
   */
  private buildKey(key: string): string {
    return `crann:${this.config.name}:v${this.config.version}:${key}`;
  }

  /**
   * Parse a storage key to extract components.
   */
  private parseKey(fullKey: string): { name: string; version: number; key: string } | null {
    const match = fullKey.match(/^crann:([^:]+):v(\d+):(.+)$/);
    if (!match) return null;
    return {
      name: match[1],
      version: parseInt(match[2], 10),
      key: match[3],
    };
  }

  /**
   * Get the metadata key for this store.
   * Format: crann:{name}:__meta
   */
  private getMetaKey(): string {
    return `crann:${this.config.name}:__meta`;
  }

  // ===========================================================================
  // Hydration
  // ===========================================================================

  /**
   * Hydrate state from chrome.storage.
   * Only loads keys that exist in the current config.
   */
  async hydrate(): Promise<Partial<DerivedSharedState<TConfig>>> {
    const [local, session] = await Promise.all([
      browser.storage.local.get(null),
      browser.storage.session.get(null),
    ]);

    const combined = { ...local, ...session };
    const hydratedState: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(this.config)) {
      if (key === "name" || key === "version" || key === "actions") continue;
      if (!isStateItem(item)) continue;

      // Only hydrate shared state with persistence
      if (item.scope === "agent") continue;
      if (!item.persist || item.persist === Persist.None) continue;

      const storageKey = this.buildKey(key);
      if (storageKey in combined) {
        hydratedState[key] = combined[storageKey];
      }
    }

    // Update metadata
    await this.updateMetadata();

    return hydratedState as Partial<DerivedSharedState<TConfig>>;
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  /**
   * Persist state changes to storage.
   * Only persists keys with persist: 'local' or 'session'.
   */
  async persist(state: Partial<DerivedSharedState<TConfig>>): Promise<void> {
    const localUpdates: Record<string, unknown> = {};
    const sessionUpdates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(state)) {
      const item = this.config[key];
      if (!isStateItem(item)) continue;

      const storageKey = this.buildKey(key);

      switch (item.persist) {
        case Persist.Local:
          localUpdates[storageKey] = value;
          break;
        case Persist.Session:
          sessionUpdates[storageKey] = value;
          break;
        // Persist.None or undefined - don't persist
      }
    }

    const promises: Promise<void>[] = [];

    if (Object.keys(localUpdates).length > 0) {
      promises.push(browser.storage.local.set(localUpdates));
    }

    if (Object.keys(sessionUpdates).length > 0) {
      promises.push(browser.storage.session.set(sessionUpdates));
    }

    await Promise.all(promises);
  }

  /**
   * Clear all persisted data for this store.
   */
  async clearAll(): Promise<void> {
    const keysToRemove: string[] = [];

    for (const [key, item] of Object.entries(this.config)) {
      if (key === "name" || key === "version" || key === "actions") continue;
      if (!isStateItem(item)) continue;
      if (item.persist && item.persist !== Persist.None) {
        keysToRemove.push(this.buildKey(key));
      }
    }

    // Also remove metadata
    keysToRemove.push(this.getMetaKey());

    await Promise.all([
      browser.storage.local.remove(keysToRemove),
      browser.storage.session.remove(keysToRemove),
    ]);
  }

  // ===========================================================================
  // Metadata
  // ===========================================================================

  private async updateMetadata(): Promise<void> {
    const metaKey = this.getMetaKey();
    const existing = await browser.storage.local.get(metaKey);

    const meta = {
      version: this.config.version,
      createdAt: existing[metaKey]?.createdAt ?? Date.now(),
      lastAccessed: Date.now(),
    };

    await browser.storage.local.set({ [metaKey]: meta });
  }
}

// =============================================================================
// Static Utilities
// =============================================================================

/**
 * Find and remove orphaned Crann data from storage.
 *
 * @example
 * const removed = await clearOrphanedData({
 *   keepStores: ['myFeature', 'otherStore'],
 *   dryRun: true,
 * });
 */
export async function clearOrphanedData(options: {
  keepStores: string[];
  dryRun?: boolean;
}): Promise<{ keys: string[]; count: number }> {
  const { keepStores, dryRun = false } = options;

  const [local, session] = await Promise.all([
    browser.storage.local.get(null),
    browser.storage.session.get(null),
  ]);

  const allKeys = new Set([...Object.keys(local), ...Object.keys(session)]);
  const orphanedKeys: string[] = [];

  for (const key of allKeys) {
    if (!key.startsWith("crann:")) continue;

    // Extract store name from key
    const match = key.match(/^crann:([^:]+):/);
    if (!match) continue;

    const storeName = match[1];
    if (!keepStores.includes(storeName)) {
      orphanedKeys.push(key);
    }
  }

  if (!dryRun && orphanedKeys.length > 0) {
    await Promise.all([
      browser.storage.local.remove(orphanedKeys),
      browser.storage.session.remove(orphanedKeys),
    ]);
  }

  return { keys: orphanedKeys, count: orphanedKeys.length };
}

