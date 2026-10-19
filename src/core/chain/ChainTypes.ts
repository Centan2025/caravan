export type CellType = '.' | '#' | 'U' | 'R' | 'D' | 'L' | 'H' | 'V' | 'G';

export type PulseDirection = 'UP' | 'RIGHT' | 'DOWN' | 'LEFT';

export const DIR_DELTA: Record<PulseDirection, { dx: number; dy: number }> = {
  UP: { dx: 0, dy: -1 },
  RIGHT: { dx: 1, dy: 0 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
};

export interface Pulse {
  x: number;
  y: number;
  dir: PulseDirection;
}

export interface CellData {
  x: number;
  y: number;
  type: CellType;
  activated: boolean;
  collected?: boolean;
}

export interface LevelDefinition {
  id: number;
  title: string;
  grid: string[]; // 5 strings of 5 characters
  maxIgnitions: number;
  hint?: string;
}

export type GameStatus = 'IDLE' | 'PULSING' | 'WON' | 'LOST';

export interface PulseTickResult {
  tick: number;
  activePulses: Pulse[];
  newlyActivated: Array<{ x: number; y: number; type: CellType }>;
  goalsCollected: Array<{ x: number; y: number }>;
}

export interface IgnitionResult {
  valid: boolean;
  errorMessage?: string;
  ticks: PulseTickResult[];
  status: GameStatus;
  score: number;
  goalsCollected: number;
  goalsTotal: number;
  ignitionsRemaining: number;
}
