import { describe, it, expect, beforeEach } from 'vitest';
import { TelemetryLogger } from '../src/shared/Telemetry';

describe('TelemetryLogger', () => {
  let logger: TelemetryLogger;

  beforeEach(() => {
    logger = TelemetryLogger.getInstance();
    logger.clearEvents();
  });

  it('Generates a non-empty anonymous session id', () => {
    expect(logger.sessionId).toBeDefined();
    expect(typeof logger.sessionId).toBe('string');
    expect(logger.sessionId.length).toBeGreaterThan(5);
  });

  it('Logs run_started, valid_move, and tracks first_tap automatically', () => {
    logger.startRun('chain_domino', 1);
    expect(logger.getEvents().length).toBe(1);
    expect(logger.getEvents()[0].event_type).toBe('run_started');

    logger.recordValidMove({ x: 4, y: 4 });
    const events = logger.getEvents();
    // Should have auto-recorded first_tap then valid_move
    expect(events.length).toBe(3);
    expect(events[1].event_type).toBe('first_tap');
    expect(events[2].event_type).toBe('valid_move');
  });

  it('Records invalid_tap without spending valid move', () => {
    logger.startRun('switch_rush', 1);
    logger.recordInvalidTap('junction_locked', { junction: 'J1' });

    const events = logger.getEvents();
    expect(events.some((e) => e.event_type === 'invalid_tap')).toBe(true);
  });

  it('Exports valid JSON with session_id and event log', () => {
    logger.startRun('chain_domino', 2);
    logger.recordGoalHit(0, 1);
    logger.recordRunWon(130);

    const json = logger.exportJSON();
    const parsed = JSON.parse(json);

    expect(parsed.session_id).toBe(logger.sessionId);
    expect(Array.isArray(parsed.events)).toBe(true);
    expect(parsed.events.length).toBeGreaterThan(0);
  });

  it('Logs replay_clicked and exit_clicked with intentional flag', () => {
    logger.startRun('chain_domino', 1);
    logger.recordReplayClicked();
    logger.recordExitClicked();

    const replayEvent = logger.getEvents().find((e) => e.event_type === 'replay_clicked');
    const exitEvent = logger.getEvents().find((e) => e.event_type === 'exit_clicked');

    expect(replayEvent).toBeDefined();
    expect(replayEvent?.payload?.intentional).toBe(true);
    expect(exitEvent).toBeDefined();
  });
});
