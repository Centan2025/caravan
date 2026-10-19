import {
  COLOR_STATION_MAP,
  GraphGameState,
  GraphGameStatus,
  GraphScenarioDefinition,
  GraphVehicle,
  VehicleColor,
} from './GraphTypes';
import { GraphTopology, CLASSIC_TREE_TOPOLOGY } from './GraphTopology';
import { FIXED_SCENARIOS } from '../SwitchNetwork';

export class GraphSwitchNetwork {
  public topology: GraphTopology;
  public scenarioId = 1;
  public status: GraphGameStatus = 'READY';
  public tickCount = 0;
  public manifest: VehicleColor[] = [];
  public vehicles: GraphVehicle[] = [];
  private nextVehicleId = 1;

  // Dynamic Switch States: switchId -> activeBranch
  public switches: Record<string, string> = {};

  // Sidings where release has been requested
  public sidingReleaseRequested: Set<string> = new Set();

  // Buffered switch toggles when player taps while locked
  public bufferedToggles: Map<string, string> = new Map();

  // Stats
  public correctCount = 0;
  public mistakeCount = 0;
  public currentStreak = 0;
  public maxStreak = 0;

  // Configurable parameters
  public tickDurationMs = 700;
  public spawnCadenceTicks = 2;
  public activeJunctions: string[] = ['J1', 'J2', 'J3'];
  public maxMistakes = 3;
  public maxConcurrentVehicles?: number;
  public spawnPreparationMs?: number;
  public district?: string;
  public levelFamily?: string;
  public primaryChallenge?: string;
  public title = '';
  public hint = '';

  private ticksSinceLastSpawn = 0;

  // Classic compatibility getters
  public get j1(): 'LEFT' | 'RIGHT' {
    return (this.switches['J1'] as 'LEFT' | 'RIGHT') ?? 'LEFT';
  }
  public get j2(): 'RED' | 'BLUE' {
    return (this.switches['J2'] as 'RED' | 'BLUE') ?? 'RED';
  }
  public get j3(): 'GREEN' | 'YELLOW' {
    return (this.switches['J3'] as 'GREEN' | 'YELLOW') ?? 'GREEN';
  }

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

  constructor(
    scenario: number | GraphScenarioDefinition = 1,
    topology: GraphTopology = new GraphTopology(CLASSIC_TREE_TOPOLOGY)
  ) {
    this.topology = topology;
    this.loadScenario(scenario);
  }

  public loadScenario(scenario: number | GraphScenarioDefinition): void {
    let sc: GraphScenarioDefinition;
    if (typeof scenario === 'number') {
      const fixed = FIXED_SCENARIOS.find((s) => s.id === scenario) || FIXED_SCENARIOS[0];
      sc = {
        id: fixed.id,
        manifest: [...fixed.manifest],
        tickDurationMs: fixed.tickDurationMs,
        spawnCadenceTicks: fixed.spawnCadenceTicks,
        activeJunctions: fixed.activeJunctions ? [...fixed.activeJunctions] : undefined,
        initialJ1: fixed.initialJ1,
        initialJ2: fixed.initialJ2,
        initialJ3: fixed.initialJ3,
        maxMistakes: fixed.maxMistakes,
        maxConcurrentVehicles: fixed.maxConcurrentVehicles,
        spawnPreparationMs: fixed.spawnPreparationMs,
        hint: fixed.hint,
        district: fixed.district,
        levelFamily: fixed.levelFamily,
        primaryChallenge: fixed.primaryChallenge,
        title: fixed.title,
      };
    } else {
      sc = scenario;
    }

    // Set topology if specified in scenario
    if (sc.topology && typeof sc.topology === 'object') {
      this.topology = new GraphTopology(sc.topology);
    }

    this.scenarioId = sc.id;
    this.manifest = [...sc.manifest];
    this.vehicles = [];
    this.nextVehicleId = 1;
    this.tickCount = 0;
    this.sidingReleaseRequested.clear();
    this.bufferedToggles.clear();

    this.tickDurationMs = sc.tickDurationMs ?? 700;
    this.spawnCadenceTicks = sc.spawnCadenceTicks ?? 2;
    this.activeJunctions = sc.activeJunctions
      ? [...sc.activeJunctions]
      : this.topology.def.switches.map((s) => s.id);
    this.maxMistakes = sc.maxMistakes ?? 3;
    this.maxConcurrentVehicles = sc.maxConcurrentVehicles;
    this.spawnPreparationMs = sc.spawnPreparationMs;
    this.district = sc.district;
    this.levelFamily = sc.levelFamily;
    this.primaryChallenge = sc.primaryChallenge;
    this.title = sc.title ?? `Senaryo ${sc.id}`;
    this.hint = sc.hint ?? '';

    this.ticksSinceLastSpawn = this.spawnCadenceTicks;

    // Initialize switches from topology defaults or scenario overrides
    this.switches = {};
    for (const sw of this.topology.def.switches) {
      this.switches[sw.id] = sw.defaultBranch ?? sw.branches[0];
    }

    // Classic initial switch overrides
    if (sc.initialJ1 && this.switches['J1'] !== undefined) this.switches['J1'] = sc.initialJ1;
    if (sc.initialJ2 && this.switches['J2'] !== undefined) this.switches['J2'] = sc.initialJ2;
    if (sc.initialJ3 && this.switches['J3'] !== undefined) this.switches['J3'] = sc.initialJ3;

    if (sc.initialSwitches) {
      Object.assign(this.switches, sc.initialSwitches);
    }

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

  public isStation(nodeId: string): boolean {
    return this.topology.isStation(nodeId);
  }

  public isNodeOccupied(nodeId: string): boolean {
    if (this.isStation(nodeId)) {
      return false; // Stations absorb vehicles immediately
    }

    const capacity = this.topology.getNodeCapacity(nodeId);
    const count = this.vehicles.filter(
      (v) =>
        v.state !== 'DELIVERED' &&
        v.state !== 'MISDELIVERED' &&
        (v.currentNode === nodeId || v.toNode === nodeId)
    ).length;

    return count >= capacity;
  }

  public isJunctionLocked(junctionId: string): boolean {
    return this.vehicles.some(
      (v) => v.state === 'MOVING' && v.toNode === junctionId
    );
  }

  public isJunctionActive(junctionId: string): boolean {
    return this.activeJunctions.includes(junctionId);
  }

  /**
   * Toggles a junction switch.
   * If allowBuffering is true and the switch is locked, buffers the switch toggle
   * to occur immediately when the transit completes.
   */
  public toggleJunction(junctionId: string, options?: { allowBuffering?: boolean }): boolean {
    if (!this.isJunctionActive(junctionId)) {
      return false;
    }

    const sw = this.topology.getSwitch(junctionId);
    if (!sw) {
      return false;
    }

    if (this.isJunctionLocked(junctionId)) {
      if (options?.allowBuffering) {
        const current = this.switches[junctionId] ?? sw.branches[0];
        const idx = sw.branches.indexOf(current);
        const nextBranch = sw.branches[(idx + 1) % sw.branches.length];
        this.bufferedToggles.set(junctionId, nextBranch);
        return true;
      }
      return false;
    }

    const currentBranch = this.switches[junctionId] ?? sw.branches[0];
    const currentIndex = sw.branches.indexOf(currentBranch);
    const nextIndex = (currentIndex + 1) % sw.branches.length;
    this.switches[junctionId] = sw.branches[nextIndex];
    this.bufferedToggles.delete(junctionId);
    return true;
  }

  /**
   * Requests release of vehicles currently PARKED in a siding.
   */
  public releaseSiding(sidingNodeId: string): boolean {
    const hasParked = this.vehicles.some(
      (v) => v.state === 'PARKED' && v.currentNode === sidingNodeId
    );
    if (hasParked) {
      this.sidingReleaseRequested.add(sidingNodeId);
      return true;
    }
    return false;
  }

  public isSidingReleaseRequested(sidingNodeId: string): boolean {
    return this.sidingReleaseRequested.has(sidingNodeId);
  }

  /**
   * Advances simulation by exactly one tick.
   * 4-Phase deterministic cycle.
   */
  public tick(): void {
    if (this.status !== 'RUNNING') {
      return;
    }

    this.tickCount++;

    // =========================================================================
    // PHASE 1: Vehicles that were MOVING arrive at their toNode
    // =========================================================================
    const arrivingVehicles = this.vehicles.filter((v) => v.state === 'MOVING');
    for (const v of arrivingVehicles) {
      if (v.toNode) {
        v.currentNode = v.toNode;
        v.fromNode = undefined;
        v.toNode = undefined;
        v.progress = 1.0;

        if (this.topology.isStation(v.currentNode)) {
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
        } else if (this.topology.isSiding(v.currentNode)) {
          // Arrived at a siding: enters PARKED state unless release already requested
          v.state = 'PARKED';
          v.sidingId = v.currentNode;
        } else {
          v.state = 'WAITING';
        }
      }
    }

    // Apply any buffered toggles once arrivals have unlocked junctions
    for (const [jId, targetBranch] of this.bufferedToggles.entries()) {
      if (!this.isJunctionLocked(jId)) {
        this.switches[jId] = targetBranch;
        this.bufferedToggles.delete(jId);
      }
    }

    // =========================================================================
    // PHASE 2: Vehicles ready at nodes depart along their chosen edge
    // Order: Downstream first (lower rank), then upstream (higher rank)
    // =========================================================================
    const readyVehicles = this.vehicles.filter((v) => {
      if (arrivingVehicles.includes(v)) return false;
      if (v.state === 'WAITING' || v.state === 'SPAWNED') return true;
      if (v.state === 'PARKED' && this.sidingReleaseRequested.has(v.currentNode)) return true;
      return false;
    });

    readyVehicles.sort((a, b) => {
      const rankDiff =
        this.topology.getDownstreamRank(a.currentNode) -
        this.topology.getDownstreamRank(b.currentNode);
      return rankDiff !== 0 ? rankDiff : a.id - b.id;
    });

    for (const v of readyVehicles) {
      const nextNode = this.topology.resolveNextNode(v.currentNode, this.switches);

      if (nextNode) {
        // Can depart if nextNode is a station OR is not occupied
        if (this.topology.isStation(nextNode) || !this.isNodeOccupied(nextNode)) {
          v.fromNode = v.currentNode;
          v.toNode = nextNode;
          v.progress = 0.0;
          v.state = 'MOVING';
          v.latchedEdge = { from: v.fromNode, to: v.toNode };

          // Clear siding release request once departed
          if (v.sidingId && v.fromNode === v.sidingId) {
            this.sidingReleaseRequested.delete(v.sidingId);
            v.sidingId = undefined;
          }

          // Vacate current node
          v.currentNode = 'MOVING';
        } else {
          if (v.state !== 'PARKED') {
            v.state = 'WAITING';
          }
        }
      }
    }

    // =========================================================================
    // PHASE 3: Spawn next vehicle from manifest every spawnCadenceTicks ticks
    // =========================================================================
    this.ticksSinceLastSpawn++;
    const canSpawnConcurrent =
      this.maxConcurrentVehicles === undefined ||
      this.getActiveVehicleCount() < this.maxConcurrentVehicles;

    if (
      this.ticksSinceLastSpawn >= this.spawnCadenceTicks &&
      this.manifest.length > 0 &&
      canSpawnConcurrent
    ) {
      const sourceNode =
        this.topology.def.nodes.find((n) => n.type === 'SOURCE')?.id || 'SOURCE';

      if (!this.isNodeOccupied(sourceNode)) {
        const nextColor = this.manifest.shift()!;
        const newVehicle: GraphVehicle = {
          id: this.nextVehicleId++,
          color: nextColor,
          currentNode: sourceNode,
          targetStation: COLOR_STATION_MAP[nextColor],
          progress: 0.0,
          state: 'SPAWNED',
        };
        this.vehicles.push(newVehicle);
        this.ticksSinceLastSpawn = 0;
      }
    }

    // =========================================================================
    // PHASE 4: Check Win Condition
    // =========================================================================
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

  public getState(): GraphGameState {
    return {
      status: this.status,
      tickCount: this.tickCount,
      manifestRemaining: [...this.manifest],
      vehicles: [...this.vehicles],
      switches: { ...this.switches },
      correctCount: this.correctCount,
      mistakeCount: this.mistakeCount,
      currentStreak: this.currentStreak,
      maxStreak: this.maxStreak,
      score: this.calculateScore(),
    };
  }
}
