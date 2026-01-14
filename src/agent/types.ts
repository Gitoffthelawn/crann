/**
 * Crann v2 Agent Type Definitions
 */

import type { AgentInfo, BrowserLocation } from "../transport";
import type {
  ConfigSchema,
  DerivedState,
  DerivedActions,
  StateChanges,
} from "../store/types";

// =============================================================================
// Agent Options
// =============================================================================

export type AgentOptions = {
  /** Enable debug logging */
  debug?: boolean;
};

// =============================================================================
// Connection Status
// =============================================================================

export type ConnectionStatus = {
  connected: boolean;
  agent?: AgentInfo;
};

// =============================================================================
// Agent Info (public, abstracted from porter types)
// =============================================================================

export type AgentConnectionInfo = {
  id: string;
  tabId: number;
  frameId: number;
  context: string;
};

// =============================================================================
// Subscription Types
// =============================================================================

export type StateSubscriber<TConfig extends ConfigSchema> = {
  keys?: Array<keyof DerivedState<TConfig>>;
  callback: (changes: StateChanges<TConfig>, state: DerivedState<TConfig>) => void;
};

// =============================================================================
// Agent API Interface
// =============================================================================

export interface AgentAPI<TConfig extends ConfigSchema> {
  /**
   * Wait for connection to store. Returns initial state.
   */
  ready(): Promise<DerivedState<TConfig>>;

  /**
   * Register callback for when connection is ready.
   */
  onReady(callback: (state: DerivedState<TConfig>) => void): () => void;

  /**
   * Get current state snapshot.
   */
  getState(): DerivedState<TConfig>;

  /**
   * Shorthand for getState().
   */
  readonly state: DerivedState<TConfig>;

  /**
   * Update state (async, awaitable).
   */
  setState(state: Partial<DerivedState<TConfig>>): Promise<void>;

  /**
   * Subscribe to state changes.
   */
  subscribe(
    callback: (changes: StateChanges<TConfig>, state: DerivedState<TConfig>) => void
  ): () => void;

  /**
   * Subscribe to specific keys only.
   */
  subscribe(
    keys: Array<keyof DerivedState<TConfig>>,
    callback: (changes: StateChanges<TConfig>, state: DerivedState<TConfig>) => void
  ): () => void;

  /**
   * Typed action proxy. Call actions like: agent.actions.increment()
   */
  readonly actions: DerivedActions<TConfig>;

  /**
   * Get this agent's connection info.
   */
  getInfo(): AgentConnectionInfo | null;

  /**
   * Register callback for disconnection.
   */
  onDisconnect(callback: () => void): () => void;

  /**
   * Register callback for reconnection.
   */
  onReconnect(callback: (state: DerivedState<TConfig>) => void): () => void;

  /**
   * Disconnect from store (cleanup).
   */
  disconnect(): void;
}

