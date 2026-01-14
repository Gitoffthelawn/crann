/**
 * ActionExecutor - Executes RPC actions
 *
 * Responsibilities:
 * - Execute action handlers with context object
 * - Validate action arguments
 * - Handle errors
 */

import type { AgentInfo } from "../transport";
import {
  ConfigSchema,
  ValidatedConfig,
  DerivedState,
  ActionContext,
  ActionDefinition,
} from "./types";

export class ActionExecutor<TConfig extends ConfigSchema> {
  private readonly config: ValidatedConfig<TConfig>;
  private readonly getState: () => DerivedState<TConfig>;
  private readonly setState: (
    state: Partial<DerivedState<TConfig>>,
    agentId: string
  ) => Promise<void>;

  constructor(
    config: ValidatedConfig<TConfig>,
    getState: () => DerivedState<TConfig>,
    setState: (state: Partial<DerivedState<TConfig>>, agentId: string) => Promise<void>
  ) {
    this.config = config;
    this.getState = getState;
    this.setState = setState;
  }

  /**
   * Execute an action by name.
   */
  async execute(
    actionName: string,
    args: unknown[],
    agentInfo: AgentInfo
  ): Promise<unknown> {
    const actions = this.config.actions;
    if (!actions) {
      throw new Error(`No actions defined in store "${this.config.name}"`);
    }

    const actionDef = actions[actionName] as ActionDefinition<
      DerivedState<TConfig>,
      unknown[],
      unknown
    > | undefined;

    if (!actionDef) {
      throw new Error(
        `Unknown action "${actionName}" in store "${this.config.name}"`
      );
    }

    // Validate arguments if validator is provided
    if (actionDef.validate) {
      try {
        actionDef.validate(...args);
      } catch (error) {
        throw new Error(
          `Validation failed for action "${actionName}": ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    // Build the action context
    const ctx: ActionContext<DerivedState<TConfig>> = {
      state: this.getState(),
      setState: async (partial) => {
        await this.setState(partial, agentInfo.id);
      },
      agentId: agentInfo.id,
      agentLocation: agentInfo.location,
    };

    // Execute the handler
    return actionDef.handler(ctx, ...args);
  }

  /**
   * Check if an action exists.
   */
  hasAction(actionName: string): boolean {
    return this.config.actions?.[actionName] !== undefined;
  }

  /**
   * Get list of available action names.
   */
  getActionNames(): string[] {
    return Object.keys(this.config.actions ?? {});
  }
}

