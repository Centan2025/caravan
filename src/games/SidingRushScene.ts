import Phaser from 'phaser';
import { GraphSwitchNetwork } from '../core/switch/graph/GraphSwitchNetwork';
import { ALL_SIDING_LEVELS, PLAYTEST_LEVELS } from '../core/switch/graph/SidingLevels';
import {
  GraphTopologyDef,
  VehicleColor,
  StationColor,
  GraphScenarioDefinition,
} from '../core/switch/graph/GraphTypes';
import {
  GraphLayoutEngine,
  VisualLayout,
} from '../core/switch/graph/GraphLayoutEngine';
import { TelemetryLogger } from '../shared/Telemetry';
import { SoundEffects } from '../audio/SoundEffects';

export class SidingRushScene extends Phaser.Scene {
  private network!: GraphSwitchNetwork;
  private scenarioIndex: number = 0;
  private isPlaytest: boolean = false;
  private activeLevelPool: GraphScenarioDefinition[] = ALL_SIDING_LEVELS;
  private visualLayout!: VisualLayout;
  private telemetry = TelemetryLogger.getInstance();
  private sounds = new SoundEffects();

  // Rendering layers
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private trackGraphics!: Phaser.GameObjects.Graphics;
  private pathPreviewGraphics!: Phaser.GameObjects.Graphics;
  private vehicleGraphics!: Phaser.GameObjects.Graphics;
  private vehicleLabels: Phaser.GameObjects.Text[] = [];

  // Dynamic visual containers
  private junctionButtons: Map<string, Phaser.GameObjects.Container> = new Map();
  private sidingDispatchButtons: Map<
    string,
    { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text }
  > = new Map();
  private dynamicDepotObjects: Phaser.GameObjects.GameObject[] = [];
  private hasUsedSiding: boolean = false;

  // HUD
  private hudTitleText!: Phaser.GameObjects.Text;
  private hudCorrect!: Phaser.GameObjects.Text;
  private hudMistakes!: Phaser.GameObjects.Text;
  private hudScore!: Phaser.GameObjects.Text;
  private statusBannerText!: Phaser.GameObjects.Text;
  private manifestPreviewText!: Phaser.GameObjects.Text;
  private pauseBtnText!: Phaser.GameObjects.Text;
  private exitBtnText!: Phaser.GameObjects.Text;
  private modalContainer: Phaser.GameObjects.Container | null = null;

  // Timing
  private tickAccumulatorMs: number = 0;
  private isPaused: boolean = false;

  private readonly STATION_COLORS: Record<VehicleColor, number> = {
    R: 0xe63946,
    B: 0x0077b6,
    G: 0x2d6a4f,
    Y: 0xe09f3e,
  };

  private readonly STATION_COLOR_NAMES: Record<StationColor, string> = {
    RED: 'KIRMIZI',
    BLUE: 'MAVİ',
    GREEN: 'YEŞİL',
    YELLOW: 'SARI',
  };

  private readonly STATION_SYMBOLS: Record<VehicleColor, string> = {
    R: '◼',
    B: '●',
    G: '▲',
    Y: '◆',
  };

  constructor() {
    super({ key: 'SidingRushScene' });
  }

  public init(data?: { scenarioIndex?: number; isPlaytest?: boolean }): void {
    this.isPlaytest = Boolean(data?.isPlaytest);
    this.activeLevelPool = this.isPlaytest ? PLAYTEST_LEVELS : ALL_SIDING_LEVELS;
    if (data && typeof data.scenarioIndex === 'number') {
      this.scenarioIndex = Math.max(0, Math.min(this.activeLevelPool.length - 1, data.scenarioIndex));
    } else {
      this.scenarioIndex = 0;
    }
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#141820');

    this.bgGraphics = this.add.graphics().setDepth(0);
    this.trackGraphics = this.add.graphics().setDepth(1);
    this.pathPreviewGraphics = this.add.graphics().setDepth(2);
    this.vehicleGraphics = this.add.graphics().setDepth(10);

    this.createHUD();
    this.loadLevel(this.scenarioIndex);
  }

  public loadLevel(idx: number): void {
    this.scenarioIndex = Math.max(0, Math.min(this.activeLevelPool.length - 1, idx));
    const sc = this.activeLevelPool[this.scenarioIndex];

    this.hasUsedSiding = false;
    this.network = new GraphSwitchNetwork(sc);
    this.network.start();
    this.tickAccumulatorMs = 0;
    this.isPaused = false;
    this.dismissModal();

    // Rebuild dynamic visuals for this specific topology via layout engine
    this.rebuildDynamicScene(this.network.topology.def);

    // Sync HTML level dropdown if available
    const levelSelect = document.getElementById('level-select') as HTMLSelectElement | null;
    if (levelSelect && levelSelect.value !== this.scenarioIndex.toString()) {
      levelSelect.value = this.scenarioIndex.toString();
    }

    // Telemetry log
    this.telemetry.startRun('switch_rush', sc.id, {
      submode: this.isPlaytest ? 'playtest' : 'siding',
      isPlaytest: this.isPlaytest,
      playtestStep: this.isPlaytest ? this.scenarioIndex + 1 : undefined,
      title: sc.title,
      topologyId: this.network.topology.def.id,
      manifestLength: sc.manifest.length,
      tickDurationMs: sc.tickDurationMs,
      spawnCadenceTicks: sc.spawnCadenceTicks,
    });

    this.updateHUD();
    this.updateControlsVisuals();

    if (this.isPlaytest) {
      this.setStatusText(`${sc.title} — Araçları doğru istasyonlara yönlendirin.`);
    } else {
      const hintPart = sc.hint ? `\n💡 İpucu: ${sc.hint}` : '';
      this.setStatusText(`${sc.title} [${sc.primaryChallenge}]${hintPart}`);
    }
  }

  /**
   * Constructs new visual entities based on GraphLayoutEngine coordinates.
   * Completely eliminates colinear track bug and HUD overlap.
   */
  private rebuildDynamicScene(topology: GraphTopologyDef): void {
    // 1. Destroy previous controls and depots
    this.junctionButtons.forEach((btn) => btn.destroy());
    this.junctionButtons.clear();

    this.sidingDispatchButtons.forEach((btn) => btn.container.destroy());
    this.sidingDispatchButtons.clear();

    for (const obj of this.dynamicDepotObjects) {
      obj.destroy();
    }
    this.dynamicDepotObjects = [];

    for (const lbl of this.vehicleLabels) {
      lbl.destroy();
    }
    this.vehicleLabels = [];

    // Calculate layout
    this.visualLayout = GraphLayoutEngine.getVisualLayout(topology);

    // 2. Render 2.5D diorama background and siding platforms
    this.renderDynamicDiorama(topology);

    // 3. Create tactile interactive switches (Min 48px touch target: 88x52px)
    for (const sw of topology.switches) {
      const vNode = this.visualLayout.nodes.get(sw.id);
      if (!vNode) continue;

      const btn = this.add.container(vNode.x, vNode.y).setDepth(20);
      btn.setSize(88, 52);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.handleJunctionTap(sw.id));
      this.junctionButtons.set(sw.id, btn);
    }

    // 4. Create siding release buttons (Min 48px touch target: 124x48px)
    const sidingNodes = topology.nodes.filter((n) => n.type === 'SIDING');
    for (const siding of sidingNodes) {
      const vNode = this.visualLayout.nodes.get(siding.id);
      if (!vNode) continue;

      const container = this.add.container(vNode.x, vNode.y + 44).setDepth(25);
      container.setSize(124, 48);
      container.setInteractive({ useHandCursor: true });

      const btnBg = this.add.graphics();
      btnBg.fillStyle(0x2d6a4f, 1);
      btnBg.lineStyle(2, 0x52b788, 1);
      btnBg.fillRoundedRect(-60, -22, 120, 44, 10);
      btnBg.strokeRoundedRect(-60, -22, 120, 44, 10);
      container.add(btnBg);

      const labelPrefix = sidingNodes.length > 1 ? (siding.id.includes('B') ? 'SAĞ ' : 'SOL ') : '';
      const text = this.add
        .text(0, 0, `🟢 ${labelPrefix}SAL`, {
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      container.add(text);

      container.on('pointerdown', () => {
        this.handleSidingDispatchTap(siding.id);
      });

      this.sidingDispatchButtons.set(siding.id, { container, text });
    }

    // 5. Create dynamic station depots and source hub (Positioned safely at y=735-740)
    for (const node of topology.nodes) {
      const vNode = this.visualLayout.nodes.get(node.id);
      if (!vNode) continue;

      if (node.type === 'STATION') {
        const colorKey = (node.stationColor?.[0] || 'R') as VehicleColor;
        const colorHex = this.STATION_COLORS[colorKey] ?? 0xe63946;
        const sym = this.STATION_SYMBOLS[colorKey] ?? '◼';
        const subName = node.stationColor
          ? this.STATION_COLOR_NAMES[node.stationColor]
          : 'İSTASYON';

        const g = this.add.graphics().setDepth(3);
        // Depot shadow
        g.fillStyle(0x000000, 0.45);
        g.fillRoundedRect(vNode.x - 42, vNode.y - 23, 84, 52, 10);
        // Depot wall & roof cap
        g.fillStyle(0x1a212d, 1);
        g.lineStyle(2, colorHex, 0.95);
        g.fillRoundedRect(vNode.x - 44, vNode.y - 27, 88, 54, 10);
        g.strokeRoundedRect(vNode.x - 44, vNode.y - 27, 88, 54, 10);
        // Color header accent band
        g.fillStyle(colorHex, 1);
        g.fillRoundedRect(vNode.x - 44, vNode.y - 27, 88, 14, { tl: 10, tr: 10, bl: 0, br: 0 });
        this.dynamicDepotObjects.push(g);

        const t1 = this.add
          .text(vNode.x, vNode.y + 1, `${sym} ${colorKey}`, {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#ffffff',
          })
          .setOrigin(0.5)
          .setDepth(4);
        this.dynamicDepotObjects.push(t1);

        const t2 = this.add
          .text(vNode.x, vNode.y + 17, subName, {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '9px',
            fontStyle: 'bold',
            color: '#a8dadc',
          })
          .setOrigin(0.5)
          .setDepth(4);
        this.dynamicDepotObjects.push(t2);
      } else if (node.type === 'SOURCE') {
        const srcG = this.add.graphics().setDepth(3);
        srcG.fillStyle(0x101721, 1);
        srcG.lineStyle(2, 0x48cae4, 0.9);
        srcG.fillRoundedRect(vNode.x - 52, vNode.y - 23, 104, 46, 10);
        srcG.strokeRoundedRect(vNode.x - 52, vNode.y - 23, 104, 46, 10);
        this.dynamicDepotObjects.push(srcG);

        const srcT = this.add
          .text(vNode.x, vNode.y, '📦 PARCEL HUB', {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#48cae4',
          })
          .setOrigin(0.5)
          .setDepth(4);
        this.dynamicDepotObjects.push(srcT);
      } else if (node.type === 'SIDING') {
        const signT = this.add
          .text(vNode.x, vNode.y - 34, `🅿️ ${node.label || 'PARK CEBİ'}`, {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#ffd166',
          })
          .setOrigin(0.5)
          .setDepth(4);
        this.dynamicDepotObjects.push(signT);
      }
    }

    // 6. Draw 2.5D tracks
    this.drawDynamicTracks();
  }

  private renderDynamicDiorama(topology: GraphTopologyDef): void {
    const g = this.bgGraphics;
    g.clear();

    // Matte diorama tabletop
    g.fillStyle(0x161a22, 1);
    g.fillRect(0, 0, 540, 960);

    // Decorative tabletop border
    g.lineStyle(2, 0x222a38, 0.8);
    g.strokeRoundedRect(8, 8, 524, 944, 16);

    // Draw realistic model railway siding platforms & stall bays
    for (const node of topology.nodes) {
      if (node.type === 'SIDING') {
        const vNode = this.visualLayout.nodes.get(node.id);
        if (!vNode) continue;

        const cap = node.capacity || 1;
        const boxH = cap === 2 ? 104 : 84;

        // Platform deck
        g.fillStyle(0x222a38, 0.95);
        g.lineStyle(1, 0x3d4a61, 0.8);
        g.fillRoundedRect(vNode.x - 66, vNode.y - boxH / 2, 132, boxH, 12);
        g.strokeRoundedRect(vNode.x - 66, vNode.y - boxH / 2, 132, boxH, 12);

        // Yellow-black hazard loading stripe
        g.fillStyle(0xf1c40f, 0.35);
        g.fillRect(vNode.x - 60, vNode.y - boxH / 2 + 4, 120, 4);

        // Parking stall outlines
        if (cap === 2) {
          g.lineStyle(1, 0x52b788, 0.4);
          g.strokeRoundedRect(vNode.x - 54, vNode.y - 44, 108, 38, 6);
          g.strokeRoundedRect(vNode.x - 54, vNode.y + 4, 108, 38, 6);

          const slot1 = this.add
            .text(vNode.x + 36, vNode.y - 36, '#1', {
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: '10px',
              fontStyle: 'bold',
              color: '#52b788',
            })
            .setOrigin(0.5)
            .setDepth(3);
          this.dynamicDepotObjects.push(slot1);

          const slot2 = this.add
            .text(vNode.x + 36, vNode.y + 12, '#2', {
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: '10px',
              fontStyle: 'bold',
              color: '#778da9',
            })
            .setOrigin(0.5)
            .setDepth(3);
          this.dynamicDepotObjects.push(slot2);
        } else {
          g.lineStyle(1, 0x52b788, 0.4);
          g.strokeRoundedRect(vNode.x - 54, vNode.y - 20, 108, 40, 6);
        }
      }
    }
  }

  private handleJunctionTap(jId: string): void {
    if (this.isPaused || this.network.status !== 'RUNNING') return;

    if (this.network.isJunctionLocked(jId)) {
      const buffered = this.network.toggleJunction(jId, { allowBuffering: true });
      if (buffered) {
        this.sounds.playRotate();
        this.setStatusText(`⏱️ ${jId} makası geçiş sonrası otomatik dönecek (Sırada).`);
        this.updateControlsVisuals();
      }
      return;
    }

    const success = this.network.toggleJunction(jId);
    if (success) {
      this.sounds.playRotate();
      this.telemetry.recordValidMove({
        action: 'toggle_switch',
        junction: jId,
        newState: this.network.switches[jId],
        mode: this.isPlaytest ? 'playtest' : 'siding',
        level: this.network.scenarioId,
      });
      this.updateControlsVisuals();
    }
  }

  private handleSidingDispatchTap(sidingId: string): void {
    if (this.isPaused || this.network.status !== 'RUNNING') return;

    const hasParked = this.network.vehicles.some(
      (v) => v.state === 'PARKED' && v.currentNode === sidingId
    );

    if (!hasParked) {
      this.sounds.playFail();
      this.telemetry.recordInvalidTap('empty_siding_dispatch', {
        mode: this.isPlaytest ? 'playtest' : 'siding',
        sidingId,
      });
      this.setStatusText('⚠️ Bu park cebinde bekleyen araç yok!');
      return;
    }

    const released = this.network.releaseSiding(sidingId);
    if (released) {
      this.hasUsedSiding = true;
      this.sounds.playGoalSuccess();
      this.telemetry.recordValidMove({
        action: 'release_siding',
        siding: sidingId,
        mode: this.isPlaytest ? 'playtest' : 'siding',
        level: this.network.scenarioId,
      });
      this.setStatusText('🚀 Parktaki araç ana hatta çıkış izni aldı!');
      this.updateControlsVisuals();
    }
  }

  private updateControlsVisuals(): void {
    const topology = this.network.topology.def;

    // Update all tactile junction buttons (88x52px)
    for (const [jId, container] of this.junctionButtons.entries()) {
      container.removeAll(true);
      const sw = this.network.topology.getSwitch(jId);
      const node = topology.nodes.find((n) => n.id === jId);
      if (!sw || !node) continue;

      const isLocked = this.network.isJunctionLocked(jId);
      const isBuffered = this.network.bufferedToggles.has(jId);
      const cur = this.network.switches[jId] ?? sw.branches[0];

      const g = this.add.graphics();
      // Capsule background
      const fillCol = isLocked ? 0x381e24 : isBuffered ? 0x163426 : 0x1a2433;
      const strokeCol = isBuffered ? 0x52b788 : isLocked ? 0xe63946 : 0x48cae4;
      g.fillStyle(fillCol, 1);
      g.lineStyle(2, strokeCol, 1);
      g.fillRoundedRect(-44, -26, 88, 52, 14);
      g.strokeRoundedRect(-44, -26, 88, 52, 14);
      container.add(g);

      // Junction Label (11px bold)
      const label = this.add
        .text(0, -9, isLocked ? `🔒 ${node.label || jId}` : node.label || jId, {
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '11px',
          fontStyle: 'bold',
          color: isLocked ? '#e63946' : '#a8dadc',
        })
        .setOrigin(0.5);
      container.add(label);

      // Branch state with crisp directional arrows (13px bold)
      let branchDisplay = cur;
      let branchCol = '#48cae4';
      if (cur === 'MAIN') {
        branchDisplay = '⬇️ ANA HAT';
        branchCol = '#48cae4';
      } else if (cur === 'SIDING') {
        branchDisplay = '◀ 🅿️ PARK';
        branchCol = '#52b788';
      } else if (cur === 'RED') {
        branchDisplay = '◀ ◼ KRMZ';
        branchCol = '#e63946';
      } else if (cur === 'BLUE') {
        branchDisplay = 'MAVİ ● ▶';
        branchCol = '#0077b6';
      }

      const stateText = this.add
        .text(0, 9, isBuffered ? `🟢 ${branchDisplay}` : branchDisplay, {
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
          color: branchCol,
        })
        .setOrigin(0.5);
      container.add(stateText);
    }

    // Update Siding dispatch buttons (124x48px)
    for (const [sidingId, btn] of this.sidingDispatchButtons.entries()) {
      const hasParked = this.network.vehicles.some(
        (v) => v.state === 'PARKED' && v.currentNode === sidingId
      );
      const isRequested = this.network.isSidingReleaseRequested(sidingId);

      if (hasParked) {
        btn.container.setVisible(true);
        btn.text.setText(isRequested ? '⏳ ÇIKIŞ İZNİ...' : '🟢 SAL');
        btn.text.setColor(isRequested ? '#ffd166' : '#ffffff');
      } else {
        btn.container.setVisible(false);
      }
    }

    this.drawDynamicTracks();
  }

  private drawDynamicTracks(): void {
    this.trackGraphics.clear();
    this.pathPreviewGraphics.clear();

    const nodesMap = this.visualLayout.nodes;

    const drawRailSection = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
      // 1. Ballast Stone Bed (16px)
      this.trackGraphics.lineStyle(16, 0x121720, 1);
      this.trackGraphics.lineBetween(p1.x, p1.y, p2.x, p2.y);

      // 2. Wooden Sleepers (Ties)
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 4) {
        const nx = -dy / dist;
        const ny = dx / dist;
        const steps = Math.floor(dist / 14);
        for (let i = 1; i <= steps; i++) {
          const t = i / (steps + 1);
          const cx = p1.x + dx * t;
          const cy = p1.y + dy * t;
          this.trackGraphics.lineStyle(4, 0x271e18, 0.95);
          this.trackGraphics.lineBetween(cx - nx * 9, cy - ny * 9, cx + nx * 9, cy + ny * 9);
        }
      }

      // 3. Twin Steel Rails (Parallel Silver Lines)
      if (dist > 2) {
        const nx = -dy / dist;
        const ny = dx / dist;
        this.trackGraphics.lineStyle(2, 0x415268, 1);
        this.trackGraphics.lineBetween(p1.x - nx * 4, p1.y - ny * 4, p2.x - nx * 4, p2.y - ny * 4);
        this.trackGraphics.lineBetween(p1.x + nx * 4, p1.y + ny * 4, p2.x + nx * 4, p2.y + ny * 4);
      }
    };

    // Draw all realistic tracks
    for (const edge of this.visualLayout.edges) {
      const pts = edge.points;
      for (let i = 0; i < pts.length - 1; i++) {
        drawRailSection(pts[i], pts[i + 1]);
      }
    }

    // Determine upcoming vehicle color for destination-associated active route preview
    const activeVehicles = this.network.vehicles.filter(
      (v) => v.state !== 'DELIVERED' && v.state !== 'MISDELIVERED'
    );
    const leadCar = activeVehicles[0];
    const incomingColorKey = leadCar ? leadCar.color : (this.network.manifest[0] || 'R');
    const pathAccentHex = this.STATION_COLORS[incomingColorKey] ?? 0x48cae4;

    const drawActiveWire = (fromId: string, toId: string) => {
      const p1 = nodesMap.get(fromId);
      const p2 = nodesMap.get(toId);
      if (!p1 || !p2) return;
      this.pathPreviewGraphics.lineStyle(3, pathAccentHex, 0.9);
      this.pathPreviewGraphics.lineBetween(p1.x, p1.y, p2.x, p2.y);
    };

    // Trace active route from SOURCE node
    const sourceNodes = this.network.topology.def.nodes.filter((n) => n.type === 'SOURCE');
    for (const src of sourceNodes) {
      let curr = src.id;
      let hops = 0;
      while (hops < 15) {
        const nextNode = this.network.topology.resolveNextNode(curr, this.network.switches);
        if (!nextNode) break;
        drawActiveWire(curr, nextNode);
        if (this.network.topology.isStation(nextNode)) break;
        curr = nextNode;
        hops++;
      }
    }

    // Trace route from siding if release is requested
    const sidingNodes = this.network.topology.def.nodes.filter((n) => n.type === 'SIDING');
    for (const siding of sidingNodes) {
      if (this.network.isSidingReleaseRequested(siding.id)) {
        let curr = siding.id;
        let hops = 0;
        while (hops < 15) {
          const nextNode = this.network.topology.resolveNextNode(curr, this.network.switches);
          if (!nextNode) break;
          drawActiveWire(curr, nextNode);
          if (this.network.topology.isStation(nextNode)) break;
          curr = nextNode;
          hops++;
        }
      }
    }
  }

  private createHUD(): void {
    // Compact top HUD bar
    const statsY = 44;

    // 1. Primary: Deliveries
    this.createPill(65, statsY, 95, 34, 'TESLİMAT');
    this.hudCorrect = this.add
      .text(65, statsY + 6, '0 / 0', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#52b788',
      })
      .setOrigin(0.5);

    // 2. Primary: Mistakes
    this.createPill(165, statsY, 80, 34, 'HATA');
    this.hudMistakes = this.add
      .text(165, statsY + 6, '0 / 2', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#e63946',
      })
      .setOrigin(0.5);

    // 3. Primary: Next Cargo in Manifest
    this.createPill(295, statsY, 155, 34, 'SIRADAKİ KARGO');
    this.manifestPreviewText = this.add
      .text(295, statsY + 6, '', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffd166',
      })
      .setOrigin(0.5);

    // 4. Secondary: Score
    this.createPill(425, statsY, 80, 34, 'SKOR');
    this.hudScore = this.add
      .text(425, statsY + 6, '0', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffd166',
      })
      .setOrigin(0.5);

    // Title badge
    this.hudTitleText = this.add
      .text(270, 15, '🅿️ SIDING DENEYİ — Seviye 1/7', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffd166',
      })
      .setOrigin(0.5);

    // Status Banner (Safely at y=805, zero overlap with stations at 740 or buttons at 880)
    this.statusBannerText = this.add
      .text(270, 805, '', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 490 },
      })
      .setOrigin(0.5);

    // Three Bottom Controls: Pause, Reset, Exit (Accessible mobile layout >= 48px touch target)
    const pauseBtn = this.add
      .container(95, 880)
      .setSize(110, 46)
      .setInteractive({ useHandCursor: true });

    const pBg = this.add.graphics();
    pBg.fillStyle(0x1d2d44, 1);
    pBg.lineStyle(1, 0x415a77, 1);
    pBg.fillRoundedRect(-55, -23, 110, 46, 8);
    pBg.strokeRoundedRect(-55, -23, 110, 46, 8);
    pauseBtn.add(pBg);

    this.pauseBtnText = this.add
      .text(0, 0, '⏸️ Duraklat', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#e0e1dd',
      })
      .setOrigin(0.5);
    pauseBtn.add(this.pauseBtnText);
    pauseBtn.on('pointerdown', () => this.togglePause());

    const resetBtn = this.add
      .container(260, 880)
      .setSize(140, 46)
      .setInteractive({ useHandCursor: true });

    const rBg = this.add.graphics();
    rBg.fillStyle(0x39281a, 1);
    rBg.lineStyle(1, 0x5a3e2b, 1);
    rBg.fillRoundedRect(-70, -23, 140, 46, 8);
    rBg.strokeRoundedRect(-70, -23, 140, 46, 8);
    resetBtn.add(rBg);

    const resetText = this.add
      .text(0, 0, '🔄 Yeniden Başlat', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#f39c12',
      })
      .setOrigin(0.5);
    resetBtn.add(resetText);
    resetBtn.on('pointerdown', () => {
      const sc = this.activeLevelPool[this.scenarioIndex];
      if (this.isPlaytest) {
        this.telemetry.recordVoluntaryReplay({
          scenarioIndex: this.scenarioIndex,
          levelId: sc.id,
          source: 'hud_reset',
        });
      } else {
        this.telemetry.recordReplayClicked({ mode: 'siding', level: this.scenarioIndex + 1 });
      }
      this.loadLevel(this.scenarioIndex);
    });

    const exitBtn = this.add
      .container(435, 880)
      .setSize(130, 46)
      .setInteractive({ useHandCursor: true });

    const eBg = this.add.graphics();
    eBg.fillStyle(0x3a1d28, 1);
    eBg.lineStyle(1, 0x7a3045, 1);
    eBg.fillRoundedRect(-65, -23, 130, 46, 8);
    eBg.strokeRoundedRect(-65, -23, 130, 46, 8);
    exitBtn.add(eBg);

    this.exitBtnText = this.add
      .text(0, 0, this.isPlaytest ? '⏹️ Testten Çık' : '⏹️ Çıkış', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#e63946',
      })
      .setOrigin(0.5);
    exitBtn.add(this.exitBtnText);
    exitBtn.on('pointerdown', () => {
      if (this.isPlaytest) {
        const sc = this.activeLevelPool[this.scenarioIndex];
        this.telemetry.recordPlaytestAbandoned({
          scenarioIndex: this.scenarioIndex,
          levelId: sc.id,
          source: 'hud_exit',
        });
        this.showPlaytestExitModal();
      } else {
        this.telemetry.recordExitClicked({ mode: 'siding', level: this.scenarioIndex + 1 });
        this.loadLevel(this.scenarioIndex);
      }
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
      .text(x, y - 10, label, {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#778da9',
      })
      .setOrigin(0.5);
  }

  public update(_time: number, delta: number): void {
    if (this.isPaused || !this.network || this.network.status !== 'RUNNING') return;

    const tickMs = this.network.tickDurationMs || 1000;
    this.tickAccumulatorMs += delta;

    while (this.tickAccumulatorMs >= tickMs) {
      this.tickAccumulatorMs -= tickMs;
      this.stepTick();
    }

    const interp = Math.min(1.0, this.tickAccumulatorMs / tickMs);
    this.renderVehicles(interp);
  }

  private stepTick(): void {
    const prevCorrect = this.network.correctCount;
    const prevMistakes = this.network.mistakeCount;

    // Check if any vehicle is currently in siding or enters siding
    if (this.network.vehicles.some((v) => v.state === 'PARKED')) {
      this.hasUsedSiding = true;
    }

    this.network.tick();

    if (this.network.correctCount > prevCorrect) {
      this.sounds.playGoalSuccess();
    }
    if (this.network.mistakeCount > prevMistakes) {
      this.sounds.playFail();
    }

    this.updateHUD();
    this.updateControlsVisuals();

    const sc = this.activeLevelPool[this.scenarioIndex];

    if (this.network.status === 'WON') {
      this.sounds.playWin();
      this.telemetry.recordRunWon(this.network.score, {
        submode: this.isPlaytest ? 'playtest' : 'siding',
        scenario: this.scenarioIndex + 1,
        levelId: sc.id,
        chosenPath: this.hasUsedSiding ? 'path_a_siding' : 'path_b_timing',
        isPlaytest: this.isPlaytest,
      });
      this.showEndModal(true);
    } else if (this.network.status === 'LOST') {
      this.sounds.playFail();
      this.telemetry.recordRunLost('mistake_limit_reached', this.network.score, {
        submode: this.isPlaytest ? 'playtest' : 'siding',
        scenario: this.scenarioIndex + 1,
        levelId: sc.id,
        stuck_level_id: sc.id,
        isPlaytest: this.isPlaytest,
      });
      this.showEndModal(false);
    }
  }

  private renderVehicles(interpProgress: number): void {
    this.vehicleGraphics.clear();

    for (const lbl of this.vehicleLabels) {
      lbl.destroy();
    }
    this.vehicleLabels = [];

    const nodesMap = this.visualLayout.nodes;
    const active = this.network.vehicles.filter(
      (v) => v.state !== 'DELIVERED' && v.state !== 'MISDELIVERED'
    );

    // Group parked vehicles by siding node to support FIFO multi-car display
    const parkedMap = new Map<string, typeof active>();
    for (const v of active) {
      if (v.state === 'PARKED') {
        const list = parkedMap.get(v.currentNode) || [];
        list.push(v);
        parkedMap.set(v.currentNode, list);
      }
    }

    for (const v of active) {
      let x = 270;
      let y = 120;

      if (v.state === 'MOVING' && v.fromNode && v.toNode) {
        const p1 = nodesMap.get(v.fromNode);
        const p2 = nodesMap.get(v.toNode);
        if (p1 && p2) {
          x = p1.x + (p2.x - p1.x) * interpProgress;
          y = p1.y + (p2.y - p1.y) * interpProgress;
        }
      } else {
        const vNode = nodesMap.get(v.currentNode);
        if (vNode) {
          x = vNode.x;
          y = vNode.y;
          if (v.state === 'PARKED') {
            const group = parkedMap.get(v.currentNode) || [v];
            const idx = group.indexOf(v);
            const slot = vNode.sidingSlotPositions[idx] || {
              x: vNode.x,
              y: vNode.y + idx * 36,
            };
            x = slot.x;
            y = slot.y;
          }
        }
      }

      // 2.5D Miniature Train Carriage
      const col = this.STATION_COLORS[v.color] ?? 0xffffff;

      // Soft drop shadow
      this.vehicleGraphics.fillStyle(0x000000, 0.45);
      this.vehicleGraphics.fillEllipse(x + 2, y + 6, 38, 22);

      // Carriage chassis
      this.vehicleGraphics.fillStyle(col, 1);
      this.vehicleGraphics.lineStyle(2, v.state === 'PARKED' ? 0xffd166 : 0xffffff, 1);
      this.vehicleGraphics.fillRoundedRect(x - 19, y - 19, 38, 38, 9);
      this.vehicleGraphics.strokeRoundedRect(x - 19, y - 19, 38, 38, 9);

      // Roof bevel highlight (2.5D reflection)
      this.vehicleGraphics.fillStyle(0xffffff, 0.28);
      this.vehicleGraphics.fillRoundedRect(x - 14, y - 16, 28, 8, 4);

      const sym = this.STATION_SYMBOLS[v.color] ?? '◼';
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

      if (v.state === 'PARKED') {
        const group = parkedMap.get(v.currentNode) || [v];
        const queueLabel = group.length > 1 ? ` #${group.indexOf(v) + 1}` : '';
        const pBadge = this.add
          .text(x, y - 25, `🅿️ PARK${queueLabel}`, {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#ffd166',
          })
          .setOrigin(0.5)
          .setDepth(13);
        this.vehicleLabels.push(pBadge);
      }
    }
  }

  private updateHUD(): void {
    if (!this.network) return;

    const modePrefix = this.isPlaytest ? '🧪 OYUNCU TESTİ' : '🅿️ SIDING DENEYİ';
    this.hudTitleText.setText(
      `${modePrefix} — Seviye ${this.scenarioIndex + 1}/${this.activeLevelPool.length}`
    );

    const total = this.network.vehicles.length + this.network.manifest.length;
    this.hudCorrect.setText(`${this.network.correctCount} / ${total}`);
    this.hudMistakes.setText(`${this.network.mistakeCount} / ${this.network.maxMistakes}`);
    this.hudScore.setText(`${this.network.score}`);

    const preview = this.network.manifest
      .slice(0, 3)
      .map((c) => `${this.STATION_SYMBOLS[c] || ''}${c}`)
      .join(' ➔ ');
    this.manifestPreviewText.setText(preview || 'Tamamlandı!');
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
    } else if (this.network.status === 'PAUSED') {
      this.network.resume();
      this.isPaused = false;
      this.pauseBtnText.setText('⏸️ Duraklat');
    }
  }

  private showEndModal(isWin: boolean): void {
    this.dismissModal();

    this.modalContainer = this.add.container(270, 480).setDepth(100);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(-270, -480, 540, 960);
    this.modalContainer.add(overlay);

    const sc = this.activeLevelPool[this.scenarioIndex];

    if (this.isPlaytest) {
      this.renderPlaytestEndModal(isWin, sc);
    } else {
      this.renderStandardEndModal(isWin);
    }
  }

  private renderPlaytestEndModal(isWin: boolean, sc: GraphScenarioDefinition): void {
    const isFinalLevel = this.scenarioIndex >= this.activeLevelPool.length - 1;
    const box = this.add.graphics();
    box.fillStyle(0x16222f, 1);
    box.lineStyle(2, isWin ? 0x52b788 : 0xe63946, 1);

    if (isWin) {
      if (isFinalLevel) {
        box.fillRoundedRect(-185, -165, 370, 330, 14);
        box.strokeRoundedRect(-185, -165, 370, 330, 14);
        this.modalContainer!.add(box);

        this.telemetry.recordPlaytestCompleted({
          totalLevels: this.activeLevelPool.length,
          finalScore: this.network.score,
        });

        const title = this.add
          .text(0, -120, 'Test Dizisi Tamamlandı', {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#52b788',
          })
          .setOrigin(0.5);
        this.modalContainer!.add(title);

        const desc = this.add
          .text(
            0,
            -70,
            `5 seviyelik test dizisi tamamlandı.\nToplam Skor: ${this.network.score}\nKatılımınız için teşekkürler.`,
            {
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: '13px',
              color: '#e0e1dd',
              align: 'center',
              lineSpacing: 4,
            }
          )
          .setOrigin(0.5);
        this.modalContainer!.add(desc);

        const csvBtn = this.createModalButton(0, -10, '📥 Sonuçları CSV İndir', '#1d3557', '#ffffff', () => {
          this.telemetry.downloadCSV();
        });
        this.modalContainer!.add(csvBtn);

        const jsonBtn = this.createModalButton(0, 42, '📥 Sonuçları JSON İndir', '#1d2d44', '#48cae4', () => {
          this.telemetry.downloadJSON();
        });
        this.modalContainer!.add(jsonBtn);

        const replayBtn = this.createModalButton(0, 94, '🔄 Seviyeleri Baştan Oyna', '#2b1e1e', '#ffd166', () => {
          this.telemetry.recordVoluntaryReplay({ playtestReset: true });
          this.loadLevel(0);
        });
        this.modalContainer!.add(replayBtn);
      } else {
        box.fillRoundedRect(-185, -160, 370, 320, 14);
        box.strokeRoundedRect(-185, -160, 370, 320, 14);
        this.modalContainer!.add(box);

        const title = this.add
          .text(0, -115, `Seviye ${this.scenarioIndex + 1} Tamamlandı`, {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#52b788',
          })
          .setOrigin(0.5);
        this.modalContainer!.add(title);

        const desc = this.add
          .text(0, -70, `Teslimat: ${this.network.correctCount}  |  Hata: ${this.network.mistakeCount}`, {
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '13px',
            color: '#e0e1dd',
            align: 'center',
          })
          .setOrigin(0.5);
        this.modalContainer!.add(desc);

        // Explicit Next Level Choice (No auto progression!)
        const nextBtn = this.createModalButton(
          0,
          -15,
          `Sonraki Seviyeye Geç (${this.scenarioIndex + 2}/${this.activeLevelPool.length}) ➔`,
          '#2d6a4f',
          '#ffffff',
          () => {
            this.telemetry.recordNextLevelClicked({
              fromScenario: this.scenarioIndex,
              nextScenario: this.scenarioIndex + 1,
              levelId: sc.id,
            });
            this.loadLevel(this.scenarioIndex + 1);
          }
        );
        this.modalContainer!.add(nextBtn);

        // Explicit Voluntary Replay Choice
        const replayBtn = this.createModalButton(
          0,
          36,
          '🔄 Bu Seviyeyi Tekrar Oyna',
          '#1d3557',
          '#ffd166',
          () => {
            this.telemetry.recordVoluntaryReplay({
              scenarioIndex: this.scenarioIndex,
              levelId: sc.id,
              postWin: true,
            });
            this.loadLevel(this.scenarioIndex);
          }
        );
        this.modalContainer!.add(replayBtn);

        // Early Exit Choice
        const exitBtn = this.createModalButton(
          0,
          86,
          '⏹️ Testi Bitir & Verileri Dışa Aktar',
          '#3a1d28',
          '#e0e1dd',
          () => {
            this.telemetry.recordPlaytestAbandoned({
              scenarioIndex: this.scenarioIndex,
              levelId: sc.id,
            });
            this.showPlaytestExitModal();
          }
        );
        this.modalContainer!.add(exitBtn);
      }
    } else {
      box.fillRoundedRect(-185, -135, 370, 270, 14);
      box.strokeRoundedRect(-185, -135, 370, 270, 14);
      this.modalContainer!.add(box);

      const title = this.add
        .text(0, -95, `Seviye ${this.scenarioIndex + 1} Tamamlanamadı`, {
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#e63946',
        })
        .setOrigin(0.5);
      this.modalContainer!.add(title);

      const desc = this.add
        .text(0, -55, `Hata limiti aşıldı (${this.network.mistakeCount}/${this.network.maxMistakes})`, {
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '13px',
          color: '#e0e1dd',
          align: 'center',
        })
        .setOrigin(0.5);
      this.modalContainer!.add(desc);

      const retryBtn = this.createModalButton(0, 0, '🔄 Yeniden Dene', '#1d3557', '#ffffff', () => {
        this.telemetry.recordReplayClicked({ mode: 'playtest', levelId: sc.id });
        this.loadLevel(this.scenarioIndex);
      });
      this.modalContainer!.add(retryBtn);

      const exitBtn = this.createModalButton(
        0,
        50,
        '⏹️ Testi Bitir & Verileri Dışa Aktar',
        '#3a1d28',
        '#e0e1dd',
        () => {
          this.telemetry.recordPlaytestAbandoned({
            scenarioIndex: this.scenarioIndex,
            levelId: sc.id,
          });
          this.showPlaytestExitModal();
        }
      );
      this.modalContainer!.add(exitBtn);
    }
  }

  private renderStandardEndModal(isWin: boolean): void {
    const box = this.add.graphics();
    box.fillStyle(0x16222f, 1);
    box.lineStyle(2, isWin ? 0x52b788 : 0xe63946, 1);
    box.fillRoundedRect(-180, -140, 360, 280, 14);
    box.strokeRoundedRect(-180, -140, 360, 280, 14);
    this.modalContainer!.add(box);

    const title = this.add
      .text(0, -90, isWin ? '🏆 BÖLÜM TAMAMLANDI!' : '💥 OYUN BİTTİ', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: isWin ? '#52b788' : '#e63946',
      })
      .setOrigin(0.5);
    this.modalContainer!.add(title);

    const details = `Skor: ${this.network.score}\nTeslimat: ${this.network.correctCount}\nHata: ${this.network.mistakeCount}`;
    const desc = this.add
      .text(0, -35, details, {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '14px',
        color: '#e0e1dd',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
    this.modalContainer!.add(desc);

    const retryBtn = this.createModalButton(
      0,
      35,
      '🔄 Bu Bölümü Tekrar Dene',
      '#1d3557',
      '#ffffff',
      () => this.loadLevel(this.scenarioIndex)
    );
    this.modalContainer!.add(retryBtn);

    if (isWin && this.scenarioIndex < this.activeLevelPool.length - 1) {
      const nextBtn = this.createModalButton(
        0,
        85,
        `Sonraki Seviye (${this.scenarioIndex + 2}) ➔`,
        '#1d2d44',
        '#48cae4',
        () => this.loadLevel(this.scenarioIndex + 1)
      );
      this.modalContainer!.add(nextBtn);
    }
  }

  private createModalButton(
    x: number,
    y: number,
    text: string,
    bgColor: string,
    textColor: string,
    onClick: () => void
  ): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, text, {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: textColor,
        backgroundColor: bgColor,
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', onClick);
    return btn;
  }

  private showPlaytestExitModal(): void {
    this.dismissModal();
    this.network.pause();
    this.isPaused = true;
    this.pauseBtnText.setText('▶️ Devam Et');

    this.modalContainer = this.add.container(270, 480).setDepth(100);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.82);
    overlay.fillRect(-270, -480, 540, 960);
    this.modalContainer.add(overlay);

    const box = this.add.graphics();
    box.fillStyle(0x16222f, 1);
    box.lineStyle(2, 0x48cae4, 1);
    box.fillRoundedRect(-185, -150, 370, 300, 14);
    box.strokeRoundedRect(-185, -150, 370, 300, 14);
    this.modalContainer.add(box);

    const title = this.add
      .text(0, -105, 'Test Oturumu Duraklatıldı', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#48cae4',
      })
      .setOrigin(0.5);
    this.modalContainer.add(title);

    const desc = this.add
      .text(0, -60, 'İstediğiniz an devam edebilir veya\ntest verilerini dışa aktarabilirsiniz.', {
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '13px',
        color: '#e0e1dd',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5);
    this.modalContainer.add(desc);

    const resumeBtn = this.createModalButton(0, -10, '▶️ Teste Devam Et', '#2d6a4f', '#ffffff', () => {
      this.dismissModal();
      this.network.resume();
      this.isPaused = false;
      this.pauseBtnText.setText('⏸️ Duraklat');
    });
    this.modalContainer.add(resumeBtn);

    const csvBtn = this.createModalButton(0, 38, '📥 Verileri İndir (CSV)', '#1d3557', '#48cae4', () => {
      this.telemetry.downloadCSV();
    });
    this.modalContainer.add(csvBtn);

    const jsonBtn = this.createModalButton(0, 86, '📥 Verileri İndir (JSON)', '#1d2d44', '#bfa895', () => {
      this.telemetry.downloadJSON();
    });
    this.modalContainer.add(jsonBtn);
  }

  private dismissModal(): void {
    if (this.modalContainer) {
      this.modalContainer.destroy();
      this.modalContainer = null;
    }
  }
}
