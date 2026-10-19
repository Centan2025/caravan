import { ChainBoard } from './ChainBoard';
import { LevelDefinition } from './ChainTypes';

export interface SolverResult {
  solvable: boolean;
  totalSolutions: number;
  bestSequence: Array<{ x: number; y: number }>;
  allWinningSequences: Array<Array<{ x: number; y: number }>>;
  losingOpeningTaps: Array<{ x: number; y: number }>;
  initialEligibleTaps: Array<{ x: number; y: number }>;
  goalsTotal: number;
}

export class ChainSolver {
  /**
   * Exhaustively searches all possible tap sequences up to maxIgnitions.
   */
  public static solve(level: LevelDefinition): SolverResult {
    const initialBoard = new ChainBoard(level);
    const initialEligibleTaps: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        if (initialBoard.isEligibleTap(x, y)) {
          initialEligibleTaps.push({ x, y });
        }
      }
    }

    const winningSequences: Array<Array<{ x: number; y: number }>> = [];
    const losingOpeningTaps: Array<{ x: number; y: number }> = [];

    // Check each initial opening tap
    for (const tap of initialEligibleTaps) {
      const b = initialBoard.clone();
      b.ignite(tap.x, tap.y);

      // Check if this opening tap can lead to ANY win
      const subWins: Array<Array<{ x: number; y: number }>> = [];
      function subDfs(cur: ChainBoard, path: Array<{ x: number; y: number }>) {
        if (cur.status === 'WON') {
          subWins.push([...path]);
          return;
        }
        if (cur.status === 'LOST' || path.length >= level.maxIgnitions) {
          return;
        }
        for (let y = 0; y < 5; y++) {
          for (let x = 0; x < 5; x++) {
            if (cur.isEligibleTap(x, y)) {
              const nb = cur.clone();
              nb.ignite(x, y);
              path.push({ x, y });
              subDfs(nb, path);
              path.pop();
            }
          }
        }
      }

      if (b.status === 'WON') {
        winningSequences.push([tap]);
      } else {
        subDfs(b, [tap]);
        for (const w of subWins) {
          winningSequences.push(w);
        }
        if (subWins.length === 0) {
          losingOpeningTaps.push(tap);
        }
      }
    }

    // Sort winning sequences by shortest length
    winningSequences.sort((a, b) => a.length - b.length);

    return {
      solvable: winningSequences.length > 0,
      totalSolutions: winningSequences.length,
      bestSequence: winningSequences[0] || [],
      allWinningSequences: winningSequences,
      losingOpeningTaps,
      initialEligibleTaps,
      goalsTotal: initialBoard.goalsTotal,
    };
  }
}
