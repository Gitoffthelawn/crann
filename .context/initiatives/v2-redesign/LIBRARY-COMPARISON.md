# Library Comparison Analysis

> **Created:** 2026-01-14  
> **Context:** Pre-v2 design validation (v2 now released)  
> **Status:** Reference Document

---

## Overview

This document captures analysis comparing Crann to existing libraries, addressing the question: *"Why not just use existing solutions?"*

---

## The Core Criticism

> "This library is great, but why not just use Comlink for the RPC? Why not just use Nanostores for the state? You're reinventing two things and tying them together in a new library with fewer developers and existing users."

This is a fair question that deserves a thorough answer.

---

## Library Analysis

### Comlink (Google)

**What it does:** Simplifies Web Worker communication by wrapping `postMessage` in a Proxy, making RPC calls look like local function calls.

```javascript
// Comlink pattern
import { wrap } from 'comlink';
const worker = wrap(new Worker('./worker.js'));
const result = await worker.someMethod(arg);
```

**Why it doesn't work for extensions:**

| Issue | Explanation |
|-------|-------------|
| Wrong messaging API | Comlink uses `postMessage`/`onmessage`. Extensions use `chrome.runtime.sendMessage`/`onMessage` and `chrome.runtime.connect` |
| 1:1 communication model | Comlink is designed for one main thread ↔ one worker. Extensions have N content scripts ↔ 1 service worker |
| No tab/frame awareness | Extensions need to know which tab sent a message. Comlink has no concept of this |
| No connection lifecycle | Extension contexts disconnect/reconnect (popup closes, service worker hibernates). Comlink assumes stable connections |
| No state management | Comlink is purely RPC—no state sync, no persistence |

**Verdict:** You cannot use Comlink for extensions without writing an adapter layer that essentially recreates Crann's transport layer.

---

### Nanostores

**What it does:** Lightweight (~1kb), framework-agnostic state management with atomic stores.

```javascript
// Nanostores pattern
import { atom } from 'nanostores';
const $count = atom(0);

$count.get();        // Read (sync)
$count.set(5);       // Write (sync, triggers subscribers)
$count.subscribe(v => console.log(v));
```

**Why it doesn't solve the extension problem:**

| Issue | Explanation |
|-------|-------------|
| No cross-context sync | A popup and content script would have separate, unsynced stores |
| No `chrome.storage` integration | No built-in persistence to extension storage APIs |
| No RPC mechanism | No way to call functions in the service worker from content scripts |
| No agent/source pattern | No concept of a central hub broadcasting to subscribers across contexts |
| Single-context design | Assumes all code runs in the same JavaScript context |

**Verdict:** Nanostores is excellent for in-memory state within a single context. Building Crann's functionality on top of it would require writing all the cross-context sync, RPC, and persistence layers—essentially building Crann with Nanostores as an implementation detail.

---

### webext-redux

**What it does:** Adapts Redux for browser extensions by proxying state between background and UI scripts.

```javascript
// webext-redux pattern (background)
const store = createStore(reducer);
wrapStore(store);

// webext-redux pattern (content script)
const store = await new Store();
store.dispatch({ type: 'INCREMENT' });
```

**Issues reported by the community:**

| Issue | Source |
|-------|--------|
| MV3 service worker challenges | Designed for MV2's persistent background pages |
| Creates store proxy per tab | Performance issues with many tabs |
| Maintenance concerns | Periods of slow updates, developers report poor support |
| Redux overhead | ~10kb+ bundle size, significant boilerplate |
| Redux architecture forced | Actions, reducers, action creators—ceremony for simple state |

**Community feedback:**
> "Don't use webext-redux!!! It was the 'easiest' but not the optimal solution... now it's a terrible solution because it has terrible support"
> — Developer experience shared on Medium

**Verdict:** webext-redux solves a similar problem but with significant drawbacks: MV3 compatibility issues, Redux overhead, and maintenance concerns. Crann's lighter approach may be preferable.

---

## Comparison Matrix

| Requirement | Comlink | Nanostores | webext-redux | Crann |
|-------------|---------|------------|--------------|-------|
| Extension messaging API | ❌ | ❌ | ✅ | ✅ |
| RPC to service worker | ❌ | ❌ | ⚠️ Via Redux | ✅ |
| Typed RPC calls | ✅ | N/A | ❌ | ✅ |
| Cross-context state sync | ❌ | ❌ | ✅ | ✅ |
| Per-agent (tab) state | N/A | ❌ | ⚠️ Awkward | ✅ |
| `chrome.storage` persistence | ❌ | ❌ | ❌ | ✅ |
| MV3 service worker support | ❌ | N/A | ⚠️ | ✅ |
| Bundle size | ~3kb | ~1kb | ~10kb+ | <5kb |
| Framework agnostic | ✅ | ✅ | ❌ | ✅ |
| Active maintenance | ✅ | ✅ | ⚠️ | ✅ |

---

## The "Composition" Argument

### What "Comlink + Nanostores" Would Actually Require

If you tried to compose existing libraries for extension state:

```typescript
// 1. Nanostores for in-memory state
import { atom } from 'nanostores';
const $count = atom(0);

// 2. Custom RPC layer (can't use Comlink)
class ExtensionRPC {
  // 200+ lines: chrome.runtime.connect, tab tracking, 
  // message correlation, reconnection handling...
}

// 3. Sync layer between Nanostores and RPC
class StateSync {
  // 200+ lines: chrome.storage hydration, atom subscriptions,
  // broadcast changes, handle incoming updates, per-agent state...
}

// 4. Agent registry
class AgentRegistry {
  // Track connected agents, per-agent state, cleanup on disconnect...
}

// 5. Glue code
const rpc = new ExtensionRPC();
const sync = new StateSync($count, rpc);
```

**Result:** You've written Crann, just with Nanostores as an implementation detail. The complexity is in the extension-specific parts—the RPC, sync, and persistence layers.

---

## Where Criticism IS Valid

### 1. Maintenance Burden

> "Fewer developers means less battle-testing."

**Valid.** Crann must be maintained carefully. Mitigation: Keep scope tight, don't try to match every Redux feature.

### 2. Ecosystem Lock-in

> "If I use Nanostores, I get their router, query library, etc."

**Partially valid.** However, Crann solves one specific problem (extension state sync). Developers can use whatever router/query library they want alongside it.

### 3. Learning Curve

> "I already know Redux."

**Valid for Redux power users.** Counter: For developers frustrated with Redux boilerplate, Crann is simpler.

---

## Crann's Value Proposition

**Crann exists because extensions are not web apps.**

- Generic state libraries (Nanostores, Zustand, Jotai) don't understand extension contexts
- Generic RPC libraries (Comlink) don't speak the extension messaging API
- Extension-specific libraries (webext-redux) bolt Redux onto an architecture it wasn't designed for

**Crann is purpose-built for MV3 extensions:**
- Type-safe RPC between contexts
- Automatic state synchronization
- Per-agent and shared state scopes
- Built-in `chrome.storage` persistence
- <5kb bundle size
- Framework-agnostic with React plugin

---

## Patterns Worth Learning From

### From Comlink

1. **Proxy-based API:** Comlink's use of `Proxy` to make RPC look like local calls is elegant. Crann v2's `agent.actions.foo()` adopts this pattern.

2. **Transfer handlers:** Comlink allows custom serialization. Could be useful for Crann's RPC if complex types need special handling.

### From Nanostores

1. **Atomic stores:** The concept of small, independent state units. See "Atoms" section below.

2. **Framework adapters:** Nanostores provides `@nanostores/react`, `@nanostores/vue`, etc. Crann's `crann/react` follows this pattern.

3. **Computed/derived state:** Nanostores has `computed()` for derived values. Potential Crann enhancement for post-v2.

### From webext-redux

1. **What not to do:** Heavy abstraction, forcing Redux patterns, poor MV3 support.

2. **DevTools integration:** Redux DevTools compatibility is valuable. Consider for Crann post-v2.

---

## Atoms and the $ Convention

### What is an "Atom"?

The term "atom" in state management (popularized by Recoil, adopted by Jotai and Nanostores) refers to the **smallest unit of state**—an indivisible piece that can be read, written, and subscribed to independently.

```javascript
// Jotai
const countAtom = atom(0);

// Nanostores
const $count = atom(0);
```

**Philosophy:** Instead of one large store object, state is split into many small atoms. Benefits:
- Fine-grained reactivity (only re-render what actually changed)
- No selector boilerplate
- Natural code-splitting (only import atoms you need)
- Easier testing (test atoms in isolation)

### Does Crann Use Atoms?

Crann's model is **different but related**:

| Concept | Atoms (Jotai/Nanostores) | Crann |
|---------|--------------------------|-------|
| Unit of state | Individual atom | State key in config |
| Granularity | One atom = one value | One config = multiple keys |
| Subscriptions | Per-atom | Per-key (via selector) or all changes |
| Cross-context | ❌ Single context | ✅ Multi-context sync |

Crann could be described as having "implicit atoms"—each key in the config is independently subscribable. But the terminology doesn't add clarity for Crann's use case.

**Recommendation:** Don't adopt "atom" terminology. Crann's model is "config with state keys and actions" which is clearer for the extension context.

### The $ Prefix Convention

**Origin:** Svelte stores. In Svelte, prefixing a variable with `$` auto-subscribes to a store:

```svelte
<script>
  import { count } from './stores.js';
  // $count automatically subscribes and unsubscribes
</script>

<p>Count: {$count}</p>
```

Nanostores adopted this convention:

```javascript
// Nanostores convention
const $user = atom(null);     // $ = "this is a reactive store"
const $posts = atom([]);

// Usage
$user.get();
$user.set(newUser);
```

**Why the $ prefix?**
1. Visual distinction between reactive stores and regular variables
2. Signals "this value can change, subscribe to it"
3. Nod to Svelte's influence
4. Similar to RxJS convention (`observable$`)

### Should Crann Use $ Prefix?

| Factor | Assessment |
|--------|------------|
| Crann's context | Extension state, not Svelte-style reactivity |
| User expectations | Extension developers may not know Svelte conventions |
| API design | Crann uses `agent.state.count`, not standalone stores |
| Clarity | `agent.state.count` is already clear about what it is |

**Recommendation:** Don't adopt the `$` prefix. It would feel foreign in Crann's API and doesn't add clarity.

```typescript
// This is already clear:
const count = agent.state.count;
agent.subscribe((state) => { ... });

// Adding $ wouldn't help:
const $count = agent.$state.$count;  // Confusing
```

---

## Patterns Growing in the Community

### Trends Worth Watching

| Trend | Description | Crann Relevance |
|-------|-------------|-----------------|
| Lightweight over heavyweight | Zustand/Jotai over Redux | ✅ Crann is lightweight |
| Framework-agnostic cores | Core library + framework adapters | ✅ Crann follows this |
| TypeScript-first | Full type inference from config | ✅ Crann v2 goal |
| Proxy-based APIs | Makes remote calls look local | ✅ Crann v2 actions |
| Signals | Fine-grained reactivity primitive | ⚠️ Not applicable to Crann |

### Signals Revolution?

Signals (Solid.js, Preact Signals, Angular Signals, TC39 proposal) are gaining traction. They're a fine-grained reactivity primitive.

**For Crann:** Signals are about in-context reactivity. Crann's challenge is cross-context sync, which signals don't address. We can stay informed but shouldn't pivot to signals.

---

## Conclusions

1. **The criticism has surface validity but falls apart technically.** You cannot compose Comlink + Nanostores for extensions—the extension-specific layers are the hard part.

2. **webext-redux is the closest competitor** but has real issues: MV3 compatibility, Redux overhead, maintenance concerns.

3. **Learn from these libraries:**
   - Comlink: Proxy-based RPC API ✅ (adopted in v2)
   - Nanostores: Framework adapters ✅ (adopted in v2)
   - Both: Keep it small and focused ✅

4. **Don't adopt for the sake of trends:**
   - Atom terminology: Not clearer for Crann's model
   - $ prefix: Foreign to extension developers
   - Signals: Different problem space

5. **Crann's positioning:** Purpose-built for MV3 extensions, filling a gap that general-purpose libraries don't address.

---

_Last updated: 2026-01-23_

