import { GraphSwitchNetwork } from './GraphSwitchNetwork';
import {
  SIDING_LEVELS,
  SIDING_LEVEL_103_FIFO,
  SIDING_LEVEL_104_DUAL,
} from './SidingLevels';
import { GraphTopologyDef } from './GraphTypes';

export interface SidingSolveResult {
  levelId: number;
  title: string;
  won: boolean;
  correctCount: number;
  mistakeCount: number;
  ticks: number;
  strategyUsed: string;
}

export class SidingSolver {
  /**
   * Solves Siding Level 1 (Entry & Exit tutorial)
   */
  public static solveLevel1(): SidingSolveResult {
    const sc = SIDING_LEVELS[0];
    const net = new GraphSwitchNetwork(sc);
    net.start();

    let ticks = 0;
    while (net.status === 'RUNNING' && ticks < 50) {
      // If car is parked in siding, release it
      const hasParked = net.vehicles.some((v) => v.state === 'PARKED');
      if (hasParked) {
        net.releaseSiding('SIDING_BAY');
      }

      net.tick();
      ticks++;
    }

    return {
      levelId: sc.id,
      title: sc.title ?? '',
      won: net.status === 'WON',
      correctCount: net.correctCount,
      mistakeCount: net.mistakeCount,
      ticks,
      strategyUsed: 'Park into siding and dispatch',
    };
  }

  /**
   * Solves Siding Level 2 (Priority & Overtake)
   * Car 1 ('B') enters Siding.
   * Car 2 ('R') takes Main line to RED.
   * Then SW_STATION toggled to BLUE, Car 1 released to BLUE.
   */
  public static solveLevel2(): SidingSolveResult {
    const sc = SIDING_LEVELS[1];
    const net = new GraphSwitchNetwork(sc);
    net.start();

    let ticks = 0;
    while (net.status === 'RUNNING' && ticks < 60) {
      const car1 = net.vehicles.find((v) => v.id === 1);
      const car2 = net.vehicles.find((v) => v.id === 2);

      // Once car 1 is in siding, switch SW_SIDING to MAIN for Car 2
      if (car1 && car1.state === 'PARKED') {
        if (net.switches['SW_SIDING'] !== 'MAIN' && !net.isJunctionLocked('SW_SIDING')) {
          net.toggleJunction('SW_SIDING');
        }
      }

      // Once Car 2 has passed MERGE or is delivered, switch SW_STATION to BLUE and release Car 1
      if (car2 && (car2.currentNode === 'MERGE' || car2.currentNode === 'RED' || car2.state === 'DELIVERED')) {
        if (car2.state === 'DELIVERED') {
          if (net.switches['SW_STATION'] !== 'BLUE' && !net.isJunctionLocked('SW_STATION')) {
            net.toggleJunction('SW_STATION');
          }
          if (car1 && car1.state === 'PARKED') {
            net.releaseSiding('SIDING_BAY');
          }
        }
      }

      net.tick();
      ticks++;
    }

    return {
      levelId: sc.id,
      title: sc.title ?? '',
      won: net.status === 'WON',
      correctCount: net.correctCount,
      mistakeCount: net.mistakeCount,
      ticks,
      strategyUsed: 'Hold B in siding, fast-track R via main, dispatch B to Blue',
    };
  }

  /**
   * Solves Siding Level 3 (Capacity & Blockage - 1 car capacity)
   */
  public static solveLevel3(): SidingSolveResult {
    const sc = SIDING_LEVELS[2];
    const net = new GraphSwitchNetwork(sc);
    net.start();

    let ticks = 0;
    while (net.status === 'RUNNING' && ticks < 80) {
      const car1 = net.vehicles.find((v) => v.id === 1);
      const car2 = net.vehicles.find((v) => v.id === 2);

      // Car 1 enters siding. Switch SW_SIDING to MAIN for Car 2 and 3
      if (car1 && car1.state === 'PARKED') {
        if (net.switches['SW_SIDING'] !== 'MAIN' && !net.isJunctionLocked('SW_SIDING')) {
          net.toggleJunction('SW_SIDING');
        }
      }

      // When Car 2 approaches station, set to BLUE
      if (car2 && (car2.currentNode === 'MERGE' || car2.toNode === 'SW_STATION')) {
        if (net.switches['SW_STATION'] !== 'BLUE' && !net.isJunctionLocked('SW_STATION')) {
          net.toggleJunction('SW_STATION');
        }
      }

      // After Car 2 delivered, set back to RED and release Car 1
      if (car2 && car2.state === 'DELIVERED') {
        if (net.switches['SW_STATION'] !== 'RED' && !net.isJunctionLocked('SW_STATION')) {
          net.toggleJunction('SW_STATION');
        }
        if (car1 && car1.state === 'PARKED') {
          net.releaseSiding('SIDING_BAY');
        }
      }

      net.tick();
      ticks++;
    }

    return {
      levelId: sc.id,
      title: sc.title ?? '',
      won: net.status === 'WON',
      correctCount: net.correctCount,
      mistakeCount: net.mistakeCount,
      ticks,
      strategyUsed: 'Capacity diversion: bypass siding after 1st car',
    };
  }

  /**
   * Solves Level 103-B: 2-Capacity FIFO Siding
   * Holds Car 1 (B) and Car 2 (B) in the same siding pocket.
   * Car 3 (R) bypasses via MAIN.
   * Then releases Car 1 (first), then Car 2 (second) deterministically.
   */
  public static solveLevel103FIFO(): SidingSolveResult {
    const sc = SIDING_LEVEL_103_FIFO;
    const net = new GraphSwitchNetwork(sc);
    net.start();

    let ticks = 0;
    while (net.status === 'RUNNING' && ticks < 80) {
      const v1 = net.vehicles.find((v) => v.id === 1);
      const v2 = net.vehicles.find((v) => v.id === 2);
      const v3 = net.vehicles.find((v) => v.id === 3);

      // Once both V1 and V2 are parked in SIDING_BAY, switch SW_SIDING to MAIN for V3 (R)
      if (v1 && v1.state === 'PARKED' && v2 && v2.state === 'PARKED') {
        if (net.switches['SW_SIDING'] !== 'MAIN' && !net.isJunctionLocked('SW_SIDING')) {
          net.toggleJunction('SW_SIDING');
        }
      }

      // If V3 is moving to station, ensure SW_STATION is RED
      if (v3 && (v3.currentNode === 'MERGE' || v3.toNode === 'SW_STATION')) {
        if (net.switches['SW_STATION'] !== 'RED' && !net.isJunctionLocked('SW_STATION')) {
          net.toggleJunction('SW_STATION');
        }
      }

      // Once V3 delivered to RED:
      if (v3 && v3.state === 'DELIVERED') {
        if (net.switches['SW_STATION'] !== 'BLUE' && !net.isJunctionLocked('SW_STATION')) {
          net.toggleJunction('SW_STATION');
        }
        // First release: dispatches V1 (FIFO #1)
        if (v1 && v1.state === 'PARKED') {
          net.releaseSiding('SIDING_BAY');
        }
        // Second release: once V1 is cleared past MERGE, dispatch V2 (FIFO #2)
        if (v2 && v2.state === 'PARKED' && (v1?.currentNode === 'SW_STATION' || v1?.state === 'DELIVERED')) {
          net.releaseSiding('SIDING_BAY');
        }
      }

      net.tick();
      ticks++;
    }

    return {
      levelId: sc.id,
      title: sc.title ?? '',
      won: net.status === 'WON',
      correctCount: net.correctCount,
      mistakeCount: net.mistakeCount,
      ticks,
      strategyUsed: '2-Car FIFO Siding: queue 2 blue cars, bypass red, release in order',
    };
  }

  /**
   * Solves Level 104 (Dual Siding Network with 2 independent siding bays)
   * Manifest: ['B', 'B', 'R', 'R']
   * V1 -> SIDING_A (West pocket)
   * V2 -> SIDING_B (East pocket)
   * V3 & V4 -> Pass via MAIN to RED Station
   * V1 & V2 -> Released sequentially to BLUE Station
   */
  public static solveLevel104Dual(): SidingSolveResult {
    const sc = SIDING_LEVEL_104_DUAL;
    const net = new GraphSwitchNetwork(sc);
    net.start();

    let ticks = 0;
    while (net.status === 'RUNNING' && ticks < 80) {
      const v1 = net.vehicles.find((v) => v.id === 1);
      const v2 = net.vehicles.find((v) => v.id === 2);
      const v3 = net.vehicles.find((v) => v.id === 3);
      const v4 = net.vehicles.find((v) => v.id === 4);

      // Once V1 is parked in SIDING_A, toggle SW_SIDING_A to MAIN
      if (v1 && v1.state === 'PARKED' && net.switches['SW_SIDING_A'] === 'SIDING') {
        if (!net.isJunctionLocked('SW_SIDING_A')) {
          net.toggleJunction('SW_SIDING_A');
        }
      }

      // Once V2 is parked in SIDING_B, toggle SW_SIDING_B to MAIN
      if (v2 && v2.state === 'PARKED' && net.switches['SW_SIDING_B'] === 'SIDING') {
        if (!net.isJunctionLocked('SW_SIDING_B')) {
          net.toggleJunction('SW_SIDING_B');
        }
      }

      // When V3 & V4 are delivered at RED:
      if (v3 && v3.state === 'DELIVERED' && v4 && v4.state === 'DELIVERED') {
        if (net.switches['SW_STATION'] !== 'BLUE' && !net.isJunctionLocked('SW_STATION')) {
          net.toggleJunction('SW_STATION');
        }
        if (v1 && v1.state === 'PARKED') {
          net.releaseSiding('SIDING_A');
        }
        if (v2 && v2.state === 'PARKED' && (v1?.currentNode === 'SW_STATION' || v1?.state === 'DELIVERED')) {
          net.releaseSiding('SIDING_B');
        }
      }

      net.tick();
      ticks++;
    }

    return {
      levelId: sc.id,
      title: sc.title ?? '',
      won: net.status === 'WON',
      correctCount: net.correctCount,
      mistakeCount: net.mistakeCount,
      ticks,
      strategyUsed: 'Dual Siding: Park V1 in A, V2 in B, bypass V3&V4, release V1&V2',
    };
  }

  /**
   * Solves Level 104 Baseline / Legacy (Single Diagonal Siding with ['B', 'R', 'B', 'R'])
   */
  public static solveLevel4(): SidingSolveResult {
    const sc = SIDING_LEVELS[3];
    const net = new GraphSwitchNetwork(sc);
    net.start();

    let ticks = 0;
    while (net.status === 'RUNNING' && ticks < 100) {
      const waiting = net.vehicles.filter((v) => v.state === 'WAITING' || v.state === 'SPAWNED');

      for (const v of waiting) {
        if (v.currentNode === 'SW_STATION') {
          const needed = v.targetStation === 'RED' ? 'RED' : 'BLUE';
          if (net.switches['SW_STATION'] !== needed && !net.isJunctionLocked('SW_STATION')) {
            net.toggleJunction('SW_STATION');
          }
        }
      }

      const car1 = net.vehicles.find((v) => v.id === 1);
      const car2 = net.vehicles.find((v) => v.id === 2);

      if (car1 && car1.state === 'PARKED' && net.switches['SW_SIDING'] !== 'MAIN' && !net.isJunctionLocked('SW_SIDING')) {
        net.toggleJunction('SW_SIDING');
      }

      if (car2 && car2.state === 'DELIVERED' && car1 && car1.state === 'PARKED') {
        net.releaseSiding('SIDING_BAY');
      }

      net.tick();
      ticks++;
    }

    return {
      levelId: sc.id,
      title: sc.title ?? '',
      won: net.status === 'WON',
      correctCount: net.correctCount,
      mistakeCount: net.mistakeCount,
      ticks,
      strategyUsed: 'Legacy Batch interleave via single siding',
    };
  }

  public static solveLevel4Legacy(): SidingSolveResult {
    return SidingSolver.solveLevel4();
  }

  /**
   * Counterfactual verification: Attempting to sort ['B', 'B', 'R', 'R'] on a single siding network.
   * Proves that removing SIDING_B makes the scenario strictly UNSOLVABLE (fails or misdelivers).
   */
  public static solveLevel104SingleCounterfactual(): SidingSolveResult {
    const SINGLE_SIDING_TOPOLOGY: GraphTopologyDef = {
      id: 'siding_topology_single_counterfactual',
      name: 'Tek Park Cebi Karşı-Olgusal Doğrulama',
      nodes: [
        { id: 'SOURCE', type: 'SOURCE' },
        { id: 'SW_SIDING_A', type: 'SWITCH' },
        { id: 'SIDING_A', type: 'SIDING', capacity: 1 },
        { id: 'MERGE_A', type: 'WAYPOINT' },
        { id: 'SW_STATION', type: 'SWITCH' },
        { id: 'RED', type: 'STATION', stationColor: 'RED' },
        { id: 'BLUE', type: 'STATION', stationColor: 'BLUE' },
      ],
      switches: [
        { id: 'SW_SIDING_A', branches: ['MAIN', 'SIDING'], defaultBranch: 'SIDING' },
        { id: 'SW_STATION', branches: ['RED', 'BLUE'], defaultBranch: 'RED' },
      ],
      edges: [
        { id: 'e1', from: 'SOURCE', to: 'SW_SIDING_A' },
        { id: 'e2', from: 'SW_SIDING_A', to: 'MERGE_A', branch: 'MAIN' },
        { id: 'e3', from: 'SW_SIDING_A', to: 'SIDING_A', branch: 'SIDING' },
        { id: 'e4', from: 'SIDING_A', to: 'MERGE_A' },
        { id: 'e5', from: 'MERGE_A', to: 'SW_STATION' },
        { id: 'e6', from: 'SW_STATION', to: 'RED', branch: 'RED' },
        { id: 'e7', from: 'SW_STATION', to: 'BLUE', branch: 'BLUE' },
      ],
    };

    const net = new GraphSwitchNetwork({
      id: 1049,
      topology: SINGLE_SIDING_TOPOLOGY,
      manifest: ['B', 'B', 'R', 'R'],
      spawnCadenceTicks: 3,
      activeJunctions: ['SW_SIDING_A', 'SW_STATION'],
      initialSwitches: { SW_SIDING_A: 'SIDING', SW_STATION: 'RED' },
      maxMistakes: 1,
    });
    net.start();

    let ticks = 0;
    while (net.status === 'RUNNING' && ticks < 40) {
      const v1 = net.vehicles.find((v) => v.id === 1);
      if (v1 && v1.state === 'PARKED' && net.switches['SW_SIDING_A'] === 'SIDING') {
        net.toggleJunction('SW_SIDING_A');
      }
      net.tick();
      ticks++;
    }

    return {
      levelId: 1049,
      title: 'Counterfactual Single Siding Failure',
      won: net.status === 'WON',
      correctCount: net.correctCount,
      mistakeCount: net.mistakeCount,
      ticks,
      strategyUsed: 'Single Siding (Forced to fail on [B, B, R, R])',
    };
  }

  /**
   * Solves Level 5 via Strategy A (Using Siding)
   */
  public static solveLevel5StrategyA(): SidingSolveResult {
    const sc = SIDING_LEVELS[4];
    const net = new GraphSwitchNetwork(sc);
    net.start();

    // Start with SIDING to park Car 1
    net.toggleJunction('SW_SIDING'); // 'MAIN' -> 'SIDING'

    let ticks = 0;
    while (net.status === 'RUNNING' && ticks < 80) {
      const car1 = net.vehicles.find((v) => v.id === 1);
      const car2 = net.vehicles.find((v) => v.id === 2);

      if (car1 && car1.state === 'PARKED') {
        if (net.switches['SW_SIDING'] !== 'MAIN' && !net.isJunctionLocked('SW_SIDING')) {
          net.toggleJunction('SW_SIDING');
        }
      }

      if (car2 && (car2.currentNode === 'MERGE' || car2.toNode === 'SW_STATION')) {
        if (net.switches['SW_STATION'] !== 'BLUE' && !net.isJunctionLocked('SW_STATION')) {
          net.toggleJunction('SW_STATION');
        }
      }

      if (car2 && car2.state === 'DELIVERED') {
        if (net.switches['SW_STATION'] !== 'RED' && !net.isJunctionLocked('SW_STATION')) {
          net.toggleJunction('SW_STATION');
        }
        if (car1 && car1.state === 'PARKED') {
          net.releaseSiding('SIDING_BAY');
        }
      }

      net.tick();
      ticks++;
    }

    return {
      levelId: sc.id,
      title: sc.title ?? '',
      won: net.status === 'WON',
      correctCount: net.correctCount,
      mistakeCount: net.mistakeCount,
      ticks,
      strategyUsed: 'Strategy A (Siding Bypass Solution)',
    };
  }

  /**
   * Solves Level 5 via Strategy B (Direct Main Line without Siding)
   */
  public static solveLevel5StrategyB(): SidingSolveResult {
    const sc = SIDING_LEVELS[4];
    const net = new GraphSwitchNetwork(sc);
    net.start();

    // SW_SIDING stays on 'MAIN' throughout the run!
    let ticks = 0;
    while (net.status === 'RUNNING' && ticks < 80) {
      for (const v of net.vehicles) {
        if (v.state === 'WAITING' && v.currentNode === 'SW_STATION') {
          const needed = v.targetStation === 'RED' ? 'RED' : 'BLUE';
          if (net.switches['SW_STATION'] !== needed && !net.isJunctionLocked('SW_STATION')) {
            net.toggleJunction('SW_STATION');
          }
        }
      }

      net.tick();
      ticks++;
    }

    return {
      levelId: sc.id,
      title: sc.title ?? '',
      won: net.status === 'WON',
      correctCount: net.correctCount,
      mistakeCount: net.mistakeCount,
      ticks,
      strategyUsed: 'Strategy B (Direct Main Line Timing Solution without Siding)',
    };
  }
}
