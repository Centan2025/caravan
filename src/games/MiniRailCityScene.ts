import Phaser from 'phaser';
import { GraphSwitchNetwork } from '../core/switch/graph/GraphSwitchNetwork';
import { GraphTopology } from '../core/switch/graph/GraphTopology';
import {
  SIDING_LEVEL_101,
  SIDING_LEVEL_104_DUAL,
  SIDING_LEVEL_103_FIFO,
  ALL_SIDING_LEVELS,
} from '../core/switch/graph/SidingLevels';
import {
  GraphScenarioDefinition,
  GraphTopologyDef,
} from '../core/switch/graph/GraphTypes';
import {
  MiniRailDioramaRegistry,
  MiniRailDioramaConfig,
  DioramaPoint,
} from '../core/switch/graph/MiniRailDioramaLayouts';
import { SoundEffects } from '../audio/SoundEffects';

export class MiniRailCityScene extends Phaser.Scene {
  private network!: GraphSwitchNetwork;
  private scenario!: GraphScenarioDefinition;
  private dioramaConfig!: MiniRailDioramaConfig;
  private scenarioIndex: number = 0;
  private sounds = new SoundEffects();

  // Visual Layers
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private trackBedGraphics!: Phaser.GameObjects.Graphics;
  private sleepersGraphics!: Phaser.GameObjects.Graphics;
  private railsGraphics!: Phaser.GameObjects.Graphics;
  private switchPointsGraphics!: Phaser.GameObjects.Graphics;
  private propsContainer!: Phaser.GameObjects.Container;
  private trainsContainer!: Phaser.GameObjects.Container;
  private hudContainer!: Phaser.GameObjects.Container;

  // Interactive Switch Controls
  private switchControls: Map<string, Phaser.GameObjects.Container> = new Map();
  private sidingReleaseButtons: Map<string, Phaser.GameObjects.Container> = new Map();

  // Tick & Run state
  private isSimulationPaused: boolean = false;
  private tickAccumulatorMs: number = 0;
  private lastDeliveryCount: number = 0;
  private lastMistakeCount: number = 0;

  // Top & Bottom HUD objects
  private deliveriesText!: Phaser.GameObjects.Text;
  private mistakesText!: Phaser.GameObjects.Text;
  private manifestContainer!: Phaser.GameObjects.Container;
  private statusBannerText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MiniRailCityScene' });
  }

  public init(data: { scenarioIndex?: number; levelId?: number }): void {
    if (data.levelId !== undefined) {
      if (data.levelId === 104) {
        this.scenario = SIDING_LEVEL_104_DUAL;
        this.scenarioIndex = 5;
      } else if (data.levelId === 1032 || data.levelId === 103) {
        this.scenario = SIDING_LEVEL_103_FIFO;
        this.scenarioIndex = 6;
      } else {
        this.scenario = SIDING_LEVEL_101;
        this.scenarioIndex = 0;
      }
    } else {
      this.scenarioIndex = data.scenarioIndex ?? 0;
      this.scenario = ALL_SIDING_LEVELS[this.scenarioIndex] || SIDING_LEVEL_101;
    }

    const topoDef = (this.scenario.topology as GraphTopologyDef) || SIDING_LEVEL_101.topology;
    this.dioramaConfig = MiniRailDioramaRegistry.getDioramaConfig(this.scenario.id, topoDef);
  }

  public create(): void {
    const topoDef = (this.scenario.topology as GraphTopologyDef) || SIDING_LEVEL_101.topology;
    this.network = new GraphSwitchNetwork(this.scenario, new GraphTopology(topoDef));
    this.network.start();

    this.switchControls.clear();
    this.sidingReleaseButtons.clear();
    this.lastDeliveryCount = 0;
    this.lastMistakeCount = 0;
    this.tickAccumulatorMs = 0;

    // Display Layers
    this.bgGraphics = this.add.graphics();
    this.trackBedGraphics = this.add.graphics();
    this.sleepersGraphics = this.add.graphics();
    this.railsGraphics = this.add.graphics();
    this.switchPointsGraphics = this.add.graphics();
    this.propsContainer = this.add.container(0, 0);
    this.trainsContainer = this.add.container(0, 0);
    this.hudContainer = this.add.container(0, 0);

    // Diorama Board & Scenery
    this.renderDioramaBase();
    this.renderSceneryProps();
    this.renderStationsAndHub();
    this.renderTracks();
    this.renderSwitchStands();
    this.renderSidingPlatforms();

    // Modern Casual Mobile HUD
    this.createCasualMobileHUD();

    this.cameras.main.setBackgroundColor('#261c16');
  }

  // ===========================================================================
  // DIORAMA TABLETOP BOARD (Faz 2 & 4)
  // ===========================================================================
  private renderDioramaBase(): void {
    const g = this.bgGraphics;
    g.clear();

    const t = this.dioramaConfig.theme;
    const boardX = 20;
    const boardY = 16;
    const boardW = 500;
    const boardH = 850;
    const radius = 28;

    // Board Drop Shadow
    g.fillStyle(0x0a0705, 0.45);
    g.fillRoundedRect(boardX + 4, boardY + 8, boardW, boardH, radius);

    // Warm Wooden Diorama Outer Rim
    g.fillStyle(t.tableColor, 1.0);
    g.fillRoundedRect(boardX, boardY, boardW, boardH, radius);

    // Inner Wood Bevel / Rim Shadow
    g.fillStyle(0x000000, 0.15);
    g.fillRoundedRect(boardX + 8, boardY + 8, boardW - 16, boardH - 16, radius - 4);

    // Diorama Ground (Meadow / Cobblestone / Terracotta)
    g.fillStyle(t.groundColor, 1.0);
    g.fillRoundedRect(boardX + 10, boardY + 10, boardW - 20, boardH - 20, radius - 6);

    // Organic Elevation Terrace Patches (Adds Depth)
    g.fillStyle(t.groundAccentColor, 0.65);
    if (this.scenario.id === 101) {
      g.fillRoundedRect(35, 160, 200, 300, 40);
      g.fillRoundedRect(310, 480, 180, 260, 35);
    } else if (this.scenario.id === 104) {
      g.fillRoundedRect(40, 210, 190, 140, 20);
      g.fillRoundedRect(310, 470, 190, 140, 20);
    } else {
      g.fillRoundedRect(35, 260, 190, 260, 30);
      g.fillRoundedRect(310, 140, 180, 180, 25);
    }
  }

  // ===========================================================================
  // SCENERY PROPS (Trees, Water Pond, Rocks, Crates)
  // ===========================================================================
  private renderSceneryProps(): void {
    const t = this.dioramaConfig.theme;

    for (const prop of t.props) {
      if (prop.type === 'water_pond') {
        const sz = prop.size ?? 75;
        const pondShadow = this.add.ellipse(prop.x + 2, prop.y + 4, sz * 1.4, sz * 0.9, 0x000000, 0.18);
        const pondBed = this.add.ellipse(prop.x, prop.y, sz * 1.4, sz * 0.9, 0x48cae4, 0.95);
        const pondDeep = this.add.ellipse(prop.x - 4, prop.y - 2, sz * 0.9, sz * 0.55, 0x0096c7, 0.9);
        const ripple = this.add.ellipse(prop.x + 8, prop.y + 6, sz * 0.45, sz * 0.22, 0xffffff, 0.4);
        this.propsContainer.add([pondShadow, pondBed, pondDeep, ripple]);
      } else if (prop.type === 'tree_round') {
        const sz = prop.size ?? 22;
        const shadow = this.add.ellipse(prop.x + 2, prop.y + sz, sz * 1.1, sz * 0.5, 0x000000, 0.22);
        const trunk = this.add.rectangle(prop.x, prop.y + sz * 0.5, 6, sz * 0.8, 0x5d4037);
        const crownShadow = this.add.circle(prop.x, prop.y + 2, sz, 0x2d6a4f);
        const crown = this.add.circle(prop.x, prop.y, sz, 0x52b788);
        const highlight = this.add.circle(prop.x - sz * 0.35, prop.y - sz * 0.35, sz * 0.35, 0x95d5b2, 0.8);
        this.propsContainer.add([shadow, trunk, crownShadow, crown, highlight]);
      } else if (prop.type === 'tree_pine') {
        const sz = prop.size ?? 24;
        const shadow = this.add.ellipse(prop.x + 2, prop.y + sz, sz * 1.1, sz * 0.5, 0x000000, 0.22);
        const trunk = this.add.rectangle(prop.x, prop.y + sz * 0.6, 6, sz * 0.8, 0x4e342e);
        const gPine = this.add.graphics();
        gPine.fillStyle(0x1b4332, 1.0);
        gPine.fillTriangle(prop.x - sz * 0.8, prop.y + sz * 0.4, prop.x + sz * 0.8, prop.y + sz * 0.4, prop.x, prop.y - sz * 0.3);
        gPine.fillStyle(0x2d6a4f, 1.0);
        gPine.fillTriangle(prop.x - sz * 0.65, prop.y, prop.x + sz * 0.65, prop.y, prop.x, prop.y - sz * 0.8);
        this.propsContainer.add([shadow, trunk, gPine]);
      } else if (prop.type === 'rock') {
        const sz = prop.size ?? 28;
        const shadow = this.add.ellipse(prop.x + 3, prop.y + 3, sz * 1.2, sz * 0.8, 0x000000, 0.25);
        const rockBase = this.add.ellipse(prop.x, prop.y, sz * 1.2, sz * 0.8, prop.color ?? 0x795548);
        const rockTop = this.add.ellipse(prop.x - 3, prop.y - 2, sz * 0.8, sz * 0.5, 0xa1887f);
        this.propsContainer.add([shadow, rockBase, rockTop]);
      } else if (prop.type === 'cargo_crates') {
        const sz = prop.size ?? 28;
        const shadow = this.add.rectangle(prop.x + 3, prop.y + 3, sz * 1.2, sz, 0x000000, 0.25);
        const c1 = this.add.rectangle(prop.x - 6, prop.y, sz * 0.55, sz * 0.55, prop.color ?? 0xd97706);
        const c2 = this.add.rectangle(prop.x + 8, prop.y + 2, sz * 0.5, sz * 0.5, 0x0284c7);
        const c3 = this.add.rectangle(prop.x, prop.y - 10, sz * 0.45, sz * 0.45, 0x16a34a);
        this.propsContainer.add([shadow, c1, c2, c3]);
      } else if (prop.type === 'fence') {
        const gFence = this.add.graphics();
        gFence.lineStyle(3, 0x6d4c41, 0.9);
        const length = prop.size ?? 50;
        gFence.lineBetween(prop.x - length / 2, prop.y - 4, prop.x + length / 2, prop.y - 4);
        gFence.lineBetween(prop.x - length / 2, prop.y + 4, prop.x + length / 2, prop.y + 4);
        for (let fx = prop.x - length / 2; fx <= prop.x + length / 2; fx += 14) {
          gFence.lineBetween(fx, prop.y - 10, fx, prop.y + 10);
        }
        this.propsContainer.add(gFence);
      } else if (prop.type === 'crane') {
        const gCrane = this.add.graphics();
        gCrane.fillStyle(0x000000, 0.2);
        gCrane.fillCircle(prop.x + 3, prop.y + 3, 14);
        gCrane.fillStyle(0xf59e0b, 1.0);
        gCrane.fillCircle(prop.x, prop.y, 12);
        gCrane.lineStyle(4, 0xf59e0b, 1.0);
        gCrane.lineBetween(prop.x, prop.y, prop.x + 22, prop.y - 20);
        gCrane.lineStyle(2, 0x374151, 1.0);
        gCrane.lineBetween(prop.x + 22, prop.y - 20, prop.x + 22, prop.y - 4);
        this.propsContainer.add(gCrane);
      } else if (prop.type === 'warehouse') {
        const sz = prop.size ?? 48;
        const shadow = this.add.rectangle(prop.x + 4, prop.y + 4, sz * 1.1, sz * 0.9, 0x000000, 0.25);
        const shed = this.add.rectangle(prop.x, prop.y, sz * 1.1, sz * 0.9, 0x94a3b8);
        const roof = this.add.rectangle(prop.x, prop.y - 6, sz * 1.15, sz * 0.5, 0x475569);
        this.propsContainer.add([shadow, shed, roof]);
      }
    }
  }

  // ===========================================================================
  // REAL FREIGHT STATIONS & SOURCE HANGAR (Faz 2 & 4)
  // ===========================================================================
  private renderStationsAndHub(): void {
    const src = this.dioramaConfig.nodes['SOURCE'];
    if (src) {
      const portalShadow = this.add.ellipse(src.x + 2, src.y + 24, 76, 20, 0x000000, 0.3);
      const portalBody = this.add.rectangle(src.x, src.y, 76, 48, 0xd97706);
      portalBody.setStrokeStyle(3, 0x78350f);
      const portalRoof = this.add.rectangle(src.x, src.y - 16, 84, 20, 0x9a3412);
      const portalArch = this.add.ellipse(src.x, src.y + 14, 34, 22, 0x1c1917);
      const portalLabel = this.add
        .text(src.x, src.y - 5, '🚂 DEPO', {
          fontSize: '11px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      this.propsContainer.add([portalShadow, portalBody, portalRoof, portalArch, portalLabel]);
    }

    const stDetails = this.dioramaConfig.stationDetails;
    this.createMiniatureStation('RED', stDetails.RED);
    this.createMiniatureStation('BLUE', stDetails.BLUE);
  }

  private createMiniatureStation(
    colorKey: 'RED' | 'BLUE',
    data: { x: number; y: number; width: number; height: number; roofColor: number; label: string }
  ): void {
    const shadow = this.add.rectangle(data.x + 3, data.y + 6, data.width, data.height, 0x000000, 0.28);
    const platform = this.add.rectangle(data.x, data.y + 14, data.width + 12, 18, 0x94a3b8);
    platform.setStrokeStyle(2, 0x475569);

    const bodyColor = colorKey === 'RED' ? 0xffebee : 0xe1f5fe;
    const building = this.add.rectangle(data.x, data.y - 6, data.width - 12, 34, bodyColor);
    building.setStrokeStyle(2, colorKey === 'RED' ? 0xef5350 : 0x42a5f5);

    const roof = this.add.rectangle(data.x, data.y - 24, data.width, 16, data.roofColor);
    const icon = colorKey === 'RED' ? '■' : '●';
    const stTitle = this.add
      .text(data.x, data.y - 7, `${icon} ${data.label}`, {
        fontSize: '12px',
        color: colorKey === 'RED' ? '#b71c1c' : '#0d47a1',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const bufferStop = this.add.rectangle(data.x, data.y + 20, 36, 6, 0x263238);

    this.propsContainer.add([shadow, platform, building, roof, stTitle, bufferStop]);
  }

  // ===========================================================================
  // PHYSICAL TOY RAILWAY TRACKS (Ballast, Sleepers, Twin Rails)
  // ===========================================================================
  private renderTracks(): void {
    const t = this.dioramaConfig.theme;

    // 1. Ballast Roadbed
    this.trackBedGraphics.clear();
    this.trackBedGraphics.lineStyle(22, t.trackBedColor, 1.0);

    for (const edge of this.dioramaConfig.edges) {
      const pts = edge.points;
      if (pts.length < 2) continue;

      this.trackBedGraphics.beginPath();
      this.trackBedGraphics.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 2) {
        this.trackBedGraphics.lineTo(pts[1].x, pts[1].y);
      } else if (pts.length === 3) {
        this.trackBedGraphics.lineTo(pts[1].x, pts[1].y);
        this.trackBedGraphics.lineTo(pts[2].x, pts[2].y);
      }
      this.trackBedGraphics.strokePath();
    }

    // 2. Wooden Sleepers
    this.sleepersGraphics.clear();
    this.sleepersGraphics.lineStyle(5, t.sleeperColor, 0.95);

    for (const edge of this.dioramaConfig.edges) {
      const pts = edge.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        const steps = Math.floor(dist / 16);
        const angle = Phaser.Math.Angle.Between(p1.x, p1.y, p2.x, p2.y);
        const perpAngle = angle + Math.PI / 2;

        for (let s = 1; s <= steps; s++) {
          const u = s / (steps + 1);
          const cx = Phaser.Math.Linear(p1.x, p2.x, u);
          const cy = Phaser.Math.Linear(p1.y, p2.y, u);

          const hx = Math.cos(perpAngle) * 9.5;
          const hy = Math.sin(perpAngle) * 9.5;

          this.sleepersGraphics.lineBetween(cx - hx, cy - hy, cx + hx, cy + hy);
        }
      }
    }

    // 3. Twin Steel Rails
    this.railsGraphics.clear();
    this.railsGraphics.lineStyle(2.5, t.railColor, 0.95);

    const railOffset = 6.0;

    for (const edge of this.dioramaConfig.edges) {
      const pts = edge.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const angle = Phaser.Math.Angle.Between(p1.x, p1.y, p2.x, p2.y);
        const perpAngle = angle + Math.PI / 2;

        const ox = Math.cos(perpAngle) * railOffset;
        const oy = Math.sin(perpAngle) * railOffset;

        this.railsGraphics.lineBetween(p1.x - ox, p1.y - oy, p2.x - ox, p2.y - oy);
        this.railsGraphics.lineBetween(p1.x + ox, p1.y + oy, p2.x + ox, p2.y + oy);
      }
    }

    this.updateActiveSwitchFrogPreviews();
  }

  // ===========================================================================
  // PHYSICAL SWITCH STANDS & TACTILE LEVERS (Faz 2 & 4)
  // ===========================================================================
  private renderSwitchStands(): void {
    const swNodes = Object.values(this.dioramaConfig.nodes).filter((n) => n.type === 'SWITCH');

    for (const sw of swNodes) {
      const container = this.add.container(sw.x, sw.y);

      const touchHitArea = this.add.circle(0, 0, 32, 0xffffff, 0.001);
      touchHitArea.setInteractive({ useHandCursor: true });

      const shadow = this.add.circle(2, 4, 22, 0x000000, 0.28);
      const outerRing = this.add.circle(0, 0, 22, 0x374151);
      outerRing.setStrokeStyle(3, 0xfbbf24);

      const face = this.add.circle(0, 0, 18, 0xffffff);
      const arrowText = this.add
        .text(0, -1, '▲', {
          fontSize: '18px',
          color: '#1f2937',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      const labelBadge = this.add.rectangle(0, 30, 84, 18, 0x1f2937, 0.85);
      labelBadge.setStrokeStyle(1, 0x94a3b8);
      const labelText = this.add
        .text(0, 30, sw.label, {
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      container.add([touchHitArea, shadow, outerRing, face, arrowText, labelBadge, labelText]);

      touchHitArea.on('pointerdown', () => {
        this.handleSwitchTap(sw.id, container, arrowText);
      });

      this.switchControls.set(sw.id, container);
    }

    this.updateSwitchVisualStates();
  }

  private handleSwitchTap(
    swId: string,
    container: Phaser.GameObjects.Container,
    arrowText: Phaser.GameObjects.Text
  ): void {
    if (this.isSimulationPaused) return;

    const toggled = this.network.toggleJunction(swId, { allowBuffering: true });
    if (toggled) {
      this.sounds.playRotate();
      this.tweens.add({
        targets: container,
        scaleX: 1.25,
        scaleY: 1.25,
        duration: 90,
        yoyo: true,
        ease: 'Quad.easeOut',
      });

      this.tweens.add({
        targets: arrowText,
        angle: arrowText.angle + 45,
        duration: 120,
        ease: 'Back.easeOut',
      });
    } else {
      this.sounds.playFail();
      this.tweens.add({
        targets: container,
        x: container.x + 6,
        duration: 40,
        yoyo: true,
        repeat: 3,
      });
    }

    this.updateSwitchVisualStates();
    this.updateActiveSwitchFrogPreviews();
  }

  private updateSwitchVisualStates(): void {
    for (const [swId, container] of this.switchControls.entries()) {
      const currentBranch = this.network.switches[swId];
      if (!currentBranch) continue;

      const isLocked = this.network.isJunctionLocked(swId);
      const arrow = container.getAt(4) as Phaser.GameObjects.Text;
      const face = container.getAt(3) as Phaser.GameObjects.Arc;
      const labelText = container.getAt(6) as Phaser.GameObjects.Text;

      labelText.setText(`${swId === 'SW_STATION' ? 'Terminal' : 'Ayrım'}: ${currentBranch}`);

      if (isLocked) {
        face.setFillStyle(0xef4444);
        arrow.setText('🔒');
        arrow.setFontSize('14px');
        arrow.setColor('#ffffff');
      } else {
        face.setFillStyle(0xffffff);
        arrow.setFontSize('18px');
        arrow.setColor('#1f2937');

        if (currentBranch === 'MAIN') {
          arrow.setText('▼');
        } else if (currentBranch === 'SIDING') {
          arrow.setText('◄');
        } else if (currentBranch === 'RED') {
          arrow.setText('◄');
          arrow.setColor('#dc2626');
        } else if (currentBranch === 'BLUE') {
          arrow.setText('►');
          arrow.setColor('#2563eb');
        }
      }
    }
  }

  private updateActiveSwitchFrogPreviews(): void {
    this.switchPointsGraphics.clear();
    this.switchPointsGraphics.lineStyle(3, 0xf59e0b, 0.85);

    for (const [swId, currentBranch] of Object.entries(this.network.switches)) {
      const activeEdge = this.dioramaConfig.edges.find(
        (e) => e.from === swId && (e.branch === undefined || e.branch === currentBranch)
      );

      if (activeEdge && activeEdge.points.length >= 2) {
        const p1 = activeEdge.points[0];
        const p2 = activeEdge.points[1];
        this.switchPointsGraphics.lineBetween(p1.x, p1.y, p2.x, p2.y);
      }
    }
  }

  // ===========================================================================
  // SIDING PLATFORMS & TACTILE SAL RELEASE (Faz 2 & 4)
  // ===========================================================================
  private renderSidingPlatforms(): void {
    for (const bay of this.dioramaConfig.sidingBays) {
      const container = this.add.container(bay.x, bay.y);

      const shadow = this.add.rectangle(3, 4, bay.width, bay.height, 0x000000, 0.22);
      const deck = this.add.rectangle(0, 0, bay.width, bay.height, 0xd7ccc8);
      deck.setStrokeStyle(3, 0x8d6e63);

      const canopy = this.add.rectangle(0, -bay.height / 2 + 8, bay.width, 14, 0x6d4c41);
      const label = this.add
        .text(0, -bay.height / 2 + 8, `🅿️ ${bay.label}`, {
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      const stallGraphics = this.add.graphics();
      stallGraphics.lineStyle(2, 0xb0bec5, 0.9);
      for (let i = 0; i < bay.slots.length; i++) {
        const s = bay.slots[i];
        const relY = s.y - bay.y;
        stallGraphics.strokeRoundedRect(-24, relY - 14, 48, 28, 6);
      }

      // Tactile "SAL / DEVAM ET" Release Button
      const btnX = bay.x > 270 ? -70 : 70;
      const salBtnContainer = this.add.container(btnX, 0);

      const salShadow = this.add.rectangle(2, 3, 100, 42, 0x000000, 0.25);
      const salBg = this.add.rectangle(0, 0, 100, 42, 0x10b981);
      salBg.setStrokeStyle(2, 0x047857);
      salBg.setInteractive({ useHandCursor: true });

      const salText = this.add
        .text(0, 0, '🚀 SAL', {
          fontSize: '14px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      salBtnContainer.add([salShadow, salBg, salText]);
      salBtnContainer.setVisible(false);

      salBg.on('pointerdown', () => {
        this.handleSidingRelease(bay.id, salBtnContainer);
      });

      container.add([shadow, deck, canopy, label, stallGraphics, salBtnContainer]);
      this.sidingReleaseButtons.set(bay.id, salBtnContainer);
    }
  }

  private handleSidingRelease(sidingId: string, btnContainer: Phaser.GameObjects.Container): void {
    if (this.isSimulationPaused) return;

    const ok = this.network.releaseSiding(sidingId);
    if (ok) {
      this.sounds.playRotate();
      this.tweens.add({
        targets: btnContainer,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 90,
        yoyo: true,
      });
    } else {
      this.sounds.playFail();
    }
  }

  // ===========================================================================
  // MODERN CASUAL MOBILE HUD (Faz 2 & 4)
  // ===========================================================================
  private createCasualMobileHUD(): void {
    this.hudContainer.removeAll(true);

    // 1. Top Floating Card
    const topBar = this.add.container(270, 52);
    const topShadow = this.add.rectangle(0, 4, 500, 54, 0x000000, 0.22);
    const topBg = this.add.rectangle(0, 0, 500, 54, 0xffffff);
    topBg.setStrokeStyle(2, 0xe2e8f0);

    const lvlPill = this.add.rectangle(-185, 0, 100, 36, 0xf1f5f9);
    lvlPill.setStrokeStyle(1, 0xcbd5e1);
    const lvlText = this.add
      .text(-185, 0, `🏷️ ${this.scenario.id}`, {
        fontSize: '12px',
        color: '#0f172a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.manifestContainer = this.add.container(-50, 0);

    const statsPill = this.add.rectangle(175, 0, 120, 36, 0xf8fafc);
    statsPill.setStrokeStyle(1, 0xcbd5e1);

    this.deliveriesText = this.add
      .text(145, 0, '📦 0/3', {
        fontSize: '13px',
        color: '#0f172a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.mistakesText = this.add
      .text(205, 0, '❤️❤️', {
        fontSize: '13px',
        color: '#ef4444',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    topBar.add([
      topShadow,
      topBg,
      lvlPill,
      lvlText,
      this.manifestContainer,
      statsPill,
      this.deliveriesText,
      this.mistakesText,
    ]);

    // 2. Bottom Friendly Status Bar
    const statusBox = this.add.container(270, 830);
    const statusBg = this.add.rectangle(0, 0, 480, 40, 0xffffff, 0.92);
    statusBg.setStrokeStyle(1, 0xe2e8f0);
    this.statusBannerText = this.add
      .text(0, 0, `💡 ${this.scenario.hint ?? ''}`, {
        fontSize: '12px',
        color: '#334155',
        fontStyle: 'bold',
        wordWrap: { width: 460 },
        align: 'center',
      })
      .setOrigin(0.5);
    statusBox.add([statusBg, this.statusBannerText]);

    // 3. Bottom Controls Row
    const btnRow = this.add.container(270, 895);

    const makeBtn = (x: number, label: string, color: number, cb: () => void) => {
      const bCont = this.add.container(x, 0);
      const bShadow = this.add.rectangle(2, 3, 120, 42, 0x000000, 0.2);
      const bBg = this.add.rectangle(0, 0, 120, 42, color);
      bBg.setStrokeStyle(2, 0xffffff);
      bBg.setInteractive({ useHandCursor: true });
      const bTxt = this.add
        .text(0, 0, label, {
          fontSize: '13px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      bBg.on('pointerdown', () => {
        this.sounds.playRotate();
        cb();
      });
      bCont.add([bShadow, bBg, bTxt]);
      return bCont;
    };

    const pauseBtn = makeBtn(-140, '⏸️ Duraklat', 0x475569, () => {
      this.isSimulationPaused = !this.isSimulationPaused;
      this.statusBannerText.setText(
        this.isSimulationPaused ? '⏸️ Oyun Duraklatıldı' : `💡 ${this.scenario.hint ?? ''}`
      );
    });

    const restartBtn = makeBtn(0, '🔄 Yeniden', 0xd97706, () => {
      this.scene.restart();
    });

    const exitBtn = makeBtn(140, '🚪 Çıkış', 0xb91c1c, () => {
      this.scene.stop();
      this.scene.start('SidingRushScene', { scenarioIndex: this.scenarioIndex });
    });

    btnRow.add([pauseBtn, restartBtn, exitBtn]);

    this.hudContainer.add([topBar, statusBox, btnRow]);
    this.updateHUDManifest();
  }

  private updateHUDManifest(): void {
    this.manifestContainer.removeAll(true);
    const unspawned = this.network.manifest;

    let ox = 0;
    const maxShow = 3;
    for (let i = 0; i < Math.min(unspawned.length, maxShow); i++) {
      const colorKey = unspawned[i];
      if (!colorKey) continue;
      const pillBg = this.add.circle(ox, 0, 14, colorKey === 'R' ? 0xef4444 : 0x3b82f6);
      const iconTxt = this.add
        .text(ox, 0, colorKey === 'R' ? '■' : '●', {
          fontSize: '11px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      this.manifestContainer.add([pillBg, iconTxt]);
      ox += 32;
    }
  }

  // ===========================================================================
  // SIMULATION TICK LOOP & TRAIN ANIMATION (Faz 2 & 4)
  // ===========================================================================
  public override update(_time: number, delta: number): void {
    if (this.isSimulationPaused || this.network.status !== 'RUNNING') return;

    const tickMs = this.scenario.tickDurationMs || 1000;
    this.tickAccumulatorMs += delta;

    while (this.tickAccumulatorMs >= tickMs) {
      this.tickAccumulatorMs -= tickMs;
      this.handleSimulationTick();
    }

    const interp = Math.min(1.0, this.tickAccumulatorMs / tickMs);
    this.renderVisualTrains(interp);
  }

  private handleSimulationTick(): void {
    this.network.tick();

    if (this.network.correctCount > this.lastDeliveryCount) {
      this.sounds.playGoalSuccess();
      this.lastDeliveryCount = this.network.correctCount;
      this.spawnCelebrationConfetti();
    }

    if (this.network.mistakeCount > this.lastMistakeCount) {
      this.sounds.playFail();
      this.lastMistakeCount = this.network.mistakeCount;
    }

    const totalTrains = this.scenario.manifest.length;
    this.deliveriesText.setText(`📦 ${this.network.correctCount}/${totalTrains}`);

    const maxMistakes = this.scenario.maxMistakes ?? 2;
    const remainingHearts = Math.max(0, maxMistakes - this.network.mistakeCount);
    this.mistakesText.setText('❤️'.repeat(remainingHearts) || '💀');

    this.updateHUDManifest();
    this.updateSwitchVisualStates();

    // Check SAL buttons for parked vehicles
    for (const [sidingId, btn] of this.sidingReleaseButtons.entries()) {
      const hasParked = this.network.vehicles.some(
        (v) => v.state === 'PARKED' && v.currentNode === sidingId
      );
      btn.setVisible(hasParked);
    }

    if (this.network.status === 'WON') {
      this.sounds.playWin();
      this.statusBannerText.setText('🎉 TEBRİKLER! Seviye Başarıyla Tamamlandı!');
    } else if (this.network.status === 'LOST') {
      this.sounds.playFail();
      this.statusBannerText.setText('❌ GÖREV BAŞARISIZ! Yeniden Deneyin.');
    }
  }

  // ===========================================================================
  // 2.5D MINIATURE TOY TRAIN CARRIAGE RENDERING (Faz 4)
  // ===========================================================================
  private renderVisualTrains(interpProgress: number): void {
    this.trainsContainer.removeAll(true);

    const activeVehicles = this.network.vehicles.filter(
      (v) => v.state !== 'DELIVERED' && v.state !== 'MISDELIVERED'
    );

    for (const v of activeVehicles) {
      const fromNodeId = v.currentNode;
      const toNodeId = v.toNode || v.currentNode;
      const pathPoints = this.findPathWaypoints(fromNodeId, toNodeId);

      const t = v.state === 'PARKED' ? 0.5 : interpProgress;
      const pos = this.interpolatePosition(pathPoints, t);
      const angle = this.calculateTrainAngle(pathPoints, t);

      const trainBox = this.add.container(pos.x, pos.y);
      trainBox.setRotation(angle);

      const shadow = this.add.rectangle(3, 4, 44, 24, 0x000000, 0.32);
      const bodyColor = v.color === 'R' ? 0xef4444 : 0x3b82f6;
      const body = this.add.rectangle(0, 0, 42, 22, bodyColor);
      body.setStrokeStyle(2, 0xffffff);

      const roof = this.add.rectangle(0, -2, 36, 12, 0xffffff, 0.45);
      const cab = this.add.circle(12, 0, 4, 0x1f2937);

      const iconText = this.add
        .text(-4, 0, v.color === 'R' ? '■' : '●', {
          fontSize: '14px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      trainBox.add([shadow, body, roof, cab, iconText]);
      this.trainsContainer.add(trainBox);
    }
  }

  private findPathWaypoints(fromId: string, toId: string): DioramaPoint[] {
    const edge = this.dioramaConfig.edges.find((e) => e.from === fromId && e.to === toId);
    if (edge && edge.points.length >= 2) {
      return edge.points;
    }
    const fromN = this.dioramaConfig.nodes[fromId] || { x: 270, y: 100 };
    const toN = this.dioramaConfig.nodes[toId] || { x: 270, y: 750 };
    return [
      { x: fromN.x, y: fromN.y },
      { x: toN.x, y: toN.y },
    ];
  }

  private interpolatePosition(points: DioramaPoint[], t: number): DioramaPoint {
    if (points.length === 0) return { x: 270, y: 100 };
    if (points.length === 1 || t <= 0) return points[0];
    if (t >= 1) return points[points.length - 1];

    if (points.length === 2) {
      return {
        x: Phaser.Math.Linear(points[0].x, points[1].x, t),
        y: Phaser.Math.Linear(points[0].y, points[1].y, t),
      };
    }

    const p0 = points[0];
    const p1 = points[1];
    const p2 = points[2];
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;

    return {
      x: uu * p0.x + 2 * u * t * p1.x + tt * p2.x,
      y: uu * p0.y + 2 * u * t * p1.y + tt * p2.y,
    };
  }

  private calculateTrainAngle(points: DioramaPoint[], t: number): number {
    if (points.length < 2) return Math.PI / 2;
    const tNext = Math.min(1.0, t + 0.05);
    const pNow = this.interpolatePosition(points, t);
    const pNext = this.interpolatePosition(points, tNext);
    return Phaser.Math.Angle.Between(pNow.x, pNow.y, pNext.x, pNext.y);
  }

  private spawnCelebrationConfetti(): void {
    for (let i = 0; i < 16; i++) {
      const cx = Phaser.Math.Between(150, 390);
      const cy = Phaser.Math.Between(700, 770);
      const star = this.add.text(cx, cy, '✨', { fontSize: '20px' }).setOrigin(0.5);
      this.tweens.add({
        targets: star,
        y: cy - 40,
        alpha: 0,
        duration: 700,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }
}
