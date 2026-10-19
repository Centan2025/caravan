import { describe, it, expect } from 'vitest';
import { ChainBoard } from '../src/core/chain/ChainBoard';
import { ChainSolver } from '../src/core/chain/ChainSolver';
import { CHAIN_LEVELS } from '../src/core/chain/ChainLevels';
import * as fs from 'fs';
import * as path from 'path';

describe('Chain Domino Core Engine', () => {
  it('Pulse moves exactly one orthogonal neighbor per tick', () => {
    const board = new ChainBoard({
      id: 99,
      title: 'Test Orthogonal',
      grid: [
        '.....',
        '..U..',
        '..U..',
        '.....',
        '.....',
      ],
      maxIgnitions: 1,
    });

    const res = board.ignite(2, 2);
    expect(res.valid).toBe(true);
    expect(res.ticks.length).toBeGreaterThanOrEqual(2);
    // In tick 1, pulse reaches (2, 1) and activates it
    expect(res.ticks[1].newlyActivated.some((c) => c.x === 2 && c.y === 1)).toBe(true);
    // In tick 2, pulse moves from (2, 1) to (2, 0)
    expect(res.ticks[2].activePulses.some((p) => p.x === 2 && p.y === 0)).toBe(true);
  });

  it('Walls, blanks, and off-board pulses terminate', () => {
    const board = new ChainBoard({
      id: 99,
      title: 'Test Absorption',
      grid: [
        '.....',
        'R.#..',
        '.....',
        '.....',
        '.....',
      ],
      maxIgnitions: 1,
    });

    const res = board.ignite(0, 1);
    expect(res.valid).toBe(true);
    // (0, 1) R emits to (1, 1)[.] -> absorbed!
    expect(res.ticks[1].newlyActivated.length).toBe(0);
    expect(board.cells[1][2].activated).toBe(false); // Wall at (2, 1) untouched
  });

  it('H/V split emits two; triggered cells activate once', () => {
    const board = new ChainBoard({
      id: 99,
      title: 'Test Split',
      grid: [
        '.....',
        '.....',
        'GLHRG',
        '.....',
        '.....',
      ],
      maxIgnitions: 1,
    });

    const res = board.ignite(2, 2); // Tap H
    expect(res.valid).toBe(true);
    expect(res.status).toBe('WON');
    expect(res.goalsCollected).toBe(2);
    expect(board.cells[2][2].activated).toBe(true);
    expect(board.cells[2][1].activated).toBe(true);
    expect(board.cells[2][3].activated).toBe(true);
  });

  it('Closed loop terminates; multiple simultaneous incoming pulses do not double-trigger', () => {
    const board = new ChainBoard({
      id: 99,
      title: 'Test Loop & Simultaneous',
      grid: [
        'RD...',
        'UL...',
        '.....',
        '.....',
        '.....',
      ],
      maxIgnitions: 1,
    });

    // (0,0)R -> (1,0)D -> (1,1)L -> (0,1)U -> (0,0)R (loop!)
    const res = board.ignite(0, 0);
    expect(res.valid).toBe(true);
    // Must terminate cleanly within ticks
    expect(res.ticks.length).toBeLessThanOrEqual(10);
    expect(board.cells[0][0].activated).toBe(true);
    expect(board.cells[0][1].activated).toBe(true);
    expect(board.cells[1][0].activated).toBe(true);
    expect(board.cells[1][1].activated).toBe(true);
  });

  it('Tapping goal/wall/empty/activated relay is invalid and does not consume a move', () => {
    const board = new ChainBoard({
      id: 99,
      title: 'Test Invalid',
      grid: [
        'G#...',
        '.U...',
        '.....',
        '.....',
        '.....',
      ],
      maxIgnitions: 2,
    });

    expect(board.ignite(0, 0).valid).toBe(false); // Goal
    expect(board.ignitionsUsed).toBe(0);

    expect(board.ignite(1, 0).valid).toBe(false); // Wall
    expect(board.ignitionsUsed).toBe(0);

    expect(board.ignite(2, 0).valid).toBe(false); // Empty
    expect(board.ignitionsUsed).toBe(0);

    expect(board.ignite(1, 1).valid).toBe(true);  // Relay
    expect(board.ignitionsUsed).toBe(1);

    expect(board.ignite(1, 1).valid).toBe(false); // Already activated relay
    expect(board.ignitionsUsed).toBe(1);
  });

  it('Gold completion and ignition exhaustion are mutually resolved correctly', () => {
    // Single ignition success with 1 unused move
    const winBoard = new ChainBoard({
      id: 99,
      title: 'Test Win',
      grid: [
        '.G...',
        '.U...',
        '.....',
        '.....',
        '.....',
      ],
      maxIgnitions: 2,
    });
    const winRes = winBoard.ignite(1, 1);
    expect(winRes.status).toBe('WON');
    expect(winRes.score).toBe(130); // 100 goal + 30 unused (1 unused out of 2)

    // Ignition exhaustion loss
    const loseBoard = new ChainBoard({
      id: 99,
      title: 'Test Lose',
      grid: [
        '..G..',
        'D....',
        '.....',
        '.....',
        '.....',
      ],
      maxIgnitions: 1,
    });
    const loseRes = loseBoard.ignite(0, 1);
    expect(loseRes.status).toBe('LOST');
    expect(loseRes.score).toBe(0);
  });

  it('ChainSolver validates all 10 boards according to GDD acceptance criteria', () => {
    for (const lvl of CHAIN_LEVELS) {
      const res = ChainSolver.solve(lvl);
      expect(res.goalsTotal).toBeGreaterThanOrEqual(1);
      expect(res.initialEligibleTaps.length).toBeGreaterThanOrEqual(2);
      expect(res.solvable).toBe(true);
      if (lvl.id > 1) {
        expect(res.losingOpeningTaps.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('All 10 level JSON files exist on disk and match definition', () => {
    for (let i = 1; i <= 10; i++) {
      const p = path.resolve(`levels/chain/level_${i.toString().padStart(2, '0')}.json`);
      expect(fs.existsSync(p)).toBe(true);
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      expect(data.id).toBe(i);
      expect(data.grid.length).toBe(5);
    }
  });
});
