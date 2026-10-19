import { describe, it, expect } from 'vitest';
import { MiniRailDioramaRegistry } from '../src/core/switch/graph/MiniRailDioramaLayouts';
import {
  SIDING_TOPOLOGY_L1,
  SIDING_TOPOLOGY_L104_DUAL,
  SIDING_TOPOLOGY_L103_FIFO,
} from '../src/core/switch/graph/SidingLevels';
import { GraphTopologyDef } from '../src/core/switch/graph/GraphTypes';

describe('MiniRailDioramaRegistry — Topology Integrity & Validation', () => {
  it('Level 101 Meadow matches SIDING_TOPOLOGY_L1 with 100% integrity', () => {
    const config = MiniRailDioramaRegistry.getDioramaConfig(101, SIDING_TOPOLOGY_L1);
    expect(config.levelId).toBe(101);
    expect(config.sidingBays[0].capacity).toBe(1);
    expect(config.sidingBays[0].slots.length).toBe(1);
  });

  it('Level 104 Dual matches SIDING_TOPOLOGY_L104_DUAL with 100% integrity', () => {
    const config = MiniRailDioramaRegistry.getDioramaConfig(104, SIDING_TOPOLOGY_L104_DUAL);
    expect(config.levelId).toBe(104);
    expect(config.sidingBays.length).toBe(2);
    expect(config.sidingBays[0].id).toBe('SIDING_A');
    expect(config.sidingBays[1].id).toBe('SIDING_B');
  });

  it('Level 103-B FIFO matches SIDING_TOPOLOGY_L103_FIFO with 2 slots', () => {
    const config = MiniRailDioramaRegistry.getDioramaConfig(1032, SIDING_TOPOLOGY_L103_FIFO);
    expect(config.levelId).toBe(1032);
    expect(config.sidingBays[0].capacity).toBe(2);
    expect(config.sidingBays[0].slots.length).toBe(2);
  });

  it('rejects unsupported level with explicit descriptive error (no silent fallback)', () => {
    expect(() => {
      MiniRailDioramaRegistry.getDioramaConfig(999, SIDING_TOPOLOGY_L1);
    }).toThrowError(/not supported in Mini Rail City diorama mode/);
  });

  it('detects missing node in diorama config and throws error', () => {
    const validConfig = MiniRailDioramaRegistry.getLevel101MeadowDiorama();
    const mutatedTopo: GraphTopologyDef = {
      ...SIDING_TOPOLOGY_L1,
      nodes: [
        ...SIDING_TOPOLOGY_L1.nodes,
        { id: 'MYSTERY_NODE', type: 'WAYPOINT' },
      ],
    };

    expect(() => {
      MiniRailDioramaRegistry.validateDiorama(validConfig, mutatedTopo);
    }).toThrowError(/Missing visual node 'MYSTERY_NODE'/);
  });

  it('detects mismatched siding capacity and throws error', () => {
    const validConfig = MiniRailDioramaRegistry.getLevel101MeadowDiorama();
    const mutatedTopo: GraphTopologyDef = {
      ...SIDING_TOPOLOGY_L1,
      nodes: SIDING_TOPOLOGY_L1.nodes.map((n) =>
        n.id === 'SIDING_BAY' ? { ...n, capacity: 5 } : n
      ),
    };

    expect(() => {
      MiniRailDioramaRegistry.validateDiorama(validConfig, mutatedTopo);
    }).toThrowError(/Siding capacity mismatch for 'SIDING_BAY'/);
  });
});
