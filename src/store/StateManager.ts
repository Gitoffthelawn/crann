/**
 * StateManager - Handles in-memory state operations
 *
 * Responsibilities:
 * - Maintain shared state and per-agent state
 * - Handle state updates with change detection
 * - Initialize default values from config
 */

import {
  ConfigSchema,
  ValidatedConfig,
  DerivedState,
  DerivedSharedState,
  DerivedAgentState,
  isStateItem,
  Scope,
} from "./types";
import { Persistence } from "./Persistence";
import { deepEqual } from "../utils/deepEqual";

export class StateManager<TConfig extends ConfigSchema> {
  private readonly config: ValidatedConfig<TConfig>;
  private readonly persistence: Persistence<TConfig>;

  private sharedState: DerivedSharedState<TConfig>;
  private readonly agentStates: Map<string, DerivedAgentState<TConfig>> = new Map();

  private readonly defaultSharedState: DerivedSharedState<TConfig>;
  private readonly defaultAgentState: DerivedAgentState<TConfig>;

  constructor(config: ValidatedConfig<TConfig>, persistence: Persistence<TConfig>) {
    this.config = config;
    this.persistence = persistence;

    // Initialize defaults from config
    this.defaultSharedState = this.buildDefaultSharedState();
    this.defaultAgentState = this.buildDefaultAgentState();
    this.sharedState = { ...this.defaultSharedState };
  }

  // ===========================================================================
  // State Access
  // ===========================================================================

  /**
   * Get the full derived state (shared only, from store perspective).
   */
  getState(): DerivedState<TConfig> {
    return { ...this.sharedState } as DerivedState<TConfig>;
  }

  /**
   * Get shared state only.
   */
  getSharedState(): DerivedSharedState<TConfig> {
    return { ...this.sharedState };
  }

  /**
   * Get agent-scoped state for a specific agent.
   */
  getAgentState(agentId: string): DerivedAgentState<TConfig> {
    return this.agentStates.get(agentId) ?? { ...this.defaultAgentState };
  }

  /**
   * Get full state for an agent (shared + agent-scoped).
   */
  getFullStateForAgent(agentId: string): DerivedState<TConfig> {
    const agentState = this.getAgentState(agentId);
    return {
      ...this.sharedState,
      ...agentState,
    } as DerivedState<TConfig>;
  }

  // ===========================================================================
  // State Updates
  // ===========================================================================

  /**
   * Update state, separating shared and agent-scoped changes.
   * Returns the changes that were actually applied.
   */
  setState(
    state: Partial<DerivedState<TConfig>>,
    agentId?: string
  ): { sharedChanges: Partial<DerivedSharedState<TConfig>>; agentChanges: Partial<DerivedAgentState<TConfig>> } {
    const sharedChanges: Partial<DerivedSharedState<TConfig>> = {};
    const agentChanges: Partial<DerivedAgentState<TConfig>> = {};

    for (const key of Object.keys(state) as Array<keyof DerivedState<TConfig>>) {
      const configItem = this.config[key as string];
      if (!isStateItem(configItem)) continue;

      const value = state[key];
      const isAgentScoped = configItem.scope === Scope.Agent;

      if (isAgentScoped && agentId) {
        // Agent-scoped state
        (agentChanges as any)[key] = value;
      } else if (!isAgentScoped) {
        // Shared state
        (sharedChanges as any)[key] = value;
      }
    }

    // Apply shared state changes
    if (Object.keys(sharedChanges).length > 0) {
      const newSharedState = { ...this.sharedState, ...sharedChanges };
      if (!deepEqual(this.sharedState, newSharedState)) {
        this.sharedState = newSharedState as DerivedSharedState<TConfig>;
      }
    }

    // Apply agent state changes
    if (agentId && Object.keys(agentChanges).length > 0) {
      const currentAgentState = this.agentStates.get(agentId) ?? { ...this.defaultAgentState };
      const newAgentState = { ...currentAgentState, ...agentChanges };
      if (!deepEqual(currentAgentState, newAgentState)) {
        this.agentStates.set(agentId, newAgentState as DerivedAgentState<TConfig>);
      }
    }

    return { sharedChanges, agentChanges };
  }

  /**
   * Update agent-scoped state only.
   */
  setAgentState(agentId: string, state: Partial<DerivedAgentState<TConfig>>): void {
    const currentState = this.agentStates.get(agentId) ?? { ...this.defaultAgentState };
    const newState = { ...currentState, ...state };
    if (!deepEqual(currentState, newState)) {
      this.agentStates.set(agentId, newState as DerivedAgentState<TConfig>);
    }
  }

  /**
   * Hydrate shared state from storage.
   */
  hydrateSharedState(state: Partial<DerivedSharedState<TConfig>>): void {
    this.sharedState = { ...this.defaultSharedState, ...state } as DerivedSharedState<TConfig>;
  }

  // ===========================================================================
  // Agent Lifecycle
  // ===========================================================================

  /**
   * Initialize state for a new agent.
   */
  initializeAgentState(agentId: string): void {
    if (!this.agentStates.has(agentId)) {
      this.agentStates.set(agentId, { ...this.defaultAgentState });
    }
  }

  /**
   * Remove state for a disconnected agent.
   */
  removeAgentState(agentId: string): void {
    this.agentStates.delete(agentId);
  }

  /**
   * Clear all state back to defaults.
   */
  clear(): void {
    this.sharedState = { ...this.defaultSharedState };
    this.agentStates.clear();
  }

  // ===========================================================================
  // Private - Build Defaults
  // ===========================================================================

  private buildDefaultSharedState(): DerivedSharedState<TConfig> {
    const state: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(this.config)) {
      if (key === "name" || key === "version" || key === "actions") continue;
      if (!isStateItem(item)) continue;

      // Shared = default scope or explicitly 'shared'
      if (!item.scope || item.scope === Scope.Shared) {
        state[key] = item.default;
      }
    }

    return state as DerivedSharedState<TConfig>;
  }

  private buildDefaultAgentState(): DerivedAgentState<TConfig> {
    const state: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(this.config)) {
      if (key === "name" || key === "version" || key === "actions") continue;
      if (!isStateItem(item)) continue;

      if (item.scope === Scope.Agent) {
        state[key] = item.default;
      }
    }

    return state as DerivedAgentState<TConfig>;
  }
}

