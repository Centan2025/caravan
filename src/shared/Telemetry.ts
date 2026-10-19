export type GameId = 'chain_domino' | 'switch_rush' | 'caravan_b' | 'caravan_c';

export type TelemetryEventType =
  | 'run_started'
  | 'first_tap'
  | 'valid_move'
  | 'invalid_tap'
  | 'goal_hit'
  | 'vehicle_delivered'
  | 'vehicle_misdelivered'
  | 'run_won'
  | 'run_lost'
  | 'replay_clicked'
  | 'voluntary_replay'
  | 'next_level_clicked'
  | 'playtest_started'
  | 'playtest_completed'
  | 'playtest_abandoned'
  | 'exit_clicked'
  | 'help_opened'
  | 'app_blurred'
  | 'runtime_error';

export interface TelemetryEvent {
  session_id: string;
  game_id: GameId;
  scenario_id: number;
  timestamp: number;
  elapsed_run_ms: number;
  active_play_ms: number;
  event_type: TelemetryEventType;
  payload?: Record<string, any>;
}

export interface RunSummary {
  runId: string;
  game_id: GameId;
  scenario_id: number;
  startTime: number;
  endTime?: number;
  timeToFirstTapMs?: number;
  activePlayMs: number;
  outcome?: 'WON' | 'LOST' | 'ABANDONED';
  validTaps: number;
  invalidTaps: number;
  voluntaryRestarts: number;
  score?: number;
}

export class TelemetryLogger {
  private static instance: TelemetryLogger;
  public sessionId: string;
  private events: TelemetryEvent[] = [];
  
  // Current active run state
  private currentRun: {
    runId: string;
    gameId: GameId;
    scenarioId: number;
    runStartMonotonic: number;
    runStartWallClock: number;
    firstTapOccurred: boolean;
    validTaps: number;
    invalidTaps: number;
    isBlurred: boolean;
    blurStartTime: number;
    totalPausedTimeMs: number;
    isComplete: boolean;
  } | null = null;

  private constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.setupVisibilityListeners();
  }

  public static getInstance(): TelemetryLogger {
    if (!TelemetryLogger.instance) {
      TelemetryLogger.instance = new TelemetryLogger();
    }
    return TelemetryLogger.instance;
  }

  private getOrCreateSessionId(): string {
    const key = 'telemetry_session_id';
    try {
      let id = localStorage.getItem(key);
      if (!id) {
        id = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return `ses_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  }

  private setupVisibilityListeners(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const onBlur = () => {
      if (this.currentRun && !this.currentRun.isBlurred) {
        this.currentRun.isBlurred = true;
        this.currentRun.blurStartTime = performance.now();
        this.logEvent('app_blurred', { reason: 'window_blur_or_hidden' });
      }
    };

    const onFocus = () => {
      if (this.currentRun && this.currentRun.isBlurred) {
        const pausedDelta = performance.now() - this.currentRun.blurStartTime;
        this.currentRun.totalPausedTimeMs += Math.max(0, pausedDelta);
        this.currentRun.isBlurred = false;
      }
    };

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        onBlur();
      } else {
        onFocus();
      }
    });

    window.addEventListener('error', (event) => {
      this.logEvent('runtime_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
      });
    });
  }

  public startRun(gameId: GameId, scenarioId: number, payload?: Record<string, any>): void {
    // If a run was already open and not completed, mark previous as abandoned
    if (this.currentRun && !this.currentRun.isComplete) {
      this.logEvent('exit_clicked', { reason: 'switched_without_completion' });
    }

    const now = performance.now();
    this.currentRun = {
      runId: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      gameId,
      scenarioId,
      runStartMonotonic: now,
      runStartWallClock: Date.now(),
      firstTapOccurred: false,
      validTaps: 0,
      invalidTaps: 0,
      isBlurred: false,
      blurStartTime: 0,
      totalPausedTimeMs: 0,
      isComplete: false,
    };

    this.logEvent('run_started', payload);
  }

  public recordFirstTapIfNeeded(interactionType: string = 'tap'): void {
    if (this.currentRun && !this.currentRun.firstTapOccurred) {
      this.currentRun.firstTapOccurred = true;
      const elapsed = this.getElapsedRunMs();
      this.logEvent('first_tap', {
        interaction_type: interactionType,
        time_to_first_tap_ms: elapsed,
      });
    }
  }

  public recordValidMove(payload?: Record<string, any>): void {
    if (this.currentRun) {
      this.recordFirstTapIfNeeded('move');
      this.currentRun.validTaps++;
    }
    this.logEvent('valid_move', payload);
  }

  public recordInvalidTap(reason: string, payload?: Record<string, any>): void {
    if (this.currentRun) {
      this.recordFirstTapIfNeeded('invalid_tap');
      this.currentRun.invalidTaps++;
    }
    this.logEvent('invalid_tap', { reason, ...payload });
  }

  public recordGoalHit(goalIndex: number, totalCollected: number): void {
    this.logEvent('goal_hit', { goalIndex, totalCollected });
  }

  public recordVehicleDelivered(vehicleId: number, station: string, streak: number): void {
    this.logEvent('vehicle_delivered', { vehicleId, station, streak });
  }

  public recordVehicleMisdelivered(vehicleId: number, station: string, targetStation: string, mistakes: number): void {
    this.logEvent('vehicle_misdelivered', { vehicleId, station, targetStation, mistakes });
  }

  public recordRunWon(score: number, payload?: Record<string, any>): void {
    if (this.currentRun) {
      this.currentRun.isComplete = true;
    }
    this.logEvent('run_won', { score, ...payload });
  }

  public recordRunLost(reason: string, score?: number, payload?: Record<string, any>): void {
    if (this.currentRun) {
      this.currentRun.isComplete = true;
    }
    this.logEvent('run_lost', { reason, score, ...payload });
  }

  public recordReplayClicked(payload?: Record<string, any>): void {
    this.logEvent('replay_clicked', { intentional: true, ...payload });
  }

  public recordExitClicked(payload?: Record<string, any>): void {
    this.logEvent('exit_clicked', { intentional: true, ...payload });
    if (this.currentRun) {
      this.currentRun.isComplete = true;
    }
  }

  public recordVoluntaryReplay(payload?: Record<string, any>): void {
    this.logEvent('voluntary_replay', { intentional: true, ...payload });
  }

  public recordNextLevelClicked(payload?: Record<string, any>): void {
    this.logEvent('next_level_clicked', { intentional: true, ...payload });
  }

  public recordPlaytestStarted(payload?: Record<string, any>): void {
    this.logEvent('playtest_started', { ...payload });
  }

  public recordPlaytestCompleted(payload?: Record<string, any>): void {
    this.logEvent('playtest_completed', { ...payload });
  }

  public recordPlaytestAbandoned(payload?: Record<string, any>): void {
    this.logEvent('playtest_abandoned', { intentional: true, ...payload });
  }

  public resetSession(): string {
    const newId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.sessionId = newId;
    try {
      localStorage.setItem('telemetry_session_id', newId);
    } catch {}
    return newId;
  }

  public recordHelpOpened(): void {
    this.logEvent('help_opened');
  }

  public logEvent(eventType: TelemetryEventType, payload?: Record<string, any>): void {
    const gameId = this.currentRun?.gameId || 'chain_domino';
    const scenarioId = this.currentRun?.scenarioId ?? 1;
    const elapsedRun = this.getElapsedRunMs();
    const activePlay = this.getActivePlayMs();

    const ev: TelemetryEvent = {
      session_id: this.sessionId,
      game_id: gameId,
      scenario_id: scenarioId,
      timestamp: Date.now(),
      elapsed_run_ms: elapsedRun,
      active_play_ms: activePlay,
      event_type: eventType,
      payload,
    };

    this.events.push(ev);
    this.persistEventsLocally();
  }

  public getElapsedRunMs(): number {
    if (!this.currentRun) return 0;
    return Math.max(0, performance.now() - this.currentRun.runStartMonotonic);
  }

  public getActivePlayMs(): number {
    if (!this.currentRun) return 0;
    let pausedTime = this.currentRun.totalPausedTimeMs;
    if (this.currentRun.isBlurred) {
      pausedTime += (performance.now() - this.currentRun.blurStartTime);
    }
    const elapsed = performance.now() - this.currentRun.runStartMonotonic;
    return Math.max(0, elapsed - pausedTime);
  }

  public getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  public clearEvents(): void {
    this.events = [];
    this.currentRun = null;
    try {
      localStorage.removeItem('telemetry_events');
    } catch {}
  }

  private persistEventsLocally(): void {
    try {
      // Keep at most 2000 events in localStorage to prevent overflow
      const trimmed = this.events.slice(-2000);
      localStorage.setItem('telemetry_events', JSON.stringify(trimmed));
    } catch {}
  }

  public exportJSON(): string {
    return JSON.stringify(
      {
        session_id: this.sessionId,
        export_time: new Date().toISOString(),
        total_events: this.events.length,
        events: this.events,
      },
      null,
      2
    );
  }

  public downloadJSON(filename: string = `telemetry_${this.sessionId}.json`): void {
    const jsonStr = this.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public exportCSV(): string {
    const headers = [
      'session_id',
      'timestamp_iso',
      'elapsed_run_ms',
      'active_play_ms',
      'game_id',
      'scenario_id',
      'event_type',
      'payload',
    ];

    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;

    const rows = this.events.map((ev) => {
      const iso = new Date(ev.timestamp).toISOString();
      const payloadStr = ev.payload ? JSON.stringify(ev.payload) : '';
      return [
        ev.session_id,
        iso,
        ev.elapsed_run_ms.toFixed(0),
        ev.active_play_ms.toFixed(0),
        ev.game_id,
        ev.scenario_id,
        ev.event_type,
        escapeCsv(payloadStr),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  public downloadCSV(filename: string = `telemetry_${this.sessionId}.csv`): void {
    const csvStr = this.exportCSV();
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
