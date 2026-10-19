import {
  CellData,
  CellType,
  DIR_DELTA,
  GameStatus,
  IgnitionResult,
  LevelDefinition,
  Pulse,
  PulseDirection,
  PulseTickResult,
} from './ChainTypes';

export class ChainBoard {
  public width = 5;
  public height = 5;
  public cells: CellData[][] = [];
  public maxIgnitions = 1;
  public ignitionsUsed = 0;
  public goalsTotal = 0;
  public goalsCollected = 0;
  public status: GameStatus = 'IDLE';

  public get totalGoals(): number {
    return this.goalsTotal;
  }

  public get collectedGoals(): number {
    return this.goalsCollected;
  }

  public get ignitionsLeft(): number {
    return Math.max(0, this.maxIgnitions - this.ignitionsUsed);
  }

  public get score(): number {
    return this.calculateScore();
  }

  public isCellEligibleRelay(x: number, y: number): boolean {
    return this.isEligibleTap(x, y);
  }

  constructor(level?: LevelDefinition) {
    if (level) {
      this.loadLevel(level);
    }
  }

  public loadLevel(level: LevelDefinition): void {
    this.width = 5;
    this.height = 5;
    this.maxIgnitions = level.maxIgnitions;
    this.ignitionsUsed = 0;
    this.goalsTotal = 0;
    this.goalsCollected = 0;
    this.status = 'IDLE';

    this.cells = [];
    for (let y = 0; y < 5; y++) {
      const row: CellData[] = [];
      const rowStr = level.grid[y] || '.....';
      for (let x = 0; x < 5; x++) {
        const char = (rowStr[x] || '.') as CellType;
        if (char === 'G') {
          this.goalsTotal++;
        }
        row.push({
          x,
          y,
          type: char,
          activated: false,
          collected: false,
        });
      }
      this.cells.push(row);
    }
  }

  public clone(): ChainBoard {
    const b = new ChainBoard();
    b.width = this.width;
    b.height = this.height;
    b.maxIgnitions = this.maxIgnitions;
    b.ignitionsUsed = this.ignitionsUsed;
    b.goalsTotal = this.goalsTotal;
    b.goalsCollected = this.goalsCollected;
    b.status = this.status;

    b.cells = this.cells.map((row) =>
      row.map((c) => ({
        x: c.x,
        y: c.y,
        type: c.type,
        activated: c.activated,
        collected: c.collected,
      }))
    );
    return b;
  }

  public getCell(x: number, y: number): CellData | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    return this.cells[y][x];
  }

  public isRelay(type: CellType): boolean {
    return ['U', 'R', 'D', 'L', 'H', 'V'].includes(type);
  }

  public isEligibleTap(x: number, y: number): boolean {
    const cell = this.getCell(x, y);
    if (!cell) return false;
    if (this.status === 'WON' || this.status === 'LOST' || this.status === 'PULSING') {
      return false;
    }
    if (this.ignitionsUsed >= this.maxIgnitions) {
      return false;
    }
    if (!this.isRelay(cell.type)) {
      return false;
    }
    if (cell.activated) {
      return false;
    }
    return true;
  }

  private getEmissionsForRelay(type: CellType): PulseDirection[] {
    switch (type) {
      case 'U':
        return ['UP'];
      case 'R':
        return ['RIGHT'];
      case 'D':
        return ['DOWN'];
      case 'L':
        return ['LEFT'];
      case 'H':
        return ['LEFT', 'RIGHT'];
      case 'V':
        return ['UP', 'DOWN'];
      default:
        return [];
    }
  }

  /**
   * Execute ignition at (x, y). Returns full step-by-step pulse trace.
   */
  public ignite(x: number, y: number): IgnitionResult {
    if (!this.isEligibleTap(x, y)) {
      return {
        valid: false,
        errorMessage: 'Geçersiz dokunuş: Yalnızca tetiklenmemiş röleler ateşlenebilir.',
        ticks: [],
        status: this.status,
        score: this.calculateScore(),
        goalsCollected: this.goalsCollected,
        goalsTotal: this.goalsTotal,
        ignitionsRemaining: this.maxIgnitions - this.ignitionsUsed,
      };
    }

    const startCell = this.getCell(x, y)!;
    startCell.activated = true;
    this.ignitionsUsed++;
    this.status = 'PULSING';

    const ticks: PulseTickResult[] = [];

    // Schedule emissions from start cell for tick 1
    const initialDirs = this.getEmissionsForRelay(startCell.type);
    let currentPulses: Pulse[] = initialDirs.map((dir) => ({ x, y, dir }));

    // Record initial tap activation as Tick 0
    ticks.push({
      tick: 0,
      activePulses: [...currentPulses],
      newlyActivated: [{ x, y, type: startCell.type }],
      goalsCollected: [],
    });

    let tickNum = 1;
    const MAX_TICKS = 100; // Safety guard

    while (currentPulses.length > 0 && tickNum < MAX_TICKS) {
      // 1. Move each pulse 1 cell along its direction
      const nextTargets: Array<{ targetX: number; targetY: number; dir: PulseDirection }> = [];
      for (const p of currentPulses) {
        const delta = DIR_DELTA[p.dir];
        const nextX = p.x + delta.dx;
        const nextY = p.y + delta.dy;

        // Discard if off board
        if (nextX >= 0 && nextX < this.width && nextY >= 0 && nextY < this.height) {
          nextTargets.push({ targetX: nextX, targetY: nextY, dir: p.dir });
        }
      }

      // 2. Group by target cell (x, y) to ensure multiple pulses hitting same cell are processed once
      const targetMap = new Map<string, { x: number; y: number; incomingDirs: PulseDirection[] }>();
      for (const t of nextTargets) {
        const key = `${t.targetX},${t.targetY}`;
        if (!targetMap.has(key)) {
          targetMap.set(key, { x: t.targetX, y: t.targetY, incomingDirs: [] });
        }
        targetMap.get(key)!.incomingDirs.push(t.dir);
      }

      // 3. Sort targets in stable y-then-x order (GDD rule 4)
      const sortedTargets = Array.from(targetMap.values()).sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      });

      const nextPulses: Pulse[] = [];
      const newlyActivated: Array<{ x: number; y: number; type: CellType }> = [];
      const goalsHitThisTick: Array<{ x: number; y: number }> = [];

      for (const target of sortedTargets) {
        const cell = this.getCell(target.x, target.y);
        if (!cell) continue;

        // Wall or Empty absorbs pulse
        if (cell.type === '.' || cell.type === '#') {
          continue;
        }

        // Gold Goal
        if (cell.type === 'G') {
          if (!cell.collected) {
            cell.collected = true;
            cell.activated = true;
            this.goalsCollected++;
            goalsHitThisTick.push({ x: cell.x, y: cell.y });
          }
          // Goal never emits pulses
          continue;
        }

        // Relays
        if (this.isRelay(cell.type)) {
          if (!cell.activated) {
            cell.activated = true;
            newlyActivated.push({ x: cell.x, y: cell.y, type: cell.type });

            // Queue outgoing emissions for next tick
            const outDirs = this.getEmissionsForRelay(cell.type);
            for (const d of outDirs) {
              nextPulses.push({ x: cell.x, y: cell.y, dir: d });
            }
          }
          // Already activated relays absorb pulses without re-emitting (GDD rule 43)
        }
      }

      ticks.push({
        tick: tickNum,
        activePulses: currentPulses.map((p) => {
          const delta = DIR_DELTA[p.dir];
          return { x: p.x + delta.dx, y: p.y + delta.dy, dir: p.dir };
        }),
        newlyActivated,
        goalsCollected: goalsHitThisTick,
      });

      currentPulses = nextPulses;
      tickNum++;

      // Check if all goals are collected early
      if (this.goalsCollected === this.goalsTotal && this.goalsTotal > 0) {
        // GDD rule 45: Win immediately when all goals active
        break;
      }
    }

    // Resolve end-of-ignition status
    if (this.goalsCollected === this.goalsTotal && this.goalsTotal > 0) {
      this.status = 'WON';
    } else if (this.ignitionsUsed >= this.maxIgnitions) {
      this.status = 'LOST';
    } else {
      this.status = 'IDLE';
    }

    return {
      valid: true,
      ticks,
      status: this.status,
      score: this.calculateScore(),
      goalsCollected: this.goalsCollected,
      goalsTotal: this.goalsTotal,
      ignitionsRemaining: this.maxIgnitions - this.ignitionsUsed,
    };
  }

  public calculateScore(): number {
    const base = this.goalsCollected * 100;
    if (this.status === 'WON') {
      const unused = Math.max(0, this.maxIgnitions - this.ignitionsUsed);
      return base + unused * 30;
    }
    return base;
  }
}
