/**
 * Crann React Integration
 *
 * Provides React hooks for connecting to and using a Crann store.
 *
 * @example
 * import { createCrannHooks } from 'crann/react';
 * import { config } from './config';
 *
 * export const { useCrannState, useCrannActions, useCrannReady } = createCrannHooks(config);
 */

export { createCrannHooks } from "./hooks";

export type {
  CrannHooks,
  CreateCrannHooksOptions,
  UseCrannStateSelector,
  UseCrannStateTuple,
} from "./types";

