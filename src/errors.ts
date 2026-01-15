/**
 * Crann Error Classes
 *
 * Custom error types for better debugging and error handling.
 */

/**
 * Base error class for all Crann errors.
 */
export class CrannError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrannError";
    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when there's an issue with the config schema.
 */
export class ConfigError extends CrannError {
  constructor(message: string, public readonly field?: string) {
    super(field ? `Config error in '${field}': ${message}` : `Config error: ${message}`);
    this.name = "ConfigError";
  }
}

/**
 * Thrown when a store or agent has been destroyed/disconnected.
 */
export class LifecycleError extends CrannError {
  constructor(
    public readonly storeName: string,
    public readonly entity: "store" | "agent"
  ) {
    super(
      `${entity === "store" ? "Store" : "Agent"} "${storeName}" has been ${
        entity === "store" ? "destroyed" : "disconnected"
      } and cannot be used.`
    );
    this.name = "LifecycleError";
  }
}

/**
 * Thrown when there's a connection issue.
 */
export class ConnectionError extends CrannError {
  constructor(
    message: string,
    public readonly storeName: string,
    public readonly reason?: string
  ) {
    super(`Connection error for store "${storeName}": ${message}`);
    this.name = "ConnectionError";
  }
}

/**
 * Thrown when an action execution fails.
 */
export class ActionError extends CrannError {
  constructor(
    public readonly actionName: string,
    public readonly storeName: string,
    public readonly reason: string
  ) {
    super(`Action "${actionName}" failed in store "${storeName}": ${reason}`);
    this.name = "ActionError";
  }
}

/**
 * Thrown when action validation fails.
 */
export class ValidationError extends CrannError {
  constructor(
    public readonly actionName: string,
    public readonly storeName: string,
    public readonly reason: string
  ) {
    super(
      `Validation failed for action "${actionName}" in store "${storeName}": ${reason}`
    );
    this.name = "ValidationError";
  }
}

/**
 * Thrown when there's a storage key collision.
 */
export class StorageCollisionError extends CrannError {
  constructor(public readonly storeName: string) {
    super(
      `Store name "${storeName}" is already in use. Each store must have a unique name. ` +
        `If you're trying to connect to an existing store, use connectStore() instead.`
    );
    this.name = "StorageCollisionError";
  }
}

