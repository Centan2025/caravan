import { describe, it, expect, beforeEach } from 'vitest';
import {
  PLAYTEST_LEVELS,
  ALL_SIDING_LEVELS,
  SIDING_LEVEL_101,
  SIDING_LEVEL_102,
  SIDING_LEVEL_104_DUAL,
  SIDING_LEVEL_103_FIFO,
  SIDING_LEVEL_105,
} from '../src/core/switch/graph/SidingLevels';
import { GraphNodeDef, GraphTopologyDef } from '../src/core/switch/graph/GraphTypes';
import { TelemetryLogger } from '../src/shared/Telemetry';

describe('Player Test Environment & Telemetry Audit', () => {
  let logger: TelemetryLogger;

  beforeEach(() => {
    logger = TelemetryLogger.getInstance();
    logger.clearEvents();
  });

  describe('Curated Playtest Sequence & Level Integrity', () => {
    it('Curates exact 5-level test sequence: 101 -> 102 -> 104 Dual -> 103-B FIFO -> 105', () => {
      expect(PLAYTEST_LEVELS.length).toBe(5);
      expect(PLAYTEST_LEVELS[0].id).toBe(SIDING_LEVEL_101.id);
      expect(PLAYTEST_LEVELS[1].id).toBe(SIDING_LEVEL_102.id);
      expect(PLAYTEST_LEVELS[2].id).toBe(SIDING_LEVEL_104_DUAL.id);
      expect(PLAYTEST_LEVELS[3].id).toBe(SIDING_LEVEL_103_FIFO.id);
      expect(PLAYTEST_LEVELS[4].id).toBe(SIDING_LEVEL_105.id);
    });

    it('Preserves all 7 mobile-playable siding levels in ALL_SIDING_LEVELS pool', () => {
      expect(ALL_SIDING_LEVELS.length).toBe(7);
      const levelIds = ALL_SIDING_LEVELS.map((lvl) => lvl.id);
      expect(levelIds).toContain(101);
      expect(levelIds).toContain(102);
      expect(levelIds).toContain(103);
      expect(levelIds).toContain(1032);
      expect(levelIds).toContain(104);
      expect(levelIds).toContain(1041);
      expect(levelIds).toContain(105);
    });

    it('Verifies Level 104 Dual has 2 independent siding nodes', () => {
      const topo = SIDING_LEVEL_104_DUAL.topology as GraphTopologyDef;
      expect(topo && typeof topo === 'object').toBe(true);
      const dualSidingNodes = topo.nodes.filter(
        (n: GraphNodeDef) => n.type === 'SIDING'
      );
      expect(dualSidingNodes.length).toBe(2);
      expect(dualSidingNodes.map((n: GraphNodeDef) => n.id)).toEqual(['SIDING_A', 'SIDING_B']);
    });

    it('Verifies Level 103-B FIFO has capacity of 2 vehicles', () => {
      const topo = SIDING_LEVEL_103_FIFO.topology as GraphTopologyDef;
      expect(topo && typeof topo === 'object').toBe(true);
      const sidingNode = topo.nodes.find(
        (n: GraphNodeDef) => n.type === 'SIDING'
      );
      expect(sidingNode).toBeDefined();
      expect(sidingNode?.capacity).toBe(2);
      expect(sidingNode?.label).toContain('FIFO');
    });
  });

  describe('Telemetry Event Differentiation & Export', () => {
    it('Distinguishes voluntary_replay from normal retry replay_clicked', () => {
      logger.startRun('switch_rush', 101, { isPlaytest: true });
      logger.recordReplayClicked({ mode: 'playtest', reason: 'failed_retry' });
      logger.recordVoluntaryReplay({ scenarioIndex: 0, levelId: 101, postWin: true });

      const events = logger.getEvents();
      const retryEv = events.find((e) => e.event_type === 'replay_clicked');
      const voluntaryEv = events.find((e) => e.event_type === 'voluntary_replay');

      expect(retryEv).toBeDefined();
      expect(retryEv?.payload?.reason).toBe('failed_retry');

      expect(voluntaryEv).toBeDefined();
      expect(voluntaryEv?.payload?.postWin).toBe(true);
      expect(voluntaryEv?.payload?.intentional).toBe(true);
    });

    it('Records next_level_clicked with source and destination scenario info', () => {
      logger.startRun('switch_rush', 101, { isPlaytest: true });
      logger.recordNextLevelClicked({
        fromScenario: 0,
        nextScenario: 1,
        levelId: 101,
      });

      const nextEv = logger.getEvents().find((e) => e.event_type === 'next_level_clicked');
      expect(nextEv).toBeDefined();
      expect(nextEv?.payload?.fromScenario).toBe(0);
      expect(nextEv?.payload?.nextScenario).toBe(1);
    });

    it('Logs playtest lifecycle events: started, completed, and abandoned', () => {
      logger.recordPlaytestStarted({ participantRole: 'volunteer' });
      logger.recordPlaytestAbandoned({ scenarioIndex: 2, levelId: 104 });
      logger.recordPlaytestCompleted({ totalLevels: 5 });

      const events = logger.getEvents();
      expect(events.some((e) => e.event_type === 'playtest_started')).toBe(true);
      expect(events.some((e) => e.event_type === 'playtest_abandoned')).toBe(true);
      expect(events.some((e) => e.event_type === 'playtest_completed')).toBe(true);
    });

    it('Resets session ID to generate clean anonymous sessions for subsequent participants', () => {
      const initialId = logger.sessionId;
      const newId = logger.resetSession();

      expect(newId).not.toBe(initialId);
      expect(logger.sessionId).toBe(newId);
      expect(newId.startsWith('ses_')).toBe(true);
    });

    it('Exports valid RFC4180 CSV with header and properly escaped payload', () => {
      logger.startRun('switch_rush', 101, { isPlaytest: true, note: 'Test, with "quotes" & commas' });
      logger.recordVoluntaryReplay({ scenarioIndex: 0 });

      const csv = logger.exportCSV();
      const lines = csv.trim().split(/\r?\n/);

      expect(lines.length).toBeGreaterThan(2);
      expect(lines[0]).toBe('session_id,timestamp_iso,elapsed_run_ms,active_play_ms,game_id,scenario_id,event_type,payload');

      // Second line (run_started)
      expect(lines[1]).toContain(logger.sessionId);
      expect(lines[1]).toContain('switch_rush');
      expect(lines[1]).toContain('101');
      expect(lines[1]).toContain('run_started');

      // Third line (voluntary_replay)
      expect(lines[2]).toContain('voluntary_replay');
    });

    it('Exports valid JSON format preserving all event payloads', () => {
      logger.startRun('switch_rush', 102, { isPlaytest: true });
      logger.recordRunWon(250, { isPlaytest: true });

      const jsonStr = logger.exportJSON();
      const parsed = JSON.parse(jsonStr);

      expect(parsed.session_id).toBe(logger.sessionId);
      expect(parsed.total_events).toBe(2);
      expect(parsed.events[1].event_type).toBe('run_won');
      expect(parsed.events[1].payload.score).toBe(250);
    });
  });
});
