import Phaser from 'phaser';
import { SwitchNetwork, FIXED_SCENARIOS } from '../core/switch/SwitchNetwork';
import { PROGRESSIVE_LEVELS } from '../core/switch/SwitchLevels';
import {
  NetworkNode,
  JunctionId,
  VehicleColor,
  ScenarioDefinition,
  DistrictId,
} from '../core/switch/SwitchTypes';
import { TelemetryLogger } from '../shared/Telemetry';
import { SoundEffects } from '../audio/SoundEffects';

export type SwitchRushMode = 'progressive' | 'original';

export class SwitchRushScene extends Phaser.Scene {
  private network!: SwitchNetwork;
  private scenarioId: number = 1; // 1 to 30 for 2.0 (progressive), 1 to 10 for Classic (original)
  public modeType: SwitchRushMode = 'progressive';
  private telemetry = TelemetryLogger.getInstance();
  private sounds = new SoundEffects();

  // Coordinates for the rail network nodes (540 x 960 viewport)
  private readonly NODE_COORDS: Record<NetworkNode, { x: number; y: number }> = {
    SOURCE: { x: 270, y: 130 },
    J1: { x: 270, y: 280 },
    J2: { x: 160, y: 470 },
    J3: { x: 380, y: 470 },
    RED: { x: 90, y: 700 },
    BLUE: { x: 230, y: 700 },
    GREEN: { x: 310, y: 700 },
    YELLOW: { x: 450, y: 700 },
  };

  private readonly STATION_COLORS: Record<VehicleColor, number> = {
    R: 0xe63946,
    B: 0x0077b6,
    G: 0x2d6a4f,
    Y: 0xe09f3e,
  };

  private readonly STATION_SYMBOLS: Record<VehicleColor, string> = {
    R: '◼',
    B: '●',
    G: '▲',
    Y: '◆',
  };

  // Rendering layers
  private dioramaBgGraphics!: Phaser.GameObjects.Graphics;
  private trackGraphics!: Phaser.GameObjects.Graphics;
  private pathPreviewGraphics!: Phaser.GameObjects.Graphics;
  private stationHighlightGraphics!: Phaser.GameObjects.Graphics;
  private vehicleGraphics!: Phaser.GameObjects.Graphics;
  private prepGraphics!: Phaser.GameObjects.Graphics;
  private vehicleLabels: Phaser.GameObjects.Text[] = [];
  private junctionButtons: Map<JunctionId, Phaser.GameObjects.Container> = new Map();
  private targetBadges: Map<NetworkNode, Phaser.GameObjects.Container> = new Map();

  // HUD Elements
  private hudDistrictBadge!: Phaser.GameObjects.Text;
  private hudCorrect!: Phaser.GameObjects.Text;
  private hudMistakes!: Phaser.GameObjects.Text;
  private hudMistakeLabel!: Phaser.GameObjects.Text;
  private hudStreak!: Phaser.GameObjects.Text;
  private hudScore!: Phaser.GameObjects.Text;
  private statusBannerText!: Phaser.GameObjects.Text;
  private manifestPreviewText!: Phaser.GameObjects.Text;
  private prepStatusText!: Phaser.GameObjects.Text;
  private pauseBtnText!: Phaser.GameObjects.Text;
  private modalContainer: Phaser.GameObjects.Container | null = null;

  // Tick & Animation timing
  private tickAccumulatorMs: number = 0;
  private isPaused: boolean = false;
  private glowTimer: number = 0;
  private prepProgress: number = 0;

  constructor() {
    super({ key: 'SwitchRushScene' });
  }

  public init(data?: { scenario?: number; mode?: SwitchRushMode }): void {
    if (data?.mode) {
      this.modeType = data.mode;
    }
    if (data && typeof data.scenario === 'number') {
      const maxSc = this.modeType === 'progressive' ? 30 : 10;
      this.scenarioId = Math.max(1, Math.min(maxSc, data.scenario));
    }
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#141c24');

    // Create rendering layers by depth
    this.dioramaBgGraphics = this.add.graphics().setDepth(0);
    this.trackGraphics = this.add.graphics().setDepth(1);
    this.pathPreviewGraphics = this.add.graphics().setDepth(2);
    this.stationHighlightGraphics = this.add.graphics().setDepth(3);
    this.vehicleGraphics = this.add.graphics().setDepth(10);
    this.prepGraphics = this.add.graphics().setDepth(14);

    this.createHUD();
    this.createJunctionControls();
    this.createStationDepots();

    this.loadScenario(this.scenarioId, this.modeType);
  }

  public setMode(mode: SwitchRushMode): void {
    this.modeType = mode;
    this.loadScenario(1, mode);
  }

  public loadScenario(scId: number, mode?: SwitchRushMode): void {
    if (mode) {
      this.modeType = mode;
    }
    const maxVal = this.modeType === 'progressive' ? 30 : 10;
    this.scenarioId = Math.max(1, Math.min(maxVal, scId));

    let scenarioDef: ScenarioDefinition;
    if (this.modeType === 'progressive') {
      scenarioDef =
        PROGRESSIVE_LEVELS.find((l) => l.id === this.scenarioId) || PROGRESSIVE_LEVELS[0];
    } else {
      scenarioDef =
        FIXED_SCENARIOS.find((s) => s.id === this.scenarioId) || FIXED_SCENARIOS[0];
    }

    this.network = new SwitchNetwork(scenarioDef);
    this.network.start();
    this.tickAccumulatorMs = 0;
    this.prepProgress = 0;
    this.isPaused = false;
    this.dismissModal();

    // Sync HTML level dropdown if available
    const levelSelect = document.getElementById('level-select') as HTMLSelectElement | null;
    if (levelSelect && levelSelect.value !== this.scenarioId.toString()) {
      levelSelect.value = this.scenarioId.toString();
    }

    // Clear frame graphics
    if (this.vehicleGraphics) this.vehicleGraphics.clear();
    if (this.stationHighlightGraphics) this.stationHighlightGraphics.clear();
    if (this.pathPreviewGraphics) this.pathPreviewGraphics.clear();
    if (this.prepGraphics) this.prepGraphics.clear();
    for (const lbl of this.vehicleLabels) {
      lbl.destroy();
    }
    this.vehicleLabels = [];

    // Telemetry log
    this.telemetry.startRun('switch_rush', this.scenarioId, {
      submode: this.modeType === 'progressive' ? '2.0' : 'classic',
      district: this.network.district || 'classic',
      levelFamily: this.network.levelFamily || 'classic',
      title: this.network.title,
      manifestLength: this.network.manifest.length,
      initialManifest: [...this.network.manifest],
      tickDurationMs: this.network.tickDurationMs,
      spawnCadenceTicks: this.network.spawnCadenceTicks,
      maxConcurrentVehicles: this.network.maxConcurrentVehicles,
      activeJunctions: this.network.activeJunctions,
      maxMistakes: this.network.maxMistakes,
    });

    // Render diorama environment
    this.renderDioramaEnvironment(this.network.district);

    this.updateHUD();
    this.updateJunctionVisuals();

    // Narrative check: Show district intro card on first level of each district
    if (this.modeType === 'progressive' && [1, 7, 13, 19, 25].includes(this.scenarioId)) {
      this.showDistrictIntroModal(this.network.district || 'suburb');
    }

    const hintPart = this.network.hint ? `\n💡 İpucu: ${this.network.hint}` : '';
    const challengePart = this.network.primaryChallenge
      ? ` [${this.network.primaryChallenge}]`
      : '';
    this.setStatusText(`${this.network.title}${challengePart}${hintPart}`);
  }

  // =========================================================================
  // FAZ 3: PREMIUM TOY CITY DIORAMA GRAPHICS SYSTEM
  // =========================================================================
  private renderDioramaEnvironment(district?: DistrictId): void {
    this.dioramaBgGraphics.clear();

    const g = this.dioramaBgGraphics;

    if (!district || this.modeType === 'original') {
      // Classic Mode: Dark industrial slate
      g.fillStyle(0x141c24, 1);
      g.fillRect(0, 0, 540, 960);
      return;
    }

    if (district === 'suburb') {
      // 1. SUBURB: Pastel meadow green with miniature houses and puff trees
      g.fillStyle(0x1a2e22, 1); // Meadow base
      g.fillRect(0, 0, 540, 960);

      // Light lawn patches in corners (never on tracks)
      g.fillStyle(0x233d2e, 0.7);
      g.fillRoundedRect(10, 160, 50, 480, 12);
      g.fillRoundedRect(480, 160, 50, 480, 12);
      g.fillRoundedRect(20, 770, 500, 50, 10);

      // Mini Houses in top margins
      this.drawMiniHouse(g, 35, 190, 0xf4a261, 0xe76f51);
      this.drawMiniHouse(g, 35, 360, 0xe9c46a, 0x2a9d8f);
      this.drawMiniHouse(g, 505, 190, 0x81b29a, 0xe07a5f);
      this.drawMiniHouse(g, 505, 360, 0xf2cc8f, 0x3d405b);

      // Mini Puff Trees
      this.drawPuffTree(g, 35, 270, 0x2d6a4f);
      this.drawPuffTree(g, 35, 450, 0x40916c);
      this.drawPuffTree(g, 505, 270, 0x52b788);
      this.drawPuffTree(g, 505, 450, 0x2d6a4f);
    } else if (district === 'downtown') {
      // 2. DOWNTOWN: Urban slate asphalt, office blocks, crosswalks
      g.fillStyle(0x161e29, 1); // Asphalt base
      g.fillRect(0, 0, 540, 960);

      // Sidewalk curbs
      g.fillStyle(0x232e3d, 0.8);
      g.fillRoundedRect(10, 160, 50, 480, 8);
      g.fillRoundedRect(480, 160, 50, 480, 8);

      // Mini Office Buildings
      this.drawMiniOffice(g, 35, 200, 0x3a506b, 0x48cae4);
      this.drawMiniOffice(g, 35, 380, 0x2b2d42, 0x8d99ae);
      this.drawMiniOffice(g, 505, 200, 0x1d3557, 0x457b9d);
      this.drawMiniOffice(g, 505, 380, 0x3d405b, 0xe07a5f);

      // Pedestrian crosswalk zebra stripes in margins
      g.fillStyle(0xffffff, 0.15);
      for (let i = 0; i < 4; i++) {
        g.fillRect(20, 275 + i * 8, 30, 4);
        g.fillRect(490, 275 + i * 8, 30, 4);
      }
    } else if (district === 'industrial') {
      // 3. INDUSTRIAL: Rusty gravel yard, steel plates, shipping containers
      g.fillStyle(0x201814, 1); // Rust yard base
      g.fillRect(0, 0, 540, 960);

      // Concrete loading yard zones
      g.fillStyle(0x2e231e, 0.8);
      g.fillRoundedRect(10, 160, 50, 480, 8);
      g.fillRoundedRect(480, 160, 50, 480, 8);

      // Stacked Intermodal Shipping Containers
      this.drawMiniContainer(g, 35, 200, 0xd00000);
      this.drawMiniContainer(g, 35, 225, 0x0077b6);
      this.drawMiniContainer(g, 35, 380, 0x38b000);
      this.drawMiniContainer(g, 35, 405, 0xffb703);

      this.drawMiniContainer(g, 505, 200, 0x0077b6);
      this.drawMiniContainer(g, 505, 225, 0xd00000);
      this.drawMiniContainer(g, 505, 380, 0xffb703);
      this.drawMiniContainer(g, 505, 405, 0x38b000);

      // Hazard warning stripes
      g.fillStyle(0xffb703, 0.3);
      g.fillRect(15, 300, 40, 6);
      g.fillRect(485, 300, 40, 6);
    } else if (district === 'harbor') {
      // 4. HARBOR: Coastal sea, wooden boardwalk pier, boat silhouettes
      g.fillStyle(0x0e1f2b, 1); // Dark ocean water base
      g.fillRect(0, 0, 540, 960);

      // Wooden boardwalk pier planks along margins
      g.fillStyle(0x2b2118, 0.9);
      g.fillRoundedRect(10, 160, 50, 480, 6);
      g.fillRoundedRect(480, 160, 50, 480, 6);

      // Dock bollards
      g.fillStyle(0x141c24, 1);
      g.fillCircle(35, 210, 7);
      g.fillCircle(35, 350, 7);
      g.fillCircle(505, 210, 7);
      g.fillCircle(505, 350, 7);

      // Mini cargo ship silhouette in deep water
      this.drawMiniShip(g, 35, 270);
      this.drawMiniShip(g, 505, 420);

      // Water wave ripple accents
      g.lineStyle(1, 0x48cae4, 0.2);
      g.lineBetween(15, 460, 45, 460);
      g.lineBetween(495, 260, 525, 260);
    } else if (district === 'night_express') {
      // 5. NIGHT EXPRESS: Midnight navy, warm street lamp halos, illuminated signs
      g.fillStyle(0x090d14, 1); // Midnight base
      g.fillRect(0, 0, 540, 960);

      // Street lamp amber glow halos in margins
      const drawLanternGlow = (lx: number, ly: number) => {
        g.fillStyle(0xffb703, 0.12);
        g.fillCircle(lx, ly, 36);
        g.fillStyle(0xffb703, 0.25);
        g.fillCircle(lx, ly, 18);
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(lx, ly, 4);
      };

      drawLanternGlow(35, 200);
      drawLanternGlow(35, 380);
      drawLanternGlow(505, 200);
      drawLanternGlow(505, 380);

      // Distant illuminated city skyline dots in bottom margin
      g.fillStyle(0xffd166, 0.35);
      for (let i = 0; i < 20; i++) {
        g.fillRect(70 + i * 20, 770 + (i % 3) * 6, 4, 4);
      }
    }
  }

  // Mini Diorama Props Helpers
  private drawMiniHouse(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    wallColor: number,
    roofColor: number
  ): void {
    // Drop shadow
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(x - 14, y - 6, 28, 26, 4);
    // Wall
    g.fillStyle(wallColor, 1);
    g.fillRoundedRect(x - 14, y - 10, 28, 24, 3);
    // Roof
    g.fillStyle(roofColor, 1);
    g.fillTriangle(x - 16, y - 10, x + 16, y - 10, x, y - 24);
    // Lit window
    g.fillStyle(0xfff3b0, 0.85);
    g.fillRect(x - 5, y - 4, 10, 8);
  }

  private drawPuffTree(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(x + 2, y + 4, 14);
    g.fillStyle(color, 0.95);
    g.fillCircle(x - 4, y - 2, 10);
    g.fillCircle(x + 4, y - 2, 10);
    g.fillCircle(x, y - 8, 11);
  }

  private drawMiniOffice(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    color: number,
    accent: number
  ): void {
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(x - 14, y - 8, 28, 38, 4);
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - 14, y - 16, 28, 36, 4);
    g.fillStyle(accent, 0.7);
    g.fillRect(x - 10, y - 12, 6, 6);
    g.fillRect(x + 4, y - 12, 6, 6);
    g.fillRect(x - 10, y, 6, 6);
    g.fillRect(x + 4, y, 6, 6);
  }

  private drawMiniContainer(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(x - 16, y - 2, 32, 18, 2);
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - 16, y - 8, 32, 16, 2);
    g.lineStyle(1, 0xffffff, 0.3);
    g.strokeRoundedRect(x - 16, y - 8, 32, 16, 2);
  }

  private drawMiniShip(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(0x1d2d44, 0.9);
    g.fillRoundedRect(x - 15, y - 6, 30, 16, 4);
    g.fillStyle(0xe63946, 0.9);
    g.fillRect(x - 10, y - 4, 8, 6);
    g.fillStyle(0x0077b6, 0.9);
    g.fillRect(x + 2, y - 4, 8, 6);
  }

  // =========================================================================
  // HUD & CONTROLS
  // =========================================================================
  private createHUD(): void {
    // Top Title & District Badge
    this.add
      .text(270, 28, 'SWITCH RUSH 2.0', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#48cae4',
      })
      .setOrigin(0.5);

    this.hudDistrictBadge = this.add
      .text(270, 48, '', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffd166',
      })
      .setOrigin(0.5);

    // Manifest line preview
    this.manifestPreviewText = this.add
      .text(270, 68, '', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#f5ede4',
      })
      .setOrigin(0.5);

    // Status Banner Box
    const bannerBox = this.add.graphics();
    bannerBox.fillStyle(0x16222f, 0.95);
    bannerBox.lineStyle(1, 0x415a77, 1);
    bannerBox.fillRoundedRect(20, 84, 500, 36, 6);
    bannerBox.strokeRoundedRect(20, 84, 500, 36, 6);

    this.statusBannerText = this.add
      .text(270, 102, '', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#e0e1dd',
        align: 'center',
        wordWrap: { width: 490 },
      })
      .setOrigin(0.5);

    // Preparation Alert Text at SOURCE Depot
    this.prepStatusText = this.add
      .text(270, 172, '', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffd166',
        backgroundColor: '#1b263b',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(15)
      .setVisible(false);

    // Bottom Stats row (Delivery, Mistakes, Streak, Score)
    const statsY = 790;
    const pillW = 110;
    const pillH = 50;

    // Delivery Pill
    this.createPill(75, statsY, pillW, pillH, 'TESLİMAT');
    this.hudCorrect = this.add
      .text(75, statsY + 6, '0 / 0', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#52b788',
      })
      .setOrigin(0.5);

    // Mistakes Pill
    this.hudMistakeLabel = this.createPill(205, statsY, pillW, pillH, 'HATA');
    this.hudMistakes = this.add
      .text(205, statsY + 6, '0 / 3', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#e63946',
      })
      .setOrigin(0.5);

    // Streak Pill
    this.createPill(335, statsY, pillW, pillH, 'SERİ');
    this.hudStreak = this.add
      .text(335, statsY + 6, '0', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#f39c12',
      })
      .setOrigin(0.5);

    // Score Pill
    this.createPill(465, statsY, pillW, pillH, 'SKOR');
    this.hudScore = this.add
      .text(465, statsY + 6, '0', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Pause & Reset Bottom Buttons
    const pauseBtn = this.add
      .container(170, 860)
      .setSize(180, 44)
      .setInteractive({ useHandCursor: true });

    const pBg = this.add.graphics();
    pBg.fillStyle(0x1d2d44, 1);
    pBg.lineStyle(1, 0x415a77, 1);
    pBg.fillRoundedRect(-90, -22, 180, 44, 6);
    pBg.strokeRoundedRect(-90, -22, 180, 44, 6);
    pauseBtn.add(pBg);

    this.pauseBtnText = this.add
      .text(0, 0, '⏸️ Duraklat', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#e0e1dd',
      })
      .setOrigin(0.5);
    pauseBtn.add(this.pauseBtnText);

    pauseBtn.on('pointerdown', () => {
      this.togglePause();
    });

    const resetBtn = this.add
      .container(370, 860)
      .setSize(180, 44)
      .setInteractive({ useHandCursor: true });

    const rBg = this.add.graphics();
    rBg.fillStyle(0x39281a, 1);
    rBg.lineStyle(1, 0x5a3e2b, 1);
    rBg.fillRoundedRect(-90, -22, 180, 44, 6);
    rBg.strokeRoundedRect(-90, -22, 180, 44, 6);
    resetBtn.add(rBg);

    const resetText = this.add
      .text(0, 0, '🔄 Yeniden Başlat', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#f39c12',
      })
      .setOrigin(0.5);
    resetBtn.add(resetText);

    resetBtn.on('pointerdown', () => {
      this.telemetry.recordReplayClicked({ mode: this.modeType, level: this.scenarioId });
      this.loadScenario(this.scenarioId, this.modeType);
    });
  }

  private createPill(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string
  ): Phaser.GameObjects.Text {
    const g = this.add.graphics();
    g.fillStyle(0x16222f, 1);
    g.lineStyle(1, 0x415a77, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);

    return this.add
      .text(x, y - 12, label, {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#778da9',
      })
      .setOrigin(0.5);
  }

  private createStationDepots(): void {
    const stations: Array<{
      id: NetworkNode;
      color: number;
      label: string;
      symbol: string;
      sub: string;
    }> = [
      { id: 'RED', color: 0xe63946, label: 'R', symbol: '◼', sub: 'KIRMIZI' },
      { id: 'BLUE', color: 0x0077b6, label: 'B', symbol: '●', sub: 'MAVİ' },
      { id: 'GREEN', color: 0x2d6a4f, label: 'G', symbol: '▲', sub: 'YEŞİL' },
      { id: 'YELLOW', color: 0xe09f3e, label: 'Y', symbol: '◆', sub: 'SARI' },
    ];

    for (const st of stations) {
      const pos = this.NODE_COORDS[st.id];
      const g = this.add.graphics().setDepth(3);

      // Station Diorama Depot House
      g.fillStyle(0x000000, 0.35); // Soft drop shadow
      g.fillRoundedRect(pos.x - 34, pos.y - 24, 68, 56, 10);

      g.fillStyle(st.color, 0.95); // Station body
      g.lineStyle(2, 0xffffff, 0.9);
      g.fillRoundedRect(pos.x - 34, pos.y - 28, 68, 56, 10);
      g.strokeRoundedRect(pos.x - 34, pos.y - 28, 68, 56, 10);

      // Beveled Roof highlight
      g.fillStyle(0xffffff, 0.25);
      g.fillRoundedRect(pos.x - 32, pos.y - 26, 64, 14, 6);

      // Letter & Accessibility Symbol
      this.add
        .text(pos.x, pos.y - 6, `${st.symbol} ${st.label}`, {
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setDepth(4);

      this.add
        .text(pos.x, pos.y + 14, st.sub, {
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '9px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setDepth(4);

      // Target Badge container (shown when this station is targeted)
      const badgeCont = this.add.container(pos.x, pos.y - 42).setDepth(15);
      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(0xffd166, 1);
      badgeBg.lineStyle(1, 0xffffff, 1);
      badgeBg.fillRoundedRect(-32, -10, 64, 20, 5);
      badgeBg.strokeRoundedRect(-32, -10, 64, 20, 5);
      badgeCont.add(badgeBg);

      const badgeTxt = this.add
        .text(0, 0, '🎯 HEDEF', {
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#141c24',
        })
        .setOrigin(0.5);
      badgeCont.add(badgeTxt);
      badgeCont.setVisible(false);

      this.targetBadges.set(st.id, badgeCont);
    }

    // Source Depot (Parcel Express Hub)
    const srcPos = this.NODE_COORDS.SOURCE;
    const srcG = this.add.graphics().setDepth(3);
    srcG.fillStyle(0x000000, 0.35); // Shadow
    srcG.fillRoundedRect(srcPos.x - 45, srcPos.y - 20, 90, 48, 10);

    srcG.fillStyle(0x1d2d44, 1);
    srcG.lineStyle(2, 0x48cae4, 0.9);
    srcG.fillRoundedRect(srcPos.x - 45, srcPos.y - 24, 90, 48, 10);
    srcG.strokeRoundedRect(srcPos.x - 45, srcPos.y - 24, 90, 48, 10);

    this.add
      .text(srcPos.x, srcPos.y - 6, '📦 HUB', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#48cae4',
      })
      .setOrigin(0.5)
      .setDepth(4);

    this.add
      .text(srcPos.x, srcPos.y + 10, 'PARCEL EXP', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '8px',
        fontStyle: 'bold',
        color: '#a8dadc',
      })
      .setOrigin(0.5)
      .setDepth(4);
  }

  private createJunctionControls(): void {
    const junctions: JunctionId[] = ['J1', 'J2', 'J3'];

    for (const jId of junctions) {
      const pos = this.NODE_COORDS[jId];
      const container = this.add.container(pos.x, pos.y).setDepth(20);
      container.setSize(86, 86);
      container.setInteractive({ useHandCursor: true });

      container.on('pointerdown', () => {
        this.handleJunctionTap(jId);
      });

      this.junctionButtons.set(jId, container);
    }
  }

  private handleJunctionTap(junction: JunctionId): void {
    if (this.isPaused || this.network.status !== 'RUNNING') {
      return;
    }

    if (!this.network.isJunctionActive(junction)) {
      this.sounds.playFail();
      this.telemetry.recordInvalidTap('junction_inactive', {
        junction,
        mode: this.modeType,
        level: this.scenarioId,
      });
      this.flashJunction(junction, 0x6c757d);
      this.setStatusText(`🔒 ${junction} makası bu seviyede sabittir.`);
      return;
    }

    if (this.network.isJunctionLocked(junction)) {
      this.sounds.playFail();
      this.telemetry.recordInvalidTap('junction_locked', {
        junction,
        mode: this.modeType,
        level: this.scenarioId,
      });
      this.flashJunction(junction, 0xe63946);
      this.setStatusText(`⚠️ Araç makastan geçerken yön değiştirilemez!`);
      return;
    }

    const success = this.network.toggleJunction(junction);
    if (success) {
      this.sounds.playRotate();
      this.telemetry.recordValidMove({
        junction,
        newState: this.getJunctionState(junction),
        mode: this.modeType,
        level: this.scenarioId,
      });

      // Snappy rotation spring bounce tween (0.18s)
      const container = this.junctionButtons.get(junction);
      if (container) {
        this.tweens.add({
          targets: container,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 90,
          yoyo: true,
          ease: 'Quad.easeInOut',
        });
      }

      this.updateJunctionVisuals();
    }
  }

  private getJunctionState(jId: JunctionId): string {
    if (jId === 'J1') return this.network.j1;
    if (jId === 'J2') return this.network.j2;
    return this.network.j3;
  }

  private flashJunction(junction: JunctionId, color: number = 0xe63946): void {
    const container = this.junctionButtons.get(junction);
    if (!container) return;

    const flash = this.add.graphics();
    flash.lineStyle(3, color, 1);
    flash.strokeCircle(container.x, container.y, 42);
    flash.setDepth(35);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 1.35,
      scaleY: 1.35,
      duration: 250,
      onComplete: () => flash.destroy(),
    });
  }

  private updateJunctionVisuals(): void {
    const junctions: JunctionId[] = ['J1', 'J2', 'J3'];

    for (const jId of junctions) {
      const container = this.junctionButtons.get(jId);
      if (!container) continue;

      container.removeAll(true);
      const isActive = this.network.isJunctionActive(jId);
      const isLocked = this.network.isJunctionLocked(jId);

      const circle = this.add.graphics();

      // Soft drop shadow
      circle.fillStyle(0x000000, 0.35);
      circle.fillCircle(2, 4, 34);

      if (!isActive) {
        // Inactive / Fixed junction styling
        circle.fillStyle(0x161d27, 0.85);
        circle.lineStyle(2, 0x415a77, 0.6);
        circle.fillCircle(0, 0, 34);
        circle.strokeCircle(0, 0, 34);
        container.add(circle);

        const nameText = this.add
          .text(0, -12, jId, {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#8d99ae',
          })
          .setOrigin(0.5);
        container.add(nameText);

        const lockBadge = this.add
          .text(0, 10, '🔒 SABİT', {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '9px',
            fontStyle: 'bold',
            color: '#778da9',
          })
          .setOrigin(0.5);
        container.add(lockBadge);
      } else if (isLocked) {
        // Locked due to vehicle in-transit
        circle.fillStyle(0x2b1e1e, 1);
        circle.lineStyle(3, 0xe63946, 1);
        circle.fillCircle(0, 0, 34);
        circle.strokeCircle(0, 0, 34);
        container.add(circle);

        const nameText = this.add
          .text(0, -12, jId, {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ffffff',
          })
          .setOrigin(0.5);
        container.add(nameText);

        const lockText = this.add
          .text(0, 10, '⚠️ GEÇİŞTE', {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '9px',
            fontStyle: 'bold',
            color: '#e63946',
          })
          .setOrigin(0.5);
        container.add(lockText);
      } else {
        // Active and switchable
        circle.fillStyle(0x1b263b, 1);
        circle.lineStyle(2, 0x48cae4, 1);
        circle.fillCircle(0, 0, 34);
        circle.strokeCircle(0, 0, 34);
        container.add(circle);

        // Dial Bevel highlight
        circle.fillStyle(0xffffff, 0.15);
        circle.fillCircle(0, -12, 16);

        const nameText = this.add
          .text(0, -12, jId, {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ffffff',
          })
          .setOrigin(0.5);
        container.add(nameText);

        let dirArrow = '';
        if (jId === 'J1') {
          dirArrow = this.network.j1 === 'LEFT' ? '◀ SOL (J2)' : 'SAĞ (J3) ▶';
        } else if (jId === 'J2') {
          dirArrow = this.network.j2 === 'RED' ? '◀ ◼ R' : '● B ▶';
        } else if (jId === 'J3') {
          dirArrow = this.network.j3 === 'GREEN' ? '◀ ▲ G' : '◆ Y ▶';
        }

        const dirText = this.add
          .text(0, 10, dirArrow, {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '9px',
            fontStyle: 'bold',
            color: '#48cae4',
          })
          .setOrigin(0.5);
        container.add(dirText);
      }
    }

    this.drawTracks();
  }

  // =========================================================================
  // TRACKS & PATH PREVIEW (Visual Path Projection)
  // =========================================================================
  private drawTracks(): void {
    this.trackGraphics.clear();
    this.pathPreviewGraphics.clear();

    const drawRailBed = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      // Dark ballast bed
      this.trackGraphics.lineStyle(10, 0x0a1017, 1);
      this.trackGraphics.lineBetween(from.x, from.y, to.x, to.y);

      // Steel sleeper ties (diorama modular look)
      this.trackGraphics.lineStyle(6, 0x1f2c3a, 0.9);
      this.trackGraphics.lineBetween(from.x, from.y, to.x, to.y);
    };

    const drawRailWire = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      isActive: boolean
    ) => {
      if (isActive) {
        // Active bright illuminated route
        this.pathPreviewGraphics.lineStyle(4, 0x48cae4, 0.95);
        this.pathPreviewGraphics.lineBetween(from.x, from.y, to.x, to.y);
      } else {
        // Inactive track wire
        this.trackGraphics.lineStyle(2, 0x223344, 0.6);
        this.trackGraphics.lineBetween(from.x, from.y, to.x, to.y);
      }
    };

    // Draw all track beds
    drawRailBed(this.NODE_COORDS.SOURCE, this.NODE_COORDS.J1);
    drawRailBed(this.NODE_COORDS.J1, this.NODE_COORDS.J2);
    drawRailBed(this.NODE_COORDS.J1, this.NODE_COORDS.J3);
    drawRailBed(this.NODE_COORDS.J2, this.NODE_COORDS.RED);
    drawRailBed(this.NODE_COORDS.J2, this.NODE_COORDS.BLUE);
    drawRailBed(this.NODE_COORDS.J3, this.NODE_COORDS.GREEN);
    drawRailBed(this.NODE_COORDS.J3, this.NODE_COORDS.YELLOW);

    // Active path projection: Follow current switch states from SOURCE to target station
    const j1Left = this.network.j1 === 'LEFT';
    const j2Red = this.network.j2 === 'RED';
    const j3Green = this.network.j3 === 'GREEN';

    drawRailWire(this.NODE_COORDS.SOURCE, this.NODE_COORDS.J1, true);
    drawRailWire(this.NODE_COORDS.J1, this.NODE_COORDS.J2, j1Left);
    drawRailWire(this.NODE_COORDS.J1, this.NODE_COORDS.J3, !j1Left);

    drawRailWire(this.NODE_COORDS.J2, this.NODE_COORDS.RED, j1Left && j2Red);
    drawRailWire(this.NODE_COORDS.J2, this.NODE_COORDS.BLUE, j1Left && !j2Red);

    drawRailWire(this.NODE_COORDS.J3, this.NODE_COORDS.GREEN, !j1Left && j3Green);
    drawRailWire(this.NODE_COORDS.J3, this.NODE_COORDS.YELLOW, !j1Left && !j3Green);
  }

  // =========================================================================
  // UPDATE LOOP & VEHICLE RENDERING
  // =========================================================================
  public update(_time: number, delta: number): void {
    if (this.isPaused || !this.network || this.network.status !== 'RUNNING') {
      return;
    }

    const tickMs = this.network.tickDurationMs || 700;
    this.tickAccumulatorMs += delta;
    this.glowTimer += delta;

    // Advance simulation ticks
    while (this.tickAccumulatorMs >= tickMs) {
      this.tickAccumulatorMs -= tickMs;
      this.stepSimulationTick();
    }

    // Interpolation progress between simulation ticks
    const interpProgress = Math.min(1.0, this.tickAccumulatorMs / tickMs);
    this.renderVehicles(interpProgress);

    // Render 1-second preparation indicator at SOURCE
    this.renderPreparationIndicator(delta);

    // Highlight target station for the leading vehicle
    const activeVehicles = this.network.vehicles.filter(
      (v) => v.state !== 'DELIVERED' && v.state !== 'MISDELIVERED'
    );
    const leading = activeVehicles[0];
    this.renderStationHighlights(leading ? leading.targetStation : null);
  }

  private stepSimulationTick(): void {
    const prevCorrect = this.network.correctCount;
    const prevMistakes = this.network.mistakeCount;

    this.network.tick();

    // Check newly delivered or misdelivered
    if (this.network.correctCount > prevCorrect) {
      this.sounds.playGoalSuccess();
      const lastDelivered = this.network.vehicles.find((v) => v.state === 'DELIVERED');
      this.telemetry.recordVehicleDelivered(
        lastDelivered?.id || 0,
        lastDelivered?.targetStation || '',
        this.network.currentStreak
      );
    }

    if (this.network.mistakeCount > prevMistakes) {
      this.sounds.playFail();
      const lastFailed = this.network.vehicles.find((v) => v.state === 'MISDELIVERED');
      this.telemetry.recordVehicleMisdelivered(
        lastFailed?.id || 0,
        lastFailed?.currentNode || '',
        lastFailed?.targetStation || '',
        this.network.mistakeCount
      );
    }

    this.updateHUD();
    this.updateJunctionVisuals();

    // Check end state
    if (this.network.status === 'WON') {
      this.sounds.playWin();
      this.telemetry.recordRunWon(this.network.score, {
        submode: this.modeType === 'progressive' ? '2.0' : 'classic',
        district: this.network.district || 'classic',
        levelFamily: this.network.levelFamily || 'classic',
        scenario: this.scenarioId,
        correct: this.network.correctCount,
        mistakes: this.network.mistakeCount,
        maxStreak: this.network.maxStreak,
      });
      this.setStatusText(`🎉 TEBRİKLER! Seviye tamamlandı! Skor: ${this.network.score}`);
      this.showEndModal(true);
    } else if (this.network.status === 'LOST') {
      this.sounds.playFail();
      this.telemetry.recordRunLost('mistake_limit_reached', this.network.score, {
        submode: this.modeType === 'progressive' ? '2.0' : 'classic',
        district: this.network.district || 'classic',
        levelFamily: this.network.levelFamily || 'classic',
        scenario: this.scenarioId,
        correct: this.network.correctCount,
        mistakes: this.network.mistakeCount,
        maxMistakes: this.network.maxMistakes,
      });
      this.setStatusText(`❌ OYUN BİTTİ! Hata limiti aşıldı. Skor: ${this.network.score}`);
      this.showEndModal(false);
    }
  }

  // 1-Second Preparation Countdown at SOURCE (FAZ 1.1)
  private renderPreparationIndicator(delta: number): void {
    this.prepGraphics.clear();

    const nextColor = this.network.manifest[0];
    const canSpawn =
      this.network.maxConcurrentVehicles === undefined ||
      this.network.getActiveVehicleCount() < this.network.maxConcurrentVehicles;

    if (nextColor && !this.network.isNodeOccupied('SOURCE') && canSpawn) {
      this.prepProgress = (this.prepProgress + delta * 0.002) % 1.0;
      const srcPos = this.NODE_COORDS.SOURCE;
      const col = this.STATION_COLORS[nextColor];
      const sym = this.STATION_SYMBOLS[nextColor];

      // Pulsing radar ring
      const ringRadius = 28 + this.prepProgress * 18;
      this.prepGraphics.lineStyle(2, col, 1 - this.prepProgress);
      this.prepGraphics.strokeCircle(srcPos.x, srcPos.y, ringRadius);

      this.prepStatusText.setText(`📦 HAZIRLANIYOR: [${sym} ${nextColor}]`);
      this.prepStatusText.setVisible(true);
    } else {
      this.prepStatusText.setVisible(false);
    }
  }

  private renderVehicles(interpProgress: number): void {
    this.vehicleGraphics.clear();

    for (const lbl of this.vehicleLabels) {
      lbl.destroy();
    }
    this.vehicleLabels = [];

    const activeVehicles = this.network.vehicles.filter(
      (v) => v.state !== 'DELIVERED' && v.state !== 'MISDELIVERED'
    );

    for (let i = 0; i < activeVehicles.length; i++) {
      const v = activeVehicles[i];
      let x = 0;
      let y = 0;

      if (v.state === 'MOVING' && v.fromNode && v.toNode) {
        const fromPos = this.NODE_COORDS[v.fromNode];
        const toPos = this.NODE_COORDS[v.toNode];
        x = fromPos.x + (toPos.x - fromPos.x) * interpProgress;
        y = fromPos.y + (toPos.y - fromPos.y) * interpProgress;
      } else {
        const nodePos = this.NODE_COORDS[v.currentNode];
        x = nodePos ? nodePos.x : 270;
        y = nodePos ? nodePos.y : 130;
      }

      // 1. Soft Drop Shadow underneath toy van
      this.vehicleGraphics.fillStyle(0x000000, 0.4);
      this.vehicleGraphics.fillEllipse(x + 2, y + 4, 38, 22);

      // 2. Toy Van Chassis
      const color = this.STATION_COLORS[v.color];
      this.vehicleGraphics.fillStyle(color, 1);
      this.vehicleGraphics.lineStyle(i === 0 ? 3 : 2, i === 0 ? 0xffd166 : 0xffffff, 1);
      this.vehicleGraphics.fillRoundedRect(x - 19, y - 18, 38, 36, 8);
      this.vehicleGraphics.strokeRoundedRect(x - 19, y - 18, 38, 36, 8);

      // 3. Beveled Roof Strip
      this.vehicleGraphics.fillStyle(0xffffff, 0.28);
      this.vehicleGraphics.fillRoundedRect(x - 16, y - 16, 32, 14, 5);

      // 4. Toy Rubber Wheels
      this.vehicleGraphics.fillStyle(0x161d27, 1);
      this.vehicleGraphics.fillRoundedRect(x - 22, y - 14, 5, 10, 2);
      this.vehicleGraphics.fillRoundedRect(x + 17, y - 14, 5, 10, 2);
      this.vehicleGraphics.fillRoundedRect(x - 22, y + 4, 5, 10, 2);
      this.vehicleGraphics.fillRoundedRect(x + 17, y + 4, 5, 10, 2);

      // 5. Letter & Color-Blind Symbol badge
      const sym = this.STATION_SYMBOLS[v.color];
      const lbl = this.add
        .text(x, y - 1, `${sym} ${v.color}`, {
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setDepth(12);

      this.vehicleLabels.push(lbl);
    }
  }

  private renderStationHighlights(targetStation: NetworkNode | null): void {
    this.stationHighlightGraphics.clear();

    for (const [node, badge] of this.targetBadges.entries()) {
      if (node === targetStation) {
        badge.setVisible(true);

        const pos = this.NODE_COORDS[node];
        // Pulsating golden halo
        const pulse = 0.5 + 0.5 * Math.sin(this.glowTimer * 0.009);
        this.stationHighlightGraphics.lineStyle(4, 0xffd166, 0.75 + 0.25 * pulse);
        this.stationHighlightGraphics.strokeRoundedRect(
          pos.x - 39,
          pos.y - 33,
          78,
          66,
          12
        );
      } else {
        badge.setVisible(false);
      }
    }
  }

  private updateHUD(): void {
    if (!this.network) return;

    const maxVal = this.modeType === 'progressive' ? 30 : 10;
    const districtIcons: Record<string, string> = {
      suburb: '🏡 Suburb',
      downtown: '🏙️ Downtown',
      industrial: '🏭 Industrial',
      harbor: '⚓ Harbor',
      night_express: '🌃 Night Express',
    };

    if (this.modeType === 'progressive') {
      const distName = districtIcons[this.network.district || 'suburb'];
      this.hudDistrictBadge.setText(
        `🚀 [${distName}] Seviye ${this.scenarioId}/${maxVal}`
      );
    } else {
      this.hudDistrictBadge.setText(`⚡ [Classic GDD] Senaryo ${this.scenarioId}/${maxVal}`);
    }

    const totalInScenario = this.network.vehicles.length + this.network.manifest.length;
    this.hudCorrect.setText(`${this.network.correctCount} / ${totalInScenario}`);
    this.hudMistakes.setText(`${this.network.mistakeCount} / ${this.network.maxMistakes}`);
    this.hudMistakeLabel.setText(`HATA (MAX ${this.network.maxMistakes - 1})`);
    this.hudStreak.setText(`${this.network.currentStreak}`);
    this.hudScore.setText(`${this.network.score}`);

    // Manifest Preview
    const preview = this.network.manifest.slice(0, 5).map(c => `${this.STATION_SYMBOLS[c]}${c}`).join(' ➔ ');
    this.manifestPreviewText.setText(preview ? `Sıradaki: [ ${preview} ]` : 'Manifesto Tamamlandı!');
  }

  private setStatusText(msg: string): void {
    if (this.statusBannerText) {
      this.statusBannerText.setText(msg);
    }
  }

  private togglePause(): void {
    if (this.network.status === 'RUNNING') {
      this.network.pause();
      this.isPaused = true;
      this.pauseBtnText.setText('▶️ Devam Et');
      this.setStatusText('Oyun duraklatıldı.');
    } else if (this.network.status === 'PAUSED') {
      this.network.resume();
      this.isPaused = false;
      this.pauseBtnText.setText('⏸️ Duraklat');
      this.setStatusText('Simülasyon devam ediyor.');
    }
  }

  // =========================================================================
  // FAZ 4: PARCEL EXPRESS NARRATIVE MODALS
  // =========================================================================
  private showDistrictIntroModal(district: DistrictId): void {
    this.dismissModal();

    this.modalContainer = this.add.container(270, 480).setDepth(100);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(-270, -480, 540, 960);
    this.modalContainer.add(overlay);

    const box = this.add.graphics();
    box.fillStyle(0x16222f, 1);
    box.lineStyle(2, 0xffd166, 1);
    box.fillRoundedRect(-200, -140, 400, 280, 14);
    box.strokeRoundedRect(-200, -140, 400, 280, 14);
    this.modalContainer.add(box);

    const titles: Record<DistrictId, { name: string; desc: string; icon: string }> = {
      suburb: {
        name: '🏡 SUBURB ŞUBESİ',
        desc: 'Parcel Express operasyonuna hoş geldiniz!\nSakin banliyö mahallesinde ilk teslimatlarınızı yapın.\nMakasları öğrenin ve ilk vagonları doğru depolara ulaştırın.',
        icon: '🏡',
      },
      downtown: {
        name: '🏙️ DOWNTOWN MERKEZİ',
        desc: 'Tebrikler Operasyon Yöneticisi!\nŞehir merkezine terfi ettiniz. Dört renkli teslimatlar\nve yoğun şehir içi kavşakları sizi bekliyor.',
        icon: '🏙️',
      },
      industrial: {
        name: '🏭 SANAYİ VE ÜRETİM HATTI',
        desc: 'Ağır sanayi bölgesinde vardiya başladı!\nFabrika ve depo hatlarında blok kargo trenlerini\nzamanında yönlendirerek üretimi aksatmayın.',
        icon: '🏭',
      },
      harbor: {
        name: '⚓ LİMAN LOJİSTİĞİ',
        desc: 'Büyük uluslararası limana ulaştınız!\nKargo gemilerinden inen konteynerleri\nrıhtım iskelelerine hızla yönlendirin.',
        icon: '⚓',
      },
      night_express: {
        name: '🌃 NIGHT EXPRESS DİREKTÖRLÜĞÜ',
        desc: 'Metropol Lojistik Direktörlüğü Nihai Sınavı!\nIşıklı gece raylarında aralıksız ekspres trenleri\nhatasız yöneterek şehri birbirine bağlayın.',
        icon: '🌃',
      },
    };

    const info = titles[district];

    const title = this.add
      .text(0, -95, info.name, {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffd166',
      })
      .setOrigin(0.5);
    this.modalContainer.add(title);

    const sub = this.add
      .text(0, -70, 'PARCEL EXPRESS BÖLGE YETKİ BELGESİ', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#48cae4',
      })
      .setOrigin(0.5);
    this.modalContainer.add(sub);

    const descText = this.add
      .text(0, -10, info.desc, {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '13px',
        color: '#e0e1dd',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
    this.modalContainer.add(descText);

    // Dismiss & Start button
    const startBtn = this.add
      .text(0, 80, 'Göreve Başla ➔', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#1d3557',
        padding: { x: 24, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startBtn.on('pointerdown', () => {
      this.dismissModal();
    });
    this.modalContainer.add(startBtn);
  }

  private showEndModal(isWin: boolean): void {
    this.dismissModal();

    this.modalContainer = this.add.container(270, 480).setDepth(100);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(-270, -480, 540, 960);
    this.modalContainer.add(overlay);

    const box = this.add.graphics();
    box.fillStyle(0x16222f, 1);
    box.lineStyle(2, isWin ? 0x52b788 : 0xe63946, 1);
    box.fillRoundedRect(-200, -150, 400, 300, 14);
    box.strokeRoundedRect(-200, -150, 400, 300, 14);
    this.modalContainer.add(box);

    const titleText = isWin
      ? '🏆 SEVİYE TAMAMLANDI!'
      : `💥 OYUN BİTTİ (${this.network.maxMistakes} HATA)`;
    const titleColor = isWin ? '#52b788' : '#e63946';

    const title = this.add
      .text(0, -110, titleText, {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: titleColor,
      })
      .setOrigin(0.5);
    this.modalContainer.add(title);

    const details = `Toplam Skor: ${this.network.score}\nBaşarılı Teslimat: ${this.network.correctCount}\nHatalar: ${this.network.mistakeCount} / ${this.network.maxMistakes}\nEn Uzun Seri: ${this.network.maxStreak}`;
    const detailsText = this.add
      .text(0, -40, details, {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '14px',
        color: '#e0e1dd',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
    this.modalContainer.add(detailsText);

    // Voluntary Replay Button
    const retryBtn = this.add
      .text(0, 45, '🔄 Bu Bölümü Tekrar Dene', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#1d3557',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    retryBtn.on('pointerdown', () => {
      this.telemetry.recordReplayClicked({ mode: this.modeType, level: this.scenarioId });
      this.loadScenario(this.scenarioId, this.modeType);
    });
    this.modalContainer.add(retryBtn);

    // Next Level Button if won and exists
    const maxVal = this.modeType === 'progressive' ? 30 : 10;
    if (isWin && this.scenarioId < maxVal) {
      const nextBtn = this.add
        .text(0, 100, `Sonraki Seviye (${this.scenarioId + 1}) ➔`, {
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#48cae4',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      nextBtn.on('pointerdown', () => {
        this.telemetry.recordExitClicked({ mode: this.modeType, level: this.scenarioId });
        this.loadScenario(this.scenarioId + 1, this.modeType);
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
