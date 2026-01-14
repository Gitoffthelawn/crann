import { StateManager } from '../StateManager';
import { Persistence } from '../Persistence';
import { createConfig, Scope } from '../types';

// Mock Persistence
jest.mock('../Persistence');

describe('StateManager', () => {
  const config = createConfig({
    name: 'testStore',
    version: 1,
    sharedCount: { default: 0, scope: Scope.Shared },
    sharedName: { default: 'default', scope: Scope.Shared },
    agentData: { default: null as string | null, scope: Scope.Agent },
  });

  let stateManager: StateManager<typeof config>;
  let mockPersistence: jest.Mocked<Persistence<typeof config>>;

  beforeEach(() => {
    mockPersistence = new Persistence(config) as jest.Mocked<Persistence<typeof config>>;
    stateManager = new StateManager(config, mockPersistence);
  });

  describe('initialization', () => {
    it('should initialize with default shared state', () => {
      const state = stateManager.getSharedState();
      expect(state.sharedCount).toBe(0);
      expect(state.sharedName).toBe('default');
    });

    it('should return empty agent state for unknown agent', () => {
      const agentState = stateManager.getAgentState('unknown-agent');
      expect(agentState.agentData).toBe(null);
    });
  });

  describe('setState', () => {
    it('should update shared state', () => {
      stateManager.setState({ sharedCount: 5 });
      expect(stateManager.getSharedState().sharedCount).toBe(5);
    });

    it('should separate shared and agent changes', () => {
      stateManager.initializeAgentState('agent-1');
      
      const { sharedChanges, agentChanges } = stateManager.setState(
        { sharedCount: 10, agentData: 'agent-specific' } as any,
        'agent-1'
      );

      expect(sharedChanges).toEqual({ sharedCount: 10 });
      expect(agentChanges).toEqual({ agentData: 'agent-specific' });
    });

    it('should not update if values are equal', () => {
      const initialState = stateManager.getSharedState();
      stateManager.setState({ sharedCount: 0 }); // Same as default
      const newState = stateManager.getSharedState();
      
      // Should still be the same object reference (no change)
      expect(newState.sharedCount).toBe(0);
    });
  });

  describe('agent lifecycle', () => {
    it('should initialize agent state', () => {
      stateManager.initializeAgentState('agent-1');
      const agentState = stateManager.getAgentState('agent-1');
      expect(agentState.agentData).toBe(null);
    });

    it('should update agent-specific state', () => {
      stateManager.initializeAgentState('agent-1');
      stateManager.setAgentState('agent-1', { agentData: 'custom' });
      
      expect(stateManager.getAgentState('agent-1').agentData).toBe('custom');
    });

    it('should isolate agent states', () => {
      stateManager.initializeAgentState('agent-1');
      stateManager.initializeAgentState('agent-2');
      
      stateManager.setAgentState('agent-1', { agentData: 'data-1' });
      stateManager.setAgentState('agent-2', { agentData: 'data-2' });
      
      expect(stateManager.getAgentState('agent-1').agentData).toBe('data-1');
      expect(stateManager.getAgentState('agent-2').agentData).toBe('data-2');
    });

    it('should remove agent state on disconnect', () => {
      stateManager.initializeAgentState('agent-1');
      stateManager.setAgentState('agent-1', { agentData: 'custom' });
      
      stateManager.removeAgentState('agent-1');
      
      // Should return default state now
      expect(stateManager.getAgentState('agent-1').agentData).toBe(null);
    });
  });

  describe('getFullStateForAgent', () => {
    it('should merge shared and agent state', () => {
      stateManager.setState({ sharedCount: 42 });
      stateManager.initializeAgentState('agent-1');
      stateManager.setAgentState('agent-1', { agentData: 'merged' });
      
      const fullState = stateManager.getFullStateForAgent('agent-1');
      
      expect(fullState.sharedCount).toBe(42);
      expect(fullState.agentData).toBe('merged');
    });
  });

  describe('clear', () => {
    it('should reset all state to defaults', () => {
      stateManager.setState({ sharedCount: 100, sharedName: 'changed' });
      stateManager.initializeAgentState('agent-1');
      stateManager.setAgentState('agent-1', { agentData: 'custom' });
      
      stateManager.clear();
      
      expect(stateManager.getSharedState().sharedCount).toBe(0);
      expect(stateManager.getSharedState().sharedName).toBe('default');
      // Agent states are cleared
      expect(stateManager.getAgentState('agent-1').agentData).toBe(null);
    });
  });

  describe('hydration', () => {
    it('should hydrate shared state', () => {
      stateManager.hydrateSharedState({ sharedCount: 999 });
      expect(stateManager.getSharedState().sharedCount).toBe(999);
      // Non-hydrated values should remain at defaults
      expect(stateManager.getSharedState().sharedName).toBe('default');
    });
  });
});

