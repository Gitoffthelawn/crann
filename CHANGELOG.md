# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-15

### Added

- **`createConfig()` helper** - Type-safe configuration with validation
- **`createStore()` factory** - Non-singleton store creation
- **`connectStore()` factory** - Non-singleton agent creation
- **Typed action proxy** - `agent.actions.myAction()` instead of `callAction("myAction")`
- **Custom error classes** - `CrannError`, `ConfigError`, `ActionError`, `LifecycleError`
- **React hooks package** - `crann/react` with `createCrannHooks()`
  - `useCrannState()` - Selector and key patterns
  - `useCrannActions()` - Stable action references
  - `useCrannReady()` - Connection status
  - `CrannProvider` - Optional provider for testing/DI
- **Structured storage keys** - `crann:{name}:v{version}:{key}` format
- **Store lifecycle** - `destroy()` method with `clearPersisted` option
- **Config validation** - Required `name` field, validated at creation time
- **JSDoc documentation** - Comprehensive inline documentation
- **Integration tests** - Multi-store isolation and lifecycle tests

### Changed

- **Terminology updates:**
  - `partition: 'instance'` → `scope: 'agent'`
  - `partition: 'service'` → `scope: 'shared'`
  - `serviceState` → `sharedState`
  - `instanceState` → `agentState`
- **API renamed:**
  - `create()` → `createStore()`
  - `connect()` → `connectStore()`
  - `Partition` enum → `Scope` enum
  - `Persistence` enum → `Persist` enum
- **Store identity** - `name` and `version` now in config, not options
- **React integration** - Moved to `crann/react` subpath export
- **Porter-Source internalized** - No longer a peer dependency

### Removed

- **Singleton pattern** - Each `createStore()`/`connectStore()` returns a new instance
- **`callAction()` method** - Replaced by typed `agent.actions` proxy
- **Porter-Source peer dependency** - Now bundled internally

### Fixed

- **Lifecycle bugs** - Proper cleanup on `destroy()`/`disconnect()`
- **Type safety** - Removed internal `any` casts, explicit return types
- **State race conditions** - Agent doesn't expose state until fully initialized
- **Subscription cleanup** - Listeners properly removed on disconnect

### Migration

See the [Migration from v1](#migration-from-v1) section in the README for detailed upgrade instructions.

## [1.0.49] - Previous Release

See git history for previous versions.

---

[2.0.0]: https://github.com/moclei/crann/compare/v1.0.49...v2.0.0
[1.0.49]: https://github.com/moclei/crann/releases/tag/v1.0.49

