import { GraphScenarioDefinition, GraphTopologyDef } from './GraphTypes';

// =============================================================================
// TOPOLOGY 1: Left-Pocket Siding (Asymmetric Left Spur)
// =============================================================================
export const SIDING_TOPOLOGY_L1: GraphTopologyDef = {
  id: 'siding_topology_l1',
  name: 'Sol Park Cebi Ağı',
  nodes: [
    { id: 'SOURCE', type: 'SOURCE', position: { x: 270, y: 110 }, label: 'Kargo Çıkış' },
    { id: 'SW_SIDING', type: 'SWITCH', position: { x: 270, y: 230 }, label: 'Giriş Makası' },
    { id: 'SIDING_BAY', type: 'SIDING', capacity: 1, position: { x: 120, y: 360 }, label: 'Sol Park Cebi' },
    { id: 'MERGE', type: 'WAYPOINT', position: { x: 270, y: 490 }, label: 'Birleşme' },
    { id: 'SW_STATION', type: 'SWITCH', position: { x: 270, y: 610 }, label: 'İstasyon Makası' },
    { id: 'RED', type: 'STATION', stationColor: 'RED', position: { x: 160, y: 750 }, label: 'Kırmızı İstasyon' },
    { id: 'BLUE', type: 'STATION', stationColor: 'BLUE', position: { x: 380, y: 750 }, label: 'Mavi İstasyon' },
  ],
  switches: [
    { id: 'SW_SIDING', branches: ['MAIN', 'SIDING'], defaultBranch: 'MAIN' },
    { id: 'SW_STATION', branches: ['RED', 'BLUE'], defaultBranch: 'RED' },
  ],
  edges: [
    { id: 'e_src_sw', from: 'SOURCE', to: 'SW_SIDING' },
    { id: 'e_sw_main', from: 'SW_SIDING', to: 'MERGE', branch: 'MAIN' },
    { id: 'e_sw_siding', from: 'SW_SIDING', to: 'SIDING_BAY', branch: 'SIDING' },
    { id: 'e_siding_merge', from: 'SIDING_BAY', to: 'MERGE' },
    { id: 'e_merge_sw', from: 'MERGE', to: 'SW_STATION' },
    { id: 'e_sw_red', from: 'SW_STATION', to: 'RED', branch: 'RED' },
    { id: 'e_sw_blue', from: 'SW_STATION', to: 'BLUE', branch: 'BLUE' },
  ],
};

// =============================================================================
// TOPOLOGY 2: Right-Pocket Siding (Asymmetric Right Spur with Curved Bypass)
// =============================================================================
export const SIDING_TOPOLOGY_L2: GraphTopologyDef = {
  id: 'siding_topology_l2',
  name: 'Sağ Park Cebi & Kavisli Sollama',
  nodes: [
    { id: 'SOURCE', type: 'SOURCE', position: { x: 270, y: 110 }, label: 'Kargo Çıkış' },
    { id: 'SW_SIDING', type: 'SWITCH', position: { x: 270, y: 230 }, label: 'Giriş Makası' },
    { id: 'SIDING_BAY', type: 'SIDING', capacity: 1, position: { x: 420, y: 360 }, label: 'Sağ Park Cebi' },
    { id: 'MERGE', type: 'WAYPOINT', position: { x: 270, y: 490 }, label: 'Birleşme' },
    { id: 'SW_STATION', type: 'SWITCH', position: { x: 270, y: 610 }, label: 'İstasyon Makası' },
    { id: 'RED', type: 'STATION', stationColor: 'RED', position: { x: 160, y: 750 }, label: 'Kırmızı İstasyon' },
    { id: 'BLUE', type: 'STATION', stationColor: 'BLUE', position: { x: 380, y: 750 }, label: 'Mavi İstasyon' },
  ],
  switches: [
    { id: 'SW_SIDING', branches: ['MAIN', 'SIDING'], defaultBranch: 'SIDING' },
    { id: 'SW_STATION', branches: ['RED', 'BLUE'], defaultBranch: 'RED' },
  ],
  edges: [
    { id: 'e_src_sw', from: 'SOURCE', to: 'SW_SIDING' },
    { id: 'e_sw_main', from: 'SW_SIDING', to: 'MERGE', branch: 'MAIN' },
    { id: 'e_sw_siding', from: 'SW_SIDING', to: 'SIDING_BAY', branch: 'SIDING' },
    { id: 'e_siding_merge', from: 'SIDING_BAY', to: 'MERGE' },
    { id: 'e_merge_sw', from: 'MERGE', to: 'SW_STATION' },
    { id: 'e_sw_red', from: 'SW_STATION', to: 'RED', branch: 'RED' },
    { id: 'e_sw_blue', from: 'SW_STATION', to: 'BLUE', branch: 'BLUE' },
  ],
};

// =============================================================================
// TOPOLOGY 3: Central Island Siding (Single Capacity Baseline)
// =============================================================================
export const SIDING_TOPOLOGY_L3: GraphTopologyDef = {
  id: 'siding_topology_l3',
  name: 'Ada Tipi Merkez Park Cebi (1-Kapasite)',
  nodes: [
    { id: 'SOURCE', type: 'SOURCE', position: { x: 270, y: 110 }, label: 'Kargo Çıkış' },
    { id: 'SW_SIDING', type: 'SWITCH', position: { x: 270, y: 220 }, label: 'Giriş Makası' },
    { id: 'SIDING_BAY', type: 'SIDING', capacity: 1, position: { x: 270, y: 360 }, label: 'Merkez Cep' },
    { id: 'MERGE', type: 'WAYPOINT', position: { x: 270, y: 500 }, label: 'Birleşme' },
    { id: 'SW_STATION', type: 'SWITCH', position: { x: 270, y: 620 }, label: 'İstasyon Makası' },
    { id: 'RED', type: 'STATION', stationColor: 'RED', position: { x: 160, y: 760 }, label: 'Kırmızı İstasyon' },
    { id: 'BLUE', type: 'STATION', stationColor: 'BLUE', position: { x: 380, y: 760 }, label: 'Mavi İstasyon' },
  ],
  switches: [
    { id: 'SW_SIDING', branches: ['MAIN', 'SIDING'], defaultBranch: 'SIDING' },
    { id: 'SW_STATION', branches: ['RED', 'BLUE'], defaultBranch: 'RED' },
  ],
  edges: [
    { id: 'e_src_sw', from: 'SOURCE', to: 'SW_SIDING' },
    { id: 'e_sw_main', from: 'SW_SIDING', to: 'MERGE', branch: 'MAIN' },
    { id: 'e_sw_siding', from: 'SW_SIDING', to: 'SIDING_BAY', branch: 'SIDING' },
    { id: 'e_siding_merge', from: 'SIDING_BAY', to: 'MERGE' },
    { id: 'e_merge_sw', from: 'MERGE', to: 'SW_STATION' },
    { id: 'e_sw_red', from: 'SW_STATION', to: 'RED', branch: 'RED' },
    { id: 'e_sw_blue', from: 'SW_STATION', to: 'BLUE', branch: 'BLUE' },
  ],
};

// =============================================================================
// TOPOLOGY 3-B: 2-Capacity FIFO Siding (Experimental Variant)
// =============================================================================
export const SIDING_TOPOLOGY_L103_FIFO: GraphTopologyDef = {
  id: 'siding_topology_l103_fifo',
  name: '2-Kapasiteli FIFO Park Cebi Ağı',
  nodes: [
    { id: 'SOURCE', type: 'SOURCE', position: { x: 270, y: 110 }, label: 'Kargo Çıkış' },
    { id: 'SW_SIDING', type: 'SWITCH', position: { x: 270, y: 220 }, label: 'Giriş Makası' },
    { id: 'SIDING_BAY', type: 'SIDING', capacity: 2, position: { x: 270, y: 360 }, label: '2x FIFO Park Cebi' },
    { id: 'MERGE', type: 'WAYPOINT', position: { x: 270, y: 500 }, label: 'Birleşme' },
    { id: 'SW_STATION', type: 'SWITCH', position: { x: 270, y: 620 }, label: 'İstasyon Makası' },
    { id: 'RED', type: 'STATION', stationColor: 'RED', position: { x: 160, y: 760 }, label: 'Kırmızı İstasyon' },
    { id: 'BLUE', type: 'STATION', stationColor: 'BLUE', position: { x: 380, y: 760 }, label: 'Mavi İstasyon' },
  ],
  switches: [
    { id: 'SW_SIDING', branches: ['MAIN', 'SIDING'], defaultBranch: 'SIDING' },
    { id: 'SW_STATION', branches: ['RED', 'BLUE'], defaultBranch: 'RED' },
  ],
  edges: [
    { id: 'e_src_sw', from: 'SOURCE', to: 'SW_SIDING' },
    { id: 'e_sw_main', from: 'SW_SIDING', to: 'MERGE', branch: 'MAIN' },
    { id: 'e_sw_siding', from: 'SW_SIDING', to: 'SIDING_BAY', branch: 'SIDING' },
    { id: 'e_siding_merge', from: 'SIDING_BAY', to: 'MERGE' },
    { id: 'e_merge_sw', from: 'MERGE', to: 'SW_STATION' },
    { id: 'e_sw_red', from: 'SW_STATION', to: 'RED', branch: 'RED' },
    { id: 'e_sw_blue', from: 'SW_STATION', to: 'BLUE', branch: 'BLUE' },
  ],
};

// =============================================================================
// TOPOLOGY 4 (LEGACY): Diagonal S-Curve Siding (Sweeping Diagonal Rail Network)
// =============================================================================
export const SIDING_TOPOLOGY_L4_LEGACY: GraphTopologyDef = {
  id: 'siding_topology_l4_legacy',
  name: 'Diyagonal S-Kavis Park Hattı (Tek Park Cebi Referansı)',
  nodes: [
    { id: 'SOURCE', type: 'SOURCE', position: { x: 180, y: 110 }, label: 'Kargo Çıkış' },
    { id: 'SW_SIDING', type: 'SWITCH', position: { x: 220, y: 230 }, label: 'Giriş Makası' },
    { id: 'SIDING_BAY', type: 'SIDING', capacity: 1, position: { x: 110, y: 380 }, label: 'Alt Kavis Cebi' },
    { id: 'MERGE', type: 'WAYPOINT', position: { x: 320, y: 490 }, label: 'Birleşme' },
    { id: 'SW_STATION', type: 'SWITCH', position: { x: 270, y: 610 }, label: 'İstasyon Makası' },
    { id: 'RED', type: 'STATION', stationColor: 'RED', position: { x: 160, y: 750 }, label: 'Kırmızı İstasyon' },
    { id: 'BLUE', type: 'STATION', stationColor: 'BLUE', position: { x: 380, y: 750 }, label: 'Mavi İstasyon' },
  ],
  switches: [
    { id: 'SW_SIDING', branches: ['MAIN', 'SIDING'], defaultBranch: 'SIDING' },
    { id: 'SW_STATION', branches: ['RED', 'BLUE'], defaultBranch: 'RED' },
  ],
  edges: [
    { id: 'e_src_sw', from: 'SOURCE', to: 'SW_SIDING' },
    { id: 'e_sw_main', from: 'SW_SIDING', to: 'MERGE', branch: 'MAIN' },
    { id: 'e_sw_siding', from: 'SW_SIDING', to: 'SIDING_BAY', branch: 'SIDING' },
    { id: 'e_siding_merge', from: 'SIDING_BAY', to: 'MERGE' },
    { id: 'e_merge_sw', from: 'MERGE', to: 'SW_STATION' },
    { id: 'e_sw_red', from: 'SW_STATION', to: 'RED', branch: 'RED' },
    { id: 'e_sw_blue', from: 'SW_STATION', to: 'BLUE', branch: 'BLUE' },
  ],
};

// =============================================================================
// TOPOLOGY 4 (NEW DUAL SIDING): 2 Independent Siding Bays (Breaks Isomorphism!)
// =============================================================================
export const SIDING_TOPOLOGY_L104_DUAL: GraphTopologyDef = {
  id: 'siding_topology_l104_dual',
  name: 'Çift Bağımsız Park Cebi Ağı (Dual Siding)',
  nodes: [
    { id: 'SOURCE', type: 'SOURCE', position: { x: 270, y: 100 }, label: 'Kargo Çıkış' },
    { id: 'SW_SIDING_A', type: 'SWITCH', position: { x: 270, y: 200 }, label: 'Sol Giriş Makası' },
    { id: 'SIDING_A', type: 'SIDING', capacity: 1, position: { x: 115, y: 310 }, label: 'Sol Park Cebi A' },
    { id: 'MERGE_A', type: 'WAYPOINT', position: { x: 270, y: 410 }, label: 'Kavşak A' },
    { id: 'SW_SIDING_B', type: 'SWITCH', position: { x: 270, y: 510 }, label: 'Sağ Giriş Makası' },
    { id: 'SIDING_B', type: 'SIDING', capacity: 1, position: { x: 425, y: 610 }, label: 'Sağ Park Cebi B' },
    { id: 'MERGE_B', type: 'WAYPOINT', position: { x: 270, y: 700 }, label: 'Ana Birleşme' },
    { id: 'SW_STATION', type: 'SWITCH', position: { x: 270, y: 780 }, label: 'İstasyon Makası' },
    { id: 'RED', type: 'STATION', stationColor: 'RED', position: { x: 160, y: 860 }, label: 'Kırmızı İstasyon' },
    { id: 'BLUE', type: 'STATION', stationColor: 'BLUE', position: { x: 380, y: 860 }, label: 'Mavi İstasyon' },
  ],
  switches: [
    { id: 'SW_SIDING_A', branches: ['MAIN', 'SIDING'], defaultBranch: 'SIDING' },
    { id: 'SW_SIDING_B', branches: ['MAIN', 'SIDING'], defaultBranch: 'SIDING' },
    { id: 'SW_STATION', branches: ['RED', 'BLUE'], defaultBranch: 'RED' },
  ],
  edges: [
    { id: 'e_src_a', from: 'SOURCE', to: 'SW_SIDING_A' },
    { id: 'e_a_main', from: 'SW_SIDING_A', to: 'MERGE_A', branch: 'MAIN' },
    { id: 'e_a_siding', from: 'SW_SIDING_A', to: 'SIDING_A', branch: 'SIDING' },
    { id: 'e_siding_a_merge', from: 'SIDING_A', to: 'MERGE_A' },
    { id: 'e_merge_a_b', from: 'MERGE_A', to: 'SW_SIDING_B' },
    { id: 'e_b_main', from: 'SW_SIDING_B', to: 'MERGE_B', branch: 'MAIN' },
    { id: 'e_b_siding', from: 'SW_SIDING_B', to: 'SIDING_B', branch: 'SIDING' },
    { id: 'e_siding_b_merge', from: 'SIDING_B', to: 'MERGE_B' },
    { id: 'e_merge_b_sw', from: 'MERGE_B', to: 'SW_STATION' },
    { id: 'e_sw_red', from: 'SW_STATION', to: 'RED', branch: 'RED' },
    { id: 'e_sw_blue', from: 'SW_STATION', to: 'BLUE', branch: 'BLUE' },
  ],
};

// Backward-compatible alias
export const SIDING_TOPOLOGY_L4 = SIDING_TOPOLOGY_L4_LEGACY;

// =============================================================================
// TOPOLOGY 5: Wide Dual-Route Siding (Expansive Diamond Layout)
// =============================================================================
export const SIDING_TOPOLOGY_L5: GraphTopologyDef = {
  id: 'siding_topology_l5',
  name: 'Geniş Elmas Dağıtım Ağı',
  nodes: [
    { id: 'SOURCE', type: 'SOURCE', position: { x: 270, y: 100 }, label: 'Kargo Çıkış' },
    { id: 'SW_SIDING', type: 'SWITCH', position: { x: 270, y: 210 }, label: 'Giriş Makası' },
    { id: 'SIDING_BAY', type: 'SIDING', capacity: 1, position: { x: 95, y: 340 }, label: 'Batı Park Cebi' },
    { id: 'MERGE', type: 'WAYPOINT', position: { x: 270, y: 480 }, label: 'Merkez Kavşak' },
    { id: 'SW_STATION', type: 'SWITCH', position: { x: 270, y: 600 }, label: 'İstasyon Makası' },
    { id: 'RED', type: 'STATION', stationColor: 'RED', position: { x: 130, y: 750 }, label: 'Kırmızı Terminal' },
    { id: 'BLUE', type: 'STATION', stationColor: 'BLUE', position: { x: 410, y: 750 }, label: 'Mavi Terminal' },
  ],
  switches: [
    { id: 'SW_SIDING', branches: ['MAIN', 'SIDING'], defaultBranch: 'MAIN' },
    { id: 'SW_STATION', branches: ['RED', 'BLUE'], defaultBranch: 'RED' },
  ],
  edges: [
    { id: 'e_src_sw', from: 'SOURCE', to: 'SW_SIDING' },
    { id: 'e_sw_main', from: 'SW_SIDING', to: 'MERGE', branch: 'MAIN' },
    { id: 'e_sw_siding', from: 'SW_SIDING', to: 'SIDING_BAY', branch: 'SIDING' },
    { id: 'e_siding_merge', from: 'SIDING_BAY', to: 'MERGE' },
    { id: 'e_merge_sw', from: 'MERGE', to: 'SW_STATION' },
    { id: 'e_sw_red', from: 'SW_STATION', to: 'RED', branch: 'RED' },
    { id: 'e_sw_blue', from: 'SW_STATION', to: 'BLUE', branch: 'BLUE' },
  ],
};

// Backward-compatible alias
export const SIDING_TOPOLOGY = SIDING_TOPOLOGY_L1;

// =============================================================================
// SCENARIO DEFINITIONS
// =============================================================================

// Seviye 1: Park cebine girme ve çıkma (Sol Park Cebi)
export const SIDING_LEVEL_101: GraphScenarioDefinition = {
  id: 101,
  title: 'Siding 1: Park Cebine Giriş ve Çıkış',
  topology: SIDING_TOPOLOGY_L1,
  manifest: ['R'],
  district: 'industrial',
  levelFamily: 'learning',
  primaryChallenge: 'Sol park cebi temel eğitimi',
  tickDurationMs: 1200,
  spawnCadenceTicks: 5,
  activeJunctions: ['SW_SIDING', 'SW_STATION'],
  initialSwitches: { SW_SIDING: 'SIDING', SW_STATION: 'RED' },
  maxMistakes: 2,
  hint: 'Araç sol park cebine girdiğinde bekler. Devam etmesi için Serbest Bırak butonuna dokunun.',
};

// Seviye 2: İki araç arasında öncelik (Sağ Park Cebi & Sollama)
export const SIDING_LEVEL_102: GraphScenarioDefinition = {
  id: 102,
  title: 'Siding 2: Öncelik ve Sollama',
  topology: SIDING_TOPOLOGY_L2,
  manifest: ['B', 'R'],
  district: 'industrial',
  levelFamily: 'priority',
  primaryChallenge: 'Sağ park cebiyle sollama',
  tickDurationMs: 1100,
  spawnCadenceTicks: 4,
  activeJunctions: ['SW_SIDING', 'SW_STATION'],
  initialSwitches: { SW_SIDING: 'SIDING', SW_STATION: 'RED' },
  maxMistakes: 2,
  hint: 'Mavi treni sağ park cebine alın. Kırmızı tren ana hattan geçtikten sonra Mavi treni salın.',
};

// Seviye 3: Park alanının dolması (Merkez Ada Park Cebi - 1 Araç Kotası)
export const SIDING_LEVEL_103: GraphScenarioDefinition = {
  id: 103,
  title: 'Siding 3: Kapasite ve Blokaj',
  topology: SIDING_TOPOLOGY_L3,
  manifest: ['R', 'B', 'R'],
  district: 'industrial',
  levelFamily: 'traffic',
  primaryChallenge: 'Merkez park cebi kapasite yönetimi',
  tickDurationMs: 1000,
  spawnCadenceTicks: 4,
  activeJunctions: ['SW_SIDING', 'SW_STATION'],
  initialSwitches: { SW_SIDING: 'SIDING', SW_STATION: 'RED' },
  maxMistakes: 2,
  hint: 'Merkez park cebi 1 araçlıktır! İlk vagon girdikten sonra makası MAIN koluna çevirin.',
};

// Seviye 3-B: 2-Araçlık FIFO Park Cebi (Deney)
export const SIDING_LEVEL_103_FIFO: GraphScenarioDefinition = {
  id: 1032,
  title: 'Siding 3-B: 2-Araçlık FIFO Park Cebi (Deney)',
  topology: SIDING_TOPOLOGY_L103_FIFO,
  manifest: ['B', 'B', 'R'],
  district: 'industrial',
  levelFamily: 'fifo_queue',
  primaryChallenge: '2 vagonu aynı cebe alıp FIFO sırasıyla boşaltma',
  tickDurationMs: 1000,
  spawnCadenceTicks: 3,
  activeJunctions: ['SW_SIDING', 'SW_STATION'],
  initialSwitches: { SW_SIDING: 'SIDING', SW_STATION: 'BLUE' },
  maxMistakes: 2,
  hint: 'Park cebi 2 araç alabilir! İlk giren araç ilk çıkar (FIFO).',
};

// Seviye 4 (YENİ): Çift Bağımsız Park Cebi (Dual Siding)
export const SIDING_LEVEL_104_DUAL: GraphScenarioDefinition = {
  id: 104,
  title: 'Siding 4: Çift Park Cebi (Dual Siding)',
  topology: SIDING_TOPOLOGY_L104_DUAL,
  manifest: ['B', 'B', 'R', 'R'],
  district: 'industrial',
  levelFamily: 'dual_pocket',
  primaryChallenge: 'İki bağımsız cep ile 4 araçlık çift sollama',
  tickDurationMs: 1000,
  spawnCadenceTicks: 3,
  activeJunctions: ['SW_SIDING_A', 'SW_SIDING_B', 'SW_STATION'],
  initialSwitches: {
    SW_SIDING_A: 'SIDING',
    SW_SIDING_B: 'SIDING',
    SW_STATION: 'RED',
  },
  maxMistakes: 2,
  hint: 'İki mavi aracı Sol ve Sağ park ceplerine park edin. Kırmızı araçlar geçtikten sonra mavi araçları salın!',
};

// Seviye 4 (ESKİ REFERANS): Tek Park Cebi 4-Vagon
export const SIDING_LEVEL_104_LEGACY: GraphScenarioDefinition = {
  id: 1041,
  title: 'Siding 4 (Ref): Tek Cepte 4 Vagon',
  topology: SIDING_TOPOLOGY_L4_LEGACY,
  manifest: ['B', 'R', 'B', 'R'],
  district: 'industrial',
  levelFamily: 'route_selection',
  primaryChallenge: 'Eski tek cepte 2 çevrimli tekrarlı sollama',
  tickDurationMs: 1000,
  spawnCadenceTicks: 3,
  activeJunctions: ['SW_SIDING', 'SW_STATION'],
  initialSwitches: { SW_SIDING: 'SIDING', SW_STATION: 'RED' },
  maxMistakes: 2,
  hint: 'Referans seviye: Tek park cebiyle tekrarlı sıralama.',
};

// Seviye 5: Birden fazla geçerli çözüm yolu (Geniş Elmas Dağıtım Ağı)
export const SIDING_LEVEL_105: GraphScenarioDefinition = {
  id: 105,
  title: 'Siding 5: Serbest Rota Planlaması',
  topology: SIDING_TOPOLOGY_L5,
  manifest: ['R', 'B', 'R'],
  district: 'industrial',
  levelFamily: 'mastery',
  primaryChallenge: 'Geniş elmas ağda çift çözüm yolu',
  tickDurationMs: 1100,
  spawnCadenceTicks: 4,
  activeJunctions: ['SW_SIDING', 'SW_STATION'],
  initialSwitches: { SW_SIDING: 'MAIN', SW_STATION: 'RED' },
  maxMistakes: 2,
  hint: 'Bu seviyede iki farklı çözüm vardır: İster batı park cebini kullanın, ister doğu ekspres hattından zamanlama yapın!',
};

// =============================================================================
// MAIN 5 BASELINE SIDING LEVELS (100% backward compatible with legacy test suite)
// =============================================================================
export const SIDING_LEVELS: GraphScenarioDefinition[] = [
  SIDING_LEVEL_101,
  SIDING_LEVEL_102,
  SIDING_LEVEL_103,
  SIDING_LEVEL_104_LEGACY,
  SIDING_LEVEL_105,
];

// =============================================================================
// NEW DIVERSITY CORRECTION EXPERIMENTS
// =============================================================================
export const SIDING_EXPERIMENTS: GraphScenarioDefinition[] = [
  SIDING_LEVEL_104_DUAL,
  SIDING_LEVEL_103_FIFO,
];

// Complete collection for UI Dropdown and Playtesting
export const ALL_SIDING_LEVELS: GraphScenarioDefinition[] = [
  ...SIDING_LEVELS,
  ...SIDING_EXPERIMENTS,
];

// =============================================================================
// CURATED PLAYTEST SEQUENCE: 101 -> 102 -> 104 Dual -> 103-B FIFO -> 105
// =============================================================================
export const PLAYTEST_LEVELS: GraphScenarioDefinition[] = [
  SIDING_LEVEL_101,       // 1/5: Park Cebi Temel Eğitimi
  SIDING_LEVEL_102,       // 2/5: Öncelik ve Tekli Sollama
  SIDING_LEVEL_104_DUAL,  // 3/5: Çift Park Cebi (Dual Siding)
  SIDING_LEVEL_103_FIFO,  // 4/5: 2-Araçlık FIFO Park Cebi
  SIDING_LEVEL_105,       // 5/5: Serbest Rota Planlaması
];
