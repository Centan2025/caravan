import { GameMode, FailureReason, TelemetryEvent } from '../types';

export class TelemetryService {
  private static instance: TelemetryService;
  private sessionId: string;
  private sessionStartTime: number;
  private events: TelemetryEvent[] = [];
  private firstInteractionLogged: boolean = false;

  private constructor() {
    this.sessionStartTime = Date.now();
    this.sessionId = this.getOrCreateSessionId();
    this.logEvent('SESSION_START', 'B', 1, {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'node',
      screen:
        typeof window !== 'undefined'
          ? `${window.innerWidth}x${window.innerHeight}`
          : 'unknown',
    });
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  private getOrCreateSessionId(): string {
    const key = 'caravan_telemetry_session_id';
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const newId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(key, newId);
      return newId;
    }
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public logFirstInteraction(mode: GameMode, levelId: number): void {
    if (this.firstInteractionLogged) return;
    this.firstInteractionLogged = true;
    const msSinceStart = Date.now() - this.sessionStartTime;
    this.logEvent('FIRST_INTERACTION', mode, levelId, {
      timeToFirstInteractionMs: msSinceStart,
    });
  }

  public logEvent(
    eventType: TelemetryEvent['eventType'],
    mode: GameMode,
    levelId: number,
    data: Record<string, any> = {}
  ): TelemetryEvent {
    const now = Date.now();
    const event: TelemetryEvent = {
      id: `evt_${this.events.length + 1}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId: this.sessionId,
      timestamp: now,
      timeSinceSessionStartMs: now - this.sessionStartTime,
      eventType,
      mode,
      levelId,
      data,
    };
    this.events.push(event);

    // Save latest in localStorage for resilience
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('caravan_telemetry_events', JSON.stringify(this.events));
      } catch {
        // LocalStorage quota may be reached in heavy testing
      }
    }

    return event;
  }

  public getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  public clearEvents(): void {
    this.events = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('caravan_telemetry_events');
    }
  }

  public exportJson(): string {
    const summary = this.generateSummary();
    return JSON.stringify(
      {
        sessionId: this.sessionId,
        exportedAt: new Date().toISOString(),
        summary,
        events: this.events,
      },
      null,
      2
    );
  }

  public downloadJson(): void {
    if (typeof window === 'undefined') return;
    const jsonStr = this.exportJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caravan_telemetry_${this.sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public generateSummary() {
    const totalEvents = this.events.length;
    const firstInteractionEvent = this.events.find(
      (e) => e.eventType === 'FIRST_INTERACTION'
    );
    const timeToFirstInteractionMs = firstInteractionEvent
      ? firstInteractionEvent.data.timeToFirstInteractionMs
      : null;

    let modeBStarts = 0;
    let modeCStarts = 0;
    let modeBCompletes = 0;
    let modeCCompletes = 0;
    let modeBFails = 0;
    let modeCFails = 0;
    let totalRetries = 0;

    const failureReasons: Record<FailureReason | string, number> = {
      DEAD_END: 0,
      DISCONNECTED: 0,
      WRONG_STOP_ORDER: 0,
      CLOSED_LOOP: 0,
      OUT_OF_BOUNDS: 0,
    };

    const levelStats: Record<
      number,
      { attempts: number; completions: number; fails: number; retries: number }
    > = {};

    for (const e of this.events) {
      if (!levelStats[e.levelId]) {
        levelStats[e.levelId] = {
          attempts: 0,
          completions: 0,
          fails: 0,
          retries: 0,
        };
      }

      if (e.eventType === 'LEVEL_START') {
        levelStats[e.levelId].attempts++;
        if (e.mode === 'B') modeBStarts++;
        else modeCStarts++;
      } else if (e.eventType === 'LEVEL_COMPLETED') {
        levelStats[e.levelId].completions++;
        if (e.mode === 'B') modeBCompletes++;
        else modeCCompletes++;
      } else if (e.eventType === 'LEVEL_FAILED') {
        levelStats[e.levelId].fails++;
        if (e.mode === 'B') modeBFails++;
        else modeCFails++;
        const reason = e.data.reason as FailureReason;
        if (reason && failureReasons[reason] !== undefined) {
          failureReasons[reason]++;
        }
      } else if (e.eventType === 'LEVEL_RETRY') {
        totalRetries++;
        levelStats[e.levelId].retries++;
      }
    }

    return {
      sessionId: this.sessionId,
      totalEvents,
      timeToFirstInteractionMs,
      modeB: {
        starts: modeBStarts,
        completes: modeBCompletes,
        fails: modeBFails,
        completionRate:
          modeBStarts > 0 ? (modeBCompletes / modeBStarts) * 100 : 0,
      },
      modeC: {
        starts: modeCStarts,
        completes: modeCCompletes,
        fails: modeCFails,
        completionRate:
          modeCStarts > 0 ? (modeCCompletes / modeCStarts) * 100 : 0,
      },
      totalRetries,
      failureReasons,
      levelStats,
    };
  }
}
