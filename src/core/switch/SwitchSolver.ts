import { SwitchNetwork, FIXED_SCENARIOS } from './SwitchNetwork';
import { ScenarioDefinition } from './SwitchTypes';
import { PROGRESSIVE_LEVELS } from './SwitchLevels';

export interface SolverScenarioResult {
  scenarioId: number;
  totalVehicles: number;
  correctCount: number;
  mistakeCount: number;
  won: boolean;
  ticksTotal: number;
}

export class SwitchSolver {
  /**
   * Simulates an omniscient switch controller that operates the switches
   * at the exact moments needed to deliver 100% of vehicles to their correct stations.
   */
  public static solveScenario(scenario: number | ScenarioDefinition): SolverScenarioResult {
    const network = new SwitchNetwork(scenario);
    network.start();

    const sc = typeof scenario === 'number'
      ? FIXED_SCENARIOS.find((s) => s.id === scenario)!
      : scenario;
    const totalVehicles = sc.manifest.length;

    let ticks = 0;
    const MAX_TICKS = 200;

    while (network.status === 'RUNNING' && ticks < MAX_TICKS) {
      // Omniscient decision:
      // Look at vehicles waiting at J1, J2, J3 and configure the switch to match their target!
      for (const v of network.vehicles) {
        if (v.state === 'WAITING' || v.state === 'SPAWNED') {
          if (v.currentNode === 'J1') {
            // If target is RED or BLUE -> J1 needs LEFT
            // If target is GREEN or YELLOW -> J1 needs RIGHT
            const needsLeft = v.targetStation === 'RED' || v.targetStation === 'BLUE';
            if (needsLeft && network.j1 !== 'LEFT') {
              network.toggleJunction('J1');
            } else if (!needsLeft && network.j1 !== 'RIGHT') {
              network.toggleJunction('J1');
            }
          } else if (v.currentNode === 'J2') {
            const needsRed = v.targetStation === 'RED';
            if (needsRed && network.j2 !== 'RED') {
              network.toggleJunction('J2');
            } else if (!needsRed && network.j2 !== 'BLUE') {
              network.toggleJunction('J2');
            }
          } else if (v.currentNode === 'J3') {
            const needsGreen = v.targetStation === 'GREEN';
            if (needsGreen && network.j3 !== 'GREEN') {
              network.toggleJunction('J3');
            } else if (!needsGreen && network.j3 !== 'YELLOW') {
              network.toggleJunction('J3');
            }
          }
        }
      }

      network.tick();
      ticks++;
    }

    return {
      scenarioId: sc.id,
      totalVehicles,
      correctCount: network.correctCount,
      mistakeCount: network.mistakeCount,
      won: network.status === 'WON' && network.correctCount === totalVehicles,
      ticksTotal: ticks,
    };
  }

  public static verifyAllScenarios(): SolverScenarioResult[] {
    return FIXED_SCENARIOS.map((s) => SwitchSolver.solveScenario(s.id));
  }

  public static verifyProgressiveLevels(): SolverScenarioResult[] {
    return PROGRESSIVE_LEVELS.map((s) => SwitchSolver.solveScenario(s));
  }
}
