import { GraphTopologyDef, StationColor } from './GraphTypes';

export interface DioramaPoint {
  x: number;
  y: number;
}

export interface DioramaNodeLayout {
  id: string;
  x: number;
  y: number;
  label: string;
  type: string;
  stationColor?: StationColor;
  capacity?: number;
}

export interface DioramaCurveEdge {
  id: string;
  from: string;
  to: string;
  branch?: string;
  points: DioramaPoint[]; // Path waypoints for track & train movement
}

export interface DioramaProp {
  type: 'tree_pine' | 'tree_round' | 'rock' | 'fence' | 'water_pond' | 'cargo_crates' | 'crane' | 'lamp' | 'flower_patch' | 'warehouse';
  x: number;
  y: number;
  size?: number;
  rotation?: number;
  color?: number;
}

export interface DioramaTheme {
  name: string;
  subtitle: string;
  tableColor: number;         // Board border
  groundColor: number;        // Meadow / terrain base
  groundAccentColor: number;  // Elevation patch / path accent
  trackBedColor: number;      // Ballast / wooden roadbed
  railColor: number;          // Metal track rails
  sleeperColor: number;       // Wooden ties
  props: DioramaProp[];
}

export interface MiniRailSidingBay {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  capacity: number;
  slots: DioramaPoint[];
}

export interface MiniRailDioramaConfig {
  levelId: number;
  topologyId: string;
  title: string;
  theme: DioramaTheme;
  nodes: Record<string, DioramaNodeLayout>;
  edges: DioramaCurveEdge[];
  stationDetails: {
    RED: { x: number; y: number; width: number; height: number; roofColor: number; label: string };
    BLUE: { x: number; y: number; width: number; height: number; roofColor: number; label: string };
  };
  sidingBays: MiniRailSidingBay[];
}

export class MiniRailDioramaRegistry {
  /**
   * Retrieves and strictly validates handcrafted diorama layout for the requested level.
   * Throws explicit descriptive error if level is not supported or if layout is inconsistent.
   */
  public static getDioramaConfig(levelId: number, topology: GraphTopologyDef): MiniRailDioramaConfig {
    let config: MiniRailDioramaConfig;

    switch (levelId) {
      case 101:
        config = this.getLevel101MeadowDiorama();
        break;
      case 104:
        config = this.getLevel104LogisticsDiorama();
        break;
      case 1032:
      case 103:
        config = this.getLevel1032QuarryDiorama();
        break;
      default:
        throw new Error(
          `[MiniRailDioramaRegistry] Level ${levelId} is not supported in Mini Rail City diorama mode. Supported levels: 101, 104 (Dual), 103-B FIFO (1032).`
        );
    }

    // Strict Topology & Geometry Integrity Validation
    this.validateDiorama(config, topology);

    return config;
  }

  /**
   * Strictly validates that the diorama presentation layout matches the simulation graph topology 100%.
   */
  public static validateDiorama(config: MiniRailDioramaConfig, topology: GraphTopologyDef): void {
    // 1. Node validation
    for (const node of topology.nodes) {
      const vNode = config.nodes[node.id];
      if (!vNode) {
        throw new Error(
          `[MiniRailDioramaRegistry] Missing visual node '${node.id}' in diorama config for level ${config.levelId}.`
        );
      }
      if (vNode.type !== node.type) {
        throw new Error(
          `[MiniRailDioramaRegistry] Node type mismatch for '${node.id}': graph has '${node.type}', diorama has '${vNode.type}'.`
        );
      }
      if (node.type === 'STATION' && vNode.stationColor !== node.stationColor) {
        throw new Error(
          `[MiniRailDioramaRegistry] Station color mismatch for '${node.id}': expected '${node.stationColor}', got '${vNode.stationColor}'.`
        );
      }
      if (node.type === 'SIDING') {
        const expectedCap = node.capacity ?? 1;
        const bay = config.sidingBays.find((b) => b.id === node.id);
        if (!bay) {
          throw new Error(
            `[MiniRailDioramaRegistry] Missing sidingBay entry for SIDING node '${node.id}'.`
          );
        }
        if (bay.capacity !== expectedCap) {
          throw new Error(
            `[MiniRailDioramaRegistry] Siding capacity mismatch for '${node.id}': graph=${expectedCap}, diorama=${bay.capacity}.`
          );
        }
        if (bay.slots.length !== expectedCap) {
          throw new Error(
            `[MiniRailDioramaRegistry] Siding slots count mismatch for '${node.id}': expected ${expectedCap} slots, got ${bay.slots.length}.`
          );
        }
      }
    }

    // 2. Edge validation
    for (const edge of topology.edges) {
      const vEdge = config.edges.find(
        (e) => e.from === edge.from && e.to === edge.to && (edge.branch === undefined || e.branch === edge.branch)
      );
      if (!vEdge) {
        throw new Error(
          `[MiniRailDioramaRegistry] Missing visual edge in diorama for graph edge '${edge.id}' (${edge.from} -> ${edge.to}${edge.branch ? ' [' + edge.branch + ']' : ''}).`
        );
      }
      if (vEdge.points.length < 2) {
        throw new Error(
          `[MiniRailDioramaRegistry] Edge '${vEdge.id}' has insufficient waypoints (${vEdge.points.length}). Minimum is 2.`
        );
      }
      const startPt = vEdge.points[0];
      const endPt = vEdge.points[vEdge.points.length - 1];
      const fromNode = config.nodes[edge.from];
      const toNode = config.nodes[edge.to];

      if (Math.hypot(startPt.x - fromNode.x, startPt.y - fromNode.y) > 2) {
        throw new Error(
          `[MiniRailDioramaRegistry] Edge '${vEdge.id}' start point (${startPt.x}, ${startPt.y}) does not match fromNode '${edge.from}' (${fromNode.x}, ${fromNode.y}).`
        );
      }
      if (Math.hypot(endPt.x - toNode.x, endPt.y - toNode.y) > 2) {
        throw new Error(
          `[MiniRailDioramaRegistry] Edge '${vEdge.id}' end point (${endPt.x}, ${endPt.y}) does not match toNode '${edge.to}' (${toNode.x}, ${toNode.y}).`
        );
      }
    }

    // 3. Switch validation
    for (const sw of topology.switches) {
      if (!config.nodes[sw.id]) {
        throw new Error(
          `[MiniRailDioramaRegistry] Switch '${sw.id}' not declared in visual nodes.`
        );
      }
      for (const branch of sw.branches) {
        const branchEdge = config.edges.find((e) => e.from === sw.id && e.branch === branch);
        if (!branchEdge) {
          throw new Error(
            `[MiniRailDioramaRegistry] Switch '${sw.id}' missing visual edge for branch '${branch}'.`
          );
        }
      }
    }

    // 4. Station details validation
    if (!config.stationDetails.RED || !config.stationDetails.BLUE) {
      throw new Error(`[MiniRailDioramaRegistry] Missing stationDetails RED or BLUE in diorama config.`);
    }
  }

  // ===========================================================================
  // LEVEL 101: Concept A — Compact Puzzle Board (Railbound + Mini Motorways)
  // Spatial Flow: Centered wooden puzzle board, zero clutter props,
  // tactile switch dials, recessed siding berth, terracotta & vaulted terminals.
  // ===========================================================================
  public static getLevel101MeadowDiorama(): MiniRailDioramaConfig {
    return {
      levelId: 101,
      topologyId: 'siding_topology_l1',
      title: 'Çayır Çıkmazı',
      theme: {
        name: 'Compact Puzzle Board',
        subtitle: 'Sıcak açık bej zemin, kalın çerçeve, minimalist bulmaca',
        tableColor: 0xd4c5b1,        // Warm beige rim
        groundColor: 0xede6da,       // Warm light sandstone board ground
        groundAccentColor: 0xe4dcce, // Elevation terrace patch
        trackBedColor: 0xd5c8b5,     // Ballast roadbed
        railColor: 0x94a3b8,         // Metallic polished steel
        sleeperColor: 0x453123,      // Dark walnut wood ties
        props: [],                   // Zero noisy props: no trees, ponds, fences, rocks!
      },
      nodes: {
        SOURCE: { id: 'SOURCE', x: 270, y: 165, label: 'Kargo Deposu', type: 'SOURCE' },
        SW_SIDING: { id: 'SW_SIDING', x: 270, y: 285, label: 'Giriş Makası', type: 'SWITCH' },
        SIDING_BAY: { id: 'SIDING_BAY', x: 135, y: 440, label: 'Sol Park Cebi', type: 'SIDING', capacity: 1 },
        MERGE: { id: 'MERGE', x: 270, y: 585, label: 'Birleşme', type: 'WAYPOINT' },
        SW_STATION: { id: 'SW_STATION', x: 270, y: 685, label: 'İstasyon Makası', type: 'SWITCH' },
        RED: { id: 'RED', x: 155, y: 805, label: 'Kırmızı Antrepo', type: 'STATION', stationColor: 'RED' },
        BLUE: { id: 'BLUE', x: 385, y: 805, label: 'Mavi Terminal', type: 'STATION', stationColor: 'BLUE' },
      },
      edges: [
        {
          id: 'e_src_sw',
          from: 'SOURCE',
          to: 'SW_SIDING',
          points: [
            { x: 270, y: 165 },
            { x: 270, y: 285 },
          ],
        },
        {
          id: 'e_sw_main',
          from: 'SW_SIDING',
          to: 'MERGE',
          branch: 'MAIN',
          points: [
            { x: 270, y: 285 },
            { x: 270, y: 585 },
          ],
        },
        {
          id: 'e_sw_siding',
          from: 'SW_SIDING',
          to: 'SIDING_BAY',
          branch: 'SIDING',
          points: [
            { x: 270, y: 285 },
            { x: 195, y: 335 },
            { x: 135, y: 440 },
          ],
        },
        {
          id: 'e_siding_merge',
          from: 'SIDING_BAY',
          to: 'MERGE',
          points: [
            { x: 135, y: 440 },
            { x: 195, y: 535 },
            { x: 270, y: 585 },
          ],
        },
        {
          id: 'e_merge_sw',
          from: 'MERGE',
          to: 'SW_STATION',
          points: [
            { x: 270, y: 585 },
            { x: 270, y: 685 },
          ],
        },
        {
          id: 'e_sw_red',
          from: 'SW_STATION',
          to: 'RED',
          branch: 'RED',
          points: [
            { x: 270, y: 685 },
            { x: 200, y: 735 },
            { x: 155, y: 805 },
          ],
        },
        {
          id: 'e_sw_blue',
          from: 'SW_STATION',
          to: 'BLUE',
          branch: 'BLUE',
          points: [
            { x: 270, y: 685 },
            { x: 340, y: 735 },
            { x: 385, y: 805 },
          ],
        },
      ],
      stationDetails: {
        RED: { x: 155, y: 805, width: 125, height: 65, roofColor: 0xe11d48, label: 'Kırmızı Antrepo' },
        BLUE: { x: 385, y: 805, width: 125, height: 65, roofColor: 0x0284c7, label: 'Mavi Terminal' },
      },
      sidingBays: [
        {
          id: 'SIDING_BAY',
          label: 'Park Yuvası',
          x: 135,
          y: 440,
          width: 120,
          height: 75,
          capacity: 1,
          slots: [{ x: 135, y: 440 }],
        },
      ],
    };
  }

  // ===========================================================================
  // LEVEL 104: Logistics & Freight Yard Diorama (Çift Park Cebi - Dual Siding)
  // Spatial Flow: Dynamic interlocking rail yard with dual staggered bays
  // (Left Bay A, Right Bay B), container crates, gantry crane, paved ground.
  // ===========================================================================
  public static getLevel104LogisticsDiorama(): MiniRailDioramaConfig {
    return {
      levelId: 104,
      topologyId: 'siding_topology_l104_dual',
      title: 'Lojistik Dağıtım Garı (Dual)',
      theme: {
        name: 'Logistics Rail Yard',
        subtitle: 'İki bağımsız peron, kargo kasaları ve yükleme vinçleri',
        tableColor: 0x5d4037,        // Dark walnut diorama border
        groundColor: 0xd3c6b2,       // Warm industrial paved yard cobblestone
        groundAccentColor: 0xbeaf99, // Concrete cargo bay foundations
        trackBedColor: 0x9e907d,     // Dark yard ballast
        railColor: 0x455a64,         // Heavy freight steel
        sleeperColor: 0x4e342e,      // Creosote treated ties
        props: [
          // Cargo Crates & Containers
          { type: 'cargo_crates', x: 60, y: 190, size: 28, color: 0xef6c00 },
          { type: 'cargo_crates', x: 470, y: 350, size: 28, color: 0x0288d1 },
          { type: 'crane', x: 470, y: 220, size: 40 },
          { type: 'warehouse', x: 60, y: 460, size: 48 },
          { type: 'lamp', x: 190, y: 175, size: 14 },
          { type: 'lamp', x: 350, y: 430, size: 14 },
          { type: 'tree_round', x: 60, y: 640, size: 22 },
          { type: 'tree_round', x: 480, y: 650, size: 22 },
        ],
      },
      nodes: {
        SOURCE: { id: 'SOURCE', x: 270, y: 100, label: 'Liman Kargo Girişi', type: 'SOURCE' },
        SW_SIDING_A: { id: 'SW_SIDING_A', x: 270, y: 180, label: 'Sol Giriş Makası', type: 'SWITCH' },
        SIDING_A: { id: 'SIDING_A', x: 125, y: 270, label: 'Sol Park Cebi A', type: 'SIDING', capacity: 1 },
        MERGE_A: { id: 'MERGE_A', x: 270, y: 355, label: 'Kavşak A', type: 'WAYPOINT' },
        SW_SIDING_B: { id: 'SW_SIDING_B', x: 270, y: 440, label: 'Sağ Giriş Makası', type: 'SWITCH' },
        SIDING_B: { id: 'SIDING_B', x: 415, y: 530, label: 'Sağ Park Cebi B', type: 'SIDING', capacity: 1 },
        MERGE_B: { id: 'MERGE_B', x: 270, y: 615, label: 'Ana Birleşme', type: 'WAYPOINT' },
        SW_STATION: { id: 'SW_STATION', x: 270, y: 685, label: 'İstasyon Makası', type: 'SWITCH' },
        RED: { id: 'RED', x: 160, y: 755, label: 'Kırmızı Terminal', type: 'STATION', stationColor: 'RED' },
        BLUE: { id: 'BLUE', x: 380, y: 755, label: 'Mavi Terminal', type: 'STATION', stationColor: 'BLUE' },
      },
      edges: [
        {
          id: 'e_src_a',
          from: 'SOURCE',
          to: 'SW_SIDING_A',
          points: [
            { x: 270, y: 100 },
            { x: 270, y: 180 },
          ],
        },
        {
          id: 'e_a_main',
          from: 'SW_SIDING_A',
          to: 'MERGE_A',
          branch: 'MAIN',
          points: [
            { x: 270, y: 180 },
            { x: 270, y: 355 },
          ],
        },
        {
          id: 'e_a_siding',
          from: 'SW_SIDING_A',
          to: 'SIDING_A',
          branch: 'SIDING',
          points: [
            { x: 270, y: 180 },
            { x: 175, y: 220 },
            { x: 125, y: 270 },
          ],
        },
        {
          id: 'e_siding_a_merge',
          from: 'SIDING_A',
          to: 'MERGE_A',
          points: [
            { x: 125, y: 270 },
            { x: 175, y: 315 },
            { x: 270, y: 355 },
          ],
        },
        {
          id: 'e_merge_a_b',
          from: 'MERGE_A',
          to: 'SW_SIDING_B',
          points: [
            { x: 270, y: 355 },
            { x: 270, y: 440 },
          ],
        },
        {
          id: 'e_b_main',
          from: 'SW_SIDING_B',
          to: 'MERGE_B',
          branch: 'MAIN',
          points: [
            { x: 270, y: 440 },
            { x: 270, y: 615 },
          ],
        },
        {
          id: 'e_b_siding',
          from: 'SW_SIDING_B',
          to: 'SIDING_B',
          branch: 'SIDING',
          points: [
            { x: 270, y: 440 },
            { x: 365, y: 480 },
            { x: 415, y: 530 },
          ],
        },
        {
          id: 'e_siding_b_merge',
          from: 'SIDING_B',
          to: 'MERGE_B',
          points: [
            { x: 415, y: 530 },
            { x: 365, y: 575 },
            { x: 270, y: 615 },
          ],
        },
        {
          id: 'e_merge_b_sw',
          from: 'MERGE_B',
          to: 'SW_STATION',
          points: [
            { x: 270, y: 615 },
            { x: 270, y: 685 },
          ],
        },
        {
          id: 'e_sw_red',
          from: 'SW_STATION',
          to: 'RED',
          branch: 'RED',
          points: [
            { x: 270, y: 685 },
            { x: 200, y: 720 },
            { x: 160, y: 755 },
          ],
        },
        {
          id: 'e_sw_blue',
          from: 'SW_STATION',
          to: 'BLUE',
          branch: 'BLUE',
          points: [
            { x: 270, y: 685 },
            { x: 340, y: 720 },
            { x: 380, y: 755 },
          ],
        },
      ],
      stationDetails: {
        RED: { x: 160, y: 755, width: 110, height: 60, roofColor: 0xd32f2f, label: 'Kırmızı Antrepo' },
        BLUE: { x: 380, y: 755, width: 110, height: 60, roofColor: 0x1976d2, label: 'Mavi Antrepo' },
      },
      sidingBays: [
        {
          id: 'SIDING_A',
          label: 'Peron A (Kuzey)',
          x: 125,
          y: 270,
          width: 85,
          height: 60,
          capacity: 1,
          slots: [{ x: 125, y: 270 }],
        },
        {
          id: 'SIDING_B',
          label: 'Peron B (Güney)',
          x: 415,
          y: 530,
          width: 85,
          height: 60,
          capacity: 1,
          slots: [{ x: 415, y: 530 }],
        },
      ],
    };
  }

  // ===========================================================================
  // LEVEL 103-B FIFO: Quarry & Canyon Siding Diorama (2 Araçlık FIFO Yükleme)
  // Spatial Flow: Terraced red/gold canyon stone, long 2-slot loading platform
  // with coal/ore chute, distinct curved bypass route around rocky outcrop.
  // ===========================================================================
  public static getLevel1032QuarryDiorama(): MiniRailDioramaConfig {
    return {
      levelId: 1032,
      topologyId: 'siding_topology_l103_fifo',
      title: 'Kanyon & Maden Yükleme Garı (FIFO)',
      theme: {
        name: 'Terraced Quarry Canyon',
        subtitle: '2 vagon kapasiteli uzun yükleme iskelesi ve kavisli baypas',
        tableColor: 0x4e342e,        // Rustic earth border
        groundColor: 0xe0a96d,       // Warm canyon terracotta sand
        groundAccentColor: 0xcc8b50, // Terraced quarry plateau
        trackBedColor: 0xbcaaa4,     // Crushed limestone ballast
        railColor: 0x37474f,         // Sturdy mountain rails
        sleeperColor: 0x5d4037,      // Heavy timber sleepers
        props: [
          // Rock Boulders
          { type: 'rock', x: 270, y: 370, size: 36, color: 0x8d6e63 }, // Rock outcrop between siding & main line!
          { type: 'rock', x: 60, y: 200, size: 28, color: 0x795548 },
          { type: 'rock', x: 460, y: 480, size: 32, color: 0x795548 },
          // Mountain Pine Trees
          { type: 'tree_pine', x: 460, y: 210, size: 26 },
          { type: 'tree_pine', x: 70, y: 580, size: 24 },
          { type: 'tree_pine', x: 460, y: 640, size: 26 },
          // Wooden Ore Hopper above siding
          { type: 'crane', x: 65, y: 370, size: 42 },
          { type: 'fence', x: 420, y: 350, size: 60, rotation: 90 },
        ],
      },
      nodes: {
        SOURCE: { id: 'SOURCE', x: 270, y: 100, label: 'Maden Ocağı', type: 'SOURCE' },
        SW_SIDING: { id: 'SW_SIDING', x: 270, y: 210, label: 'Giriş Makası', type: 'SWITCH' },
        SIDING_BAY: { id: 'SIDING_BAY', x: 130, y: 370, label: '2x FIFO Park Cebi', type: 'SIDING', capacity: 2 },
        MERGE: { id: 'MERGE', x: 270, y: 530, label: 'Birleşme', type: 'WAYPOINT' },
        SW_STATION: { id: 'SW_STATION', x: 270, y: 640, label: 'İstasyon Makası', type: 'SWITCH' },
        RED: { id: 'RED', x: 160, y: 750, label: 'Kızıl Maden Deposu', type: 'STATION', stationColor: 'RED' },
        BLUE: { id: 'BLUE', x: 380, y: 750, label: 'Gök Cevher Terminali', type: 'STATION', stationColor: 'BLUE' },
      },
      edges: [
        {
          id: 'e_src_sw',
          from: 'SOURCE',
          to: 'SW_SIDING',
          points: [
            { x: 270, y: 100 },
            { x: 270, y: 210 },
          ],
        },
        {
          id: 'e_sw_main',
          from: 'SW_SIDING',
          to: 'MERGE',
          branch: 'MAIN',
          // Distinct curved bypass bowing to the right around the rock outcrop!
          points: [
            { x: 270, y: 210 },
            { x: 330, y: 370 },
            { x: 270, y: 530 },
          ],
        },
        {
          id: 'e_sw_siding',
          from: 'SW_SIDING',
          to: 'SIDING_BAY',
          branch: 'SIDING',
          points: [
            { x: 270, y: 210 },
            { x: 180, y: 270 },
            { x: 130, y: 370 },
          ],
        },
        {
          id: 'e_siding_merge',
          from: 'SIDING_BAY',
          to: 'MERGE',
          points: [
            { x: 130, y: 370 },
            { x: 180, y: 470 },
            { x: 270, y: 530 },
          ],
        },
        {
          id: 'e_merge_sw',
          from: 'MERGE',
          to: 'SW_STATION',
          points: [
            { x: 270, y: 530 },
            { x: 270, y: 640 },
          ],
        },
        {
          id: 'e_sw_red',
          from: 'SW_STATION',
          to: 'RED',
          branch: 'RED',
          points: [
            { x: 270, y: 640 },
            { x: 200, y: 690 },
            { x: 160, y: 750 },
          ],
        },
        {
          id: 'e_sw_blue',
          from: 'SW_STATION',
          to: 'BLUE',
          branch: 'BLUE',
          points: [
            { x: 270, y: 640 },
            { x: 340, y: 690 },
            { x: 380, y: 750 },
          ],
        },
      ],
      stationDetails: {
        RED: { x: 160, y: 750, width: 110, height: 60, roofColor: 0xb71c1c, label: 'Kızıl Maden Deposu' },
        BLUE: { x: 380, y: 750, width: 110, height: 60, roofColor: 0x0d47a1, label: 'Gök Cevher Terminali' },
      },
      sidingBays: [
        {
          id: 'SIDING_BAY',
          label: '2-Araçlık FIFO İskelesi',
          x: 130,
          y: 370,
          width: 90,
          height: 120, // Elongated 2-capacity bay
          capacity: 2,
          slots: [
            { x: 130, y: 335 }, // Slot #1 (lead position)
            { x: 130, y: 405 }, // Slot #2 (tail position)
          ],
        },
      ],
    };
  }
}
