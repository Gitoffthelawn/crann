# Crann RPC Actions Technical Proposal

## Overview

This document outlines the technical design for adding RPC-style actions to Crann, allowing state mutations to be executed in the service worker context while being called from any extension context (content scripts, popups, devtools, etc.).

## Current Architecture

Crann currently provides:

- State management with partitioning (instance vs service worker)
- State persistence options
- Type-safe state definitions
- Automatic state synchronization
- React hooks for state management

## Existing RPC Implementation

The project includes an existing RPC implementation in `src/rpc` that provides:

- Message passing between contexts
- Robust TypeScript type safety
- Memory management for transferred objects
- Error handling and termination capabilities
- Encoding/decoding strategies for complex types

### Key Components to Adapt

1. **MessageEndpoint Interface**

   - Handles communication between contexts
   - Will be adapted to work with Crann's porter-source system

2. **EncodingStrategy**

   - Handles serialization of complex types
   - Will be extended to support Crann's state types

3. **Memory Management**

   - Built-in memory management for transferred objects
   - Will be preserved for handling large state updates

4. **Type Utilities**
   - RemoteCallable type system
   - Will be integrated with Crann's state types

### Adaptation Strategy

1. **Phase 1: Integration**

   - Create a wrapper around the existing RPC system that works with Crann's porter-source
   - Adapt the message passing to use Crann's existing communication channels
   - Add action validation and state update handling

2. **Phase 2: Type System Integration**

   - Extend Crann's type system to work with the RPC types
   - Add action-specific type definitions
   - Ensure type safety across contexts

3. **Phase 3: React Integration**
   - Create React hooks that work with the adapted RPC system
   - Add loading states and error handling
   - Implement optimistic updates

## Proposed RPC Actions Design

### Service Worker Configuration

```typescript
// In service worker
import { create } from "crann";

const crann = create({
  // Existing state definitions
  counter: {
    default: 0,
    persistence: Persistence.Local,
  },

  // New action definitions
  actions: {
    increment: {
      // This action will be executed in the service worker
      handler: async (state, amount: number) => {
        return { counter: state.counter + amount };
      },
      // Optional validation
      validate: (amount: number) => {
        if (amount < 0) throw new Error("Amount must be positive");
      },
    },

    fetchData: {
      handler: async (state, url: string) => {
        const response = await fetch(url);
        const data = await response.json();
        return { data };
      },
    },
  },
});
```

### Content Script Usage

```typescript
// In content script
import { connect } from "crann";

const crann = connect();

// Get the current state
const state = crann.get();

// Call an action
const result = await crann.call("increment", 1);
// result will be the new state after the action is executed

// Subscribe to state changes
crann.subscribe((changes) => {
  if ("counter" in changes) {
    console.log("Counter changed:", changes.counter);
  }
});
```

### React Component Usage

```typescript
// In a React component (popup, devtools panel, etc.)
import { createCrannStateHook } from "crann";

// Create the hook (typically done once at app initialization)
const useCrannState = createCrannStateHook();

function CounterComponent() {
  const { useStateItem, useAction } = useCrannState();
  const [counter, setCounter] = useStateItem("counter");
  const increment = useAction("increment");

  return (
    <div>
      <p>Count: {counter}</p>
      <button onClick={() => increment(1)}>Increment</button>
      <button onClick={() => increment(5)}>Increment by 5</button>
    </div>
  );
}
```

## Technical Implementation Details

### 1. Type System Extensions

```typescript
// New types to be added to crann.model.ts
type ActionHandler<TState, TArgs extends any[], TResult> = (
  state: TState,
  ...args: TArgs
) => Promise<TResult>;

type ActionDefinition<TState, TArgs extends any[], TResult> = {
  handler: ActionHandler<TState, TArgs, TResult>;
  validate?: (...args: TArgs) => void;
};

type ActionsConfig<TState> = {
  [K: string]: ActionDefinition<TState, any[], Partial<TState>>;
};
```

### 2. RPC Communication Protocol

The RPC implementation will use the existing porter-source messaging system with new message types:

```typescript
type RPCMessage = {
  action: "callAction";
  payload: {
    actionName: string;
    args: any[];
  };
};

type RPCResponse = {
  action: "actionResult";
  payload: {
    result: any;
    error?: string;
  };
};
```

### 3. Implementation Phases

1. **Phase 1: Core RPC Infrastructure**

   - Add action definitions to state config
   - Implement basic RPC message passing
   - Add type definitions and validation

2. **Phase 2: React Integration**

   - Create `useAction` hook
   - Add error handling and loading states
   - Implement optimistic updates

3. **Phase 3: Advanced Features**
   - Add action middleware support
   - Implement action batching
   - Add action cancellation

### 4. Error Handling

Actions will support comprehensive error handling:

- Validation errors from `validate` function
- Runtime errors from `handler` function
- Network/communication errors
- Timeout errors

### 5. Security Considerations

- Action names will be validated against the configuration
- Input validation will be enforced
- Rate limiting may be implemented for high-frequency actions

## Migration Path

The RPC actions system will be designed to be backward compatible:

1. Existing state management will continue to work unchanged
2. Actions will be an optional addition to the configuration
3. The API will be designed to be intuitive for existing Crann users

## Open Questions

1. Should we support action middleware for cross-cutting concerns?
2. How should we handle action timeouts?
3. Should we implement action batching for performance?
4. How should we handle action cancellation?
5. Should we support action retries for transient failures?

## Next Steps

1. Create proof-of-concept implementation
2. Add type definitions and validation
3. Implement basic RPC communication
4. Add React integration
5. Write comprehensive tests
6. Document the new features
7. Create example applications
