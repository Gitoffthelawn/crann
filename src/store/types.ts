/**
 * Crann v2 Type Definitions
 *
 * This file defines the new config schema and derived types for v2.
 * Key changes from v1:
 * - `name` and `version` are part of config (single source of truth)
 * - `scope: 'shared' | 'agent'` replaces `partition: 'service' | 'instance'`
 * - Actions are nested under `actions:` key
 * - Action handlers receive a context object
 */

import { AgentInfo, BrowserLocation } from "../transport";

// =============================================================================
// Scope & Persistence Constants
// =============================================================================

export const Scope = {
  Shared: "shared" as const,
  Agent: "agent" as const,
};

export type ScopeType = (typeof Scope)[keyof typeof Scope];

export const Persist = {
  Local: "local" as const,
  Session: "session" as const,
  None: "none" as const,
};

export type PersistType = (typeof Persist)[keyof typeof Persist];

// =============================================================================
// State Item Definition
// =============================================================================

export type StateItemDefinition<T = unknown> = {
  default: T;
  scope?: ScopeType; // Defaults to 'shared'
  persist?: PersistType; // Defaults to 'none'
};

// =============================================================================
// Action Context & Definition
// =============================================================================

/**
 * Context object passed to action handlers.
 * Provides access to state and utilities without positional parameters.
 */
export type ActionContext<TState> = {
  /** Current state snapshot */
  state: TState;
  /** Update state (async, awaitable) */
  setState: (partial: Partial<TState>) => Promise<void>;
  /** ID of the agent that called this action */
  agentId: string;
  /** Location info of the calling agent */
  agentLocation: BrowserLocation;
};

/**
 * Action handler function signature.
 */
export type ActionHandler<TState, TArgs extends unknown[], TResult> = (
  ctx: ActionContext<TState>,
  ...args: TArgs
) => Promise<TResult>;

/**
 * Action definition with handler and optional validation.
 */
export type ActionDefinition<
  TState = unknown,
  TArgs extends unknown[] = unknown[],
  TResult = unknown
> = {
  handler: ActionHandler<TState, TArgs, TResult>;
  validate?: (...args: TArgs) => void;
};

/**
 * Actions configuration object.
 */
export type ActionsDefinition<TState> = {
  [actionName: string]: ActionDefinition<TState, any[], any>;
};

// =============================================================================
// Config Schema
// =============================================================================

/**
 * Base config structure that users provide to createConfig().
 */
export type ConfigSchema = {
  /** Store name - used for storage keys and agent connection routing */
  name: string;
  /** Schema version for migrations (default: 1) */
  version?: number;
  /** Action definitions */
  actions?: ActionsDefinition<any>;
  /** State item definitions (all other keys) */
  [key: string]: string | number | StateItemDefinition<any> | ActionsDefinition<any> | undefined;
};

/**
 * Validated config with required fields filled in.
 */
export type ValidatedConfig<T extends ConfigSchema> = T & {
  name: string;
  version: number;
};

// =============================================================================
// Type Extraction Utilities
// =============================================================================

/**
 * Extract state item keys from config (excludes name, version, actions).
 */
type StateKeys<T extends ConfigSchema> = {
  [K in keyof T]: K extends "name" | "version" | "actions"
    ? never
    : T[K] extends StateItemDefinition<any>
    ? K
    : never;
}[keyof T];

/**
 * Extract action keys from the actions object.
 */
type ActionKeys<T extends ConfigSchema> = T["actions"] extends ActionsDefinition<any>
  ? keyof T["actions"]
  : never;

// =============================================================================
// Derived State Types
// =============================================================================

/**
 * Remove never properties from a type.
 */
type OmitNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};

/**
 * Full derived state from config (all state items).
 */
export type DerivedState<T extends ConfigSchema> = OmitNever<{
  [K in StateKeys<T>]: T[K] extends StateItemDefinition<infer D> ? D : never;
}>;

/**
 * Shared state (scope: 'shared' or unspecified).
 */
export type DerivedSharedState<T extends ConfigSchema> = OmitNever<{
  [K in StateKeys<T>]: T[K] extends StateItemDefinition<infer D>
    ? T[K] extends { scope: "agent" }
      ? never
      : D
    : never;
}>;

/**
 * Agent-scoped state (scope: 'agent').
 */
export type DerivedAgentState<T extends ConfigSchema> = OmitNever<{
  [K in StateKeys<T>]: T[K] extends StateItemDefinition<infer D> & { scope: "agent" }
    ? D
    : never;
}>;

// =============================================================================
// Derived Action Types
// =============================================================================

/**
 * Extract the typed actions interface from config.
 */
export type DerivedActions<T extends ConfigSchema> = T["actions"] extends ActionsDefinition<any>
  ? {
      [K in keyof T["actions"]]: T["actions"][K] extends ActionDefinition<
        any,
        infer TArgs,
        infer TResult
      >
        ? (...args: TArgs) => Promise<TResult>
        : never;
    }
  : Record<string, never>;

// =============================================================================
// Store & Agent Options
// =============================================================================

export type StoreOptions = {
  /** Enable debug logging */
  debug?: boolean;
  /** Migration function for schema version changes */
  migrate?: (oldState: unknown, oldVersion: number, newVersion: number) => unknown;
};

export type AgentOptions = {
  /** Enable debug logging */
  debug?: boolean;
};

// =============================================================================
// Connection & Lifecycle Types
// =============================================================================

export type ConnectionStatus = {
  connected: boolean;
  agent?: AgentInfo;
};

export type StateChanges<T extends ConfigSchema> = Partial<DerivedState<T>>;

export type StateChangeListener<T extends ConfigSchema> = (
  state: DerivedState<T>,
  changes: StateChanges<T>,
  agent?: AgentInfo
) => void;

export type AgentConnectionInfo = {
  id: string;
  tabId: number;
  frameId: number;
  context: string;
  connectedAt: number;
};

// =============================================================================
// Type Guards
// =============================================================================

export function isStateItem(item: unknown): item is StateItemDefinition<unknown> {
  return (
    typeof item === "object" &&
    item !== null &&
    "default" in item &&
    !("handler" in item)
  );
}

export function isActionDefinition(item: unknown): item is ActionDefinition<any, any[], any> {
  return typeof item === "object" && item !== null && "handler" in item;
}

// =============================================================================
// createConfig Helper
// =============================================================================

/**
 * Creates a validated config object with proper type inference.
 * This is the single source of truth for store identity and shape.
 *
 * @example
 * const config = createConfig({
 *   name: 'myFeature',
 *   version: 1,
 *   count: { default: 0, scope: 'shared', persist: 'local' },
 *   agentData: { default: null as AgentData | null, scope: 'agent' },
 *   actions: {
 *     increment: {
 *       handler: async (ctx) => {
 *         await ctx.setState({ count: ctx.state.count + 1 });
 *         return ctx.state.count + 1;
 *       },
 *     },
 *   },
 * });
 */
export function createConfig<T extends ConfigSchema>(config: T): ValidatedConfig<T> {
  if (!config.name) {
    throw new Error("Crann config requires a 'name' property");
  }

  return {
    ...config,
    version: config.version ?? 1,
  } as ValidatedConfig<T>;
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export type { AgentInfo, BrowserLocation };

