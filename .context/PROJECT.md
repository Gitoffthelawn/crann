# Crann: Effortless State Synchronization for Web Extensions

## Project Overview

**Crann** is a lightweight TypeScript library that simplifies state management and synchronization across different contexts in Web Extensions. It eliminates the need for manual `chrome.runtime.sendMessage`/`onMessage` boilerplate by providing a centralized state hub with automatic synchronization.

### Core Value Proposition

- **Minimal overhead**: < 5kb bundle size
- **Zero boilerplate**: No manual message passing required
- **Full TypeScript support**: Strong type inference and safety
- **Universal compatibility**: Works across all Web Extension contexts
- **Reactive updates**: Automatic state synchronization via subscriptions

## Active Initiatives

| Initiative                                         | Status   | Description                                                         |
| -------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| [v2-redesign](./initiatives/v2-redesign/DESIGN.md) | Planning | Major version with breaking API changes, architectural improvements |

## Architecture

### Central Hub Pattern

Crann uses a **service worker as the central state hub** with client connections from all other extension contexts:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Content Script │    │     Popup       │    │   Side Panel    │
│                 │    │                 │    │                 │
│   connect()     │    │   connect()     │    │   connect()     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼───────────┐
                    │    Service Worker       │
                    │                         │
                    │      create()           │
                    │   (State Hub)           │
                    └─────────────────────────┘
```

### State Management Features

1. **Partitioned State**: Support for context-specific state (`Partition.Instance`)
2. **Persistence Options**: Local Storage (`Persistence.Local`) and Session Storage (`Persistence.Session`)
3. **Complex Types**: Full support for custom types with type assertions
4. **RPC Actions**: Remote procedure calls that execute in the service worker context

## Core Components

### Service Worker (State Hub)

- **Location**: `src/crann.ts` - Main Crann class
- **Purpose**: Central state management and synchronization
- **Key Methods**: `create()`, `get()`, `set()`, `subscribe()`, `onInstanceReady()`

### Client Connections

- **Location**: `src/crannAgent.ts` - Agent implementation
- **Supported Contexts**: Content Scripts, Popup, Side Panels, DevTools, Options Pages
- **Key Methods**: `connect()`, `get()`, `set()`, `subscribe()`, `callAction()`

### Type System

- **Location**: `src/model/crann.model.ts`
- **Features**: Strong TypeScript inference, union type support, action definitions
- **Recent Fix**: Resolved nullable state typing issue using `infer` keyword

### RPC System

- **Location**: `src/rpc/` directory
- **Purpose**: Remote procedure calls between contexts
- **Features**: Type-safe actions, validation, error handling, memory management

## Key Dependencies

### Porter-Source

- **Version**: ^1.1.20 (peer dependency)
- **Purpose**: Underlying message passing and agent management
- **Relationship**: Crann is built on top of Porter-Source's communication layer
- **Future Consideration**: Likely to be merged into Crann as part of v2 redesign

### Development Dependencies

- **TypeScript**: ^5.5.4 - Primary language
- **esbuild**: ^0.23.0 - Build system
- **React**: ^18.2.0 - Optional React integration
- **webextension-polyfill**: ^0.12.0 - Cross-browser compatibility

## Porter-Source Integration & Debugging

### Tight Coupling Relationship

Crann and Porter-Source are tightly coupled libraries. During development, bugs or features often require changes in Porter-Source first, followed by updates in Crann. This creates a frequent need to examine Porter-Source code during debugging sessions.

### Debug Access Setup

To provide easy access to Porter-Source code for debugging and AI context:

```bash
# Get Porter source for debugging
./scripts/debug-porter.sh

# Clean up debug files
./scripts/debug-porter.sh clean
```

This creates a `.porter-debug/` directory (git-ignored) containing the latest Porter-Source code for reference during debugging sessions.

### When to Use Porter Debug Access

- **Cross-library bugs**: Issues that span both Crann and Porter-Source
- **Message passing problems**: Understanding the underlying communication layer
- **Agent connection issues**: Debugging client connection failures
- **Performance investigation**: Analyzing the porter-source communication patterns
- **AI assistance**: Providing full context when AI helps debug complex issues

### Future Integration Strategy

**Decision (v2):** Porter-Source will be merged into Crann as `src/transport/` to eliminate the cross-repo development friction. See [v2-redesign/DESIGN.md](./initiatives/v2-redesign/DESIGN.md) for details.

## Project Structure

```
src/
├── crann.ts                 # Main Crann class (service worker)
├── crannAgent.ts           # Client connection logic
├── index.ts                # Public API exports
├── model/
│   └── crann.model.ts      # TypeScript type definitions
├── rpc/
│   ├── adapter.ts          # RPC communication adapter
│   ├── endpoint.ts         # Message endpoint implementation
│   ├── memory.ts           # Memory management
│   ├── types.ts            # RPC type definitions
│   └── encoding/           # Serialization strategies
├── hooks/
│   └── useCrannState.ts    # React integration
└── utils/
    ├── agent.ts            # Agent utilities
    ├── config.ts           # Configuration helpers
    ├── debug.ts            # Debug management
    ├── deepEqual.ts        # Deep equality checking
    ├── logger.ts           # Logging system
    └── tracking.ts         # State change tracking
```

## Build System

### Build Configuration

- **Tool**: esbuild with custom configuration (`esbuild.config.js`)
- **Outputs**:
  - CommonJS: `dist/cjs/index.js`
  - ESM: `dist/esm/index.js`
  - TypeScript Declarations: `dist/types/`
- **Commands**:
  - `npm run build` - Full build (TypeScript + JavaScript)
  - `npm run build:ts` - TypeScript declarations only
  - `npm run build:js` - JavaScript bundles only

### Package Configuration

- **Main**: `dist/cjs/index.js` (CommonJS)
- **Module**: `dist/esm/index.js` (ESM)
- **Types**: `dist/types/index.d.ts`
- **Files**: Only `dist/` directory is published

## Usage Patterns

### Basic State Synchronization

```typescript
// Service Worker
const crann = create({
  isEnabled: { default: false },
  counter: { default: 0, persist: Persistence.Local },
});

// Content Script
const { get, set, subscribe } = connect();
set({ isEnabled: true });
subscribe((changes) => console.log("State changed:", changes));
```

### RPC Actions

```typescript
// Service Worker
const crann = create({
  counter: { default: 0 },
  increment: {
    handler: async (state, setState, target, amount) => {
      const newValue = state.counter + amount;
      await setState({ counter: newValue });
      return newValue;
    },
  },
});

// Any Context
const { callAction } = connect();
const result = await callAction("increment", 5);
```

### React Integration

```typescript
const useCrannState = createCrannStateHook(config);

function MyComponent() {
  const { useStateItem, callAction } = useCrannState();
  const [counter, setCounter] = useStateItem("counter");

  return (
    <button onClick={() => callAction("increment", 1)}>Count: {counter}</button>
  );
}
```

## Testing & Examples

### Primary Example

- **Location**: `tests/extension/`
- **Purpose**: Comprehensive test extension demonstrating all features
- **Includes**: Background script, content script, popup, side panel integration
- **Build**: `npm run build-test`

### Test Configuration

- **Config**: `tests/extension/src/config.ts`
- **Features Demonstrated**:
  - Basic state management
  - Partitioned state (instance-specific)
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

### Current Phase

- **Version**: 1.0.44 (stable, pre-v2)
- **Focus**: Planning v2 redesign based on comprehensive code analysis
- **Priority**: Addressing technical debt before external adoption push

### v2 Redesign Planned

A major version is in planning to address issues identified through code review:

- Singleton pattern → Multi-instance architecture
- API asymmetry → Unified, symmetric APIs
- Type safety gaps → Full TypeScript safety for actions
- Naming confusion → Consistent terminology
- Lifecycle bugs → Proper cleanup, no listener leaks

See [initiatives/v2-redesign/DESIGN.md](./initiatives/v2-redesign/DESIGN.md) for full details.

### Recent Fixes (v1.x)

- **Nullable State Types**: Fixed TypeScript inference issue with union types including `null`
- **RPC Integration**: Completed RPC actions implementation
- **Type Safety**: Enhanced type inference using `infer` keyword

### Known Issues

- See [v2-redesign/DESIGN.md - Current Problems](./initiatives/v2-redesign/DESIGN.md#current-problems) for comprehensive list

## AI Assistant Guidelines

### When Working with Crann

1. **State Management**: Always consider partitioning (instance vs service) when designing state
2. **Type Safety**: Leverage TypeScript's type system, especially for complex union types
3. **RPC Actions**: Use for operations that need service worker context (network requests, storage APIs)
4. **Performance**: Remember the <5kb constraint when suggesting features
5. **Testing**: Reference the test extension for implementation patterns

### Common Patterns

- Service worker initializes with `create()`
- Other contexts connect with `connect()`
- Use `subscribe()` for reactive updates
- Use `callAction()` for service worker operations
- Prefer type assertions for complex default values

### Debugging Tips

- Enable debug mode with `{ debug: true }`
- Check console logs in both service worker and client contexts
- Use type inspection utilities for complex type issues
- Verify porter-source connection status

## Future Considerations

### Immediate (v2)

- Remove singleton pattern
- Merge Porter-Source into Crann
- Typed action invocation
- React hook simplification
- Consistent naming (global/tab instead of service/instance)

### Post-v2

- DevTools integration (Redux DevTools, custom panel)
- Middleware system
- Computed/derived state
- Vue/Svelte integrations
- Performance benchmarks

### Ideas Document

- Future feature ideas will be documented in `IDEAS.md`
- See [v2-redesign/DESIGN.md - Backlog](./initiatives/v2-redesign/DESIGN.md#backlog-post-v2) for post-v2 ideas

---

_Last updated: 2026-01-13_
