import { source, AgentInfo, connect, Message } from "porter-source";
import { createEndpoint } from "./endpoint";
import {
  MessageEndpoint,
  ActionsConfig,
  RPCMessage,
  CallMessage,
  ErrorMessage,
  ResultMessage,
  ReleaseMessage,
} from "./types";

export function createCrannRPCAdapter<
  TState,
  TActions extends ActionsConfig<TState>
>(
  initialState: TState,
  actions: TActions,
  porter: ReturnType<typeof source> | ReturnType<typeof connect>,
  environment?: "service" | "agent"
) {
  const porterInstance = porter || source("crann");

  console.log("creating RPC Adapter with porterInstance", porterInstance);
  // Determine if this is a service worker instance (source) or content script instance (connect)
  const isServiceWorker = environment === "service";
  console.log(
    `[Crann:RPC] Initializing adapter in ${
      isServiceWorker ? "service worker" : "content script"
    } context`
  );

  const messageEndpoint: MessageEndpoint = {
    postMessage: (message, transferables) => {
      console.log(`[Crann:RPC] Adapter sending message:`, message);

      if (isServiceWorker) {
        // In service worker, we need to respond to the specific target
        const [_, messageObj] = message as [number, RPCMessage];
        // Extract target from call/result/error object
        let target;
        if ("call" in messageObj) {
          target = messageObj.call.target;
        } else if ("result" in messageObj) {
          target = messageObj.result.target;
        } else if ("error" in messageObj) {
          target = messageObj.error.target;
        } else if ("release" in messageObj) {
          target = messageObj.release.target;
        }

        if (!target) {
          console.warn(
            "[Crann:RPC] No target specified for RPC response in service worker"
          );
          return;
        }

        console.log(`[Crann:RPC] Service worker sending to target:`, target);
        porterInstance.post(
          {
            action: "rpc",
            payload: {
              message,
              transferables: transferables || [],
            },
          },
          target
        );
      } else {
        // In content script, target is automatically the service worker
        console.log("[Crann:RPC] Content script sending to service worker");
        porterInstance.post({
          action: "rpc",
          payload: {
            message,
            transferables: transferables || [],
          },
        });
      }
    },
    addEventListener: (event, listener) => {
      console.log(`[Crann:RPC] Setting up message listener for event:`, event);

      porterInstance.onMessage({
        rpc: (message: Message<string>, info?: AgentInfo) => {
          console.log(`[Crann:RPC] Received message:`, message);

          try {
            const { message: originalMessage, transferables = [] } =
              message.payload;

            // Add the sender's location as the target for responses
            const target = info?.location;
            console.log(`[Crann:RPC] Processing with target:`, target);

            // Check if the message is in the expected format [id, payload]
            if (
              Array.isArray(originalMessage) &&
              originalMessage.length === 2
            ) {
              const [id, msgPayload] = originalMessage as [number, any];

              // Add target to the appropriate message type
              let processedMessage: [number, RPCMessage];

              if (typeof msgPayload === "object" && msgPayload !== null) {
                if ("call" in msgPayload) {
                  // Attach target to call message
                  processedMessage = [
                    id,
                    {
                      call: {
                        ...msgPayload.call,
                        target,
                      },
                    } as CallMessage,
                  ];
                } else if ("result" in msgPayload) {
                  // Attach target to result message
                  processedMessage = [
                    id,
                    {
                      result: {
                        ...msgPayload.result,
                        target,
                      },
                    } as ResultMessage,
                  ];
                } else if ("error" in msgPayload) {
                  // Attach target to error message
                  processedMessage = [
                    id,
                    {
                      error: {
                        ...msgPayload.error,
                        target,
                      },
                    } as ErrorMessage,
                  ];
                } else if ("release" in msgPayload) {
                  // Attach target to release message
                  processedMessage = [
                    id,
                    {
                      release: {
                        ...msgPayload.release,
                        target,
                      },
                    } as ReleaseMessage,
                  ];
                } else if ("id" in msgPayload && "args" in msgPayload) {
                  // It's an old-style message without discriminator, convert it
                  processedMessage = [
                    id,
                    {
                      call: {
                        id: String(msgPayload.id),
                        args: msgPayload.args,
                        target,
                      },
                    } as CallMessage,
                  ];
                } else {
                  // Unknown message format, create a safe fallback
                  console.warn(
                    "[Crann:RPC] Unknown message payload format:",
                    msgPayload
                  );
                  processedMessage = [
                    id,
                    {
                      error: {
                        id: "system",
                        error: "Unknown message format",
                        target,
                      },
                    } as ErrorMessage,
                  ];
                }
              } else {
                // Non-object payload, create a safe fallback
                console.warn(
                  "[Crann:RPC] Non-object message payload:",
                  msgPayload
                );
                processedMessage = [
                  id,
                  {
                    error: {
                      id: "system",
                      error: "Invalid message payload",
                      target,
                    },
                  } as ErrorMessage,
                ];
              }

              console.log(`[Crann:RPC] Processed message:`, processedMessage);

              const event = new MessageEvent("message", {
                data: processedMessage,
                ports:
                  (transferables.filter(
                    (t: unknown) => t instanceof MessagePort
                  ) as MessagePort[]) || [],
              });

              listener(event);
            } else {
              console.warn(
                "[Crann:RPC] Unexpected message format:",
                originalMessage
              );
            }
          } catch (e) {
            console.error("[Crann:RPC] Failed to parse message payload:", e);
          }
        },
      });
    },
    removeEventListener: () => {
      console.log("[Crann:RPC] Removing event listener");
      // Porter-source doesn't support removing listeners
    },
  };

  return createEndpoint(messageEndpoint, initialState, actions);
}
