import Phaser from 'phaser';
import {
  Direction,
  DIR_OFFSETS,
  GameMode,
  LevelConfig,
  StopType,
  TileData,
  TileGeometry,
  SimulationResult,
} from '../types';
import {
  simulateRoute,
  checkNextStep,
} from '../core/PathSolver';
import {
  generateHandcraftedLevels,
  generateSeededLevel,
} from '../core/LevelManager';
import { TelemetryService } from '../core/Telemetry';
import { sfx } from '../audio/SoundEffects';

export interface SceneCallbacks {
  onMoveChange: (moves: number) => void;
  onTimeChange: (timeMs: number) => void;
  onInnStatusChange: (visited: boolean) => void;
  onGameStatusChange: (
    status: 'PLANNING' | 'RUNNING' | 'SUCCESS' | 'FAILED',
    message?: string
  ) => void;
  onModeChange: (mode: GameMode) => void;
}

export class GameScene extends Phaser.Scene {
  private mode: GameMode = 'B';
  private levelId: number = 1;
  private currentLevel!: LevelConfig;
  private tiles: TileData[] = [];
  private tileContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private tileRoadGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();

  // Caravan state
  private caravanContainer!: Phaser.GameObjects.Container;
  private caravanActive: boolean = false;
  private caravanStepIndex: number = 0;
  private currentSimResult: SimulationResult | null = null;
  private activeCaravanCoords = { x: 0, y: 0 };
  private activeExitDir: Direction = 1;

  // Stats
  private moveCount: number = 0;
  private levelStartTime: number = 0;
  private elapsedLevelMs: number = 0;
  private isTimerActive: boolean = false;
  private innVisited: boolean = false;
  private isCompleted: boolean = false;
  private isFailed: boolean = false;

  // Mode C runner timer
  private modeCTimerEvent: Phaser.Time.TimerEvent | null = null;
  private modeCTickIntervalMs: number = 1100; // 1.1s per step
  private isModeCPaused: boolean = false;

  // Layout constants (540x960 canvas)
  private readonly BOARD_SIZE = 5;
  private readonly TILE_SIZE = 86;
  private readonly TILE_GAP = 6;
  private readonly BOARD_OFFSET_X = 40;
  private readonly BOARD_OFFSET_Y = 240;

  public callbacks?: SceneCallbacks;
  private telemetry: TelemetryService = TelemetryService.getInstance();
  private lookaheadGfx!: Phaser.GameObjects.Graphics;
  private countdownTimerEvent: Phaser.Time.TimerEvent | null = null;
  private isCountingDown: boolean = false;
  private countdownRemaining: number = 3;

  constructor() {
    super('GameScene');
  }

  public init(data: {
    levelId?: number;
    mode?: GameMode;
    seed?: number;
    keepRotations?: boolean;
    savedRotations?: Record<string, number>;
  }) {
    this.mode = data.mode || 'B';
    this.levelId = data.levelId || 1;

    // Retain UI callbacks across restarts
    if (!this.callbacks && (this.game as any)._caravanCallbacks) {
      this.callbacks = (this.game as any)._caravanCallbacks;
    } else if (this.callbacks) {
      (this.game as any)._caravanCallbacks = this.callbacks;
    }

    this.loadLevelData(data.seed, data.savedRotations);
  }

  private loadLevelData(seed?: number, savedRotations?: Record<string, number>) {
    if (seed !== undefined) {
      this.currentLevel = generateSeededLevel(seed, this.levelId);
    } else {
      const handcrafted = generateHandcraftedLevels();
      const found = handcrafted.find((l) => l.id === this.levelId);
      this.currentLevel = found || handcrafted[0];
    }

    // Clone tiles deep
    this.tiles = this.currentLevel.tiles.map((t) => {
      const rot = savedRotations ? savedRotations[`${t.x},${t.y}`] ?? t.rotation : t.rotation;
      return { ...t, rotation: rot };
    });
    this.moveCount = 0;
    this.elapsedLevelMs = 0;
    this.innVisited = false;
    this.isCompleted = false;
    this.isFailed = false;
    this.caravanActive = false;
    this.isCountingDown = false;
    this.isModeCPaused = false;
  }

  public create() {
    this.createBackground();
    this.createBoard();
    this.createCaravan();
    this.createLookaheadGraphics();
    this.setupTimers();

    this.levelStartTime = Date.now();
    this.isTimerActive = true;

    this.telemetry.logEvent('LEVEL_START', this.mode, this.levelId, {
      title: this.currentLevel.title,
      isSeeded: !!this.currentLevel.seed,
    });

    this.notifyUI();

    // Mode C automatic runner setup with countdown
    if (this.mode === 'C') {
      this.startModeCCountdown();
    } else {
      this.updateLookaheadIndicator();
    }
  }

  private createBackground() {
    // Warm gradient sand dunes
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xdfab6f, 0xdfab6f, 0xc78c48, 0xc78c48, 1);
    bg.fillRect(0, 0, 540, 960);

    // Decorative subtle dune waves
    bg.lineStyle(2, 0xe8bc85, 0.4);
    for (let i = 0; i < 6; i++) {
      const curve = new Phaser.Curves.CubicBezier(
        new Phaser.Math.Vector2(-50, 160 + i * 140),
        new Phaser.Math.Vector2(150, 130 + i * 140),
        new Phaser.Math.Vector2(350, 190 + i * 140),
        new Phaser.Math.Vector2(600, 150 + i * 140)
      );
      curve.draw(bg);
    }

    // Board container backdrop shadow & border
    const boardBg = this.add.graphics();
    const boardTotalW = this.BOARD_SIZE * (this.TILE_SIZE + this.TILE_GAP) - this.TILE_GAP;
    boardBg.fillStyle(0x7c4f24, 0.4);
    boardBg.fillRoundedRect(
      this.BOARD_OFFSET_X - 10,
      this.BOARD_OFFSET_Y - 10,
      boardTotalW + 20,
      boardTotalW + 20,
      18
    );
    boardBg.fillStyle(0xd6a469, 0.95);
    boardBg.fillRoundedRect(
      this.BOARD_OFFSET_X - 6,
      this.BOARD_OFFSET_Y - 6,
      boardTotalW + 12,
      boardTotalW + 12,
      14
    );
    boardBg.lineStyle(3, 0xa16830, 0.9);
    boardBg.strokeRoundedRect(
      this.BOARD_OFFSET_X - 6,
      this.BOARD_OFFSET_Y - 6,
      boardTotalW + 12,
      boardTotalW + 12,
      14
    );
  }

  private getTilePixelPos(x: number, y: number) {
    const px = this.BOARD_OFFSET_X + x * (this.TILE_SIZE + this.TILE_GAP) + this.TILE_SIZE / 2;
    const py = this.BOARD_OFFSET_Y + y * (this.TILE_SIZE + this.TILE_GAP) + this.TILE_SIZE / 2;
    return { px, py };
  }

  private createBoard() {
    this.tileContainers.clear();
    this.tileRoadGraphics.clear();

    for (const tile of this.tiles) {
      const { px, py } = this.getTilePixelPos(tile.x, tile.y);

      const container = this.add.container(px, py);
      container.setSize(this.TILE_SIZE, this.TILE_SIZE);
      container.setInteractive({ useHandCursor: tile.geometry !== 'EMPTY' && !tile.fixed });

      // Base tile plate
      const plate = this.add.graphics();
      this.drawTilePlate(plate, tile);
      container.add(plate);

      // Road graphics inside a rotatable child container
      const roadContainer = this.add.container(0, 0);
      const roadGfx = this.add.graphics();
      this.drawRoadGeometry(roadGfx, tile.geometry);
      roadContainer.add(roadGfx);

      // Set initial rotation
      roadContainer.setAngle(tile.rotation * 90);
      container.add(roadContainer);

      // Stop badge (Producer, Inn, Market)
      if (tile.stop !== 'NONE') {
        const stopGfx = this.createStopBadge(tile.stop);
        container.add(stopGfx);
      }

      // Input listener
      container.on('pointerdown', () => {
        this.handleTileTap(tile, roadContainer);
      });

      this.tileContainers.set(`${tile.x},${tile.y}`, container);
      this.tileRoadGraphics.set(`${tile.x},${tile.y}`, roadGfx);
    }
  }

  private drawTilePlate(g: Phaser.GameObjects.Graphics, tile: TileData) {
    g.clear();
    const half = this.TILE_SIZE / 2;

    if (tile.geometry === 'EMPTY') {
      // Barren sand tile
      g.fillStyle(0xcda16c, 0.4);
      g.fillRoundedRect(-half, -half, this.TILE_SIZE, this.TILE_SIZE, 8);
      g.lineStyle(1, 0xb88852, 0.3);
      g.strokeRoundedRect(-half, -half, this.TILE_SIZE, this.TILE_SIZE, 8);
      return;
    }

    // Paved puzzle tile plate
    const isStop = tile.stop !== 'NONE';
    const bgColor = isStop ? 0xfbf2e5 : 0xf2e4d0;
    const borderColor = tile.fixed ? 0xa87948 : 0xd1b490;

    g.fillStyle(0x69421d, 0.2); // subtle bottom drop
    g.fillRoundedRect(-half + 1, -half + 3, this.TILE_SIZE, this.TILE_SIZE, 8);

    g.fillStyle(bgColor, 1);
    g.fillRoundedRect(-half, -half, this.TILE_SIZE, this.TILE_SIZE, 8);

    g.lineStyle(2, borderColor, 1);
    g.strokeRoundedRect(-half, -half, this.TILE_SIZE, this.TILE_SIZE, 8);

    // Subtle corner stone insets
    g.fillStyle(0xcca67d, 0.4);
    g.fillCircle(-half + 5, -half + 5, 2);
    g.fillCircle(half - 5, -half + 5, 2);
    g.fillCircle(-half + 5, half - 5, 2);
    g.fillCircle(half - 5, half - 5, 2);
  }

  private drawRoadGeometry(g: Phaser.GameObjects.Graphics, geom: TileGeometry) {
    g.clear();
    if (geom === 'EMPTY') return;

    const half = this.TILE_SIZE / 2;
    const roadWidth = 26;
    const halfW = roadWidth / 2;
    const innerTrackW = 12;
    const halfInner = innerTrackW / 2;

    const roadCasingColor = 0xb5804c; // Outer paving edge
    const roadFillColor = 0xe4c69b;   // Sand gravel road
    const innerLineColor = 0xa36c39;  // Wagon wheel grooves

    // Helper to draw straight bar between sides
    const drawBar = (dir1: Direction, dir2: Direction) => {
      // dir: 0: N, 1: E, 2: S, 3: W
      g.fillStyle(roadFillColor, 1);
      g.lineStyle(2, roadCasingColor, 1);

      if ((dir1 === 0 && dir2 === 2) || (dir1 === 2 && dir2 === 0)) {
        // Vertical road
        g.fillRect(-halfW, -half, roadWidth, this.TILE_SIZE);
        g.lineBetween(-halfW, -half, -halfW, half);
        g.lineBetween(halfW, -half, halfW, half);

        // Wagon trail
        g.lineStyle(2, innerLineColor, 0.45);
        g.lineBetween(-halfInner, -half, -halfInner, half);
        g.lineBetween(halfInner, -half, halfInner, half);
      } else if ((dir1 === 1 && dir2 === 3) || (dir1 === 3 && dir2 === 1)) {
        // Horizontal road
        g.fillRect(-half, -halfW, this.TILE_SIZE, roadWidth);
        g.lineBetween(-half, -halfW, half, -halfW);
        g.lineBetween(-half, halfW, half, halfW);

        // Wagon trail
        g.lineStyle(2, innerLineColor, 0.45);
        g.lineBetween(-half, -halfInner, half, -halfInner);
        g.lineBetween(-half, halfInner, half, halfInner);
      }
    };

    if (geom === 'STRAIGHT') {
      // Base: North & South [0, 2]
      drawBar(0, 2);
    } else if (geom === 'ELBOW') {
      // Base: North & East [0, 1]
      // Draw outer curved corner
      g.fillStyle(roadFillColor, 1);
      // North branch
      g.fillRect(-halfW, -half, roadWidth, half + halfW);
      // East branch
      g.fillRect(-halfW, -halfW, half + halfW, roadWidth);

      // Borders
      g.lineStyle(2, roadCasingColor, 1);
      // Inner corner border (L shape)
      g.beginPath();
      g.moveTo(halfW, -half);
      g.lineTo(halfW, -halfW);
      g.lineTo(half, -halfW);
      g.strokePath();

      // Outer corner border
      g.beginPath();
      g.moveTo(-halfW, -half);
      g.lineTo(-halfW, halfW);
      g.lineTo(half, halfW);
      g.strokePath();

      // Wagon trails curve
      g.lineStyle(2, innerLineColor, 0.45);
      const trailCurve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(0, -half),
        new Phaser.Math.Vector2(0, 0),
        new Phaser.Math.Vector2(half, 0)
      );
      trailCurve.draw(g);
    } else if (geom === 'TEE') {
      // Base: [3, 0, 1] (West, North, East)
      g.fillStyle(roadFillColor, 1);
      // Horizontal bar
      g.fillRect(-half, -halfW, this.TILE_SIZE, roadWidth);
      // North arm
      g.fillRect(-halfW, -half, roadWidth, half);

      // Borders
      g.lineStyle(2, roadCasingColor, 1);
      // Top left corner
      g.beginPath();
      g.moveTo(-half, -halfW);
      g.lineTo(-halfW, -halfW);
      g.lineTo(-halfW, -half);
      g.strokePath();

      // Top right corner
      g.beginPath();
      g.moveTo(halfW, -half);
      g.lineTo(halfW, -halfW);
      g.lineTo(half, -halfW);
      g.strokePath();

      // Bottom straight border
      g.lineBetween(-half, halfW, half, halfW);

      // Wheel trails
      g.lineStyle(2, innerLineColor, 0.45);
      g.lineBetween(-half, 0, half, 0);
      g.beginPath();
      g.moveTo(0, -half);
      g.lineTo(0, 0);
      g.strokePath();
    } else if (geom === 'CROSS') {
      // Base: [0, 1, 2, 3] (All 4)
      g.fillStyle(roadFillColor, 1);
      g.fillRect(-half, -halfW, this.TILE_SIZE, roadWidth);
      g.fillRect(-halfW, -half, roadWidth, this.TILE_SIZE);

      g.lineStyle(2, roadCasingColor, 1);
      // 4 corners
      g.beginPath(); // Top-Left
      g.moveTo(-half, -halfW);
      g.lineTo(-halfW, -halfW);
      g.lineTo(-halfW, -half);
      g.strokePath();

      g.beginPath(); // Top-Right
      g.moveTo(halfW, -half);
      g.lineTo(halfW, -halfW);
      g.lineTo(half, -halfW);
      g.strokePath();

      g.beginPath(); // Bottom-Right
      g.moveTo(half, halfW);
      g.lineTo(halfW, halfW);
      g.lineTo(halfW, half);
      g.strokePath();

      g.beginPath(); // Bottom-Left
      g.moveTo(-halfW, half);
      g.lineTo(-halfW, halfW);
      g.lineTo(-half, halfW);
      g.strokePath();

      // Wheel trail cross
      g.lineStyle(2, innerLineColor, 0.45);
      g.lineBetween(-half, 0, half, 0);
      g.lineBetween(0, -half, 0, half);
    }
  }

  private createStopBadge(stop: StopType): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const badge = this.add.graphics();

    if (stop === 'PRODUCER') {
      // Green Oasis / Tent landmark
      badge.fillStyle(0x2d6a4f, 0.95);
      badge.fillCircle(0, 0, 15);
      badge.lineStyle(2, 0xffffff, 1);
      badge.strokeCircle(0, 0, 15);

      const text = this.add.text(0, -1, 'P', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
      });
      text.setOrigin(0.5);
      container.add([badge, text]);
    } else if (stop === 'INN') {
      // Blue Caravanserai Fortress
      badge.fillStyle(0x1d3557, 0.95);
      badge.fillRoundedRect(-14, -14, 28, 28, 6);
      badge.lineStyle(2, 0xffffff, 1);
      badge.strokeRoundedRect(-14, -14, 28, 28, 6);

      const text = this.add.text(0, -1, 'HAN', {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
      });
      text.setOrigin(0.5);
      container.add([badge, text]);
    } else if (stop === 'MARKET') {
      // Golden Bazaar / Market
      badge.fillStyle(0xd97706, 0.95);
      badge.fillCircle(0, 0, 15);
      badge.lineStyle(2, 0xffffff, 1);
      badge.strokeCircle(0, 0, 15);

      const text = this.add.text(0, -1, 'PAZAR', {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#ffffff',
      });
      text.setOrigin(0.5);
      container.add([badge, text]);
    }

    return container;
  }

  private createCaravan() {
    this.caravanContainer = this.add.container(0, 0);
    this.caravanContainer.setDepth(20);

    // Camel / Caravan wagon sprite drawn procedurally
    const gfx = this.add.graphics();

    // Shadow
    gfx.fillStyle(0x422800, 0.35);
    gfx.fillEllipse(0, 10, 26, 12);

    // Camel body (desert tan)
    gfx.fillStyle(0xb27732, 1);
    gfx.fillRoundedRect(-12, -7, 24, 15, 6);

    // Humps
    gfx.fillStyle(0x996120, 1);
    gfx.fillCircle(-4, -8, 5);
    gfx.fillCircle(4, -8, 4);

    // Neck & Head
    gfx.fillStyle(0xb27732, 1);
    gfx.fillRoundedRect(8, -14, 6, 12, 3);
    gfx.fillCircle(12, -15, 4.5);

    // Pack goods / silk rolls
    gfx.fillStyle(0xce2d4f, 1);
    gfx.fillRoundedRect(-8, -4, 16, 6, 2);
    gfx.fillStyle(0x1a8fe3, 1);
    gfx.fillCircle(-2, -5, 3);

    this.caravanContainer.add(gfx);

    // Initial position at producer start tile
    const startPos = this.getTilePixelPos(
      this.currentLevel.startTile.x,
      this.currentLevel.startTile.y
    );
    this.caravanContainer.setPosition(startPos.px, startPos.py);
    this.activeCaravanCoords = {
      x: this.currentLevel.startTile.x,
      y: this.currentLevel.startTile.y,
    };
    this.activeExitDir = this.currentLevel.startTile.initialExitDir;
  }

  private setupTimers() {
    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        if (this.isTimerActive && !this.isCompleted && !this.isFailed) {
          this.elapsedLevelMs = Date.now() - this.levelStartTime;
          this.callbacks?.onTimeChange(this.elapsedLevelMs);
        }
      },
    });
  }

  private handleTileTap(tile: TileData, roadContainer: Phaser.GameObjects.Container) {
    if (tile.geometry === 'EMPTY' || tile.fixed) {
      if (tile.fixed) {
        // Nudge animation for fixed landmark
        this.tweens.add({
          targets: roadContainer.parentContainer,
          scaleX: 1.06,
          scaleY: 1.06,
          yoyo: true,
          duration: 90,
        });
      }
      return;
    }

    // In Mode C: lock active tile under the caravan
    if (this.mode === 'C' && this.caravanActive) {
      if (tile.x === this.activeCaravanCoords.x && tile.y === this.activeCaravanCoords.y) {
        // Shaking refusal
        this.tweens.add({
          targets: roadContainer.parentContainer,
          x: roadContainer.parentContainer.x + 4,
          yoyo: true,
          repeat: 2,
          duration: 40,
        });
        return;
      }
    }

    // In Mode B: if caravan is currently running animation, ignore tap until reset/edit
    if (this.mode === 'B' && this.caravanActive) {
      return;
    }

    // First interaction telemetry
    this.telemetry.logFirstInteraction(this.mode, this.levelId);

    // Update rotation
    tile.rotation = ((tile.rotation + 1) % 4);
    this.moveCount++;
    sfx.playRotate();

    // Smooth 90 degree tween
    this.tweens.add({
      targets: roadContainer,
      angle: roadContainer.angle + 90,
      duration: 150,
      ease: 'Back.easeOut',
    });

    this.telemetry.logEvent('TILE_ROTATED', this.mode, this.levelId, {
      x: tile.x,
      y: tile.y,
      geometry: tile.geometry,
      newRotation: tile.rotation,
      moveCount: this.moveCount,
    });

    this.callbacks?.onMoveChange(this.moveCount);
    this.updateLookaheadIndicator();
  }

  // ==========================================
  // MODE B: TRADE CHAIN LAUNCH
  // ==========================================
  public launchTradeChain() {
    if (this.caravanActive || this.isCompleted) return;

    this.caravanActive = true;
    this.caravanStepIndex = 0;
    this.innVisited = false;
    this.callbacks?.onInnStatusChange(false);
    this.callbacks?.onGameStatusChange('RUNNING', 'Kervan yola çıktı...');

    this.telemetry.logEvent('CARAVAN_LAUNCHED', 'B', this.levelId, {
      movesSoFar: this.moveCount,
    });

    // Run deterministic simulation
    const sim = simulateRoute(
      this.tiles,
      this.BOARD_SIZE,
      this.currentLevel.startTile
    );
    this.currentSimResult = sim;

    this.playNextModeBStep();
  }

  private playNextModeBStep() {
    if (!this.currentSimResult) return;

    const steps = this.currentSimResult.steps;
    if (this.caravanStepIndex >= steps.length) {
      // Completed all steps or error occurred at end
      if (this.currentSimResult.success) {
        this.handleLevelSuccess();
      } else {
        this.handleLevelFailure(
          this.currentSimResult.status as any,
          this.currentSimResult.errorMessage || 'Rota tamamlanamadı!'
        );
      }
      return;
    }

    const step = steps[this.caravanStepIndex];
    const targetPos = this.getTilePixelPos(step.x, step.y);

    this.activeCaravanCoords = { x: step.x, y: step.y };
    this.activeExitDir = step.exitDir;

    sfx.playStep();
    this.createDustPuff(this.caravanContainer.x, this.caravanContainer.y);

    // Rotate camel to face exit direction
    const faceAngles: Record<Direction, number> = { 0: -90, 1: 0, 2: 90, 3: 180 };
    const targetAngle = faceAngles[step.exitDir] ?? 0;

    this.tweens.add({
      targets: this.caravanContainer,
      x: targetPos.px,
      y: targetPos.py,
      angle: targetAngle,
      duration: 380,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Check if stopped at Inn
        if (step.stop === 'INN') {
          this.innVisited = true;
          this.callbacks?.onInnStatusChange(true);
          sfx.playInnArrival();
          this.highlightStopPulse(step.x, step.y, 0x1d3557);
        }

        this.caravanStepIndex++;

        // If this is the last simulated step and simulation was a failure, show failure now!
        if (
          this.caravanStepIndex >= steps.length &&
          !this.currentSimResult!.success
        ) {
          this.handleLevelFailure(
            this.currentSimResult!.status as any,
            this.currentSimResult!.errorMessage || 'Kervan rotada tıkandı!'
          );
          return;
        }

        // Delay slightly before next tile step
        this.time.delayedCall(120, () => {
          if (this.caravanActive) {
            this.playNextModeBStep();
          }
        });
      },
    });
  }

  // ==========================================
  // LOOKAHEAD & TARGET PATH FEEDBACK
  // ==========================================
  private createLookaheadGraphics() {
    this.lookaheadGfx = this.add.graphics();
    this.lookaheadGfx.setDepth(15);
  }

  public updateLookaheadIndicator() {
    if (!this.lookaheadGfx) return;
    this.lookaheadGfx.clear();

    if (this.isCompleted || this.isFailed) return;

    // Determine the tile the caravan is about to face
    const offset = DIR_OFFSETS[this.activeExitDir];
    const nextX = this.activeCaravanCoords.x + offset.dx;
    const nextY = this.activeCaravanCoords.y + offset.dy;

    if (nextX < 0 || nextX >= this.BOARD_SIZE || nextY < 0 || nextY >= this.BOARD_SIZE) {
      // Off grid warning on current tile
      const pos = this.getTilePixelPos(this.activeCaravanCoords.x, this.activeCaravanCoords.y);
      this.lookaheadGfx.lineStyle(3, 0xe63946, 0.9);
      this.lookaheadGfx.strokeRoundedRect(
        pos.px - this.TILE_SIZE / 2,
        pos.py - this.TILE_SIZE / 2,
        this.TILE_SIZE,
        this.TILE_SIZE,
        8
      );
      return;
    }

    const check = checkNextStep(
      this.activeCaravanCoords.x,
      this.activeCaravanCoords.y,
      this.activeExitDir,
      this.tiles,
      this.BOARD_SIZE,
      this.innVisited
    );

    const targetPos = this.getTilePixelPos(nextX, nextY);
    const half = this.TILE_SIZE / 2;

    if (check.valid) {
      // Glowing green border: road is open and ready!
      this.lookaheadGfx.lineStyle(3, 0x2ecc71, 0.95);
      this.lookaheadGfx.strokeRoundedRect(
        targetPos.px - half,
        targetPos.py - half,
        this.TILE_SIZE,
        this.TILE_SIZE,
        8
      );
      this.lookaheadGfx.fillStyle(0x2ecc71, 0.15);
      this.lookaheadGfx.fillRoundedRect(
        targetPos.px - half,
        targetPos.py - half,
        this.TILE_SIZE,
        this.TILE_SIZE,
        8
      );
    } else {
      // Glowing amber/red warning: next tile is closed/misaligned!
      this.lookaheadGfx.lineStyle(3, 0xe63946, 0.95);
      this.lookaheadGfx.strokeRoundedRect(
        targetPos.px - half,
        targetPos.py - half,
        this.TILE_SIZE,
        this.TILE_SIZE,
        8
      );
      this.lookaheadGfx.fillStyle(0xe63946, 0.15);
      this.lookaheadGfx.fillRoundedRect(
        targetPos.px - half,
        targetPos.py - half,
        this.TILE_SIZE,
        this.TILE_SIZE,
        8
      );
    }
  }

  // ==========================================
  // MODE C: CARAVAN RUSH (REAL TIME RUNNER)
  // ==========================================
  public startModeCCountdown() {
    if (this.countdownTimerEvent) {
      this.countdownTimerEvent.destroy();
    }
    if (this.modeCTimerEvent) {
      this.modeCTimerEvent.destroy();
    }

    this.isCountingDown = true;
    this.countdownRemaining = 3;
    this.caravanActive = false;
    this.isModeCPaused = false;

    // Reset caravan position to start
    const startPos = this.getTilePixelPos(
      this.currentLevel.startTile.x,
      this.currentLevel.startTile.y
    );
    this.caravanContainer.setPosition(startPos.px, startPos.py);
    this.caravanContainer.setAngle(0);
    this.activeCaravanCoords = {
      x: this.currentLevel.startTile.x,
      y: this.currentLevel.startTile.y,
    };
    this.activeExitDir = this.currentLevel.startTile.initialExitDir;

    this.updateLookaheadIndicator();

    const notifyCount = () => {
      this.callbacks?.onGameStatusChange(
        'PLANNING',
        `⏳ Hazır ol: ${this.countdownRemaining} sn içinde kervan yola çıkıyor! Önündeki karoyu hazırla.`
      );
      sfx.playStep();
    };

    notifyCount();

    this.countdownTimerEvent = this.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        this.countdownRemaining--;
        if (this.countdownRemaining > 0) {
          notifyCount();
        } else {
          this.isCountingDown = false;
          this.startModeCRushNow();
        }
      },
    });
  }

  public startModeCRushNow() {
    if (this.countdownTimerEvent) {
      this.countdownTimerEvent.destroy();
    }
    this.isCountingDown = false;
    this.caravanActive = true;
    this.isModeCPaused = false;

    this.callbacks?.onGameStatusChange(
      'RUNNING',
      '🐪 Kervan yola çıktı! Önündeki karoları kervan varmadan önce çevir!'
    );

    this.updateLookaheadIndicator();

    if (this.modeCTimerEvent) {
      this.modeCTimerEvent.destroy();
    }

    this.modeCTimerEvent = this.time.addEvent({
      delay: this.modeCTickIntervalMs,
      loop: true,
      callback: () => {
        if (!this.isModeCPaused && !this.isCompleted && !this.isFailed) {
          this.stepModeCRush();
        }
      },
    });
  }

  private stepModeCRush() {
    const curX = this.activeCaravanCoords.x;
    const curY = this.activeCaravanCoords.y;

    const check = checkNextStep(
      curX,
      curY,
      this.activeExitDir,
      this.tiles,
      this.BOARD_SIZE,
      this.innVisited
    );

    if (!check.valid) {
      if (this.modeCTimerEvent) this.modeCTimerEvent.destroy();
      if (this.lookaheadGfx) this.lookaheadGfx.clear();
      this.handleLevelFailure(
        check.reason || 'DISCONNECTED',
        check.message || 'Kervan kaza yaptı! Yol bağlantısız veya çıkmaz.'
      );
      return;
    }

    // Step is valid, animate caravan to next tile!
    const targetPos = this.getTilePixelPos(check.nextX, check.nextY);
    this.activeCaravanCoords = { x: check.nextX, y: check.nextY };

    sfx.playStep();
    this.createDustPuff(this.caravanContainer.x, this.caravanContainer.y);

    const faceAngles: Record<Direction, number> = { 0: -90, 1: 0, 2: 90, 3: 180 };
    const targetAngle = faceAngles[this.activeExitDir] ?? 0;

    this.tweens.add({
      targets: this.caravanContainer,
      x: targetPos.px,
      y: targetPos.py,
      angle: targetAngle,
      duration: this.modeCTickIntervalMs * 0.7,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (check.isInn) {
          this.innVisited = true;
          this.callbacks?.onInnStatusChange(true);
          sfx.playInnArrival();
          this.highlightStopPulse(check.nextX, check.nextY, 0x1d3557);
        }

        if (check.isMarket) {
          if (this.modeCTimerEvent) this.modeCTimerEvent.destroy();
          if (this.lookaheadGfx) this.lookaheadGfx.clear();
          this.handleLevelSuccess();
          return;
        }

        if (check.nextExitDir !== undefined) {
          this.activeExitDir = check.nextExitDir;
        }

        this.updateLookaheadIndicator();
      },
    });
  }

  public toggleModeCPause() {
    if (this.isCountingDown) {
      this.startModeCRushNow();
      return;
    }
    if (this.isFailed || this.isCompleted) {
      this.resetLevel(false);
      return;
    }
    this.isModeCPaused = !this.isModeCPaused;
    this.callbacks?.onGameStatusChange(
      this.isModeCPaused ? 'PLANNING' : 'RUNNING',
      this.isModeCPaused ? '⏸ Duraklatıldı. Devam etmek için dokunun.' : '🐪 Kervan ilerliyor!'
    );
  }

  public isLevelFailed(): boolean {
    return this.isFailed;
  }

  public isLevelCompleted(): boolean {
    return this.isCompleted;
  }

  public isCountdownActive(): boolean {
    return this.isCountingDown;
  }

  public isModePaused(): boolean {
    return this.isModeCPaused;
  }

  // ==========================================
  // FEEDBACK & ANIMATIONS
  // ==========================================
  private createDustPuff(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      const p = this.add.graphics();
      p.fillStyle(0xd5ba93, 0.7);
      p.fillCircle(0, 0, Phaser.Math.Between(3, 7));
      p.setPosition(
        x + Phaser.Math.Between(-10, 10),
        y + Phaser.Math.Between(-6, 12)
      );

      this.tweens.add({
        targets: p,
        alpha: 0,
        scale: 1.8,
        y: p.y - 15,
        duration: 400,
        onComplete: () => p.destroy(),
      });
    }
  }

  private highlightStopPulse(x: number, y: number, color: number) {
    const pos = this.getTilePixelPos(x, y);
    const ring = this.add.graphics();
    ring.lineStyle(4, color, 1);
    ring.strokeCircle(pos.px, pos.py, 20);

    this.tweens.add({
      targets: ring,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: 600,
      onComplete: () => ring.destroy(),
    });
  }

  private handleLevelSuccess() {
    this.isCompleted = true;
    this.isTimerActive = false;
    this.caravanActive = false;
    sfx.playVictory();

    this.callbacks?.onGameStatusChange(
      'SUCCESS',
      'Tebrikler! Ticaret zinciri başarıyla tamamlandı!'
    );

    this.telemetry.logEvent('LEVEL_COMPLETED', this.mode, this.levelId, {
      moves: this.moveCount,
      durationMs: this.elapsedLevelMs,
      targetMoves: this.currentLevel.targetMoves,
    });

    // Celebration burst
    for (let i = 0; i < 30; i++) {
      const star = this.add.graphics();
      star.fillStyle(Phaser.Utils.Array.GetRandom([0xf1c40f, 0xe67e22, 0x2ecc71, 0x3498db]));
      star.fillCircle(0, 0, Phaser.Math.Between(4, 9));
      star.setPosition(this.caravanContainer.x, this.caravanContainer.y);

      const destX = this.caravanContainer.x + Phaser.Math.Between(-160, 160);
      const destY = this.caravanContainer.y + Phaser.Math.Between(-200, 100);

      this.tweens.add({
        targets: star,
        x: destX,
        y: destY,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(700, 1200),
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  private handleLevelFailure(reason: any, message: string) {
    this.isFailed = true;
    this.caravanActive = false;
    sfx.playError();

    // Camera shake
    this.cameras.main.shake(250, 0.015);

    // Highlight fail tile with pulsing red ring
    const pos = this.getTilePixelPos(
      this.activeCaravanCoords.x,
      this.activeCaravanCoords.y
    );
    const failRing = this.add.graphics();
    failRing.lineStyle(4, 0xe63946, 1);
    failRing.strokeRoundedRect(
      pos.px - this.TILE_SIZE / 2,
      pos.py - this.TILE_SIZE / 2,
      this.TILE_SIZE,
      this.TILE_SIZE,
      10
    );

    this.tweens.add({
      targets: failRing,
      alpha: 0.2,
      yoyo: true,
      repeat: 4,
      duration: 250,
      onComplete: () => failRing.destroy(),
    });

    this.callbacks?.onGameStatusChange('FAILED', message);

    this.telemetry.logEvent('LEVEL_FAILED', this.mode, this.levelId, {
      reason,
      message,
      lastX: this.activeCaravanCoords.x,
      lastY: this.activeCaravanCoords.y,
      moves: this.moveCount,
      durationMs: this.elapsedLevelMs,
    });
  }

  // ==========================================
  // PUBLIC CONTROL METHODS
  // ==========================================
  public resetLevel(keepRotations: boolean = false) {
    if (this.countdownTimerEvent) {
      this.countdownTimerEvent.destroy();
    }
    if (this.modeCTimerEvent) {
      this.modeCTimerEvent.destroy();
    }

    this.caravanActive = false;
    this.isCompleted = false;
    this.isFailed = false;
    this.innVisited = false;
    this.isCountingDown = false;
    this.isModeCPaused = false;

    if (!keepRotations) {
      // Re-read initial scrambled level data
      this.scene.restart({
        levelId: this.levelId,
        mode: this.mode,
        seed: this.currentLevel.seed,
      });
    } else {
      // Reset caravan to start, keep rotated tiles for easy editing
      const startPos = this.getTilePixelPos(
        this.currentLevel.startTile.x,
        this.currentLevel.startTile.y
      );
      this.caravanContainer.setPosition(startPos.px, startPos.py);
      this.caravanContainer.setAngle(0);
      this.activeCaravanCoords = {
        x: this.currentLevel.startTile.x,
        y: this.currentLevel.startTile.y,
      };
      this.activeExitDir = this.currentLevel.startTile.initialExitDir;
      this.callbacks?.onInnStatusChange(false);

      if (this.mode === 'C') {
        this.startModeCCountdown();
      } else {
        this.callbacks?.onGameStatusChange('PLANNING', 'Rotayı düzenleyin.');
        this.updateLookaheadIndicator();
      }
    }

    this.telemetry.logEvent('LEVEL_RETRY', this.mode, this.levelId, {
      keepRotations,
    });
  }

  public setMode(newMode: GameMode) {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.telemetry.logEvent('MODE_SWITCHED', newMode, this.levelId, {
      fromMode: this.mode,
      toMode: newMode,
    });

    // Save existing rotations so player does not lose their planned route
    const savedRotations: Record<string, number> = {};
    for (const t of this.tiles) {
      savedRotations[`${t.x},${t.y}`] = t.rotation;
    }

    this.scene.restart({
      levelId: this.levelId,
      mode: newMode,
      seed: this.currentLevel.seed,
      savedRotations,
    });
  }

  public setLevel(newLevelId: number, seed?: number) {
    this.telemetry.logEvent('LEVEL_QUIT', this.mode, this.levelId, {
      reason: 'LEVEL_SWITCHED',
      durationMs: this.elapsedLevelMs,
    });
    this.levelId = newLevelId;
    this.scene.restart({
      levelId: newLevelId,
      mode: this.mode,
      seed,
    });
  }

  public applySolutionHint() {
    const handcrafted = generateHandcraftedLevels();
    const cur = handcrafted.find((l) => l.id === this.levelId);
    if (!cur) return;

    for (const t of this.tiles) {
      const solvedRot = cur.solutionRotations[`${t.x},${t.y}`];
      if (solvedRot !== undefined && !t.fixed) {
        t.rotation = solvedRot;
        const container = this.tileContainers.get(`${t.x},${t.y}`);
        if (container) {
          const roadCont = container.getAt(1) as Phaser.GameObjects.Container;
          if (roadCont) {
            roadCont.setAngle(solvedRot * 90);
          }
        }
      }
    }

    sfx.playInnArrival();
    this.notifyUI();
  }

  private notifyUI() {
    this.callbacks?.onMoveChange(this.moveCount);
    this.callbacks?.onTimeChange(this.elapsedLevelMs);
    this.callbacks?.onInnStatusChange(this.innVisited);
    this.callbacks?.onModeChange(this.mode);
    this.callbacks?.onGameStatusChange('PLANNING', 'Kervan hazırlanıyor...');
  }
}
