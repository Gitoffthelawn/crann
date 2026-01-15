/**
 * Crann v2 Store Module
 *
 * This module provides the new Store implementation for v2.
 */

// Main exports
export { Store, createStore } from "./Store";
export { createConfig } from "./types";
export { clearOrphanedData } from "./Persistence";

// Type exports
export type {
  // Config types
  ConfigSchema,
  ValidatedConfig,
  StateItemDefinition,
  ActionDefinition,
  ActionsDefinition,
  ActionContext,
  ActionHandler,
  // State types
  DerivedState,
  DerivedSharedState,
  DerivedAgentState,
  DerivedActions,
  StateChanges,
  StateChangeListener,
  // Options
  StoreOptions,
  AgentOptions,
  // Connection
  ConnectionStatus,
  AgentConnectionInfo,
  // Constants
  ScopeType,
  PersistType,
} from "./types";

// Re-export constants
export { Scope, Persist } from "./types";

