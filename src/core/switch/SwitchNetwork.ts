import {
  COLOR_STATION_MAP,
  J1Branch,
  J2Branch,
  J3Branch,
  JunctionId,
  NetworkNode,
  ScenarioDefinition,
  SwitchGameState,
  SwitchGameStatus,
  Vehicle,
  VehicleColor,
  DistrictId,
  LevelFamily,
} from './SwitchTypes';

export const FIXED_SCENARIOS: ScenarioDefinition[] = [
  { id: 1, manifest: ['R', 'B', 'R', 'B', 'R', 'B'] },
  { id: 2, manifest: ['G', 'Y', 'G', 'Y', 'G', 'Y'] },
  { id: 3, manifest: ['R', 'G', 'B', 'Y', 'R', 'G'] },
  { id: 4, manifest: ['R', 'B', 'G', 'Y', 'B', 'R', 'G', 'Y'] },
  { id: 5, manifest: ['Y', 'Y', 'G', 'R', 'B', 'B', 'G', 'R'] },
  { id: 6, manifest: ['R', 'G', 'R', 'G', 'B', 'Y', 'B', 'Y'] },
  { id: 7, manifest: ['R', 'B', 'Y', 'G', 'Y', 'B', 'R', 'G', 'R', 'B'] },
  { id: 8, manifest: ['G', 'R', 'Y', 'B', 'G', 'B', 'Y', 'R', 'G', 'Y'] },
  { id: 9, manifest: ['B', 'Y', 'R', 'G', 'B', 'G', 'R', 'Y', 'B', 'G'] },
  { id: 10, manifest: ['R', 'G', 'B', 'Y', 'Y', 'B', 'G', 'R', 'B', 'Y', 'R', 'G'] },
];

export class SwitchNetwork {
  public scenarioId = 1;
  public status: SwitchGameStatus = 'READY';
  public tickCount = 0;
  public manifest: VehicleColor[] = [];
  public vehicles: Vehicle[] = [];
  private nextVehicleId = 1;

  // Junction switch states
  public j1: J1Branch = 'LEFT';
  public j2: J2Branch = 'RED';
  public j3: J3Branch = 'GREEN';

  // Stats
  public correctCount = 0;
  public mistakeCount = 0;
  public currentStreak = 0;
  public maxStreak = 0;

  // Configurable difficulty parameters
  public tickDurationMs = 700;
  public spawnCadenceTicks = 2;
  public activeJunctions: JunctionId[] = ['J1', 'J2', 'J3'];
  public maxMistakes = 3;
  public maxConcurrentVehicles?: number;
  public spawnPreparationMs?: number;
  public district?: DistrictId;
  public levelFamily?: LevelFamily;
  public primaryChallenge?: string;
  public title = '';
  public hint = '';

  public get SPAWN_CADENCE_TICKS(): number {
    return this.spawnCadenceTicks;
  }

  public get score(): number {
    return this.correctCount * 100 + this.maxStreak * 25;
  }

  public getActiveVehicleCount(): number {
    return this.vehicles.filter(
      (v) => v.state !== 'DELIVERED' && v.state !== 'MISDELIVERED'
    ).length;
  }

  // Spawning cadence counter
  private ticksSinceLastSpawn = 0;

  constructor(scenario: number | ScenarioDefinition = 1) {
    this.loadScenario(scenario);
  }

  public loadScenario(scenario: number | ScenarioDefinition): void {
    let sc: ScenarioDefinition;
    if (typeof scenario === 'number') {
      sc = FIXED_SCENARIOS.find((s) => s.id === scenario) || FIXED_SCENARIOS[0];
    } else {
      sc = scenario;
    }

    this.scenarioId = sc.id;
    this.manifest = [...sc.manifest];
    this.vehicles = [];
    this.nextVehicleId = 1;
    this.tickCount = 0;

    this.tickDurationMs = sc.tickDurationMs ?? 700;
    this.spawnCadenceTicks = sc.spawnCadenceTicks ?? 2;
    this.activeJunctions = sc.activeJunctions ? [...sc.activeJunctions] : ['J1', 'J2', 'J3'];
    this.maxMistakes = sc.maxMistakes ?? 3;
    this.maxConcurrentVehicles = sc.maxConcurrentVehicles;
    this.spawnPreparationMs = sc.spawnPreparationMs;
    this.district = sc.district;
    this.levelFamily = sc.levelFamily;
    this.primaryChallenge = sc.primaryChallenge;
    this.title = sc.title ?? `Senaryo ${sc.id}`;
    this.hint = sc.hint ?? '';

    this.ticksSinceLastSpawn = this.spawnCadenceTicks; // Allow spawn on first tick

    // Initial junction states
    this.j1 = sc.initialJ1 ?? 'LEFT';
    this.j2 = sc.initialJ2 ?? 'RED';
    this.j3 = sc.initialJ3 ?? 'GREEN';

    this.correctCount = 0;
    this.mistakeCount = 0;
    this.currentStreak = 0;
    this.maxStreak = 0;
    this.status = 'READY';
  }

  public start(): void {
    if (this.status === 'READY' || this.status === 'PAUSED') {
      this.status = 'RUNNING';
    }
  }

  public pause(): void {
    if (this.status === 'RUNNING') {
      this.status = 'PAUSED';
    }
  }

  public resume(): void {
    if (this.status === 'PAUSED') {
      this.status = 'RUNNING';
    }
  }

  public isStation(node: NetworkNode): boolean {
    return ['RED', 'BLUE', 'GREEN', 'YELLOW'].includes(node);
  }

  public isNodeOccupied(node: NetworkNode): boolean {
    if (this.isStation(node)) {
      return false; // Stations absorb vehicles immediately
    }
    // Node is occupied if a vehicle is resting AT that node, OR moving INTO that node
    return this.vehicles.some(
      (v) =>
        v.state !== 'DELIVERED' &&
        v.state !== 'MISDELIVERED' &&
        (v.currentNode === node || v.toNode === node)
    );
  }

  /**
   * Checks whether a vehicle is currently entering the given junction during this tick.
   * GDD line 107: "A tap on a junction toggles its branch instantly unless a car is
   * currently entering that junction during the same simulation tick."
   */
  public isJunctionLocked(junction: JunctionId): boolean {
    return this.vehicles.some(
      (v) => v.state === 'MOVING' && v.toNode === junction
    );
  }

  public isJunctionActive(junction: JunctionId): boolean {
    return this.activeJunctions.includes(junction);
  }

  public toggleJunction(junction: JunctionId): boolean {
    if (!this.isJunctionActive(junction)) {
      return false;
    }

    if (this.isJunctionLocked(junction)) {
      return false;
    }

    if (junction === 'J1') {
      this.j1 = this.j1 === 'LEFT' ? 'RIGHT' : 'LEFT';
      return true;
    } else if (junction === 'J2') {
      this.j2 = this.j2 === 'RED' ? 'BLUE' : 'RED';
      return true;
    } else if (junction === 'J3') {
      this.j3 = this.j3 === 'GREEN' ? 'YELLOW' : 'GREEN';
      return true;
    }
    return false;
  }

  /**
   * Advances simulation by exactly one tick (tickDurationMs).
   * Exactly 1 edge per tick per vehicle.
   */
  public tick(): void {
    if (this.status !== 'RUNNING') {
      return;
    }

    this.tickCount++;

    // PHASE 1: Vehicles that were MOVING arrive at their destination node
    const arrivingVehicles = this.vehicles.filter((v) => v.state === 'MOVING');
    for (const v of arrivingVehicles) {
      if (v.toNode) {
        v.currentNode = v.toNode;
        v.fromNode = undefined;
        v.toNode = undefined;
        v.progress = 1.0;

        if (this.isStation(v.currentNode)) {
          // Arrived at a station
          if (v.currentNode === v.targetStation) {
            v.state = 'DELIVERED';
            this.correctCount++;
            this.currentStreak++;
            this.maxStreak = Math.max(this.maxStreak, this.currentStreak);
          } else {
            v.state = 'MISDELIVERED';
            this.mistakeCount++;
            this.currentStreak = 0;
            if (this.mistakeCount >= this.maxMistakes) {
              this.status = 'LOST';
              return;
            }
          }
        } else {
          v.state = 'WAITING';
        }
      }
    }

    // PHASE 2: Vehicles that were ALREADY waiting at a node (before this tick's arrivals)
    // depart along their chosen edge.
    // Order: J2/J3 first (downstream), then J1, then SOURCE (upstream).
    const readyVehicles = this.vehicles.filter(
      (v) =>
        (v.state === 'WAITING' || v.state === 'SPAWNED') &&
        !arrivingVehicles.includes(v)
    );

    const nodeOrder: Record<NetworkNode, number> = {
      RED: 0,
      BLUE: 0,
      GREEN: 0,
      YELLOW: 0,
      J2: 1,
      J3: 1,
      J1: 2,
      SOURCE: 3,
    };

    readyVehicles.sort((a, b) => nodeOrder[a.currentNode] - nodeOrder[b.currentNode]);

    for (const v of readyVehicles) {
      let nextNode: NetworkNode | null = null;

      if (v.currentNode === 'SOURCE') {
        nextNode = 'J1';
      } else if (v.currentNode === 'J1') {
        nextNode = this.j1 === 'LEFT' ? 'J2' : 'J3';
      } else if (v.currentNode === 'J2') {
        nextNode = this.j2 === 'RED' ? 'RED' : 'BLUE';
      } else if (v.currentNode === 'J3') {
        nextNode = this.j3 === 'GREEN' ? 'GREEN' : 'YELLOW';
      }

      if (nextNode) {
        // Can only depart if nextNode is a station OR is not currently occupied
        if (this.isStation(nextNode) || !this.isNodeOccupied(nextNode)) {
          v.fromNode = v.currentNode;
          v.toNode = nextNode;
          v.progress = 0.0;
          v.state = 'MOVING';
          v.latchedEdge = { from: v.fromNode, to: v.toNode };
          // Vacate current node
          v.currentNode = 'MOVING' as any;
        } else {
          v.state = 'WAITING';
        }
      }
    }

    // PHASE 3: Spawn next vehicle from manifest every spawnCadenceTicks ticks if SOURCE is free
    this.ticksSinceLastSpawn++;
    const canSpawnConcurrent =
      this.maxConcurrentVehicles === undefined ||
      this.getActiveVehicleCount() < this.maxConcurrentVehicles;

    if (
      this.ticksSinceLastSpawn >= this.spawnCadenceTicks &&
      this.manifest.length > 0 &&
      canSpawnConcurrent
    ) {
      if (!this.isNodeOccupied('SOURCE')) {
        const nextColor = this.manifest.shift()!;
        const newVehicle: Vehicle = {
          id: this.nextVehicleId++,
          color: nextColor,
          currentNode: 'SOURCE',
          targetStation: COLOR_STATION_MAP[nextColor],
          progress: 0.0,
          state: 'SPAWNED',
        };
        this.vehicles.push(newVehicle);
        this.ticksSinceLastSpawn = 0;
      }
    }

    // PHASE 4: Check Win Condition
    const allResolved =
      this.manifest.length === 0 &&
      this.vehicles.length > 0 &&
      this.vehicles.every((v) => v.state === 'DELIVERED' || v.state === 'MISDELIVERED');

    if (allResolved) {
      if (this.mistakeCount < this.maxMistakes) {
        this.status = 'WON';
      } else {
        this.status = 'LOST';
      }
    }
  }

  public calculateScore(): number {
    return this.correctCount * 100 + this.maxStreak * 25;
  }

  public getState(): SwitchGameState {
    return {
      status: this.status,
      tickCount: this.tickCount,
      manifestRemaining: [...this.manifest],
      vehicles: [...this.vehicles],
      j1: this.j1,
      j2: this.j2,
      j3: this.j3,
      correctCount: this.correctCount,
      mistakeCount: this.mistakeCount,
      currentStreak: this.currentStreak,
      maxStreak: this.maxStreak,
      score: this.calculateScore(),
    };
  }
}
