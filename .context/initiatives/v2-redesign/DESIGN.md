# Crann v2 Design Document

> **Status:** Draft  
> **Authors:** Marc O'Cleirigh  
> **Created:** 2026-01-12  
> **Last Updated:** 2026-01-13

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Background & Motivation](#background--motivation)
3. [Goals & Non-Goals](#goals--non-goals)
4. [Current Problems](#current-problems)
5. [Proposed API Design](#proposed-api-design)
6. [Architectural Changes](#architectural-changes)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Migration Guide](#migration-guide)
9. [Open Questions](#open-questions)
10. [Appendix: Analysis Sources](#appendix-analysis-sources)

---

## Executive Summary

Crann is a state synchronization library for Manifest V3 browser extensions. It provides centralized state management that syncs between service workers and extension contexts (content scripts, popups, sidepanels).

This document outlines a v2 redesign based on comprehensive code analysis from multiple experienced engineers. The redesign addresses:

- **Singleton anti-pattern** → Multi-instance architecture
- **API asymmetry** → Unified, symmetric APIs
- **Type safety gaps** → Full TypeScript safety, especially for actions
- **Naming confusion** → Consistent, intuitive terminology
- **Performance issues** → Optimized logging, proper async handling
- **Lifecycle bugs** → Proper cleanup, no listener leaks

**Target:** A library worthy of external adoption—simple to use, hard to misuse, fully typed, well-documented.

---

## Background & Motivation

### What Crann Does

Browser extensions run code across isolated contexts:

- Service worker (background)
- Content scripts (per-tab)
- Popup, sidepanel, devtools, options page

Sharing state between these traditionally requires manual `chrome.runtime.sendMessage` choreography. Crann abstracts this:

```
┌─────────────────────────────────────────────────────────┐
│                    Service Worker                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Crann Store (Source)                │    │
│  │  - Single source of truth                        │    │
│  │  - Persists to chrome.storage                    │    │
│  │  - Broadcasts updates to agents                  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
           │              │              │
           ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  Agent   │   │  Agent   │   │  Agent   │
    │ (popup)  │   │ (tab 1)  │   │ (tab 2)  │
    └──────────┘   └──────────┘   └──────────┘
```

### Why v2?

The current implementation works but has accumulated technical debt:

- Designed "as-you-go" based on immediate needs
- Singleton pattern prevents testing and multi-store scenarios
- API inconsistencies between source and agent
- Untyped action invocation
- Lifecycle edge cases (listener leaks, race conditions)

With few current users and a goal of external adoption, now is the time for breaking changes.

---

## Goals & Non-Goals

### Goals

1. **Simple mental model** - Source holds state, agents consume and update it
2. **Full type safety** - Config → API types flow through completely
3. **Framework agnostic** - Core works without React; React is a plugin
4. **Multi-instance support** - Multiple stores, isolated testing
5. **Symmetric APIs** - Source and agent have parallel interfaces where sensible
6. **Modern patterns** - Async/await, proper cleanup, no singletons
7. **Excellent DX** - Clear errors, good defaults, minimal boilerplate

### Non-Goals

1. **Backward compatibility** - This is a breaking release
2. **Feature parity with Redux** - We solve extension-specific problems
3. **Supporting non-MV3** - MV2 is deprecated
4. **Real-time collaboration** - Single-user, single-browser scope

---

## Current Problems

### Critical (Must Fix)

| Problem                            | Impact                           | Root Cause               |
| ---------------------------------- | -------------------------------- | ------------------------ |
| Singleton pattern                  | Can't test, can't multi-store    | Design decision          |
| Async not awaited                  | Race conditions, silent failures | Implementation oversight |
| Memory leak in `agentsInitialized` | Unbounded growth                 | Missing cleanup          |
| Listener accumulation              | Multiple handlers fire           | Nested registration      |
| Initial state race                 | UI flicker on mount              | Sync before async data   |

### High Priority (API Quality)

| Problem              | Impact                   | Root Cause         |
| -------------------- | ------------------------ | ------------------ |
| `callAction(string)` | No type safety           | Hacked-in RPC      |
| API asymmetry        | Confusing to learn       | Organic growth     |
| Naming confusion     | Hard to discuss/document | Changed during dev |
| Logger overhead      | CPU waste per log        | Getter pattern     |
| React double-hook    | Awkward usage            | Overcomplicated    |

### Medium Priority (Polish)

| Problem                | Impact                   | Root Cause         |
| ---------------------- | ------------------------ | ------------------ |
| No schema versioning   | Stale data on upgrade    | Not implemented    |
| Crann class too large  | Hard to maintain         | No decomposition   |
| Porter types leak      | Coupling to transport    | Blurred boundaries |
| Storage key collisions | Could hydrate wrong data | No validation      |

---

## Proposed API Design

### Guiding Principles

1. **Config is the contract** - Define once, types flow everywhere
2. **Explicit over implicit** - No magic, no singletons
3. **Parallel structure** - Source and agent mirror each other
4. **Progressive disclosure** - Simple cases simple, complex possible

### Terminology

| Old                   | New             | Rationale                                   |
| --------------------- | --------------- | ------------------------------------------- |
| Crann (class)         | Store           | Universal term                              |
| create()              | createStore()   | More descriptive                            |
| connect()             | connectStore()  | Parallel naming                             |
| Instance state        | Agent state     | Aligns with Crann's "agent" terminology     |
| Service state         | Shared state    | State shared across all agents              |
| partition: 'instance' | scope: 'agent'  | Scoped to specific agent (avoids tab/frame) |
| partition: 'service'  | scope: 'shared' | Shared across all agents                    |

### Config Schema

The config is the single source of truth for a store - including its identity.

```typescript
import { createConfig } from "crann";

const config = createConfig({
  // Store identity (required)
  name: "myFeature", // Used for storage keys, agent connection routing
  version: 1, // Schema version for migrations

  // State items
  count: {
    default: 0,
    scope: "shared", // 'shared' | 'agent' (default: 'shared')
    persist: "local", // 'local' | 'session' | 'none' (default: 'none')
  },

  agentData: {
    default: null as AgentData | null,
    scope: "agent",
  },

  // Actions (RPC)
  actions: {
    increment: {
      handler: async (ctx) => {
        ctx.setState({ count: ctx.state.count + 1 });
        return ctx.state.count + 1;
      },
    },

    fetchUser: {
      handler: async (ctx, userId: string) => {
        const user = await api.getUser(userId);
        ctx.setState({ user });
        return user;
      },
      // Optional validation
      validate: (userId: string) => {
        if (!userId) throw new Error("userId required");
      },
    },
  },
});

// Type is inferred
type MyConfig = typeof config;
```

### Source API (Service Worker)

```typescript
import { createStore } from 'crann';
import { config } from './config';

// Create store - NOT a singleton
// Name and version come from config (single source of truth)
const store = createStore(config, {
  debug: process.env.NODE_ENV === 'development',
});

// Get state
const state = store.getState();
const count = store.getState().count;

// Set state (async, awaitable)
await store.setState({ count: 5 });

// Subscribe to changes
const unsubscribe = store.subscribe((state, changes) => {
  console.log('State changed:', changes);
});

// Subscribe to specific keys
const unsubscribe = store.subscribe(['count'], (state, changes) => {
  console.log('Count changed:', changes.count);
});

// Agent lifecycle
store.onAgentConnect((agent) => {
  console.log('Agent connected:', agent.id, agent.context);
});

store.onAgentDisconnect((agent) => {
  console.log('Agent disconnected:', agent.id);
});

// Get agent's agent-scoped state
const agentState = store.getAgentState(agentId);

// Set agent's agent-scoped state
await store.setAgentState(agentId, { agentData: { ... } });

// Query connected agents
const agents = store.getAgents({ context: 'content_script' });

// Clear all state (reset to defaults)
await store.clear();

// Cleanup (for testing, HMR)
store.destroy();
```

### Agent API (Content Scripts, Popup, etc.)

```typescript
import { connectStore } from "crann";
import { config } from "./config";

// Connect to store - uses config.name to find the right store
const agent = connectStore(config, {
  debug: process.env.NODE_ENV === "development",
});

// Wait for connection (returns typed state)
const initialState = await agent.ready();

// Or callback style
agent.onReady((state) => {
  console.log("Connected with state:", state);
});

// Get state (sync after ready)
const state = agent.getState();
const count = agent.state.count; // Shorthand

// Set state (async, awaitable)
await agent.setState({ count: 5 });

// Subscribe to changes
const unsubscribe = agent.subscribe((state, changes) => {
  console.log("State changed:", changes);
});

// Call actions (FULLY TYPED)
const newCount = await agent.actions.increment();
const user = await agent.actions.fetchUser("user-123");

// Connection lifecycle
agent.onDisconnect(() => {
  console.log("Lost connection to store");
});

agent.onReconnect((state) => {
  console.log("Reconnected with state:", state);
});

// Get own agent info
const info = agent.getInfo();
console.log(info.id, info.tabId, info.frameId, info.context);

// Disconnect (cleanup)
agent.disconnect();
```

### React Integration

```typescript
// crann/react
import { createCrannHooks } from "crann/react";
import { config } from "./config";

// Create hooks (once, at module level)
export const {
  useCrannState, // For reading state
  useCrannActions, // For calling actions
  useCrannReady, // For connection status
  CrannProvider, // Optional context provider
} = createCrannHooks(config);

// Usage in components
function Counter() {
  const count = useCrannState((state) => state.count);
  const { increment } = useCrannActions();
  const isReady = useCrannReady();

  if (!isReady) return <Loading />;

  return <button onClick={() => increment()}>Count: {count}</button>;
}

// Or with tuple pattern (familiar from useState)
function Counter() {
  const [count, setCount] = useCrannState("count");
  // ...
}
```

### Type Safety Demonstration

```typescript
const config = createConfig({
  count: { default: 0 },
  user: { default: null as User | null },
  actions: {
    setUser: {
      handler: async (ctx, user: User) => {
        ctx.setState({ user });
      },
    },
  },
});

// All of these are fully typed:
agent.state.count; // number
agent.state.user; // User | null
agent.state.nonexistent; // TS Error!

await agent.setState({ count: "string" }); // TS Error!
await agent.actions.setUser({ wrong: "shape" }); // TS Error!
await agent.actions.setUser(validUser); // OK, returns void
```

---

## Architectural Changes

### 1. Remove Singleton Pattern

**Before:**

```typescript
class Crann {
  private static instance: Crann | null = null;
  static getInstance(config) {
    if (!Crann.instance) Crann.instance = new Crann(config);
    return Crann.instance;
  }
}
```

**After:**

```typescript
class Store {
  constructor(config, options) {
    // Just a normal instance
  }

  destroy() {
    // Cleanup for testing/HMR
    this.porter.disconnect();
    this.listeners.clear();
    this.agents.clear();
  }
}

export function createStore(config, options) {
  return new Store(config, options);
}
```

### 2. Decompose Crann Class

Split ~600 line class into focused modules:

```
src/
  store/
    Store.ts           # Main class, delegates to:
    StateManager.ts    # get/set state, change detection
    Persistence.ts     # chrome.storage hydration/persistence
    AgentRegistry.ts   # track connected agents
    ActionExecutor.ts  # RPC action handling
  agent/
    Agent.ts           # Main class
    Connection.ts      # porter-source wrapper
  common/
    types.ts           # Config, state types
    config.ts          # createConfig helper
```

### 3. Merge Porter-Source

Since both libraries are maintained together and tightly coupled:

1. Fork porter-source into `src/transport/`
2. Simplify to only what Crann needs
3. Hide transport types from public API
4. Single repo, single release cycle

### 4. Typed Action Proxy

Replace `callAction(string)` with typed proxy:

```typescript
// In agent
private createActionProxy(): Actions<TConfig> {
  return new Proxy({} as Actions<TConfig>, {
    get: (_, actionName: string) => {
      return async (...args: unknown[]) => {
        return this.rpc.call(actionName, args);
      };
    },
  });
}

// Exposed as
agent.actions.increment()  // Fully typed!
```

### 5. Fix Async/Await Chain

Ensure all state mutations are awaitable:

```typescript
// Before
public async set(state) {
  this.setInstanceState(key, instance);  // Not awaited!
  this.setServiceState(worker);          // Not awaited!
}

// After
public async setState(state) {
  const promises = [];
  if (hasAgentState) promises.push(this.setAgentState(agentId, agentState));
  if (hasSharedState) promises.push(this.setSharedState(sharedState));
  await Promise.all(promises);
}
```

### 6. Optimize Logger

Cache method bindings, rebuild only on tag change:

```typescript
class Logger {
  private cachedMethods: LogMethods | null = null;
  private cachedTag: string | null = null;

  private getMethods(): LogMethods {
    if (this.cachedMethods && this.tag === this.cachedTag) {
      return this.cachedMethods;
    }
    this.cachedTag = this.tag;
    this.cachedMethods = this.buildMethods();
    return this.cachedMethods;
  }

  log(...args: unknown[]) {
    if (!Logger.debugEnabled) return;
    this.getMethods().log(...args);
  }
}
```

### 7. Storage Key Structure & Collision Detection

#### Key Format

All persisted state uses structured keys with the `crann:` prefix:

```
crann:{name}:v{version}:{key}
```

Examples:

```
crann:myFeature:v1:count
crann:myFeature:v1:user
crann:myFeature:__meta
```

The `__meta` key stores store metadata (without version, since it tracks version):

```typescript
interface StoreMetadata {
  version: number;
  createdAt: number;
  lastAccessed: number;
}
```

#### Why This Structure?

1. **`crann:` prefix** - Avoids collisions with non-Crann data in `chrome.storage`
2. **`{name}`** - Store name from config, enables multi-store scenarios
3. **`v{version}`** - Schema version from config, enables migrations without key collisions
4. **`{key}`** - The actual state key from config

#### Collision Detection

When `createStore()` is called:

1. Check if `crann:{name}:__meta` already exists in storage
2. If exists AND current process didn't create it → collision detected
3. In development: throw descriptive error
4. In production: log warning (don't crash user's extension)

```typescript
// In development
throw new CrannError(
  `Store name "${name}" is already in use. Each store must have a unique name. ` +
    `If you're trying to connect to an existing store, use connectStore() instead.`
);
```

We track "current process" stores in memory to allow the same store to be referenced multiple times in a codebase without false positives.

#### Cleanup Utilities

For orphaned data from removed stores or old versions:

```typescript
// Clear all data for a specific store (including all versions)
await store.clearPersistedData();

// Static utility to find and remove orphaned Crann data
import { clearOrphanedData } from "crann";
const removed = await clearOrphanedData({
  keepStores: ["myFeature", "otherStore"], // Store names to preserve
  dryRun: true, // Preview what would be removed
});
// Returns: { keys: ['crann:oldStore:v1:count', ...], count: 5 }

// Actually remove
await clearOrphanedData({ keepStores: ["myFeature", "otherStore"] });
```

The `store.destroy()` method accepts an option to clear persisted data:

```typescript
store.destroy({ clearPersisted: true }); // Removes all storage keys for this store
```

---

## Implementation Roadmap

### Phase 0: Preparation (1-2 days)

- [ ] Create `v2` branch
- [ ] Set up this design doc in `.context/`
- [ ] Merge porter-source into repo as `src/transport/`
- [ ] Update build config for new structure

### Phase 1: Core Architecture (3-5 days)

- [ ] Implement new `createConfig()` with updated schema
- [ ] Create `Store` class (non-singleton)
- [ ] Extract `StateManager` from current Crann
- [ ] Extract `Persistence` module
- [ ] Extract `AgentRegistry` module
- [ ] Implement `store.destroy()` for cleanup
- [ ] Fix async/await chain in setState
- [ ] Fix memory leaks (agentsInitialized, listeners)
- [ ] Add schema versioning for persistence

### Phase 2: Agent Rewrite (2-3 days)

- [ ] Create new `Agent` class (non-singleton)
- [ ] Implement `agent.ready()` promise
- [ ] Create typed action proxy
- [ ] Fix initial state race condition
- [ ] Implement proper disconnect/reconnect handling
- [ ] Add `agent.disconnect()` cleanup

### Phase 3: API Polish (2-3 days)

- [ ] Unify naming (shared/agent)
- [ ] Make source and agent APIs symmetric
- [ ] Improve error messages
- [ ] Add input validation
- [ ] Update all TypeScript types

### Phase 4: React Integration (1-2 days)

- [ ] Create `crann/react` entry point
- [ ] Implement `createCrannHooks()`
- [ ] Implement `useCrannState` with selector support
- [ ] Implement `useCrannActions`
- [ ] Implement `useCrannReady`
- [ ] Fix initial state flash

### Phase 5: Testing & Docs (2-3 days)

- [ ] Unit tests for StateManager, Persistence, AgentRegistry
- [ ] Integration tests for store ↔ agent communication
- [ ] Test isolation (verify no singleton leakage)
- [ ] Update README with new API
- [ ] Add migration guide
- [ ] Add examples

### Phase 6: Release (1 day)

- [ ] Version bump to 2.0.0
- [ ] Changelog
- [ ] npm publish
- [ ] GitHub release notes

**Estimated Total: 12-19 days**

---

## Migration Guide

### Config Changes

```typescript
// v1
const config = {
  count: { default: 0, partition: "service", persist: "local" },
  tabData: { default: null, partition: "instance" },
};

// v2 - name and version are now part of config (single source of truth)
const config = createConfig({
  name: "myFeature", // Required - identifies store for connection and storage
  version: 1, // Optional - schema version for migrations

  count: { default: 0, scope: "shared", persist: "local" },
  agentData: { default: null, scope: "agent" },
});
```

### Store Creation

```typescript
// v1
import { create } from "crann";
const crann = create(config);

// v2
import { createStore } from "crann";
// name and version are now in config (single source of truth)
const store = createStore(config, { debug: true });
```

### Agent Connection

```typescript
// v1
import { connect } from 'crann';
const agent = connect(config);
agent.onReady((status) => {
  if (status.connected) { ... }
});

// v2
import { connectStore } from 'crann';
const agent = connectStore(config);
await agent.ready();  // or agent.onReady(callback)
```

### State Access

```typescript
// v1
const state = crann.get();
crann.set({ count: 5 });

// v2
const state = store.getState();
await store.setState({ count: 5 });
```

### Actions

```typescript
// v1
agent.callAction("increment", arg1, arg2);

// v2
await agent.actions.increment(arg1, arg2);
```

### React

```typescript
// v1
const useCrannState = createCrannStateHook(config);
function Component() {
  const { useStateItem } = useCrannState();
  const [count, setCount] = useStateItem("count");
}

// v2
const { useCrannState } = createCrannHooks(config);
function Component() {
  const [count, setCount] = useCrannState("count");
  // or: const count = useCrannState(s => s.count);
}
```

---

## Open Questions

1. **Should we keep `createConfig()` or use `as const satisfies`?**

   - Pro createConfig: Works in older TS, familiar pattern
   - Pro satisfies: No runtime, more modern
   - Decision: TBD

2. **Should actions be nested under `actions:` in config or flat?**

   - Current proposal: Nested for clarity
   - Alternative: Flat with type discrimination
   - Decision: TBD

3. **How to handle schema migrations?**

   - Option A: Built-in `migrate` function in config
   - Option B: Separate migration utility
   - Decision: TBD

4. **Should porter-source remain publishable separately?**
   - If yes: Monorepo with pnpm workspaces
   - If no: Just merge into crann
   - Decision: Merge for now, extract later if needed

---

## Appendix: Analysis Sources

This design was informed by code review and analysis from:

1. **Internal analysis** - Line-by-line code review
2. **Charles** - Focus on lifecycle, async patterns, API consistency
3. **George** - Focus on type system, RPC design, singleton issues
4. **Grainne** - Focus on architecture, DX, naming, complexity

Key consensus points:

- Singleton must go
- API asymmetry hurts usability
- `callAction(string)` loses type safety
- Naming is inconsistent
- Logging has overhead
- Lifecycle has edge cases (leaks, races)

All reviewers agreed the core concept is sound; implementation needs polish.

---

_Document version: 0.1.0-draft_
