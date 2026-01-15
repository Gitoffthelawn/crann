/**
 * AgentRegistry - Tracks connected agents
 *
 * Responsibilities:
 * - Maintain registry of connected agents
 * - Provide query capabilities
 * - Clean up on disconnect
 */

import type { AgentInfo } from "../transport";
import { AgentConnectionInfo } from "./types";

export class AgentRegistry {
  private readonly agents: Map<string, AgentConnectionInfo> = new Map();

  /**
   * Register a new agent connection.
   */
  add(agentInfo: AgentInfo): AgentConnectionInfo {
    const connectionInfo: AgentConnectionInfo = {
      id: agentInfo.id,
      tabId: agentInfo.location.tabId,
      frameId: agentInfo.location.frameId,
      context: agentInfo.location.context,
      connectedAt: Date.now(),
    };

    this.agents.set(agentInfo.id, connectionInfo);
    return connectionInfo;
  }

  /**
   * Unregister an agent.
   */
  remove(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * Get agent info by ID.
   */
  get(agentId: string): AgentConnectionInfo | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all connected agents.
   */
  getAll(): AgentConnectionInfo[] {
    return Array.from(this.agents.values());
  }

  /**
   * Query agents by criteria.
   */
  query(criteria: {
    context?: string;
    tabId?: number;
    frameId?: number;
  }): AgentConnectionInfo[] {
    return this.getAll().filter((agent) => {
      if (criteria.context !== undefined && agent.context !== criteria.context) {
        return false;
      }
      if (criteria.tabId !== undefined && agent.tabId !== criteria.tabId) {
        return false;
      }
      if (criteria.frameId !== undefined && agent.frameId !== criteria.frameId) {
        return false;
      }
      return true;
    });
  }

  /**
   * Check if an agent is registered.
   */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Get the number of connected agents.
   */
  get size(): number {
    return this.agents.size;
  }

  /**
   * Clear all agents.
   */
  clear(): void {
    this.agents.clear();
  }
}

