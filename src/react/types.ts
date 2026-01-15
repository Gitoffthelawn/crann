/**
 * Crann React Integration Types
 */

import type { ConfigSchema, DerivedState, DerivedActions } from "../store/types";
import type { AgentAPI } from "../agent/types";

/**
 * Return type of the useCrannState hook when using a selector.
 */
export type UseCrannStateSelector<TConfig extends ConfigSchema, TSelected> = TSelected;

/**
 * Return type of the useCrannState hook when using a key.
 * Returns [value, setValue] tuple like useState.
 */
export type UseCrannStateTuple<TConfig extends ConfigSchema, K extends keyof DerivedState<TConfig>> = [
  DerivedState<TConfig>[K],
  (value: DerivedState<TConfig>[K]) => Promise<void>
];

/**
 * Options for creating Crann hooks.
 */
export type CreateCrannHooksOptions = {
  /** Enable debug logging */
  debug?: boolean;
};

/**
 * The hooks object returned by createCrannHooks.
 */
export interface CrannHooks<TConfig extends ConfigSchema> {
  /**
   * Hook to read state with a selector function.
   * Re-renders only when selected value changes.
   *
   * @example
   * const count = useCrannState(s => s.count);
   */
  useCrannState<TSelected>(selector: (state: DerivedState<TConfig>) => TSelected): TSelected;

  /**
   * Hook to read and write a specific state key.
   * Returns [value, setValue] tuple like useState.
   *
   * @example
   * const [count, setCount] = useCrannState('count');
   */
  useCrannState<K extends keyof DerivedState<TConfig>>(
    key: K
  ): UseCrannStateTuple<TConfig, K>;

  /**
   * Hook to get typed action methods.
   * Actions are stable references that won't cause re-renders.
   *
   * @example
   * const { increment, fetchUser } = useCrannActions();
   */
  useCrannActions(): DerivedActions<TConfig>;

  /**
   * Hook to check connection status.
   * Re-renders when connection status changes.
   *
   * @example
   * const isReady = useCrannReady();
   * if (!isReady) return <Loading />;
   */
  useCrannReady(): boolean;

  /**
   * Optional provider for dependency injection (useful for testing).
   * Not required for normal usage.
   */
  CrannProvider: React.FC<{ agent?: AgentAPI<TConfig>; children: React.ReactNode }>;

  /**
   * Get the current agent instance (for advanced usage).
   */
  useAgent(): AgentAPI<TConfig> | null;
}

