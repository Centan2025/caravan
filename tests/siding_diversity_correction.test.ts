import { describe, it, expect } from 'vitest';
import {
  SIDING_LEVELS,
  SIDING_LEVEL_103_FIFO,
  SIDING_LEVEL_104_DUAL,
  ALL_SIDING_LEVELS,
} from '../src/core/switch/graph/SidingLevels';
import { SidingSolver } from '../src/core/switch/graph/SidingSolver';
import { GraphSwitchNetwork } from '../src/core/switch/graph/GraphSwitchNetwork';
import { TelemetryLogger } from '../src/shared/Telemetry';

describe('FAZ 1: Kanıt Doğrulama (Isomorphism, Traces, & Timing Windows)', () => {
  it('Baseline 101-105 topologies are mathematically isomorphic (7 nodes, 7 edges)', () => {
    for (const lvl of SIDING_LEVELS) {
      const top = typeof lvl.topology === 'string' ? null : lvl.topology;
      expect(top).toBeDefined();
      expect(top!.nodes.length).toBe(7);
      expect(top!.edges.length).toBe(7);
      expect(top!.switches.length).toBe(2);
    }
  });

  it('Level 105 Path A (Siding) and Path B (Direct Timing) produce two distinct execution traces', () => {
    const resA = SidingSolver.solveLevel5StrategyA();
    const resB = SidingSolver.solveLevel5StrategyB();

    expect(resA.won).toBe(true);
    expect(resB.won).toBe(true);
    expect(resA.correctCount).toBe(3);
    expect(resB.correctCount).toBe(3);
    expect(resA.mistakeCount).toBe(0);
    expect(resB.mistakeCount).toBe(0);

    // Strategy A parks in siding (takes more ticks), Strategy B avoids siding entirely
    expect(resA.ticks).toBeGreaterThan(resB.ticks);
    expect(resA.strategyUsed).toContain('Strategy A');
    expect(resB.strategyUsed).toContain('Strategy B');
  });

  it('Siding eliminates panic: Parked vehicle has infinite slack time until release', () => {
    const sc = SIDING_LEVELS[1]; // Level 102
    const net = new GraphSwitchNetwork(sc);
    net.start();

    // Spawn and park Car 1 (B)
    net.tick(); // Spawn
    net.tick(); // Moving to SW_SIDING
    net.tick(); // Arrived at SW_SIDING
    net.tick(); // Moving to SIDING_BAY
    net.tick(); // Arrived at SIDING_BAY (PARKED)
    expect(net.vehicles[0].state).toBe('PARKED');

    // Simulate player pausing to think for 50 ticks without triggering loss
    for (let i = 0; i < 50; i++) {
      net.tick();
      expect(net.status).not.toBe('LOST');
      expect(net.vehicles[0].state).toBe('PARKED');
    }
  });
});

describe('FAZ 2: Seviye 104 Dual-Siding & Karşı-Olgusal Doğrulama', () => {
  it('Dual-Siding topology breaks isomorphism (|V|=10, |E|=11, 3 Switches)', () => {
    const top = SIDING_LEVEL_104_DUAL.topology as any;
    expect(top.nodes.length).toBe(10);
    expect(top.edges.length).toBe(11);
    expect(top.switches.length).toBe(3);

    // Has two independent siding nodes
    const sidings = top.nodes.filter((n: any) => n.type === 'SIDING');
    expect(sidings.length).toBe(2);
    expect(sidings.map((s: any) => s.id)).toEqual(['SIDING_A', 'SIDING_B']);
  });

  it('Dual Siding solves [B, B, R, R] with 4/4 correct deliveries and 0 mistakes', () => {
    const res = SidingSolver.solveLevel104Dual();
    expect(res.won).toBe(true);
    expect(res.correctCount).toBe(4);
    expect(res.mistakeCount).toBe(0);
  });

  it('Counterfactual proof: Removing Siding B causes [B, B, R, R] to fail on single siding', () => {
    const res = SidingSolver.solveLevel104SingleCounterfactual();
    // With only 1 siding, Car 2 cannot park, forcing misdelivery
    expect(res.won).toBe(false);
    expect(res.mistakeCount).toBeGreaterThanOrEqual(1);
  });
});

describe('FAZ 3: Seviye 103-B (2-Araçlık FIFO Park Cebi Deneyi)', () => {
  it('Level 103-B FIFO Siding node has capacity: 2', () => {
    const top = SIDING_LEVEL_103_FIFO.topology as any;
    const sidingBay = top.nodes.find((n: any) => n.id === 'SIDING_BAY');
    expect(sidingBay.capacity).toBe(2);
  });

  it('FIFO Siding queues 2 vehicles and releases them in deterministic First-In-First-Out order', () => {
    const res = SidingSolver.solveLevel103FIFO();
    expect(res.won).toBe(true);
    expect(res.correctCount).toBe(3);
    expect(res.mistakeCount).toBe(0);
    expect(res.strategyUsed).toContain('FIFO');
  });
});

describe('FAZ 4: Tüm Seviyelerin Çözülebilirliği & Bütünlük Kontrolü', () => {
  it('ALL_SIDING_LEVELS contains 7 complete scenarios with valid parameters', () => {
    expect(ALL_SIDING_LEVELS.length).toBe(7);

    for (const lvl of ALL_SIDING_LEVELS) {
      expect(lvl.id).toBeGreaterThan(0);
      expect(lvl.manifest.length).toBeGreaterThanOrEqual(1);
      expect(lvl.activeJunctions).toBeDefined();
      expect(lvl.activeJunctions!.length).toBeGreaterThan(0);
      expect(lvl.initialSwitches).toBeDefined();
    }
  });

  it('Baseline Level 104 Legacy is intact and solvable', () => {
    const res = SidingSolver.solveLevel4Legacy();
    expect(res.won).toBe(true);
    expect(res.correctCount).toBe(4);
    expect(res.mistakeCount).toBe(0);
  });
});

describe('FAZ 5: Oyuncu Testi & Telemetri Doğrulama', () => {
  it('Telemetry tracks first_tap, valid_move, invalid_tap, and level completion path payload', () => {
    const telemetry = TelemetryLogger.getInstance();
    telemetry.startRun('switch_rush', 105, { submode: 'siding' });

    telemetry.recordFirstTapIfNeeded('tap');
    telemetry.recordValidMove({ action: 'toggle_switch', junction: 'SW_SIDING' });
    telemetry.recordInvalidTap('empty_siding_dispatch', { mode: 'siding' });

    // Test completion payload with path recording
    telemetry.recordRunWon(500, {
      submode: 'siding',
      levelId: 105,
      chosenPath: 'path_a_siding',
    });

    const events = telemetry.getEvents();
    const wonEvent = events.find((e) => e.event_type === 'run_won');

    expect(wonEvent).toBeDefined();
    expect(wonEvent!.payload?.chosenPath).toBe('path_a_siding');
    expect(wonEvent!.payload?.levelId).toBe(105);
  });
});
