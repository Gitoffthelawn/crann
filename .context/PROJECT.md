# Crann: Effortless State Synchronization for Web Extensions

## Project Overview

**Crann** is a lightweight TypeScript library that simplifies state management and synchronization across different contexts in Web Extensions. It eliminates the need for manual `chrome.runtime.sendMessage`/`onMessage` boilerplate by providing a centralized state hub with automatic synchronization.

### Core Value Proposition

- **Minimal overhead**: < 5kb bundle size
- **Zero boilerplate**: No manual message passing required
- **Full TypeScript support**: Strong type inference and safety
- **Universal compatibility**: Works across all Web Extension contexts
- **Reactive updates**: Automatic state synchronization via subscriptions
- **Typed RPC Actions**: Execute service worker logic from any context with full type safety

## Architecture

### Central Hub Pattern

Crann uses a **service worker as the central state hub** with client connections from all other extension contexts:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Content Script │    │     Popup       │    │   Side Panel    │
│                 │    │                 │    │                 │
│ connectStore()  │    │ connectStore()  │    │ connectStore()  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼───────────┐
                    │    Service Worker       │
                    │                         │
                    │     createStore()       │
                    │     (State Hub)         │
                    └─────────────────────────┘
```

### State Management Features

1. **Scoped State**: Support for shared state (`scope: 'shared'`) and agent-specific state (`scope: 'agent'`)
2. **Persistence Options**: Local Storage (`Persist.Local`) and Session Storage (`Persist.Session`)
3. **Complex Types**: Full support for custom types with type assertions
4. **RPC Actions**: Remote procedure calls that execute in the service worker context with full type safety

## Core Components

### Store (Service Worker)

- **Location**: `src/store/Store.ts` - Main Store class
- **Purpose**: Central state management and synchronization
- **Key Methods**: `createStore()`, `getState()`, `setState()`, `subscribe()`, `onAgentConnect()`

### Agent (Client Connections)

- **Location**: `src/agent/Agent.ts` - Agent implementation
- **Supported Contexts**: Content Scripts, Popup, Side Panels, DevTools, Options Pages
- **Key Methods**: `connectStore()`, `getState()`, `setState()`, `subscribe()`, `actions.*`

### Type System

- **Location**: `src/store/types.ts`
- **Features**: Strong TypeScript inference, union type support, action definitions, `createConfig()` helper
- **Key Types**: `ConfigSchema`, `DerivedState`, `DerivedActions`, `ActionContext`

### RPC System

- **Location**: `src/rpc/` directory
- **Purpose**: Remote procedure calls between contexts
- **Features**: Type-safe actions via `agent.actions.*`, validation, error handling

### Transport Layer

- **Location**: `src/transport/` directory
- **Purpose**: Message passing and connection management (merged from porter-source)
- **Note**: Internal implementation detail, not exposed in public API

## Project Structure

```
src/
├── index.ts                 # Public API exports
├── errors.ts                # Custom error classes
├── store/
│   ├── Store.ts             # Main Store class
│   ├── StateManager.ts      # State operations
│   ├── Persistence.ts       # chrome.storage integration
│   ├── AgentRegistry.ts     # Connected agent tracking
│   ├── ActionExecutor.ts    # RPC action execution
│   ├── types.ts             # Config schema and derived types
│   └── __tests__/           # Unit tests
├── agent/
│   ├── Agent.ts             # Client agent class
│   ├── types.ts             # Agent-specific types
│   └── __tests__/           # Unit tests
├── react/
│   ├── index.ts             # React entry point (crann/react)
│   ├── hooks.tsx            # React hooks implementation
│   └── __tests__/           # Hook tests
├── transport/
│   ├── core/                # PorterAgent, PorterSource
│   ├── managers/            # Connection and message handling
│   └── porter.model.ts      # Transport types
├── rpc/
│   ├── adapter.ts           # RPC communication adapter
│   ├── endpoint.ts          # Message endpoint implementation
│   └── encoding/            # Serialization strategies
└── utils/
    ├── logger.ts            # Logging system
    ├── deepEqual.ts         # Deep equality checking
    └── ...                  # Other utilities

# Legacy files (deprecated, for v1 compatibility)
├── crann.ts                 # Legacy v1 Crann class
├── crannAgent.ts            # Legacy v1 Agent
└── model/crann.model.ts     # Legacy v1 types
```

## Build System

### Build Configuration

- **Tool**: esbuild with custom configuration (`esbuild.config.js`)
- **Outputs**:
  - CommonJS: `dist/cjs/index.js`
  - ESM: `dist/esm/index.js`
  - React: `dist/cjs/react.js`, `dist/esm/react.js`
  - TypeScript Declarations: `dist/types/`
- **Commands**:
  - `npm run build` - Full build (TypeScript + JavaScript)
  - `npm run build:ts` - TypeScript declarations only
  - `npm run build:js` - JavaScript bundles only
  - `npm test` - Run tests

### Package Configuration

- **Main**: `dist/cjs/index.js` (CommonJS)
- **Module**: `dist/esm/index.js` (ESM)
- **Types**: `dist/types/index.d.ts`
- **Exports**: `crann` and `crann/react`
- **Files**: Only `dist/` directory is published

## Usage Patterns

### Basic State Synchronization

```typescript
// config.ts
import { createConfig, Persist } from "crann";

export const config = createConfig({
  name: "myExtension",
  isEnabled: { default: false },
  counter: { default: 0, persist: Persist.Local },
});

// Service Worker
import { createStore } from "crann";
import { config } from "./config";

const store = createStore(config);
store.subscribe((state, changes) => console.log("State changed:", changes));

// Content Script
import { connectStore } from "crann";
import { config } from "./config";

const agent = connectStore(config);
agent.onReady(() => {
  agent.setState({ isEnabled: true });
  agent.subscribe((changes) => console.log("State changed:", changes));
});
```

### RPC Actions

```typescript
// config.ts
const config = createConfig({
  name: "myExtension",
  counter: { default: 0 },
  actions: {
    increment: {
      handler: async (ctx, amount: number = 1) => {
        return { counter: ctx.state.counter + amount };
      },
    },
  },
});

// Any Context
const agent = connectStore(config);
await agent.ready();
const result = await agent.actions.increment(5); // Fully typed!
```

### React Integration

```typescript
// hooks.ts
import { createCrannHooks } from "crann/react";
import { config } from "./config";

export const { useCrannState, useCrannActions, useCrannReady } =
  createCrannHooks(config);

// Component.tsx
function Counter() {
  const count = useCrannState((s) => s.counter);
  const { increment } = useCrannActions();
  const isReady = useCrannReady();

  if (!isReady) return <div>Loading...</div>;

  return <button onClick={() => increment(1)}>Count: {count}</button>;
}
```

## Testing

### Unit Tests

- **Location**: `src/**/__tests__/`
- **Framework**: Jest with ts-jest
- **Coverage**: StateManager, Persistence, AgentRegistry, ActionExecutor, Agent, React hooks

### Test Extension

- **Location**: `tests/extension/`
- **Purpose**: Manual testing and integration verification
- **Build**: `npm run build-test`
- **Features Demonstrated**:
  - Basic state management
  - Scoped state (shared and agent)
  - Persistence (local and session)
  - RPC actions with validation
  - React integration (in side panel)

## Browser Compatibility

### Supported Browsers

- **Chrome**: Primary development and testing platform
- **Firefox**: Should work (untested)
- **Safari**: Should work (untested)
- **Edge**: Should work (untested)

### Manifest Version

- **Target**: Manifest V3 (MV3)
- **Compatibility**: Uses `webextension-polyfill` for cross-browser support

## Development Status

- **Version**: 2.0.x (stable)
- **Status**: Production ready
- **Breaking Changes**: v2 introduced breaking API changes from v1. See README.md for migration guide.

## AI Assistant Guidelines

### When Working with Crann

1. **State Management**: Always consider scoping (shared vs agent) when designing state
2. **Type Safety**: Leverage TypeScript's type system, especially for complex union types
3. **RPC Actions**: Use for operations that need service worker context (network requests, storage APIs)
4. **Performance**: Remember the <5kb constraint when suggesting features
5. **Testing**: Reference the test extension for implementation patterns

### Common Patterns

- Service worker initializes with `createStore(config)`
- Other contexts connect with `connectStore(config)`
- Use `subscribe()` for reactive updates
- Use `agent.actions.actionName()` for typed RPC calls
- Prefer type assertions for complex default values
- Always include `name` in config (required)

### Debugging Tips

- Enable debug mode with `{ debug: true }` option
- Check console logs in both service worker and client contexts
- Use `agent.ready()` or `agent.onReady()` before accessing state
- Verify connection status with `useCrannReady()` in React

## Future Considerations

- DevTools integration (Redux DevTools, custom panel)
- Middleware system
- Computed/derived state
- Vue/Svelte integrations
- Performance benchmarks
- Storage collision detection
- Enhanced schema migration testing

### Ideas Document

- Future feature ideas will be documented in `IDEAS.md`
- See [v2-redesign/DESIGN.md - Backlog](./initiatives/v2-redesign/DESIGN.md#backlog-post-v2) for more ideas

---

_Last updated: 2026-01-23_
