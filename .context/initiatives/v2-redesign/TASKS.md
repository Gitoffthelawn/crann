# Crann v2 Implementation Tasks

> **Reference:** [DESIGN.md](./DESIGN.md)  
> **Status:** ✅ Complete  
> **Branch:** `v2` (merged to main)  
> **Released:** v2.0.0 - v2.0.6

---

## Legend

- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked
- [—] Skipped/Abandoned

---

## Phase 0: Preparation

**Goal:** Set up for development

- [x] Create `v2` branch from main
- [—] Create `.context/initiatives/release-preparedness/` folder structure _(abandoned)_
- [x] Move/copy porter-source into `src/transport/`
  - [x] Copy source files
  - [x] Update imports
  - [x] Remove porter-source from package.json dependencies
  - [x] Verify build works
- [x] Update tsconfig if needed for new structure
- [x] Update esbuild.config.js for new entry points (`crann`, `crann/react`)

**Exit Criteria:** ✅ Build passes, porter-source is internal

---

## Phase 1: Core Architecture

**Goal:** New Store implementation with proper lifecycle

### 1.1 New Config Schema

- [x] Define new `ConfigItem` type with `scope` instead of `partition`
- [x] Define new `ActionDefinition` with `handler` receiving context object
- [x] Add `name` (required) and `version` (optional, default 1) to config schema
- [x] Create `createConfig<T>()` helper (or decide on `satisfies` pattern) → _Chose `createConfig()` with runtime validation_
- [x] Update type inference (`DerivedState`, `DerivedSharedState`, `DerivedAgentState`)
- [x] Add `OmitNever` consistently to derived types
- [x] Write tests for type inference → _`src/store/__tests__/types.test.ts`_

### 1.2 Store Class (Non-Singleton)

- [x] Create new `src/store/Store.ts`
- [x] Constructor takes config and options (no static getInstance)
- [x] Options interface: `{ debug?: boolean, migrate?: fn }` (name/version come from config)
- [x] Validate `config.name` is provided (required)
- [x] Implement `destroy()` method for cleanup
- [x] Export `createStore()` factory function

### 1.3 StateManager Module

- [x] Extract from current Crann into `src/store/StateManager.ts`
- [x] `getState()` - returns full state
- [x] `getSharedState()` - returns shared-scoped state
- [x] `getAgentState(agentId)` - returns agent-scoped state for agent
- [x] `setState()` - properly async, returns Promise
- [x] `setSharedState()` - async
- [x] `setAgentState(agentId, state)` - async
- [x] Fix: await all internal state operations
- [x] Use proper deep equality (handle Date, Map, Set)
- [x] Emit change events

### 1.4 Persistence Module

- [x] Extract into `src/store/Persistence.ts`
- [x] `hydrate()` - load from chrome.storage
- [x] `persist(key, value)` - save to chrome.storage
- [x] Implement structured key format: `crann:{name}:v{version}:{key}`
  - [x] Create `buildStorageKey(config, key)` helper (reads name/version from config)
  - [x] Create `parseStorageKey(fullKey)` helper for cleanup utilities
- [x] Store metadata at `crann:{name}:__meta`
  - [x] Track `version`, `createdAt`, `lastAccessed`
- [x] Add schema versioning
  - [x] Read version from `__meta`
  - [x] Add `version` and `migrate` options to store options
  - [x] Call migrate on version mismatch
- [—] Implement collision detection _(not implemented - see Future Work)_
- [x] Fix: validate keys against config before hydrating
- [x] Fix: only hydrate keys that exist in current config
- [x] Implement cleanup utilities
  - [x] `store.clearPersistedData()` - clears all keys for this store
  - [x] `store.destroy({ clearPersisted: true })` option
  - [x] Static `clearOrphanedData({ keepStores, dryRun })` utility

### 1.5 AgentRegistry Module

- [x] Extract into `src/store/AgentRegistry.ts`
- [x] Track connected agents with metadata
- [x] `addAgent(info)` - register new agent
- [x] `removeAgent(id)` - unregister agent
- [x] `getAgent(id)` - get agent info
- [x] `getAgents(query)` - query by context, tabId, etc.
- [x] Fix: clean up `agentsInitialized` on disconnect
- [x] Fix: proper listener cleanup (no accumulation)

### 1.6 ActionExecutor Module

- [x] Extract into `src/store/ActionExecutor.ts`
- [x] Execute action handlers with context object
- [x] Validate arguments if validator provided
- [x] Return results through RPC

### 1.7 Integration

- [x] Wire all modules together in Store
- [x] Verify store lifecycle (create → use → destroy)
- [x] Write integration tests → _`src/__tests__/integration.test.ts`_

**Exit Criteria:** ✅ Store works, passes tests, no singleton

---

## Phase 2: Agent Rewrite

**Goal:** New Agent with typed actions and proper lifecycle

### 2.1 Agent Class

- [x] Create new `src/agent/Agent.ts`
- [x] Constructor connects to store (no singleton)
- [x] Implement `disconnect()` cleanup method

### 2.2 Connection Handling

- [x] Create `src/agent/Connection.ts` to wrap transport → _Handled within Agent.ts_
- [x] Implement `ready()` - returns Promise that resolves with initial state
- [x] Implement `onReady(callback)` - callback style
- [x] Fix: don't expose state until initialState received (no race)
- [x] Implement `onDisconnect(callback)`
- [x] Implement `onReconnect(callback)`

### 2.3 State Access

- [x] `getState()` - returns current state
- [x] `state` getter - shorthand for getState()
- [x] `setState(partial)` - async, returns Promise
- [x] `subscribe(callback)` - returns unsubscribe function
- [x] `subscribe(keys, callback)` - subscribe to specific keys

### 2.4 Typed Action Proxy

- [x] Create Proxy that exposes actions as typed methods
- [x] `agent.actions.actionName(args)` → fully typed
- [x] Returns Promise with proper return type
- [x] Remove `callAction(string)` method → _Kept as legacy export for gradual migration_

### 2.5 Agent Info

- [x] `getInfo()` - returns { id, tabId, frameId, context }
- [x] Abstract away porter-source types from public API

### 2.6 Integration

- [x] Export `connectStore()` factory function
- [x] Write tests for agent lifecycle → _`src/agent/__tests__/Agent.test.ts`_
- [x] Test action type safety

**Exit Criteria:** ✅ Agent works, actions typed, no state race

---

## Phase 3: API Polish

**Goal:** Consistent, intuitive API surface

### 3.1 Naming Consistency

- [x] Rename throughout codebase:
  - [x] `partition: 'service'` → `scope: 'shared'`
  - [x] `partition: 'instance'` → `scope: 'agent'`
  - [x] `serviceState` → `sharedState`
  - [x] `instanceState` → `agentState`
  - [x] `onInstanceReady` → `onAgentConnect`
- [x] Update all types
- [x] Update all internal variables

### 3.2 API Symmetry Audit

- [x] List all Store methods
- [x] List all Agent methods
- [x] Identify asymmetries
- [x] Decide: add to both, remove, or document why different
- [x] Implement changes

### 3.3 Error Handling

- [x] Create custom error classes (`CrannError`, `ConnectionError`, etc.)
- [x] Add helpful error messages with context
- [x] Validate config at creation time
- [x] Throw early for misuse (not late RPC errors)

### 3.4 TypeScript Polish

- [x] Remove all `any` casts (or document why necessary)
- [x] Ensure all public APIs have explicit return types
- [x] Add JSDoc comments to public APIs
- [x] Generate .d.ts files correctly

**Exit Criteria:** ✅ API is consistent, well-typed, well-documented

---

## Phase 4: React Integration

**Goal:** Idiomatic React hooks

### 4.1 Package Structure

- [x] Create `src/react/index.ts` entry point
- [x] Update build to output `crann/react`
- [x] Update package.json exports

### 4.2 Hook Factory

- [x] Implement `createCrannHooks(config)`
- [x] Returns object with all hooks

### 4.3 useCrannState

- [x] Selector pattern: `useCrannState(s => s.count)`
- [x] Key pattern: `useCrannState('count')` returns tuple
- [x] Handle initial state correctly (no flash)
- [x] Optimize re-renders (only when selected value changes)

### 4.4 useCrannActions

- [x] Returns typed action object
- [x] Actions are stable references (no re-render churn)

### 4.5 useCrannReady

- [x] Returns boolean for connection status
- [x] Re-renders on connect/disconnect

### 4.6 Optional Provider

- [x] `CrannProvider` for dependency injection (testing)
- [x] But works without provider (uses module-level connection)

**Exit Criteria:** ✅ React integration is clean, no double-hook

---

## Phase 5: Testing & Documentation

**Goal:** Confidence and clarity

### 5.1 Unit Tests

- [x] StateManager tests → _`src/store/__tests__/StateManager.test.ts`_
- [x] Persistence tests (mock chrome.storage) → _`src/store/__tests__/Persistence.test.ts`_
- [x] AgentRegistry tests → _`src/store/__tests__/AgentRegistry.test.ts`_
- [x] ActionExecutor tests → _`src/store/__tests__/ActionExecutor.test.ts`_
- [x] Logger tests
- [x] Type inference tests (compile-time) → _`src/store/__tests__/types.test.ts`_

### 5.2 Integration Tests

- [x] Store ↔ Agent communication → _`src/__tests__/integration.test.ts`_
- [x] Multiple agents scenario
- [x] Disconnect/reconnect scenario
- [x] Persistence hydration
- [x] Action execution end-to-end

### 5.3 Isolation Tests

- [x] Multiple store instances don't interfere
- [x] Tests can run in parallel
- [x] destroy() fully cleans up

### 5.4 Documentation

- [x] Update README.md
  - [x] Quick start
  - [x] Full API reference
  - [x] React usage
  - [x] Migration from v1
- [—] Add CHANGELOG.md entry _(not done - future task)_
- [—] Add examples/ _(not done - future initiative)_

**Exit Criteria:** ✅ Tests pass, docs are complete

---

## Phase 6: Release

**Goal:** Ship it

### 6.1 Pre-Release

- [x] Run full test suite
- [x] Manual testing in test extension
- [x] Review all public APIs one more time
- [x] Check bundle size

### 6.2 Version & Publish

- [x] Bump version to 2.0.0
- [—] Update CHANGELOG.md _(not done)_
- [x] npm publish
- [x] Create GitHub release
- [x] Tag v2.0.0

### 6.3 Announcement

- [x] Update GitHub description
- [—] (Optional) Blog post / Twitter _(not done)_

**Exit Criteria:** ✅ v2.0.0 is live on npm (now at v2.0.6)

---

## Backlog (Post-v2)

These are nice-to-haves that didn't make the cut:

- [ ] DevTools integration (Redux DevTools, custom panel)
- [ ] Middleware system for intercepting state changes
- [ ] Computed/derived state (selectors that cache)
- [ ] Vue integration
- [ ] Svelte integration
- [ ] Performance benchmarks
- [ ] Time-travel debugging

---

## Future Work (Identified During v2)

Items that were planned but not implemented, or identified as future enhancements:

- [ ] **Collision detection for storage** - Detect when multiple stores use the same name. Was planned in Persistence module design but not implemented.
- [ ] **Schema migration testing** - The `migrate` option exists but needs thorough testing and documentation.
- [ ] **CHANGELOG.md** - Should be created and maintained going forward.
- [ ] **examples/ directory** - Example projects demonstrating various use cases.

---

## Notes & Decisions Log

Use this section to record decisions made during implementation.

### 2026-01-13 - Scope Terminology: `shared`/`agent`

**Context:** Needed to finalize terminology for state scoping. Original proposal was `global`/`tab`.  
**Options:**

1. `global`/`tab` - intuitive but "tab" is technically imprecise (iframes each get their own instance)
2. `global`/`frame` - accurate but forces users to think about frames
3. `global`/`local` - but state isn't truly local (still managed by service worker)
4. `shared`/`agent` - aligns with Crann's existing agent terminology

**Decision:** `scope: 'shared'` and `scope: 'agent'`  
**Rationale:**

- "agent" sidesteps the tab vs frame debate entirely by aligning with Crann's existing terminology
- "shared" avoids collision with JavaScript's `global` object in Node/service workers
- The pairing is intuitive: "Is this state shared across all agents, or specific to this agent?"

---

### 2026-01-13 - Storage Key Structure & `name` in Config

**Context:** The original `storagePrefix` option felt "janky" - it required users to provide a technical implementation detail rather than a meaningful name. Additionally, there was no collision detection, no cleanup utilities, and no clear structure for how keys would be organized in `chrome.storage`.

**Options:**

1. Keep `storagePrefix` as-is, add validation later
2. Rename to `name`, add `crann:` prefix automatically
3. Make prefix optional with auto-generated default
4. Use hash-based keys to avoid collisions entirely

**Decision:** Option 2 - Require `name` in config, structured keys `crann:{name}:v{version}:{key}`

**Rationale:**

- `name` is user-focused ("name your store") vs implementation-focused ("provide a prefix")
- `crann:` prefix guarantees no collision with non-Crann data
- Version in key path enables clean migrations without orphaned keys
- Collision detection (throw in dev, warn in prod) catches mistakes early
- Cleanup utilities (`clearOrphanedData`) solve the "old data lying around" problem
- `name` is required - placing it in config ensures both source and agent agree on store identity

**Implementation:**

- `name` and `version` live in `createConfig()`, not store options
- Keys: `crann:{name}:v{version}:{key}` for state, `crann:{name}:__meta` for metadata
- Collision detection checks `__meta` exists from another process
- `store.destroy({ clearPersisted: true })` for full cleanup
- Static `clearOrphanedData({ keepStores })` for maintenance

---

### 2026-01-14 - Store Identity in Config (Single Source of Truth)

**Context:** The original design had `name` and `version` in `createStore()` options, but `connectStore()` had no way to specify which store to connect to. This was an oversight - agents need to know which store to connect to when multiple stores exist.

**Options:**

1. Add `name` to `connectStore()` options - requires specifying name in two places
2. Embed `name` and `version` in `createConfig()` - single source of truth
3. Default to "first store" when name omitted - magic behavior, potential confusion
4. Auto-discovery based on config structure fingerprinting - overly complex

**Decision:** Option 2 - Embed `name` (required) and `version` (optional, default 1) in `createConfig()`

**Rationale:**

- **Single source of truth** - The config already defines state shape; adding identity keeps everything together
- **DRY** - Name isn't repeated in `createStore()` and `connectStore()`
- **Module-like identity** - Similar to how Zustand/Jotai use imports for store identity, but works across extension context boundaries
- **Type safety flows naturally** - Same config = same store = correct types
- **Mirrors database connection strings** - Identity is part of the connection config, not separate

**Implementation:**

- `createConfig({ name: 'myFeature', version: 1, ... })`
- Both `createStore(config)` and `connectStore(config)` read identity from config
- Store options become just `{ debug?: boolean, migrate?: fn }`

---

### 2026-01-23 - Legacy API Preservation

**Context:** During v2 implementation, decided to preserve v1 API exports for gradual migration.

**Decision:** Export legacy APIs (`create`, `connect`, `Partition`, `Persistence`) with deprecation notice in `src/index.ts`.

**Rationale:**

- Allows existing users to migrate gradually
- No breaking change for users who don't want to update immediately
- Legacy exports clearly marked for removal in v3

---

_Last updated: 2026-01-23_
