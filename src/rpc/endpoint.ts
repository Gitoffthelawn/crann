import { createBasicEncoder } from "./encoding";
import type {
  MessageEndpoint,
  RemoteCallable,
  ActionsConfig,
  EncodingStrategy,
  EncodingStrategyApi,
  Retainer,
  CallMessage,
  ResultMessage,
  ErrorMessage,
  ReleaseMessage,
  RPCMessage,
} from "./types";
import { StackFrame } from "./memory";

const CALL = 0;
const RESULT = 1;
const TERMINATE = 2;
const RELEASE = 3;
const FUNCTION_APPLY = 5;
const FUNCTION_RESULT = 6;

type AnyFunction = (...args: any[]) => any;

export interface Endpoint<TActions extends ActionsConfig<any>> {
  readonly call: RemoteCallable<TActions>;
  replace(messenger: MessageEndpoint): void;
  expose(api: Record<string, AnyFunction | undefined>): void;
  callable(...methods: string[]): void;
  terminate(): void;
}

/**
 * Creates an RPC endpoint for communication between content scripts and service workers.
 *
 * This endpoint handles sending and receiving messages with proper discriminators:
 * - call: Invokes an action on the remote side
 * - result: Returns a successful result
 * - error: Returns an error
 * - release: Releases memory references
 *
 * @param messenger The message endpoint for communication
 * @param state The current state available to handlers
 * @param actions Map of action handlers to execute
 * @returns A proxy object that sends RPC calls
 */
export function createEndpoint<TState, TActions extends ActionsConfig<TState>>(
  messenger: MessageEndpoint,
  state: TState,
  actions: TActions,
  encodingStrategy?: EncodingStrategy
): RemoteCallable<TActions> {
  const callbacks = new Map<number, (result: unknown) => void>();
  const retainedObjects = new Map<string, Set<Retainer>>();

  console.log("[Crann:RPC] Creating endpoint");
  messenger.addEventListener("message", (event) => {
    const [id, message] = event.data as [number, RPCMessage];
    console.log("[Crann:RPC] Received message:", message);

    if ("call" in message) {
      const { id: callId, args, target } = message.call;
      console.log(`[Crann:RPC] Processing RPC call: ${callId}`, args);

      const action = actions[callId];
      if (!action) {
        console.warn(`[Crann:RPC] Action not found: ${callId}`);
        const errorMessage: ErrorMessage = {
          error: { id: callId, error: "Action not found" },
        };
        messenger.postMessage([id, errorMessage]);
        return;
      }

      try {
        if (action.validate) {
          action.validate(...args);
        }
        console.log(`[Crann:RPC] Executing handler for: ${callId}`);
        action.handler(state, ...args).then(
          (result) => {
            console.log(`[Crann:RPC] Action completed: ${callId}`, result);
            const resultMessage: ResultMessage = {
              result: { id: callId, result, target },
            };
            messenger.postMessage([id, resultMessage]);
          },
          (error: Error) => {
            console.error(`[Crann:RPC] Action failed: ${callId}`, error);
            const errorMessage: ErrorMessage = {
              error: { id: callId, error: error.message, target },
            };
            messenger.postMessage([id, errorMessage]);
          }
        );
      } catch (error) {
        console.error(`[Crann:RPC] Action threw error: ${callId}`, error);
        const errorMessage: ErrorMessage = {
          error: {
            id: callId,
            error:
              error instanceof Error ? error.message : "Unknown error occurred",
          },
        };
        messenger.postMessage([id, errorMessage]);
      }
    } else if ("result" in message) {
      const { id: resultId, result } = message.result;
      console.log(`[Crann:RPC] Received result: ${resultId}`, result);

      const callback = callbacks.get(id);
      if (callback) {
        callback(result);
        callbacks.delete(id);
      }
    } else if ("error" in message) {
      const { id: errorId, error } = message.error;
      console.error(`[Crann:RPC] Received error: ${errorId}`, error);

      const callback = callbacks.get(id);
      if (callback) {
        callback(Promise.reject(new Error(error)));
        callbacks.delete(id);
      }
    } else if ("release" in message) {
      const { id: releaseId } = message.release;

      const retainers = retainedObjects.get(releaseId);
      if (retainers) {
        retainers.clear();
        retainedObjects.delete(releaseId);
      }
    }
  });

  const proxy = new Proxy({} as RemoteCallable<TActions>, {
    get(_, prop: string) {
      return (...args: unknown[]) => {
        const id = Math.random();
        console.log(`[Crann:RPC] Creating call: ${String(prop)}`, args);

        return new Promise((resolve, reject) => {
          callbacks.set(id, (result) => {
            if (result instanceof Promise) {
              result.then(resolve, reject);
            } else {
              resolve(result);
            }
          });

          // Add the 'call' discriminator to the message
          const callMessage: CallMessage = {
            call: { id: String(prop), args },
          };
          messenger.postMessage([id, callMessage]);
        });
      };
    },
  });

  return proxy;
}
