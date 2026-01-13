# Crann v2 Implementation Tasks

> **Reference:** [DESIGN.md](./DESIGN.md)  
> **Status:** Not Started  
> **Branch:** `v2` (to be created)

---

## Legend

- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked

---

## Phase 0: Preparation

**Goal:** Set up for development

- [ ] Create `v2` branch from main
- [ ] Create `.context/initiatives/release-preparedness/` folder structure
- [ ] Move/copy porter-source into `src/transport/`
  - [ ] Copy source files
  - [ ] Update imports
  - [ ] Remove porter-source from package.json dependencies
  - [ ] Verify build works
- [ ] Update tsconfig if needed for new structure
- [ ] Update esbuild.config.js for new entry points (`crann`, `crann/react`)

**Exit Criteria:** Build passes, porter-source is internal

---

## Phase 1: Core Architecture

**Goal:** New Store implementation with proper lifecycle

### 1.1 New Config Schema

- [ ] Define new `ConfigItem` type with `scope` instead of `partition`
- [ ] Define new `ActionDefinition` with `handler` receiving context object
- [ ] Create `createConfig<T>()` helper (or decide on `satisfies` pattern)
- [ ] Update type inference (`DerivedState`, `DerivedSharedState`, `DerivedAgentState`)
- [ ] Add `OmitNever` consistently to derived types
- [ ] Write tests for type inference

### 1.2 Store Class (Non-Singleton)

- [ ] Create new `src/store/Store.ts`
- [ ] Constructor takes config and options (no static getInstance)
- [ ] Implement `destroy()` method for cleanup
- [ ] Export `createStore()` factory function

### 1.3 StateManager Module

- [ ] Extract from current Crann into `src/store/StateManager.ts`
- [ ] `getState()` - returns full state
- [ ] `getSharedState()` - returns shared-scoped state
- [ ] `getAgentState(agentId)` - returns agent-scoped state for agent
- [ ] `setState()` - properly async, returns Promise
- [ ] `setSharedState()` - async
- [ ] `setAgentState(agentId, state)` - async
- [ ] Fix: await all internal state operations
- [ ] Use proper deep equality (handle Date, Map, Set)
- [ ] Emit change events

### 1.4 Persistence Module

- [ ] Extract into `src/store/Persistence.ts`
- [ ] `hydrate()` - load from chrome.storage
- [ ] `persist(key, value)` - save to chrome.storage
- [ ] Add schema versioning
  - [ ] Store `__version` in storage
  - [ ] Add `version` and `migrate` options to config
  - [ ] Call migrate on version mismatch
- [ ] Fix: validate keys against config before hydrating
- [ ] Fix: only hydrate keys that exist in current config

### 1.5 AgentRegistry Module

- [ ] Extract into `src/store/AgentRegistry.ts`
- [ ] Track connected agents with metadata
- [ ] `addAgent(info)` - register new agent
- [ ] `removeAgent(id)` - unregister agent
- [ ] `getAgent(id)` - get agent info
- [ ] `getAgents(query)` - query by context, tabId, etc.
- [ ] Fix: clean up `agentsInitialized` on disconnect
- [ ] Fix: proper listener cleanup (no accumulation)

### 1.6 ActionExecutor Module

- [ ] Extract into `src/store/ActionExecutor.ts`
- [ ] Execute action handlers with context object
- [ ] Validate arguments if validator provided
- [ ] Return results through RPC

### 1.7 Integration

- [ ] Wire all modules together in Store
- [ ] Verify store lifecycle (create → use → destroy)
- [ ] Write integration tests

**Exit Criteria:** Store works, passes tests, no singleton

---

## Phase 2: Agent Rewrite

**Goal:** New Agent with typed actions and proper lifecycle

### 2.1 Agent Class

- [ ] Create new `src/agent/Agent.ts`
- [ ] Constructor connects to store (no singleton)
- [ ] Implement `disconnect()` cleanup method

### 2.2 Connection Handling

- [ ] Create `src/agent/Connection.ts` to wrap transport
- [ ] Implement `ready()` - returns Promise that resolves with initial state
- [ ] Implement `onReady(callback)` - callback style
- [ ] Fix: don't expose state until initialState received (no race)
- [ ] Implement `onDisconnect(callback)`
- [ ] Implement `onReconnect(callback)`

### 2.3 State Access

- [ ] `getState()` - returns current state
- [ ] `state` getter - shorthand for getState()
- [ ] `setState(partial)` - async, returns Promise
- [ ] `subscribe(callback)` - returns unsubscribe function
- [ ] `subscribe(keys, callback)` - subscribe to specific keys

### 2.4 Typed Action Proxy

- [ ] Create Proxy that exposes actions as typed methods
- [ ] `agent.actions.actionName(args)` → fully typed
- [ ] Returns Promise with proper return type
- [ ] Remove `callAction(string)` method

### 2.5 Agent Info

- [ ] `getInfo()` - returns { id, tabId, frameId, context }
- [ ] Abstract away porter-source types from public API

### 2.6 Integration

- [ ] Export `connectStore()` factory function
- [ ] Write tests for agent lifecycle
- [ ] Test action type safety

**Exit Criteria:** Agent works, actions typed, no state race

---

## Phase 3: API Polish

**Goal:** Consistent, intuitive API surface

### 3.1 Naming Consistency

- [ ] Rename throughout codebase:
  - [ ] `partition: 'service'` → `scope: 'shared'`
  - [ ] `partition: 'instance'` → `scope: 'agent'`
  - [ ] `serviceState` → `sharedState`
  - [ ] `instanceState` → `agentState`
  - [ ] `onInstanceReady` → `onAgentConnect`
- [ ] Update all types
- [ ] Update all internal variables

### 3.2 API Symmetry Audit

- [ ] List all Store methods
- [ ] List all Agent methods
- [ ] Identify asymmetries
- [ ] Decide: add to both, remove, or document why different
- [ ] Implement changes

### 3.3 Error Handling

- [ ] Create custom error classes (`CrannError`, `ConnectionError`, etc.)
- [ ] Add helpful error messages with context
- [ ] Validate config at creation time
- [ ] Throw early for misuse (not late RPC errors)

### 3.4 TypeScript Polish

- [ ] Remove all `any` casts (or document why necessary)
- [ ] Ensure all public APIs have explicit return types
- [ ] Add JSDoc comments to public APIs
- [ ] Generate .d.ts files correctly

**Exit Criteria:** API is consistent, well-typed, well-documented

---

## Phase 4: React Integration

**Goal:** Idiomatic React hooks

### 4.1 Package Structure

- [ ] Create `src/react/index.ts` entry point
- [ ] Update build to output `crann/react`
- [ ] Update package.json exports

### 4.2 Hook Factory

- [ ] Implement `createCrannHooks(config)`
- [ ] Returns object with all hooks

### 4.3 useCrannState

- [ ] Selector pattern: `useCrannState(s => s.count)`
- [ ] Key pattern: `useCrannState('count')` returns tuple
- [ ] Handle initial state correctly (no flash)
- [ ] Optimize re-renders (only when selected value changes)

### 4.4 useCrannActions

- [ ] Returns typed action object
- [ ] Actions are stable references (no re-render churn)

### 4.5 useCrannReady

- [ ] Returns boolean for connection status
- [ ] Re-renders on connect/disconnect

### 4.6 Optional Provider

- [ ] `CrannProvider` for dependency injection (testing)
- [ ] But works without provider (uses module-level connection)

**Exit Criteria:** React integration is clean, no double-hook

---

## Phase 5: Testing & Documentation

**Goal:** Confidence and clarity

### 5.1 Unit Tests

- [ ] StateManager tests
- [ ] Persistence tests (mock chrome.storage)
- [ ] AgentRegistry tests
- [ ] ActionExecutor tests
- [ ] Logger tests
- [ ] Type inference tests (compile-time)

### 5.2 Integration Tests

- [ ] Store ↔ Agent communication
- [ ] Multiple agents scenario
- [ ] Disconnect/reconnect scenario
- [ ] Persistence hydration
- [ ] Action execution end-to-end

### 5.3 Isolation Tests

- [ ] Multiple store instances don't interfere
- [ ] Tests can run in parallel
- [ ] destroy() fully cleans up

### 5.4 Documentation

- [ ] Update README.md
  - [ ] Quick start
  - [ ] Full API reference
  - [ ] React usage
  - [ ] Migration from v1
- [ ] Add CHANGELOG.md entry
- [ ] Add examples/
  - [ ] Basic usage
  - [ ] With React
  - [ ] Multiple stores
  - [ ] Persistence
  - [ ] Actions

**Exit Criteria:** Tests pass, docs are complete

---

## Phase 6: Release

**Goal:** Ship it

### 6.1 Pre-Release

- [ ] Run full test suite
- [ ] Manual testing in test extension
- [ ] Review all public APIs one more time
- [ ] Check bundle size

### 6.2 Version & Publish

- [ ] Bump version to 2.0.0
- [ ] Update CHANGELOG.md
- [ ] npm publish
- [ ] Create GitHub release
- [ ] Tag v2.0.0

### 6.3 Announcement

- [ ] Update GitHub description
- [ ] (Optional) Blog post / Twitter

**Exit Criteria:** v2.0.0 is live on npm

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

### [Date] - Decision Title

**Context:** What was the situation?  
**Options:** What were the choices?  
**Decision:** What did we pick?  
**Rationale:** Why?

---

_Last updated: 2026-01-13_
