export type Direction = 0 | 1 | 2 | 3; // 0: N, 1: E, 2: S, 3: W

export const DIR_OFFSETS: Record<Direction, { dx: number; dy: number }> = {
  0: { dx: 0, dy: -1 }, // North
  1: { dx: 1, dy: 0 },  // East
  2: { dx: 0, dy: 1 },  // South
  3: { dx: -1, dy: 0 }, // West
};

export const DIR_NAMES: Record<Direction, string> = {
  0: 'Kuzey',
  1: 'Doğu',
  2: 'Güney',
  3: 'Batı',
};

export function getOppositeDir(dir: Direction): Direction {
  return ((dir + 2) % 4) as Direction;
}

export type TileGeometry = 'EMPTY' | 'STRAIGHT' | 'ELBOW' | 'TEE' | 'CROSS';

export type StopType = 'NONE' | 'PRODUCER' | 'INN' | 'MARKET';

export interface TileData {
  x: number;
  y: number;
  geometry: TileGeometry;
  rotation: number; // 0, 1, 2, 3 (multiples of 90 degrees)
  stop: StopType;
  fixed?: boolean; // If true, cannot be rotated by player (e.g. fixed landmark)
}

export type FailureReason =
  | 'DEAD_END'
  | 'DISCONNECTED'
  | 'WRONG_STOP_ORDER'
  | 'CLOSED_LOOP'
  | 'OUT_OF_BOUNDS';

export interface RouteStep {
  x: number;
  y: number;
  entrySide: Direction; // The side of the current tile where caravan entered
  exitDir: Direction;   // The direction caravan exits to the neighbor
  stop?: StopType;
}

export interface SimulationResult {
  success: boolean;
  status: 'SUCCESS' | FailureReason;
  steps: RouteStep[];
  errorStep?: RouteStep;
  errorMessage?: string;
  innVisited: boolean;
  marketReached: boolean;
  tilesTraversed: number;
}

export type GameMode = 'B' | 'C'; // B: Trade Chain, C: Caravan Rush

export interface LevelConfig {
  id: number;
  title: string;
  description: string;
  gridSize: number; // 5 for 5x5
  seed?: number;
  startTile: { x: number; y: number; initialExitDir: Direction };
  tiles: TileData[];
  targetMoves?: number;
}

export interface TelemetryEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  timeSinceSessionStartMs: number;
  eventType:
    | 'SESSION_START'
    | 'FIRST_INTERACTION'
    | 'LEVEL_START'
    | 'TILE_ROTATED'
    | 'CARAVAN_LAUNCHED'
    | 'CARAVAN_STEP'
    | 'LEVEL_COMPLETED'
    | 'LEVEL_FAILED'
    | 'LEVEL_RETRY'
    | 'LEVEL_QUIT'
    | 'MODE_SWITCHED'
    | 'PREFERENCE_VOTE';
  mode: GameMode;
  levelId: number;
  data: Record<string, any>;
}
