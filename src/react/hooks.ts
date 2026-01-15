/**
 * Crann React Hooks Implementation
 *
 * Provides React hooks for connecting to and using a Crann store.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
  type FC,
} from "react";
import { connectStore } from "../agent";
import type { AgentAPI } from "../agent/types";
import type {
  ConfigSchema,
  ValidatedConfig,
  DerivedState,
  DerivedActions,
} from "../store/types";
import type { CrannHooks, CreateCrannHooksOptions, UseCrannStateTuple } from "./types";

/**
 * Creates a set of React hooks for a Crann store.
 *
 * This is the main entry point for React integration. Call once at module
 * level with your config, then use the returned hooks in your components.
 *
 * @param config - Validated config from createConfig()
 * @param options - Optional hook options
 * @returns Object containing all Crann React hooks
 *
 * @example
 * // hooks.ts
 * import { createConfig } from 'crann';
 * import { createCrannHooks } from 'crann/react';
 *
 * const config = createConfig({
 *   name: 'myFeature',
 *   count: { default: 0 },
 *   actions: {
 *     increment: { handler: async (ctx) => ctx.setState({ count: ctx.state.count + 1 }) },
 *   },
 * });
 *
 * export const { useCrannState, useCrannActions, useCrannReady } = createCrannHooks(config);
 *
 * // MyComponent.tsx
 * function Counter() {
 *   const count = useCrannState(s => s.count);
 *   const { increment } = useCrannActions();
 *   const isReady = useCrannReady();
 *
 *   if (!isReady) return <div>Loading...</div>;
 *
 *   return <button onClick={() => increment()}>Count: {count}</button>;
 * }
 */
export function createCrannHooks<TConfig extends ConfigSchema>(
  config: ValidatedConfig<TConfig>,
  options: CreateCrannHooksOptions = {}
): CrannHooks<TConfig> {
  // Module-level agent instance (created lazily)
  let moduleAgent: AgentAPI<TConfig> | null = null;

  // Create React context for optional provider override
  const AgentContext = createContext<AgentAPI<TConfig> | null>(null);

  /**
   * Get or create the agent instance.
   */
  function getAgent(): AgentAPI<TConfig> {
    if (!moduleAgent) {
      moduleAgent = connectStore(config, { debug: options.debug });
    }
    return moduleAgent;
  }

  /**
   * Hook to get the current agent (from context or module-level).
   */
  function useAgent(): AgentAPI<TConfig> | null {
    const contextAgent = useContext(AgentContext);
    const [agent, setAgent] = useState<AgentAPI<TConfig> | null>(
      contextAgent ?? moduleAgent
    );

    useEffect(() => {
      if (!agent) {
        setAgent(getAgent());
      }
    }, [agent]);

    return contextAgent ?? agent;
  }

  /**
   * Hook to check if connection is ready.
   */
  function useCrannReady(): boolean {
    const agent = useAgent();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
      if (!agent) return;

      // Check if already ready
      const info = agent.getInfo();
      if (info) {
        setIsReady(true);
      }

      // Subscribe to ready event
      const unsubReady = agent.onReady(() => {
        setIsReady(true);
      });

      // Subscribe to disconnect/reconnect
      const unsubDisconnect = agent.onDisconnect(() => {
        setIsReady(false);
      });

      const unsubReconnect = agent.onReconnect(() => {
        setIsReady(true);
      });

      return () => {
        unsubReady();
        unsubDisconnect();
        unsubReconnect();
      };
    }, [agent]);

    return isReady;
  }

  /**
   * Hook to read state with selector or key pattern.
   */
  function useCrannState<TSelected>(
    selector: (state: DerivedState<TConfig>) => TSelected
  ): TSelected;
  function useCrannState<K extends keyof DerivedState<TConfig>>(
    key: K
  ): UseCrannStateTuple<TConfig, K>;
  function useCrannState<TSelected, K extends keyof DerivedState<TConfig>>(
    selectorOrKey: ((state: DerivedState<TConfig>) => TSelected) | K
  ): TSelected | UseCrannStateTuple<TConfig, K> {
    const agent = useAgent();
    const isFunction = typeof selectorOrKey === "function";

    // For selector pattern
    const selector = isFunction
      ? (selectorOrKey as (state: DerivedState<TConfig>) => TSelected)
      : (state: DerivedState<TConfig>) => state[selectorOrKey as K] as unknown as TSelected;

    // Track selected value
    const [selectedValue, setSelectedValue] = useState<TSelected>(() => {
      if (!agent) {
        // Return default from config
        const defaultState = buildDefaultState(config);
        return selector(defaultState);
      }
      return selector(agent.getState());
    });

    // Store previous selected value for comparison
    const prevSelectedRef = useRef(selectedValue);

    useEffect(() => {
      if (!agent) return;

      // Update with current state
      const currentState = agent.getState();
      const newSelected = selector(currentState);
      if (!shallowEqual(newSelected, prevSelectedRef.current)) {
        prevSelectedRef.current = newSelected;
        setSelectedValue(newSelected);
      }

      // Subscribe to changes
      const unsubscribe = agent.subscribe((changes, state) => {
        const newSelected = selector(state);
        if (!shallowEqual(newSelected, prevSelectedRef.current)) {
          prevSelectedRef.current = newSelected;
          setSelectedValue(newSelected);
        }
      });

      return unsubscribe;
    }, [agent, selector]);

    // For key pattern, return tuple
    if (!isFunction) {
      const key = selectorOrKey as K;
      const setValue = useCallback(
        async (value: DerivedState<TConfig>[K]) => {
          if (agent) {
            await agent.setState({ [key]: value } as Partial<DerivedState<TConfig>>);
          }
        },
        [agent, key]
      );

      return [selectedValue as DerivedState<TConfig>[K], setValue] as UseCrannStateTuple<TConfig, K>;
    }

    return selectedValue;
  }

  /**
   * Hook to get typed actions with stable references.
   */
  function useCrannActions(): DerivedActions<TConfig> {
    const agent = useAgent();

    // Return stable proxy that delegates to agent.actions
    const actionsRef = useRef<DerivedActions<TConfig> | null>(null);

    if (!actionsRef.current) {
      actionsRef.current = new Proxy({} as DerivedActions<TConfig>, {
        get: (_target, actionName: string) => {
          return async (...args: unknown[]) => {
            if (!agent) {
              throw new Error(
                `Cannot call action "${actionName}" before agent is connected`
              );
            }
            return (agent.actions as any)[actionName](...args);
          };
        },
      });
    }

    return actionsRef.current;
  }

  /**
   * Optional provider for dependency injection.
   */
  const CrannProvider: FC<{ agent?: AgentAPI<TConfig>; children: ReactNode }> = ({
    agent,
    children,
  }) => {
    const value = agent ?? getAgent();
    return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
  };

  return {
    useCrannState,
    useCrannActions,
    useCrannReady,
    useAgent,
    CrannProvider,
  };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Build default state from config.
 */
function buildDefaultState<TConfig extends ConfigSchema>(
  config: ValidatedConfig<TConfig>
): DerivedState<TConfig> {
  const state: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(config)) {
    if (key === "name" || key === "version" || key === "actions") continue;
    if (typeof item === "object" && item !== null && "default" in item) {
      state[key] = item.default;
    }
  }

  return state as DerivedState<TConfig>;
}

/**
 * Shallow equality check.
 */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (a === null || b === null) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if ((a as any)[key] !== (b as any)[key]) return false;
  }

  return true;
}

