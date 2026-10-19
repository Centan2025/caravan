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
  sidingBays: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    capacity: number;
    slots: DioramaPoint[];
  }>;
}

export class MiniRailDioramaRegistry {
  /**
   * Generates handcrafted diorama layouts for the 3 curated showcase levels.
   * Every node and edge 100% strictly corresponds to the simulation graph!
   */
  public static getDioramaConfig(levelId: number, topology: GraphTopologyDef): MiniRailDioramaConfig {
    switch (levelId) {
      case 101:
        return this.getLevel101MeadowDiorama();
      case 104:
        return this.getLevel104LogisticsDiorama();
      case 1032:
        return this.getLevel1032QuarryDiorama();
      default:
        return this.getFallbackDiorama(levelId, topology);
    }
  }

  // ===========================================================================
  // LEVEL 101: Countryside Meadow Diorama (Çayır ve Gölet İstasyonu)
  // Spatial Flow: Elegant S-curve starting top-center, swooping left into siding,
  // then sweeping back to twin pastoral stations by the pond.
  // ===========================================================================
  private static getLevel101MeadowDiorama(): MiniRailDioramaConfig {
    return {
      levelId: 101,
      topologyId: 'siding_topology_l1',
      title: 'Çayır & Vadi İstasyonu',
      theme: {
        name: 'Pastoral Countryside',
        subtitle: 'Yumuşak yeşillikler, minyatür gölet ve ahşap çitler',
        tableColor: 0x8d6e63,        // Warm mahogany toy rim
        groundColor: 0x88c070,       // Lush warm meadow green
        groundAccentColor: 0x78ab60, // Meadow hill terrace
        trackBedColor: 0xdfcbaf,     // Natural ballast gravel
        railColor: 0x546e7a,         // Vintage dark steel
        sleeperColor: 0x6d4c41,      // Warm oak wood sleepers
        props: [
          // Scenic Pond
          { type: 'water_pond', x: 420, y: 360, size: 75 },
          // Miniature Trees
          { type: 'tree_round', x: 70, y: 220, size: 22 },
          { type: 'tree_round', x: 460, y: 200, size: 26 },
          { type: 'tree_pine', x: 60, y: 440, size: 24 },
          { type: 'tree_round', x: 80, y: 620, size: 20 },
          { type: 'tree_pine', x: 470, y: 640, size: 24 },
          // Wooden fence along meadow
          { type: 'fence', x: 420, y: 260, size: 70, rotation: 0 },
          { type: 'flower_patch', x: 100, y: 720, size: 16 },
          { type: 'flower_patch', x: 450, y: 720, size: 16 },
        ],
      },
      nodes: {
        SOURCE: { id: 'SOURCE', x: 270, y: 110, label: 'Kargo Hangarı', type: 'SOURCE' },
        SW_SIDING: { id: 'SW_SIDING', x: 270, y: 230, label: 'Kavşak 1', type: 'SWITCH' },
        SIDING_BAY: { id: 'SIDING_BAY', x: 130, y: 380, label: 'Sol Park Cebi', type: 'SIDING', capacity: 1 },
        MERGE: { id: 'MERGE', x: 270, y: 530, label: 'Birleşme', type: 'WAYPOINT' },
        SW_STATION: { id: 'SW_STATION', x: 270, y: 640, label: 'İstasyon Makası', type: 'SWITCH' },
        RED: { id: 'RED', x: 160, y: 750, label: 'Kırmızı Gar', type: 'STATION', stationColor: 'RED' },
        BLUE: { id: 'BLUE', x: 380, y: 750, label: 'Mavi Gar', type: 'STATION', stationColor: 'BLUE' },
      },
      edges: [
        {
          id: 'e_src_sw',
          from: 'SOURCE',
          to: 'SW_SIDING',
          points: [
            { x: 270, y: 110 },
            { x: 270, y: 230 },
          ],
        },
        {
          id: 'e_sw_main',
          from: 'SW_SIDING',
          to: 'MERGE',
          branch: 'MAIN',
          points: [
            { x: 270, y: 230 },
            { x: 270, y: 380 },
            { x: 270, y: 530 },
          ],
        },
        {
          id: 'e_sw_siding',
          from: 'SW_SIDING',
          to: 'SIDING_BAY',
          branch: 'SIDING',
          points: [
            { x: 270, y: 230 },
            { x: 190, y: 280 },
            { x: 130, y: 380 },
          ],
        },
        {
          id: 'e_siding_merge',
          from: 'SIDING_BAY',
          to: 'MERGE',
          points: [
            { x: 130, y: 380 },
            { x: 180, y: 480 },
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
        RED: { x: 160, y: 750, width: 110, height: 60, roofColor: 0xd9534f, label: 'Kırmızı Gar' },
        BLUE: { x: 380, y: 750, width: 110, height: 60, roofColor: 0x337ab7, label: 'Mavi Gar' },
      },
      sidingBays: [
        {
          id: 'SIDING_BAY',
          label: 'Park Peronu',
          x: 130,
          y: 380,
          width: 90,
          height: 70,
          capacity: 1,
          slots: [{ x: 130, y: 380 }],
        },
      ],
    };
  }

  // ===========================================================================
  // LEVEL 104: Logistics & Freight Yard Diorama (Çift Park Cebi - Dual Siding)
  // Spatial Flow: Dynamic interlocking rail yard with dual staggered bays
  // (Left Bay A, Right Bay B), container crates, gantry crane, paved ground.
  // ===========================================================================
  private static getLevel104LogisticsDiorama(): MiniRailDioramaConfig {
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
        SW_SIDING_A: { id: 'SW_SIDING_A', x: 270, y: 180, label: 'Makas A', type: 'SWITCH' },
        SIDING_A: { id: 'SIDING_A', x: 125, y: 270, label: 'Sol Peron A', type: 'SIDING', capacity: 1 },
        MERGE_A: { id: 'MERGE_A', x: 270, y: 355, label: 'Kavşak A', type: 'WAYPOINT' },
        SW_SIDING_B: { id: 'SW_SIDING_B', x: 270, y: 440, label: 'Makas B', type: 'SWITCH' },
        SIDING_B: { id: 'SIDING_B', x: 415, y: 530, label: 'Sağ Peron B', type: 'SIDING', capacity: 1 },
        MERGE_B: { id: 'MERGE_B', x: 270, y: 615, label: 'Kavşak B', type: 'WAYPOINT' },
        SW_STATION: { id: 'SW_STATION', x: 270, y: 685, label: 'Terminal Makası', type: 'SWITCH' },
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
  private static getLevel1032QuarryDiorama(): MiniRailDioramaConfig {
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
        SW_SIDING: { id: 'SW_SIDING', x: 270, y: 210, label: 'Maden Ayrımı', type: 'SWITCH' },
        SIDING_BAY: { id: 'SIDING_BAY', x: 130, y: 370, label: '2x FIFO İskelesi', type: 'SIDING', capacity: 2 },
        MERGE: { id: 'MERGE', x: 270, y: 530, label: 'Ana Hat Birleşimi', type: 'WAYPOINT' },
        SW_STATION: { id: 'SW_STATION', x: 270, y: 640, label: 'İstasyon Dağıtımı', type: 'SWITCH' },
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

  private static getFallbackDiorama(_levelId: number, _topology: GraphTopologyDef): MiniRailDioramaConfig {
    return this.getLevel101MeadowDiorama();
  }
}
