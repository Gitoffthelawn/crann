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
import { ActionError, ValidationError } from "../errors";

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
   *
   * @param actionName - The name of the action to execute
   * @param args - Arguments to pass to the action handler
   * @param agentInfo - Info about the calling agent
   * @returns The result of the action handler
   * @throws {ActionError} If the action doesn't exist or fails
   * @throws {ValidationError} If action validation fails
   */
  async execute(
    actionName: string,
    args: unknown[],
    agentInfo: AgentInfo
  ): Promise<unknown> {
    const actions = this.config.actions;
    if (!actions) {
      throw new ActionError(actionName, this.config.name, "No actions defined");
    }

    const actionDef = actions[actionName] as ActionDefinition<
      DerivedState<TConfig>,
      unknown[],
      unknown
    > | undefined;

    if (!actionDef) {
      throw new ActionError(actionName, this.config.name, "Unknown action");
    }

    // Validate arguments if validator is provided
    if (actionDef.validate) {
      try {
        actionDef.validate(...args);
      } catch (error) {
        throw new ValidationError(
          actionName,
          this.config.name,
          error instanceof Error ? error.message : String(error)
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
    try {
      return await actionDef.handler(ctx, ...args);
    } catch (error) {
      throw new ActionError(
        actionName,
        this.config.name,
        error instanceof Error ? error.message : String(error)
      );
    }
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

