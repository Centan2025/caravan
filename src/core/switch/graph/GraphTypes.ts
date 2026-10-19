import { VehicleColor, StationColor, COLOR_STATION_MAP } from '../SwitchTypes';

export type { VehicleColor, StationColor };
export { COLOR_STATION_MAP };

export type NodeType = 'SOURCE' | 'SWITCH' | 'STATION' | 'SIDING' | 'WAYPOINT';

export interface GraphNodeDef {
  id: string;
  type: NodeType;
  stationColor?: StationColor;
  capacity?: number;
  position?: { x: number; y: number };
  label?: string;
}

export interface GraphSwitchDef {
  id: string;
  branches: string[];
  defaultBranch?: string;
}

export interface GraphEdgeDef {
  id: string;
  from: string;
  to: string;
  branch?: string;
  lengthTicks?: number;
}

export interface GraphTopologyDef {
  id: string;
  name: string;
  nodes: GraphNodeDef[];
  switches: GraphSwitchDef[];
  edges: GraphEdgeDef[];
}

export type VehicleState =
  | 'MANIFEST'
  | 'SPAWNED'
  | 'MOVING'
  | 'WAITING'
  | 'PARKED'
  | 'DELIVERED'
  | 'MISDELIVERED';

export interface GraphVehicle {
  id: number;
  color: VehicleColor;
  currentNode: string;
  targetStation: StationColor;
  fromNode?: string;
  toNode?: string;
  progress: number;
  latchedEdge?: { from: string; to: string };
  state: VehicleState;
  sidingId?: string;
}

export interface GraphScenarioDefinition {
  id: number;
  title?: string;
  topology?: string | GraphTopologyDef;
  manifest: VehicleColor[];
  district?: string;
  levelFamily?: string;
  primaryChallenge?: string;
  tickDurationMs?: number;
  spawnCadenceTicks?: number;
  activeJunctions?: string[];
  initialSwitches?: Record<string, string>;
  // Backward compatibility with Classic properties
  initialJ1?: 'LEFT' | 'RIGHT';
  initialJ2?: 'RED' | 'BLUE';
  initialJ3?: 'GREEN' | 'YELLOW';
  maxMistakes?: number;
  maxConcurrentVehicles?: number;
  spawnPreparationMs?: number;
  hint?: string;
}

export type GraphGameStatus = 'READY' | 'RUNNING' | 'PAUSED' | 'WON' | 'LOST';

export interface GraphGameState {
  status: GraphGameStatus;
  tickCount: number;
  manifestRemaining: VehicleColor[];
  vehicles: GraphVehicle[];
  switches: Record<string, string>;
  correctCount: number;
  mistakeCount: number;
  currentStreak: number;
  maxStreak: number;
  score: number;
}
