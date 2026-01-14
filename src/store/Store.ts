/**
 * Crann v2 Store
 *
 * The central state hub that runs in the service worker.
 * This is NOT a singleton - each call to createStore() returns a new instance.
 */

import { source } from "../transport";
import type { Agent, AgentInfo, BrowserLocation } from "../transport";
import {
  ConfigSchema,
  ValidatedConfig,
  StoreOptions,
  DerivedState,
  DerivedSharedState,
  DerivedAgentState,
  StateChanges,
  StateChangeListener,
  AgentConnectionInfo,
  isStateItem,
  Scope,
} from "./types";
import { StateManager } from "./StateManager";
import { Persistence } from "./Persistence";
import { AgentRegistry } from "./AgentRegistry";
import { ActionExecutor } from "./ActionExecutor";

// =============================================================================
// Store Class
// =============================================================================

export class Store<TConfig extends ConfigSchema> {
  private readonly config: ValidatedConfig<TConfig>;
  private readonly options: StoreOptions;
  private readonly porter: ReturnType<typeof source>;

  private readonly stateManager: StateManager<TConfig>;
  private readonly persistence: Persistence<TConfig>;
  private readonly agentRegistry: AgentRegistry;
  private readonly actionExecutor: ActionExecutor<TConfig>;

  private readonly stateChangeListeners: Set<StateChangeListener<TConfig>> = new Set();
  private readonly agentConnectListeners: Set<(agent: AgentConnectionInfo) => void> = new Set();
  private readonly agentDisconnectListeners: Set<(agent: AgentConnectionInfo) => void> = new Set();

  private isDestroyed = false;

  constructor(config: ValidatedConfig<TConfig>, options: StoreOptions = {}) {
    this.config = config;
    this.options = options;

    // Initialize porter with the store name as namespace
    this.porter = source(config.name, { debug: options.debug ?? false });

    // Initialize sub-modules
    this.persistence = new Persistence(config, options);
    this.stateManager = new StateManager(config, this.persistence);
    this.agentRegistry = new AgentRegistry();
    this.actionExecutor = new ActionExecutor(
      config,
      () => this.getState(),
      (state, agentId) => this.setState(state, agentId)
    );

    // Set up message handlers
    this.setupMessageHandlers();

    // Hydrate state from storage
    this.hydrate();
  }

  // ===========================================================================
  // Public API - State
  // ===========================================================================

  /**
   * Get the current shared state.
   */
  getState(): DerivedState<TConfig> {
    this.assertNotDestroyed();
    return this.stateManager.getState();
  }

  /**
   * Get agent-scoped state for a specific agent.
   */
  getAgentState(agentId: string): DerivedAgentState<TConfig> {
    this.assertNotDestroyed();
    return this.stateManager.getAgentState(agentId);
  }

  /**
   * Update shared state.
   */
  async setState(state: Partial<DerivedSharedState<TConfig>>): Promise<void>;
  /**
   * Update state for a specific agent (can include both shared and agent-scoped).
   */
  async setState(
    state: Partial<DerivedState<TConfig>>,
    agentId: string
  ): Promise<void>;
  async setState(
    state: Partial<DerivedState<TConfig>>,
    agentId?: string
  ): Promise<void> {
    this.assertNotDestroyed();

    const { sharedChanges, agentChanges } = this.stateManager.setState(state, agentId);

    // Persist shared state changes
    if (Object.keys(sharedChanges).length > 0) {
      await this.persistence.persist(sharedChanges);
    }

    // Notify listeners and agents
    this.notifyStateChange(state as StateChanges<TConfig>, agentId);
  }

  /**
   * Update agent-scoped state for a specific agent.
   */
  async setAgentState(
    agentId: string,
    state: Partial<DerivedAgentState<TConfig>>
  ): Promise<void> {
    this.assertNotDestroyed();
    this.stateManager.setAgentState(agentId, state);
    this.notifyStateChange(state as StateChanges<TConfig>, agentId);
  }

  /**
   * Clear all state back to defaults.
   */
  async clear(): Promise<void> {
    this.assertNotDestroyed();
    this.stateManager.clear();
    await this.persistence.clearAll();
    this.notifyStateChange({} as StateChanges<TConfig>);
  }

  // ===========================================================================
  // Public API - Subscriptions
  // ===========================================================================

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: StateChangeListener<TConfig>): () => void {
    this.assertNotDestroyed();
    this.stateChangeListeners.add(listener);
    return () => {
      this.stateChangeListeners.delete(listener);
    };
  }

  /**
   * Register callback for agent connections.
   */
  onAgentConnect(callback: (agent: AgentConnectionInfo) => void): () => void {
    this.assertNotDestroyed();
    this.agentConnectListeners.add(callback);
    return () => {
      this.agentConnectListeners.delete(callback);
    };
  }

  /**
   * Register callback for agent disconnections.
   */
  onAgentDisconnect(callback: (agent: AgentConnectionInfo) => void): () => void {
    this.assertNotDestroyed();
    this.agentDisconnectListeners.add(callback);
    return () => {
      this.agentDisconnectListeners.delete(callback);
    };
  }

  // ===========================================================================
  // Public API - Agent Queries
  // ===========================================================================

  /**
   * Get all connected agents, optionally filtered.
   */
  getAgents(query?: Partial<BrowserLocation>): AgentConnectionInfo[] {
    this.assertNotDestroyed();
    if (query) {
      const porterAgents = this.porter.queryAgents(query);
      return porterAgents
        .map((a) => this.agentRegistry.get(a.info.id))
        .filter((a): a is AgentConnectionInfo => a !== undefined);
    }
    return this.agentRegistry.getAll();
  }

  // ===========================================================================
  // Public API - Lifecycle
  // ===========================================================================

  /**
   * Destroy the store and clean up all resources.
   * Call this for testing or HMR cleanup.
   */
  destroy(options?: { clearPersisted?: boolean }): void {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    // Clear all listeners
    this.stateChangeListeners.clear();
    this.agentConnectListeners.clear();
    this.agentDisconnectListeners.clear();

    // Clear agent registry
    this.agentRegistry.clear();

    // Optionally clear persisted data
    if (options?.clearPersisted) {
      this.persistence.clearAll();
    }

    // Note: Porter doesn't have a disconnect method, but we've cleaned up our state
  }

  // ===========================================================================
  // Private - Message Handling
  // ===========================================================================

  private setupMessageHandlers(): void {
    // Track which agents have received initial state
    const initializedAgents = new Set<string>();

    // Handle state updates from agents
    this.porter.on({
      setState: (message, agentInfo) => {
        if (!agentInfo) return;
        this.setState(message.payload.state, agentInfo.id);
      },
    });

    // Handle agent ready signal (messages established)
    this.porter.onMessagesSet((agentInfo: AgentInfo) => {
      if (!agentInfo || initializedAgents.has(agentInfo.id)) return;

      initializedAgents.add(agentInfo.id);

      // Send initial state to the agent
      const fullState = this.stateManager.getFullStateForAgent(agentInfo.id);
      this.porter.post(
        {
          action: "initialState",
          payload: { state: fullState, info: agentInfo },
        },
        agentInfo.location
      );
    });

    // Handle agent connections
    this.porter.onConnect((agentInfo: AgentInfo) => {
      if (!agentInfo) return;

      const connectionInfo = this.agentRegistry.add(agentInfo);
      this.stateManager.initializeAgentState(agentInfo.id);

      // Notify listeners
      this.agentConnectListeners.forEach((cb) => cb(connectionInfo));
    });

    // Handle agent disconnections
    this.porter.onDisconnect((agentInfo: AgentInfo) => {
      if (!agentInfo) return;

      const connectionInfo = this.agentRegistry.get(agentInfo.id);
      if (connectionInfo) {
        this.agentRegistry.remove(agentInfo.id);
        this.stateManager.removeAgentState(agentInfo.id);
        initializedAgents.delete(agentInfo.id);

        // Notify listeners
        this.agentDisconnectListeners.forEach((cb) => cb(connectionInfo));
      }
    });

    // Set up RPC for actions
    this.setupRpcHandlers();
  }

  private setupRpcHandlers(): void {
    this.porter.on({
      rpc: async (message, agentInfo) => {
        if (!agentInfo) return;

        const { actionName, args } = message.payload;
        try {
          const result = await this.actionExecutor.execute(
            actionName,
            args,
            agentInfo
          );
          this.porter.post(
            {
              action: "rpcResult",
              payload: { actionName, result, success: true },
            },
            agentInfo.location
          );
        } catch (error) {
          this.porter.post(
            {
              action: "rpcResult",
              payload: {
                actionName,
                error: error instanceof Error ? error.message : String(error),
                success: false,
              },
            },
            agentInfo.location
          );
        }
      },
    });
  }

  // ===========================================================================
  // Private - State Hydration & Notification
  // ===========================================================================

  private async hydrate(): Promise<void> {
    const hydratedState = await this.persistence.hydrate();
    if (Object.keys(hydratedState).length > 0) {
      this.stateManager.hydrateSharedState(hydratedState);
    }
  }

  private notifyStateChange(changes: StateChanges<TConfig>, agentId?: string): void {
    const state = this.getState();
    const agentInfo = agentId
      ? this.porter.getAgentById(agentId)?.info
      : undefined;

    // Notify local listeners
    this.stateChangeListeners.forEach((listener) => {
      listener(state, changes, agentInfo);
    });

    // Notify connected agents
    if (agentId) {
      // Notify specific agent
      const agent = this.porter.getAgentById(agentId);
      if (agent?.info.location) {
        this.porter.post(
          { action: "stateUpdate", payload: { state: changes } },
          agent.info.location
        );
      }
    } else {
      // Notify all agents
      for (const agent of this.agentRegistry.getAll()) {
        this.porter.post(
          { action: "stateUpdate", payload: { state: changes } },
          agent.id
        );
      }
    }
  }

  // ===========================================================================
  // Private - Utilities
  // ===========================================================================

  private assertNotDestroyed(): void {
    if (this.isDestroyed) {
      throw new Error(
        `Store "${this.config.name}" has been destroyed and cannot be used.`
      );
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new store instance.
 *
 * @example
 * const store = createStore(config, { debug: true });
 */
export function createStore<TConfig extends ConfigSchema>(
  config: ValidatedConfig<TConfig>,
  options?: StoreOptions
): Store<TConfig> {
  return new Store(config, options);
}

