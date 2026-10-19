export type VehicleColor = 'R' | 'B' | 'G' | 'Y';

export type StationColor = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW';

export const COLOR_STATION_MAP: Record<VehicleColor, StationColor> = {
  R: 'RED',
  B: 'BLUE',
  G: 'GREEN',
  Y: 'YELLOW',
};

export type JunctionId = 'J1' | 'J2' | 'J3';

export type J1Branch = 'LEFT' | 'RIGHT';      // LEFT -> J2, RIGHT -> J3
export type J2Branch = 'RED' | 'BLUE';        // LEFT -> RED, RIGHT -> BLUE
export type J3Branch = 'GREEN' | 'YELLOW';    // LEFT -> GREEN, RIGHT -> YELLOW

export type NetworkNode = 'SOURCE' | 'J1' | 'J2' | 'J3' | StationColor;

export interface Vehicle {
  id: number;
  color: VehicleColor;
  currentNode: NetworkNode;
  targetStation: StationColor;
  // Progress along edge for animation / interpolation: 0.0 to 1.0
  fromNode?: NetworkNode;
  toNode?: NetworkNode;
  progress: number;
  latchedEdge?: { from: NetworkNode; to: NetworkNode };
  state: 'MANIFEST' | 'SPAWNED' | 'MOVING' | 'WAITING' | 'DELIVERED' | 'MISDELIVERED';
}

export type DistrictId = 'suburb' | 'downtown' | 'industrial' | 'harbor' | 'night_express';

export type LevelFamily =
  | 'learning'
  | 'timing'
  | 'priority'
  | 'route_selection'
  | 'traffic'
  | 'mastery';

export interface ScenarioDefinition {
  id: number;
  title?: string;
  manifest: VehicleColor[];
  district?: DistrictId;
  levelFamily?: LevelFamily;
  primaryChallenge?: string;
  tickDurationMs?: number;        // default 700ms
  spawnCadenceTicks?: number;     // default 2 ticks
  activeJunctions?: JunctionId[];  // default ['J1', 'J2', 'J3']
  initialJ1?: J1Branch;           // default 'LEFT'
  initialJ2?: J2Branch;           // default 'RED'
  initialJ3?: J3Branch;           // default 'GREEN'
  maxMistakes?: number;           // default 3
  maxConcurrentVehicles?: number; // max active vehicles on board simultaneously
  spawnPreparationMs?: number;    // preparation delay indicator before departure
  hint?: string;                  // educational instructional cue
}

export type SwitchGameStatus = 'READY' | 'RUNNING' | 'PAUSED' | 'WON' | 'LOST';

export interface SwitchGameState {
  status: SwitchGameStatus;
  tickCount: number;
  manifestRemaining: VehicleColor[];
  vehicles: Vehicle[];
  j1: J1Branch;
  j2: J2Branch;
  j3: J3Branch;
  correctCount: number;
  mistakeCount: number;
  currentStreak: number;
  maxStreak: number;
  score: number;
}
