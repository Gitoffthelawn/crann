/**
 * React Hooks Tests
 *
 * Tests for the Crann React integration hooks.
 */

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createCrannHooks } from "../hooks";
import { createConfig } from "../../store/types";
import type { AgentAPI } from "../../agent/types";

// Mock the agent module
jest.mock("../../agent", () => ({
  connectStore: jest.fn(),
}));

import { connectStore } from "../../agent";

const mockConnectStore = connectStore as jest.Mock;

describe("createCrannHooks", () => {
  const config = createConfig({
    name: "test",
    version: 1,
    count: { default: 0 },
    name_: { default: "Test" },
    actions: {
      increment: {
        handler: async (ctx) => {
          return { count: ctx.state.count + 1 };
        },
      },
    },
  });

  let mockAgent: Partial<AgentAPI<typeof config>>;
  let readyCallback: () => void;
  let disconnectCallback: () => void;
  let reconnectCallback: () => void;
  let stateCallback: (changes: any, state: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();

    readyCallback = () => {};
    disconnectCallback = () => {};
    reconnectCallback = () => {};
    stateCallback = () => {};

    mockAgent = {
      getInfo: jest.fn().mockReturnValue(null),
      getState: jest.fn().mockReturnValue({ count: 0, name_: "Test" }),
      setState: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockImplementation((cb) => {
        stateCallback = cb;
        return jest.fn();
      }),
      onReady: jest.fn().mockImplementation((cb) => {
        readyCallback = cb;
        return jest.fn();
      }),
      onDisconnect: jest.fn().mockImplementation((cb) => {
        disconnectCallback = cb;
        return jest.fn();
      }),
      onReconnect: jest.fn().mockImplementation((cb) => {
        reconnectCallback = cb;
        return jest.fn();
      }),
      actions: {
        increment: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    mockConnectStore.mockReturnValue(mockAgent);
  });

  describe("useCrannReady", () => {
    it("should return false initially when not ready", () => {
      const { useCrannReady } = createCrannHooks(config);

      const { result } = renderHook(() => useCrannReady());

      expect(result.current).toBe(false);
    });

    it("should return true when already connected", () => {
      mockAgent.getInfo = jest.fn().mockReturnValue({ agentId: "123" });
      const { useCrannReady } = createCrannHooks(config);

      const { result } = renderHook(() => useCrannReady());

      expect(result.current).toBe(true);
    });

    it("should update when ready callback fires", async () => {
      const { useCrannReady } = createCrannHooks(config);

      const { result } = renderHook(() => useCrannReady());

      expect(result.current).toBe(false);

      act(() => {
        readyCallback();
      });

      expect(result.current).toBe(true);
    });

    it("should update when disconnect/reconnect callbacks fire", async () => {
      mockAgent.getInfo = jest.fn().mockReturnValue({ agentId: "123" });
      const { useCrannReady } = createCrannHooks(config);

      const { result } = renderHook(() => useCrannReady());

      expect(result.current).toBe(true);

      act(() => {
        disconnectCallback();
      });

      expect(result.current).toBe(false);

      act(() => {
        reconnectCallback();
      });

      expect(result.current).toBe(true);
    });
  });

  describe("useCrannState with selector", () => {
    it("should return selected value from state", () => {
      const { useCrannState } = createCrannHooks(config);

      const { result } = renderHook(() => useCrannState((s) => s.count));

      expect(result.current).toBe(0);
    });

    it("should update when state changes", async () => {
      const { useCrannState } = createCrannHooks(config);

      const { result } = renderHook(() => useCrannState((s) => s.count));

      expect(result.current).toBe(0);

      // Update the mock to return new state
      mockAgent.getState = jest.fn().mockReturnValue({ count: 5, name_: "Test" });

      act(() => {
        stateCallback({ count: 5 }, { count: 5, name_: "Test" });
      });

      expect(result.current).toBe(5);
    });

    it("should not re-render when unrelated state changes", async () => {
      const { useCrannState } = createCrannHooks(config);
      let renderCount = 0;

      const { result } = renderHook(() => {
        renderCount++;
        return useCrannState((s) => s.count);
      });

      expect(result.current).toBe(0);
      const initialRenderCount = renderCount;

      // Simulate name change (not count)
      act(() => {
        stateCallback({ name_: "Updated" }, { count: 0, name_: "Updated" });
      });

      // Should not trigger re-render because count didn't change
      expect(renderCount).toBe(initialRenderCount);
    });
  });

  describe("useCrannState with key", () => {
    it("should return tuple with value and setter", () => {
      const { useCrannState } = createCrannHooks(config);

      const { result } = renderHook(() => useCrannState("count"));

      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current[0]).toBe(0);
      expect(typeof result.current[1]).toBe("function");
    });

    it("should call setState when setter is invoked", async () => {
      const { useCrannState } = createCrannHooks(config);

      const { result } = renderHook(() => useCrannState("count"));

      await act(async () => {
        await result.current[1](10);
      });

      expect(mockAgent.setState).toHaveBeenCalledWith({ count: 10 });
    });
  });

  describe("useCrannActions", () => {
    it("should return stable actions object", () => {
      const { useCrannActions } = createCrannHooks(config);

      const { result, rerender } = renderHook(() => useCrannActions());

      const firstActions = result.current;
      rerender();
      const secondActions = result.current;

      expect(firstActions).toBe(secondActions);
    });

    it("should delegate to agent actions", async () => {
      const { useCrannActions } = createCrannHooks(config);

      const { result } = renderHook(() => useCrannActions());

      await act(async () => {
        await result.current.increment();
      });

      expect(mockAgent.actions?.increment).toHaveBeenCalled();
    });
  });

  describe("useAgent", () => {
    it("should return the agent instance", () => {
      const { useAgent } = createCrannHooks(config);

      const { result } = renderHook(() => useAgent());

      expect(result.current).toBe(mockAgent);
    });
  });

  describe("CrannProvider", () => {
    it("should provide custom agent to hooks", () => {
      const customAgent: Partial<AgentAPI<typeof config>> = {
        ...mockAgent,
        getState: jest.fn().mockReturnValue({ count: 99, name_: "Custom" }),
      };

      const { useCrannState, CrannProvider } = createCrannHooks(config);

      const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <CrannProvider agent={customAgent as AgentAPI<typeof config>}>
          {children}
        </CrannProvider>
      );

      const { result } = renderHook(() => useCrannState((s) => s.count), {
        wrapper,
      });

      expect(result.current).toBe(99);
    });
  });
});

