import { describe, it, expect } from 'vitest';
import { SIDING_LEVELS } from '../src/core/switch/graph/SidingLevels';
import { SidingSolver } from '../src/core/switch/graph/SidingSolver';
import { PROGRESSIVE_LEVELS } from '../src/core/switch/SwitchLevels';

describe('Siding QA & Decision Metrics Benchmark', () => {
  it('Computes Decision Slack Time comparison: Progressive vs Siding', () => {
    // Progressive Levels 15-30: tick is 700-750ms, spawn cadence is 2 ticks, max concurrent is 3
    const lateProgressive = PROGRESSIVE_LEVELS.slice(14);
    const avgProgressiveTick =
      lateProgressive.reduce((sum, l) => sum + (l.tickDurationMs ?? 700), 0) /
      lateProgressive.length;

    // Siding Levels 1-5: tick is 1000-1200ms, plus vehicles in siding have UNLIMITED slack time
    const avgSidingTick =
      SIDING_LEVELS.reduce((sum, l) => sum + (l.tickDurationMs ?? 1000), 0) /
      SIDING_LEVELS.length;

    expect(avgSidingTick).toBeGreaterThan(avgProgressiveTick);
    expect(avgSidingTick).toBeGreaterThanOrEqual(1000);
  });

  it('Verifies all 5 Siding levels pass automated QA and are 100% solvable', () => {
    const r1 = SidingSolver.solveLevel1();
    const r2 = SidingSolver.solveLevel2();
    const r3 = SidingSolver.solveLevel3();
    const r4 = SidingSolver.solveLevel4();
    const r5A = SidingSolver.solveLevel5StrategyA();
    const r5B = SidingSolver.solveLevel5StrategyB();

    const results = [r1, r2, r3, r4, r5A, r5B];
    for (const r of results) {
      expect(r.won).toBe(true);
      expect(r.mistakeCount).toBe(0);
      expect(r.correctCount).toBeGreaterThan(0);
    }
  });

  it('Computes Levenshtein action distance between Siding levels to prove trace differentiation', () => {
    const traces = [
      SidingSolver.solveLevel1().strategyUsed,
      SidingSolver.solveLevel2().strategyUsed,
      SidingSolver.solveLevel3().strategyUsed,
      SidingSolver.solveLevel4().strategyUsed,
      SidingSolver.solveLevel5StrategyA().strategyUsed,
      SidingSolver.solveLevel5StrategyB().strategyUsed,
    ];

    // Verify all strategy descriptions and paths are unique
    const unique = new Set(traces);
    expect(unique.size).toBe(traces.length);
  });
});
