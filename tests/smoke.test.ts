import { describe, it, expect, beforeEach } from 'vitest';
import { ChainBoard } from '../src/core/chain/ChainBoard';
import { CHAIN_LEVELS } from '../src/core/chain/ChainLevels';
import { SwitchNetwork } from '../src/core/switch/SwitchNetwork';
import { PROGRESSIVE_LEVELS } from '../src/core/switch/SwitchLevels';
import { TelemetryLogger } from '../src/shared/Telemetry';

describe('Integration & Smoke Tests (Mobile Gameplay & Telemetry)', () => {
  let telemetry: TelemetryLogger;

  beforeEach(() => {
    telemetry = TelemetryLogger.getInstance();
    telemetry.clearEvents();
  });

  describe('Chain Domino End-to-End Flow', () => {
    it('Simulates complete gameplay of Level 1 from tap to win with telemetry', () => {
      telemetry.startRun('chain_domino', 1);

      const board = new ChainBoard(CHAIN_LEVELS[0]);
      expect(board.status).toBe('IDLE');
      expect(board.ignitionsLeft).toBe(1);

      // Verify ineligible taps fail cleanly without consuming moves
      expect(board.isEligibleTap(0, 0)).toBe(false); // '.' empty
      telemetry.recordInvalidTap('ineligible_cell', { x: 0, y: 0 });

      // Valid tap on (4, 4)
      expect(board.isEligibleTap(4, 4)).toBe(true);
      const result = board.ignite(4, 4);

      telemetry.recordValidMove({ x: 4, y: 4 });
      expect(result.valid).toBe(true);
      expect(board.status).toBe('WON');
      expect(board.collectedGoals).toBe(1);
      // Level 1 maxIgnitions is 1, using 1 ignition leaves 0 unused: 100 * 1 + 30 * 0 = 100
      expect(board.score).toBe(100);

      telemetry.recordGoalHit(0, 1);
      telemetry.recordRunWon(board.score);

      // Verify voluntary replay button logs replay_clicked
      telemetry.recordReplayClicked();

      const events = telemetry.getEvents();
      expect(events.map((e) => e.event_type)).toEqual([
        'run_started',
        'first_tap',
        'invalid_tap',
        'valid_move',
        'goal_hit',
        'run_won',
        'replay_clicked',
      ]);
    });
  });

  describe('Switch Rush End-to-End Flow', () => {
    it('Simulates complete gameplay of Scenario 1 with junction toggles and victory', () => {
      telemetry.startRun('switch_rush', 1);

      const net = new SwitchNetwork(1); // Manifest: R, B, R, B, R, B
      net.start();

      // Vehicle 1 is R. Default route: J1=LEFT (to J2), J2=RED (to RED). Target is RED.
      // Vehicle 2 is B. Must go to BLUE!
      
      // Tick 1: Car 1 spawns at SOURCE
      net.tick();
      expect(net.vehicles.length).toBe(1);

      // Tick 2: Car 1 departs SOURCE -> J1
      net.tick();
      // Tick 3: Car 1 arrives at J1; Car 2 spawns at SOURCE
      net.tick();
      expect(net.vehicles.length).toBe(2);

      // Tick 4: Car 1 departs J1 -> J2; Car 2 departs SOURCE -> J1
      net.tick();
      // Tick 5: Car 1 arrives at J2; Car 2 arrives at J1; Car 3 spawns at SOURCE
      net.tick();

      // Tick 6: Car 1 departs J2 -> RED; Car 2 departs J1 -> J2
      net.tick();

      // Tick 7: Car 1 arrives at RED (Delivery 1)! Car 2 arrives at J2 (WAITING at J2).
      net.tick();
      expect(net.correctCount).toBe(1);
      telemetry.recordVehicleDelivered(1, 'RED', net.currentStreak);

      // While Car 2 is waiting at J2, toggle J2 to BLUE!
      const toggled = net.toggleJunction('J2');
      expect(toggled).toBe(true);
      expect(net.j2).toBe('BLUE');
      telemetry.recordValidMove({ junction: 'J2', newState: 'BLUE' });

      // Tick 8: Car 2 departs J2 -> BLUE!
      net.tick();
      // Tick 9: Car 2 arrives at BLUE (Delivery 2)!
      net.tick();
      expect(net.correctCount).toBe(2);
      telemetry.recordVehicleDelivered(2, 'BLUE', net.currentStreak);

      const jsonExport = telemetry.exportJSON();
      expect(jsonExport).toContain('switch_rush');
      expect(jsonExport).toContain('vehicle_delivered');
    });

    it('Simulates Switch Rush 2.0 Level 1 Suburb onboarding flow with single vehicle and telemetry', () => {
      telemetry.startRun('switch_rush', 1, {
        submode: '2.0',
        district: 'suburb',
        levelFamily: 'learning',
      });

      const net = new SwitchNetwork(PROGRESSIVE_LEVELS[0]);
      expect(net.district).toBe('suburb');
      expect(net.levelFamily).toBe('learning');
      expect(net.maxConcurrentVehicles).toBe(1);
      expect(net.tickDurationMs).toBe(1000);
      expect(net.manifest).toEqual(['B']);

      net.start();
      // Tick 1: vehicle 'B' spawns at SOURCE
      net.tick();
      expect(net.vehicles.length).toBe(1);
      expect(net.getActiveVehicleCount()).toBe(1);

      // Tick 2: departs SOURCE -> J1
      net.tick();
      // Tick 3: arrives at J1
      net.tick();
      // Tick 4: departs J1 -> J2
      net.tick();
      // Tick 5: arrives at J2 (WAITING at J2).
      net.tick();

      // Toggle J2 to BLUE!
      expect(net.j2).toBe('RED');
      const toggled = net.toggleJunction('J2');
      expect(toggled).toBe(true);
      expect(net.j2).toBe('BLUE');
      telemetry.recordValidMove({ junction: 'J2', newState: 'BLUE' });

      // Tick 6: departs J2 -> BLUE
      net.tick();
      // Tick 7: arrives at BLUE and wins!
      net.tick();
      expect(net.status).toBe('WON');
      expect(net.correctCount).toBe(1);
      expect(net.mistakeCount).toBe(0);

      telemetry.recordVehicleDelivered(1, 'BLUE', 1);
      telemetry.recordRunWon(net.score, { submode: '2.0', district: 'suburb', level: 1 });

      const events = telemetry.getEvents();
      expect(events.some((e) => e.payload?.submode === '2.0')).toBe(true);
      expect(events.some((e) => e.event_type === 'run_won')).toBe(true);
    });
  });

  describe('Game Level Switching Isolation', () => {
    it('Ensures level transitions instantiate independent boards without side effects', () => {
      const boardLvl1 = new ChainBoard(CHAIN_LEVELS[0]);
      const boardLvl2 = new ChainBoard(CHAIN_LEVELS[1]);

      expect(boardLvl1.goalsTotal).toBe(1);
      expect(boardLvl1.maxIgnitions).toBe(1);

      expect(boardLvl2.goalsTotal).toBe(1);
      expect(boardLvl2.maxIgnitions).toBe(1);

      // Switching to level 2 does not mutate level 1
      boardLvl2.ignite(0, 0);
      expect(boardLvl2.ignitionsUsed).toBe(1);
      expect(boardLvl1.ignitionsUsed).toBe(0);
      expect(boardLvl1.status).toBe('IDLE');

      // Switch Rush scenario isolation
      const netSc1 = new SwitchNetwork(1);
      const netSc2 = new SwitchNetwork(2);

      expect(netSc1.manifest).toEqual(['R', 'B', 'R', 'B', 'R', 'B']);
      expect(netSc2.manifest).toEqual(['G', 'Y', 'G', 'Y', 'G', 'Y']);

      netSc1.start();
      netSc1.tick();
      expect(netSc1.vehicles.length).toBe(1);
      expect(netSc2.vehicles.length).toBe(0);
      expect(netSc2.status).toBe('READY');
    });
  });
});
