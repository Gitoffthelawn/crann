import { AgentRegistry } from '../AgentRegistry';
import type { AgentInfo } from '../../transport';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  const createAgentInfo = (id: string, tabId = 1, frameId = 0): AgentInfo => ({
    id,
    location: {
      context: 'contentscript' as any,
      tabId,
      frameId,
    },
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  });

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('add/remove', () => {
    it('should add an agent', () => {
      const agentInfo = createAgentInfo('agent-1');
      const connectionInfo = registry.add(agentInfo);

      expect(connectionInfo.id).toBe('agent-1');
      expect(connectionInfo.tabId).toBe(1);
      expect(connectionInfo.frameId).toBe(0);
      expect(registry.has('agent-1')).toBe(true);
    });

    it('should remove an agent', () => {
      registry.add(createAgentInfo('agent-1'));
      expect(registry.has('agent-1')).toBe(true);

      const removed = registry.remove('agent-1');
      expect(removed).toBe(true);
      expect(registry.has('agent-1')).toBe(false);
    });

    it('should return false when removing non-existent agent', () => {
      expect(registry.remove('non-existent')).toBe(false);
    });
  });

  describe('get/getAll', () => {
    it('should get agent by id', () => {
      registry.add(createAgentInfo('agent-1', 1));
      registry.add(createAgentInfo('agent-2', 2));

      const agent = registry.get('agent-1');
      expect(agent?.tabId).toBe(1);
    });

    it('should return undefined for unknown agent', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('should get all agents', () => {
      registry.add(createAgentInfo('agent-1'));
      registry.add(createAgentInfo('agent-2'));
      registry.add(createAgentInfo('agent-3'));

      const all = registry.getAll();
      expect(all.length).toBe(3);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      registry.add(createAgentInfo('cs-tab1-f0', 1, 0));
      registry.add(createAgentInfo('cs-tab1-f1', 1, 1));
      registry.add(createAgentInfo('cs-tab2-f0', 2, 0));
    });

    it('should query by tabId', () => {
      const results = registry.query({ tabId: 1 });
      expect(results.length).toBe(2);
    });

    it('should query by frameId', () => {
      const results = registry.query({ frameId: 0 });
      expect(results.length).toBe(2);
    });

    it('should query by multiple criteria', () => {
      const results = registry.query({ tabId: 1, frameId: 0 });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('cs-tab1-f0');
    });

    it('should return empty array for no matches', () => {
      const results = registry.query({ tabId: 999 });
      expect(results.length).toBe(0);
    });
  });

  describe('size/clear', () => {
    it('should report correct size', () => {
      expect(registry.size).toBe(0);
      
      registry.add(createAgentInfo('agent-1'));
      expect(registry.size).toBe(1);
      
      registry.add(createAgentInfo('agent-2'));
      expect(registry.size).toBe(2);
    });

    it('should clear all agents', () => {
      registry.add(createAgentInfo('agent-1'));
      registry.add(createAgentInfo('agent-2'));
      
      registry.clear();
      
      expect(registry.size).toBe(0);
      expect(registry.getAll()).toEqual([]);
    });
  });
});

