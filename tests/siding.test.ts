import { describe, it, expect } from 'vitest';
import { SidingSolver } from '../src/core/switch/graph/SidingSolver';
import { SIDING_LEVELS } from '../src/core/switch/graph/SidingLevels';
import { GraphSwitchNetwork } from '../src/core/switch/graph/GraphSwitchNetwork';

describe('Siding (Park Cebi) 5 Test Levels Verification', () => {
  it('Level 1: Solves successfully with Siding entry and dispatch', () => {
    const res = SidingSolver.solveLevel1();
    expect(res.won).toBe(true);
    expect(res.mistakeCount).toBe(0);
    expect(res.correctCount).toBe(1);
  });

  it('Level 2: Solves successfully with order reversal (holding Blue, fast-tracking Red)', () => {
    const res = SidingSolver.solveLevel2();
    expect(res.won).toBe(true);
    expect(res.mistakeCount).toBe(0);
    expect(res.correctCount).toBe(2);
  });

  it('Level 3: Solves successfully with capacity limit and blockage diversion', () => {
    const res = SidingSolver.solveLevel3();
    expect(res.won).toBe(true);
    expect(res.mistakeCount).toBe(0);
    expect(res.correctCount).toBe(3);
  });

  it('Level 4: Solves successfully with multi-batch delivery scheduling', () => {
    const res = SidingSolver.solveLevel4();
    expect(res.won).toBe(true);
    expect(res.mistakeCount).toBe(0);
    expect(res.correctCount).toBe(4);
  });

  it('Level 5: Has at least two distinct valid solution strategies (Strategy A & B)', () => {
    const resA = SidingSolver.solveLevel5StrategyA();
    const resB = SidingSolver.solveLevel5StrategyB();

    expect(resA.won).toBe(true);
    expect(resA.mistakeCount).toBe(0);
    expect(resA.correctCount).toBe(3);
    expect(resA.strategyUsed).toContain('Strategy A');

    expect(resB.won).toBe(true);
    expect(resB.mistakeCount).toBe(0);
    expect(resB.correctCount).toBe(3);
    expect(resB.strategyUsed).toContain('Strategy B');

    // Strategy A uses siding and takes more ticks, Strategy B is direct
    expect(resA.ticks).not.toBe(resB.ticks);
  });

  it('Capacity enforcement: A second car cannot enter an occupied siding', () => {
    const sc = SIDING_LEVELS[2]; // Level 3: capacity 1
    const net = new GraphSwitchNetwork(sc);
    net.start();

    // Start with SW_SIDING pointing to SIDING
    // Car 1 enters Siding and parks
    net.tick(); // Tick 1: Spawn at SOURCE
    net.tick(); // Tick 2: Depart SOURCE -> SW_SIDING
    net.tick(); // Tick 3: Arrive SW_SIDING
    net.tick(); // Tick 4: Depart SW_SIDING -> SIDING_BAY
    net.tick(); // Tick 5: Arrive at SIDING_BAY -> state is PARKED
    expect(net.vehicles[0].state).toBe('PARKED');
    expect(net.isNodeOccupied('SIDING_BAY')).toBe(true);

    // Car 2 arrives at SW_SIDING while SW_SIDING is still SIDING
    // Next node would be SIDING_BAY, but SIDING_BAY is occupied!
    // Therefore Car 2 must remain WAITING at SW_SIDING
    net.tick(); // Car 2 spawns
    net.tick(); // Car 2 departs SOURCE -> SW_SIDING
    net.tick(); // Car 2 arrives at SW_SIDING

    const car2 = net.vehicles.find((v) => v.id === 2)!;
    expect(car2.currentNode).toBe('SW_SIDING');
    expect(car2.state).toBe('WAITING');

    // Next tick: Car 2 CANNOT move to SIDING_BAY because it's full
    net.tick();
    expect(car2.currentNode).toBe('SW_SIDING');
    expect(car2.state).toBe('WAITING');
  });

  it('Buffered toggle allows player to pre-set switch while vehicle is in transit', () => {
    const sc = SIDING_LEVELS[0];
    const net = new GraphSwitchNetwork(sc);
    net.start();

    net.tick(); // Spawn
    net.tick(); // Moving into SW_SIDING (locked!)
    expect(net.isJunctionLocked('SW_SIDING')).toBe(true);

    // Normal toggle without buffering is rejected
    expect(net.toggleJunction('SW_SIDING')).toBe(false);

    // Buffered toggle is accepted
    expect(net.toggleJunction('SW_SIDING', { allowBuffering: true })).toBe(true);
    expect(net.bufferedToggles.has('SW_SIDING')).toBe(true);

    // After car finishes transit into SW_SIDING, buffered toggle takes effect automatically!
    net.tick();
    expect(net.bufferedToggles.has('SW_SIDING')).toBe(false);
  });

  it('All 5 Siding levels have distinct, unique topology definitions and rail geometries', () => {
    const topologyIds = SIDING_LEVELS.map((l) => (l.topology as any).id);
    expect(new Set(topologyIds).size).toBe(5);

    // Verify SIDING_BAY physical positions are all distinct
    const bayPositions = SIDING_LEVELS.map((l) => {
      const bay = (l.topology as any).nodes.find((n: any) => n.id === 'SIDING_BAY');
      return `${bay.position.x},${bay.position.y}`;
    });
    expect(new Set(bayPositions).size).toBe(5);
  });
});
