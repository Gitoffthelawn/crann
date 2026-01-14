/**
 * Crann v2 Agent
 *
 * Client-side connection to a Crann store.
 * Runs in content scripts, popup, sidepanel, etc.
 */

import { connect as connectPorter } from "../transport";
import type { AgentInfo } from "../transport";
import type {
  ConfigSchema,
  ValidatedConfig,
  DerivedState,
  DerivedActions,
  StateChanges,
  isStateItem,
} from "../store/types";
import type {
  AgentOptions,
  AgentAPI,
  AgentConnectionInfo,
  StateSubscriber,
  ConnectionStatus,
} from "./types";

// =============================================================================
// Agent Class
// =============================================================================

export class Agent<TConfig extends ConfigSchema> implements AgentAPI<TConfig> {
  private readonly config: ValidatedConfig<TConfig>;
  private readonly options: AgentOptions;
  private readonly porter: ReturnType<typeof connectPorter>;

  private _state: DerivedState<TConfig>;
  private _agentInfo: AgentInfo | null = null;
  private _isConnected = false;
  private _isDisconnected = false;

  private readonly subscribers: Set<StateSubscriber<TConfig>> = new Set();
  private readonly readyCallbacks: Set<(state: DerivedState<TConfig>) => void> = new Set();
  private readonly disconnectCallbacks: Set<() => void> = new Set();
  private readonly reconnectCallbacks: Set<(state: DerivedState<TConfig>) => void> = new Set();

  private readyPromise: Promise<DerivedState<TConfig>>;
  private readyResolve!: (state: DerivedState<TConfig>) => void;

  private readonly actionsProxy: DerivedActions<TConfig>;

  constructor(config: ValidatedConfig<TConfig>, options: AgentOptions = {}) {
    this.config = config;
    this.options = options;

    // Initialize state with defaults
    this._state = this.buildDefaultState();

    // Create ready promise
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    // Connect to store via porter (using store name as namespace)
    this.porter = connectPorter({
      namespace: config.name,
      debug: options.debug ?? false,
    });

    // Set up message handlers
    this.setupMessageHandlers();

    // Create typed actions proxy
    this.actionsProxy = this.createActionsProxy();
  }

  // ===========================================================================
  // Public API - Connection
  // ===========================================================================

  ready(): Promise<DerivedState<TConfig>> {
    this.assertNotDisconnected();
    return this.readyPromise;
  }

  onReady(callback: (state: DerivedState<TConfig>) => void): () => void {
    this.assertNotDisconnected();
    
    // If already connected, call immediately
    if (this._isConnected) {
      setTimeout(() => callback(this._state), 0);
    }
    
    this.readyCallbacks.add(callback);
    return () => {
      this.readyCallbacks.delete(callback);
    };
  }

  // ===========================================================================
  // Public API - State
  // ===========================================================================

  getState(): DerivedState<TConfig> {
    this.assertNotDisconnected();
    return { ...this._state };
  }

  get state(): DerivedState<TConfig> {
    return this.getState();
  }

  async setState(state: Partial<DerivedState<TConfig>>): Promise<void> {
    this.assertNotDisconnected();
    
    // Optimistically update local state
    this._state = { ...this._state, ...state };
    
    // Send to store
    this.porter.post({
      action: "setState",
      payload: { state },
    });
  }

  // ===========================================================================
  // Public API - Subscriptions
  // ===========================================================================

  subscribe(
    callbackOrKeys: ((changes: StateChanges<TConfig>, state: DerivedState<TConfig>) => void) | Array<keyof DerivedState<TConfig>>,
    maybeCallback?: (changes: StateChanges<TConfig>, state: DerivedState<TConfig>) => void
  ): () => void {
    this.assertNotDisconnected();

    let keys: Array<keyof DerivedState<TConfig>> | undefined;
    let callback: (changes: StateChanges<TConfig>, state: DerivedState<TConfig>) => void;

    if (typeof callbackOrKeys === "function") {
      callback = callbackOrKeys;
    } else {
      keys = callbackOrKeys;
      callback = maybeCallback!;
    }

    const subscriber: StateSubscriber<TConfig> = { keys, callback };
    this.subscribers.add(subscriber);

    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  // ===========================================================================
  // Public API - Actions
  // ===========================================================================

  get actions(): DerivedActions<TConfig> {
    this.assertNotDisconnected();
    return this.actionsProxy;
  }

  // ===========================================================================
  // Public API - Agent Info
  // ===========================================================================

  getInfo(): AgentConnectionInfo | null {
    if (!this._agentInfo) return null;
    
    return {
      id: this._agentInfo.id,
      tabId: this._agentInfo.location.tabId,
      frameId: this._agentInfo.location.frameId,
      context: this._agentInfo.location.context,
    };
  }

  // ===========================================================================
  // Public API - Lifecycle
  // ===========================================================================

  onDisconnect(callback: () => void): () => void {
    this.assertNotDisconnected();
    this.disconnectCallbacks.add(callback);
    return () => {
      this.disconnectCallbacks.delete(callback);
    };
  }

  onReconnect(callback: (state: DerivedState<TConfig>) => void): () => void {
    this.assertNotDisconnected();
    this.reconnectCallbacks.add(callback);
    return () => {
      this.reconnectCallbacks.delete(callback);
    };
  }

  disconnect(): void {
    if (this._isDisconnected) return;

    this._isDisconnected = true;
    this._isConnected = false;

    // Clear all callbacks
    this.subscribers.clear();
    this.readyCallbacks.clear();
    this.disconnectCallbacks.clear();
    this.reconnectCallbacks.clear();

    // Note: Porter doesn't have a disconnect method, but we've cleaned up our state
  }

  // ===========================================================================
  // Private - Message Handling
  // ===========================================================================

  private setupMessageHandlers(): void {
    // Handle initial state from store
    this.porter.on({
      initialState: (message) => {
        const { state, info } = message.payload;
        
        this._state = state;
        this._agentInfo = info;
        this._isConnected = true;

        // Resolve ready promise
        this.readyResolve(this._state);

        // Notify ready callbacks
        this.readyCallbacks.forEach((cb) => {
          try {
            cb(this._state);
          } catch (e) {
            console.error("[Crann Agent] Error in onReady callback:", e);
          }
        });

        // Notify initial subscribers
        this.notifySubscribers(state);
      },

      stateUpdate: (message) => {
        const { state: changes } = message.payload;
        this._state = { ...this._state, ...changes };
        this.notifySubscribers(changes);
      },

      rpcResult: (message) => {
        // RPC results are handled by the action proxy's pending promises
        // This is handled in createActionsProxy
      },
    });

    // Handle disconnect/reconnect from porter
    this.porter.onDisconnect(() => {
      this._isConnected = false;
      this.disconnectCallbacks.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.error("[Crann Agent] Error in onDisconnect callback:", e);
        }
      });
    });

    this.porter.onReconnect((info: AgentInfo) => {
      this._agentInfo = info;
      this._isConnected = true;
      this.reconnectCallbacks.forEach((cb) => {
        try {
          cb(this._state);
        } catch (e) {
          console.error("[Crann Agent] Error in onReconnect callback:", e);
        }
      });
    });
  }

  private notifySubscribers(changes: StateChanges<TConfig>): void {
    this.subscribers.forEach((subscriber) => {
      // If subscriber has specific keys, check if any changed
      if (subscriber.keys) {
        const hasRelevantChange = subscriber.keys.some(
          (key) => key in changes
        );
        if (!hasRelevantChange) return;
      }

      try {
        subscriber.callback(changes, this._state);
      } catch (e) {
        console.error("[Crann Agent] Error in subscriber callback:", e);
      }
    });
  }

  // ===========================================================================
  // Private - Actions Proxy
  // ===========================================================================

  private createActionsProxy(): DerivedActions<TConfig> {
    const pendingCalls = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
    let callId = 0;

    // Listen for RPC results
    this.porter.on({
      rpcResult: (message) => {
        const { callId: id, result, error, success } = message.payload;
        const pending = pendingCalls.get(id);
        if (pending) {
          pendingCalls.delete(id);
          if (success) {
            pending.resolve(result);
          } else {
            pending.reject(new Error(error));
          }
        }
      },
    });

    return new Proxy({} as DerivedActions<TConfig>, {
      get: (_target, actionName: string) => {
        return async (...args: unknown[]) => {
          const id = `${callId++}`;
          
          return new Promise((resolve, reject) => {
            pendingCalls.set(id, { resolve, reject });
            
            this.porter.post({
              action: "rpc",
              payload: {
                callId: id,
                actionName,
                args,
              },
            });
          });
        };
      },
    });
  }

  // ===========================================================================
  // Private - Utilities
  // ===========================================================================

  private buildDefaultState(): DerivedState<TConfig> {
    const state: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(this.config)) {
      if (key === "name" || key === "version" || key === "actions") continue;
      if (typeof item === "object" && item !== null && "default" in item) {
        state[key] = item.default;
      }
    }

    return state as DerivedState<TConfig>;
  }

  private assertNotDisconnected(): void {
    if (this._isDisconnected) {
      throw new Error(
        `Agent for store "${this.config.name}" has been disconnected and cannot be used.`
      );
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Connect to a Crann store.
 *
 * @example
 * const agent = connectStore(config, { debug: true });
 * const state = await agent.ready();
 * console.log(state.count);
 */
export function connectStore<TConfig extends ConfigSchema>(
  config: ValidatedConfig<TConfig>,
  options?: AgentOptions
): AgentAPI<TConfig> {
  return new Agent(config, options);
}

