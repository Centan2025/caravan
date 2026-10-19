import Phaser from 'phaser';
import { ChainBoard } from '../core/chain/ChainBoard';
import { CHAIN_LEVELS } from '../core/chain/ChainLevels';
import { PulseTickResult } from '../core/chain/ChainTypes';
import { TelemetryLogger } from '../shared/Telemetry';
import { SoundEffects } from '../audio/SoundEffects';

export class ChainDominoScene extends Phaser.Scene {
  private board!: ChainBoard;
  private currentLevelIndex: number = 0; // 0 to 9 for levels 1 to 10
  private telemetry = TelemetryLogger.getInstance();
  private sounds = new SoundEffects();

  // Rendering dimensions
  private readonly BOARD_SIZE = 5;
  private readonly CELL_SIZE = 76;
  private readonly BOARD_OFFSET_X = 80;
  private readonly BOARD_OFFSET_Y = 270;

  // Visual container objects
  private cellContainers: Phaser.GameObjects.Container[][] = [];
  private pulseGraphics!: Phaser.GameObjects.Graphics;
  private boardBgGraphics: Phaser.GameObjects.Graphics | null = null;
  private hudTextScore!: Phaser.GameObjects.Text;
  private hudTextGoals!: Phaser.GameObjects.Text;
  private hudTextIgnitions!: Phaser.GameObjects.Text;
  private statusBannerText!: Phaser.GameObjects.Text;
  private modalContainer: Phaser.GameObjects.Container | null = null;

  // Animation timing
  private isSimulatingStep: boolean = false;
  private stepTimerEvent: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'ChainDominoScene' });
  }

  public init(data?: { level?: number }): void {
    if (data && typeof data.level === 'number') {
      this.currentLevelIndex = Math.max(0, Math.min(CHAIN_LEVELS.length - 1, data.level - 1));
    }
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#1c1510');

    // Create top banner & HUD
    this.createHUD();

    // Pulse effects layer
    this.pulseGraphics = this.add.graphics();
    this.pulseGraphics.setDepth(10);

    // Load initial level
    this.loadLevel(this.currentLevelIndex + 1);

    // Enable touch input on cells
    this.input.on('pointerdown', this.handlePointerDown, this);
  }

  public loadLevel(levelNum: number): void {
    this.currentLevelIndex = levelNum - 1;
    const levelDef = CHAIN_LEVELS[this.currentLevelIndex];
    this.board = new ChainBoard(levelDef);

    const levelSelect = document.getElementById('level-select') as HTMLSelectElement | null;
    if (levelSelect && levelSelect.value !== levelNum.toString()) {
      levelSelect.value = levelNum.toString();
    }

    if (this.stepTimerEvent) {
      this.stepTimerEvent.remove();
      this.stepTimerEvent = null;
    }
    this.isSimulatingStep = false;
    if (this.pulseGraphics) {
      this.pulseGraphics.clear();
    }
    this.dismissModal();

    this.telemetry.startRun('chain_domino', levelNum, {
      maxIgnitions: levelDef.maxIgnitions,
      targetGoals: this.board.totalGoals,
    });

    this.renderBoard();
    this.updateHUD();
    this.setStatusText(`Seviye ${levelNum}: Başlatıcı oku seçin. Kalan ateşleme: ${this.board.ignitionsLeft}`);
  }

  private createHUD(): void {
    // Top Title & Info
    this.add
      .text(270, 45, 'CHAIN DOMINO', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#f39c12',
      })
      .setOrigin(0.5);

    this.add
      .text(270, 75, 'Ateşle ➔ Zinciri Başlat ➔ Tüm Altınları Topla', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '13px',
        color: '#bfa895',
      })
      .setOrigin(0.5);

    // Status Banner Box
    const bannerBox = this.add.graphics();
    bannerBox.fillStyle(0x2a211a, 1);
    bannerBox.lineStyle(1, 0x4d3a2b, 1);
    bannerBox.fillRoundedRect(40, 100, 460, 48, 8);
    bannerBox.strokeRoundedRect(40, 100, 460, 48, 8);

    this.statusBannerText = this.add
      .text(270, 124, '', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 440 },
      })
      .setOrigin(0.5);

    // Stats bar: Hedefler (Goals), Ateşleme (Ignitions), Skor (Score)
    const statsY = 175;
    const pillWidth = 140;
    const pillHeight = 55;

    // Goals Pill
    this.createPill(100, statsY, pillWidth, pillHeight, 'ALTIN HEDEF');
    this.hudTextGoals = this.add
      .text(100, statsY + 8, '0 / 0', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#f39c12',
      })
      .setOrigin(0.5);

    // Ignitions Pill
    this.createPill(270, statsY, pillWidth, pillHeight, 'ATEŞLEME HAKKI');
    this.hudTextIgnitions = this.add
      .text(270, statsY + 8, '0 / 0', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#48cae4',
      })
      .setOrigin(0.5);

    // Score Pill
    this.createPill(440, statsY, pillWidth, pillHeight, 'SKOR');
    this.hudTextScore = this.add
      .text(440, statsY + 8, '0', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#52b788',
      })
      .setOrigin(0.5);

    // Reset button in bottom UI
    const resetBtn = this.add
      .text(270, 720, '🔄 Bu Seviyeyi Baştan Başlat', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#f5ede4',
        backgroundColor: '#39281a',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    resetBtn.on('pointerdown', () => {
      this.telemetry.recordReplayClicked();
      this.loadLevel(this.currentLevelIndex + 1);
    });
  }

  private createPill(x: number, y: number, w: number, h: number, label: string): void {
    const g = this.add.graphics();
    g.fillStyle(0x221811, 1);
    g.lineStyle(1, 0x4d3a2b, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);

    this.add
      .text(x, y - 12, label, {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#bfa895',
      })
      .setOrigin(0.5);
  }

  private setStatusText(msg: string): void {
    if (this.statusBannerText) {
      this.statusBannerText.setText(msg);
    }
  }

  private updateHUD(): void {
    if (!this.board) return;
    this.hudTextGoals.setText(`${this.board.collectedGoals} / ${this.board.totalGoals}`);
    this.hudTextIgnitions.setText(`${this.board.ignitionsLeft} / ${this.board.maxIgnitions}`);
    this.hudTextScore.setText(`${this.board.score}`);
  }

  private renderBoard(): void {
    // Clear old container objects
    for (const row of this.cellContainers) {
      for (const container of row) {
        container.destroy();
      }
    }
    this.cellContainers = [];

    // Board background grid
    if (!this.boardBgGraphics) {
      this.boardBgGraphics = this.add.graphics();
    }
    this.boardBgGraphics.clear();
    this.boardBgGraphics.fillStyle(0x18100b, 1);
    this.boardBgGraphics.lineStyle(2, 0x3d2b1f, 1);
    const bgPadding = 8;
    this.boardBgGraphics.fillRoundedRect(
      this.BOARD_OFFSET_X - bgPadding,
      this.BOARD_OFFSET_Y - bgPadding,
      this.BOARD_SIZE * this.CELL_SIZE + bgPadding * 2,
      this.BOARD_SIZE * this.CELL_SIZE + bgPadding * 2,
      12
    );
    this.boardBgGraphics.strokeRoundedRect(
      this.BOARD_OFFSET_X - bgPadding,
      this.BOARD_OFFSET_Y - bgPadding,
      this.BOARD_SIZE * this.CELL_SIZE + bgPadding * 2,
      this.BOARD_SIZE * this.CELL_SIZE + bgPadding * 2,
      12
    );

    for (let y = 0; y < this.BOARD_SIZE; y++) {
      const row: Phaser.GameObjects.Container[] = [];
      for (let x = 0; x < this.BOARD_SIZE; x++) {
        const cell = this.board.getCell(x, y);
        const cx = this.BOARD_OFFSET_X + x * this.CELL_SIZE + this.CELL_SIZE / 2;
        const cy = this.BOARD_OFFSET_Y + y * this.CELL_SIZE + this.CELL_SIZE / 2;

        const container = this.add.container(cx, cy);
        if (cell) {
          this.renderCellContent(container, cell);
        }
        row.push(container);
      }
      this.cellContainers.push(row);
    }
  }

  private renderCellContent(container: Phaser.GameObjects.Container, cell: any): void {
    container.removeAll(true);

    const size = this.CELL_SIZE - 6;
    const bg = this.add.graphics();

    let bgColor = 0x241a12;
    let borderColor = 0x3d2b1f;

    if (cell.type === '#') {
      bgColor = 0x15100c;
      borderColor = 0x221610;
    } else if (cell.type === 'G') {
      bgColor = cell.activated ? 0x6e5015 : 0x3a2c14;
      borderColor = cell.activated ? 0xf39c12 : 0xaa7014;
    } else if (['U', 'R', 'D', 'L', 'H', 'V'].includes(cell.type)) {
      bgColor = cell.activated ? 0x1d3557 : 0x2a3542;
      borderColor = cell.activated ? 0x457b9d : 0x48cae4;
    }

    bg.fillStyle(bgColor, 1);
    bg.lineStyle(1.5, borderColor, 1);
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, 8);
    bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 8);
    container.add(bg);

    // Label / Icon
    let label = '';
    let textColor = '#ffffff';
    let fontSize = '26px';

    if (cell.type === '#') {
      label = '⬛';
      fontSize = '22px';
      textColor = '#443322';
    } else if (cell.type === 'G') {
      label = cell.activated ? '★' : 'G';
      textColor = '#f39c12';
      fontSize = cell.activated ? '32px' : '26px';
    } else if (cell.type === 'U') {
      label = '↑';
      textColor = cell.activated ? '#8ecae6' : '#ffffff';
    } else if (cell.type === 'R') {
      label = '→';
      textColor = cell.activated ? '#8ecae6' : '#ffffff';
    } else if (cell.type === 'D') {
      label = '↓';
      textColor = cell.activated ? '#8ecae6' : '#ffffff';
    } else if (cell.type === 'L') {
      label = '←';
      textColor = cell.activated ? '#8ecae6' : '#ffffff';
    } else if (cell.type === 'H') {
      label = '↔';
      textColor = cell.activated ? '#a8dadc' : '#ffffff';
      fontSize = '22px';
    } else if (cell.type === 'V') {
      label = '↕';
      textColor = cell.activated ? '#a8dadc' : '#ffffff';
      fontSize = '22px';
    } else if (cell.type === '.') {
      label = '·';
      fontSize = '28px';
      textColor = '#4a382c';
    }

    if (label) {
      const text = this.add
        .text(0, 0, label, {
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize,
          fontStyle: 'bold',
          color: textColor,
        })
        .setOrigin(0.5);
      container.add(text);
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isSimulatingStep) {
      this.telemetry.recordInvalidTap('simulation_busy');
      return;
    }

    if (this.board.status === 'WON' || this.board.status === 'LOST') {
      return;
    }

    const gridX = Math.floor((pointer.x - this.BOARD_OFFSET_X) / this.CELL_SIZE);
    const gridY = Math.floor((pointer.y - this.BOARD_OFFSET_Y) / this.CELL_SIZE);

    if (gridX < 0 || gridX >= this.BOARD_SIZE || gridY < 0 || gridY >= this.BOARD_SIZE) {
      return; // Touch outside board
    }

    const cell = this.board.getCell(gridX, gridY);
    if (!cell) return;

    if (!this.board.isCellEligibleRelay(gridX, gridY)) {
      this.telemetry.recordInvalidTap('ineligible_cell', {
        x: gridX,
        y: gridY,
        type: cell.type,
        activated: cell.activated,
      });
      this.flashInvalidCell(gridX, gridY);
      return;
    }

    // Valid ignition!
    const result = this.board.ignite(gridX, gridY);
    if (!result.valid) {
      this.telemetry.recordInvalidTap('no_ignitions_left');
      return;
    }

    this.telemetry.recordValidMove({ x: gridX, y: gridY, type: cell.type });
    this.sounds.playRotate();
    this.updateHUD();
    this.setStatusText(`Ateşlendi! (${gridX}, ${gridY}) Dalgalar yayılıyor...`);

    // Redraw board to show activated state
    this.refreshBoardDisplay();

    // Start playback of simulation ticks
    this.startTicksPlayback(result.ticks);
  }

  private flashInvalidCell(x: number, y: number): void {
    const cx = this.BOARD_OFFSET_X + x * this.CELL_SIZE + this.CELL_SIZE / 2;
    const cy = this.BOARD_OFFSET_Y + y * this.CELL_SIZE + this.CELL_SIZE / 2;

    const flash = this.add.graphics();
    flash.lineStyle(2, 0xe63946, 1);
    flash.strokeRoundedRect(cx - (this.CELL_SIZE - 6) / 2, cy - (this.CELL_SIZE - 6) / 2, this.CELL_SIZE - 6, this.CELL_SIZE - 6, 8);
    flash.setDepth(20);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
  }

  private refreshBoardDisplay(): void {
    for (let y = 0; y < this.BOARD_SIZE; y++) {
      for (let x = 0; x < this.BOARD_SIZE; x++) {
        const cell = this.board.getCell(x, y);
        if (cell) {
          const container = this.cellContainers[y][x];
          this.renderCellContent(container, cell);
        }
      }
    }
  }

  private startTicksPlayback(ticks: PulseTickResult[]): void {
    this.isSimulatingStep = true;
    let tickIdx = 0;

    const stepIntervalMs = 160; // Clean, readable pulse travel animation
    this.stepTimerEvent = this.time.addEvent({
      delay: stepIntervalMs,
      loop: true,
      callback: () => {
        if (tickIdx < ticks.length) {
          const currentTick = ticks[tickIdx];
          this.drawPulses(currentTick.activePulses);

          if (currentTick.goalsCollected.length > 0) {
            this.sounds.playGoalSuccess();
            for (const _ of currentTick.goalsCollected) {
              this.telemetry.recordGoalHit(this.board.collectedGoals - 1, this.board.collectedGoals);
            }
          }

          this.refreshBoardDisplay();
          this.updateHUD();
          tickIdx++;
        } else {
          // Playback finished
          if (this.stepTimerEvent) {
            this.stepTimerEvent.remove();
            this.stepTimerEvent = null;
          }
          this.isSimulatingStep = false;
          this.pulseGraphics.clear();
          this.refreshBoardDisplay();
          this.updateHUD();
          this.checkCompletion();
        }
      },
    });
  }

  private drawPulses(pulses: Array<{ x: number; y: number; dir: string }>): void {
    this.pulseGraphics.clear();
    this.pulseGraphics.fillStyle(0x00f0ff, 0.9);
    this.pulseGraphics.lineStyle(3, 0xffffff, 1);

    for (const p of pulses) {
      const cx = this.BOARD_OFFSET_X + p.x * this.CELL_SIZE + this.CELL_SIZE / 2;
      const cy = this.BOARD_OFFSET_Y + p.y * this.CELL_SIZE + this.CELL_SIZE / 2;

      this.pulseGraphics.fillCircle(cx, cy, 10);
      this.pulseGraphics.strokeCircle(cx, cy, 10);

      // Trail line indicating direction
      let tx = cx;
      let ty = cy;
      if (p.dir === 'UP') ty -= this.CELL_SIZE * 0.4;
      if (p.dir === 'DOWN') ty += this.CELL_SIZE * 0.4;
      if (p.dir === 'LEFT') tx -= this.CELL_SIZE * 0.4;
      if (p.dir === 'RIGHT') tx += this.CELL_SIZE * 0.4;

      this.pulseGraphics.lineBetween(cx, cy, tx, ty);
    }
  }

  private checkCompletion(): void {
    if (this.board.status === 'WON') {
      this.sounds.playWin();
      this.setStatusText(`🎉 TEBRİKLER! Bölüm Kazanıldı! Skor: ${this.board.score}`);
      this.telemetry.recordRunWon(this.board.score, {
        level: this.currentLevelIndex + 1,
        goals: this.board.collectedGoals,
        remainingIgnitions: this.board.ignitionsLeft,
      });
      this.showEndModal(true);
    } else if (this.board.status === 'LOST') {
      this.sounds.playFail();
      this.setStatusText(`❌ BAŞARISIZ! Ateşleme hakkı bitti. Skor: ${this.board.score}`);
      this.telemetry.recordRunLost('ignitions_exhausted', this.board.score, {
        level: this.currentLevelIndex + 1,
        goals: this.board.collectedGoals,
      });
      this.showEndModal(false);
    } else {
      this.setStatusText(`Sonraki oku seçin. Kalan ateşleme: ${this.board.ignitionsLeft}`);
    }
  }

  private showEndModal(isWin: boolean): void {
    this.dismissModal();

    this.modalContainer = this.add.container(270, 480);
    this.modalContainer.setDepth(100);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(-270, -480, 540, 960);
    this.modalContainer.add(overlay);

    const box = this.add.graphics();
    box.fillStyle(0x221811, 1);
    box.lineStyle(2, isWin ? 0xf39c12 : 0xe63946, 1);
    box.fillRoundedRect(-200, -140, 400, 280, 14);
    box.strokeRoundedRect(-200, -140, 400, 280, 14);
    this.modalContainer.add(box);

    const titleText = isWin ? '🏆 BÖLÜM TAMAMLANDI!' : '💀 ATEŞLEME TÜKENDİ';
    const titleColor = isWin ? '#f39c12' : '#e63946';

    const title = this.add
      .text(0, -100, titleText, {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: titleColor,
      })
      .setOrigin(0.5);
    this.modalContainer.add(title);

    const scoreMsg = `Toplam Skor: ${this.board.score}\nToplanan Altın: ${this.board.collectedGoals}/${this.board.totalGoals}\nKalan Ateşleme: ${this.board.ignitionsLeft}`;
    const scoreText = this.add
      .text(0, -35, scoreMsg, {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '15px',
        color: '#f5ede4',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
    this.modalContainer.add(scoreText);

    // Play again / Retry button (Voluntary replay trigger)
    const retryBtn = this.add
      .text(0, 45, isWin ? '🔄 Yeniden Oyna' : '🔄 Tekrar Dene', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#c07d39',
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    retryBtn.on('pointerdown', () => {
      this.telemetry.recordReplayClicked();
      this.loadLevel(this.currentLevelIndex + 1);
    });
    this.modalContainer.add(retryBtn);

    // Next Level button if won and has next level
    if (isWin && this.currentLevelIndex < CHAIN_LEVELS.length - 1) {
      const nextBtn = this.add
        .text(0, 95, `Sonraki Seviye (${this.currentLevelIndex + 2}) ➔`, {
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#8ecae6',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      nextBtn.on('pointerdown', () => {
        this.telemetry.recordExitClicked();
        this.loadLevel(this.currentLevelIndex + 2);
      });
      this.modalContainer.add(nextBtn);
    }
  }

  private dismissModal(): void {
    if (this.modalContainer) {
      this.modalContainer.destroy();
      this.modalContainer = null;
    }
  }
}
