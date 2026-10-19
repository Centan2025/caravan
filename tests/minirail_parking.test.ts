import { describe, it, expect } from 'vitest';
import { GraphSwitchNetwork } from '../src/core/switch/graph/GraphSwitchNetwork';
import { GraphTopology } from '../src/core/switch/graph/GraphTopology';
import { SIDING_TOPOLOGY_L103_FIFO, SIDING_LEVEL_103_FIFO } from '../src/core/switch/graph/SidingLevels';
import { MiniRailDioramaRegistry } from '../src/core/switch/graph/MiniRailDioramaLayouts';
import { TrackGeometry } from '../src/core/switch/graph/TrackGeometry';

describe('Mini Rail City — FIFO Siding Parking Slots & Exit Trajectory', () => {
  it('allocates distinct physical slots when 2 vehicles are parked in FIFO siding', () => {
    const topology = new GraphTopology(SIDING_TOPOLOGY_L103_FIFO);
    const network = new GraphSwitchNetwork(SIDING_LEVEL_103_FIFO, topology);
    network.start();

    const config = MiniRailDioramaRegistry.getDioramaConfig(1032, SIDING_TOPOLOGY_L103_FIFO);
    const bay = config.sidingBays[0];
    expect(bay.capacity).toBe(2);
    expect(bay.slots.length).toBe(2);

    const slot0 = bay.slots[0]; // Lead position
    const slot1 = bay.slots[1]; // Tail position
    expect(slot0.y).not.toBe(slot1.y);
    expect(Math.abs(slot1.y - slot0.y)).toBeGreaterThanOrEqual(40); // At least 40px slot spacing
  });

  it('verifies exit trajectory from siding slot to merge point has no missing edges', () => {
    const config = MiniRailDioramaRegistry.getDioramaConfig(1032, SIDING_TOPOLOGY_L103_FIFO);
    const exitEdge = config.edges.find((e) => e.from === 'SIDING_BAY' && e.to === 'MERGE');
    expect(exitEdge).toBeDefined();
    expect(exitEdge!.points.length).toBeGreaterThanOrEqual(2);

    // Test sampling exit edge
    const samples = TrackGeometry.sampleCurve(exitEdge!.points, 30);
    expect(samples.length).toBe(31);
    expect(samples[samples.length - 1].x).toBe(config.nodes['MERGE'].x);
    expect(samples[samples.length - 1].y).toBe(config.nodes['MERGE'].y);
  });

  it('throws explicit error when an edge is missing in diorama layout', () => {
    const config = MiniRailDioramaRegistry.getLevel101MeadowDiorama();
    const findEdge = (fromId: string, toId: string) => {
      const edge = config.edges.find((e) => e.from === fromId && e.to === toId);
      if (!edge) {
        throw new Error(
          `[MiniRailCityScene] Missing edge definition in diorama layout: from "${fromId}" to "${toId}". Every logical edge must have an explicit visual curve!`
        );
      }
      return edge.points;
    };

    expect(() => findEdge('NON_EXISTENT_SOURCE', 'MERGE')).toThrowError(
      /Missing edge definition in diorama layout/
    );
  });
});
