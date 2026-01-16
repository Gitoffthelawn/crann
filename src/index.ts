/**
 * Crann v2 - Effortless State Synchronization for Web Extensions
 *
 * Main entry point for the Crann library.
 */

// =============================================================================
// Store (Service Worker)
// =============================================================================

export { Store, createStore } from "./store";
export { createConfig } from "./store";
export { clearOrphanedData } from "./store";
export { Scope, Persist } from "./store";

// =============================================================================
// Agent (Content Scripts, Popup, etc.)
// =============================================================================

export { Agent, connectStore } from "./agent";

// =============================================================================
// Types
// =============================================================================

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
} from "./store";

export type { AgentAPI, StateSubscriber } from "./agent";

// =============================================================================
// Errors
// =============================================================================

export {
  CrannError,
  ConfigError,
  ActionError,
  LifecycleError,
  ValidationError,
} from "./errors";

// =============================================================================
// Legacy Exports (Deprecated - will be removed in v3)
// =============================================================================

// Re-export legacy API with deprecation notices for gradual migration
export { create, Crann } from "./crann";
export { connect, connected } from "./crannAgent";
export { Partition, Persistence } from "./model/crann.model";
