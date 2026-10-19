import {
  Direction,
  LevelConfig,
  StopType,
  TileData,
  TileGeometry,
} from '../types';
import { simulateRoute } from './PathSolver';

/**
 * Pseudo-random number generator (Mulberry32) for reproducible seeds.
 */
export function createPRNG(seed: number) {
  let s = Math.floor(seed) >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface HandcraftedLevelData extends LevelConfig {
  solutionRotations: Record<string, number>; // "x,y" => correct rotation
}

/**
 * Creates empty 5x5 grid template
 */
function createEmptyGrid(gridSize = 5): TileData[] {
  const tiles: TileData[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      tiles.push({
        x,
        y,
        geometry: 'EMPTY',
        rotation: 0,
        stop: 'NONE',
      });
    }
  }
  return tiles;
}

/**
 * 10 Handcrafted progressive levels
 */
export const HANDCRAFTED_LEVELS: HandcraftedLevelData[] = [
  // LEVEL 1: Temel Bağlantı (Düz yollar ve Han durağı)
  {
    id: 1,
    title: 'Seviye 1: Vaha Yolu',
    description: 'Üreticiden çıkan kervanı İpek Hanı üzerinden Pazara ulaştırın.',
    gridSize: 5,
    targetMoves: 3,
    startTile: { x: 0, y: 2, initialExitDir: 1 }, // Exit East
    solutionRotations: {
      '0,2': 1, // STRAIGHT horizontal [1, 3]
      '1,2': 1, // STRAIGHT horizontal [1, 3]
      '2,2': 1, // INN - STRAIGHT horizontal [1, 3]
      '3,2': 1, // STRAIGHT horizontal [1, 3]
      '4,2': 1, // MARKET - STRAIGHT horizontal [1, 3]
    },
    tiles: [
      ...createEmptyGrid(5).filter((t) => !(t.y === 2)),
      { x: 0, y: 2, geometry: 'STRAIGHT', rotation: 1, stop: 'PRODUCER', fixed: true },
      { x: 1, y: 2, geometry: 'STRAIGHT', rotation: 0, stop: 'NONE' }, // Needs 1 rot
      { x: 2, y: 2, geometry: 'STRAIGHT', rotation: 0, stop: 'INN' },      // Needs 1 rot
      { x: 3, y: 2, geometry: 'STRAIGHT', rotation: 0, stop: 'NONE' }, // Needs 1 rot
      { x: 4, y: 2, geometry: 'STRAIGHT', rotation: 1, stop: 'MARKET', fixed: true },
    ],
  },

  // LEVEL 2: Çöl Dönüşleri (Dirsek / Elbow Geometrisi)
  {
    id: 2,
    title: 'Seviye 2: Altın Kıvrım',
    description: 'Dirsek karolarını döndürerek Han üzerinden geçiş yapın.',
    gridSize: 5,
    targetMoves: 4,
    startTile: { x: 0, y: 1, initialExitDir: 1 },
    solutionRotations: {
      '0,1': 1, // STRAIGHT [1, 3]
      '1,1': 1, // ELBOW [1, 2] (East -> South)
      '1,2': 3, // ELBOW [3, 0] wait: entry from North (0), needs East (1)? ELBOW [0, 1] rot 0!
      // Let's verify carefully:
      // (0,1) goes E to (1,1).
      // (1,1) entered from W (entrySide 3). Exits S (2). Connections: [1, 2] -> rot 1! Right.
      // (1,2) entered from N (entrySide 0). Exits E (1). Connections: [0, 1] -> rot 0!
      // (2,2) INN: entered from W (entrySide 3). Exits E (1). STRAIGHT rot 1!
      // (3,2) entered from W (entrySide 3). Exits S (2). ELBOW [2, 3] -> rot 2!
      // (3,3) MARKET: entered from N (entrySide 0). STRAIGHT rot 0!
    },
    // We will build tiles based on exact verified coordinates below
    tiles: [],
  },

  // We will populate all 10 below with verified paths!
];

// Helper to assemble and verify levels
export function buildLevel(
  id: number,
  title: string,
  description: string,
  start: { x: number; y: number; initialExitDir: Direction },
  pathDefinitions: Array<{
    x: number;
    y: number;
    geometry: TileGeometry;
    solvedRotation: number;
    scrambledRotation: number;
    stop: StopType;
    fixed?: boolean;
  }>,
  decoyTiles: Array<{
    x: number;
    y: number;
    geometry: TileGeometry;
    rotation: number;
  }> = []
): HandcraftedLevelData {
  const grid = createEmptyGrid(5);
  const tileMap = new Map<string, TileData>();
  for (const t of grid) {
    tileMap.set(`${t.x},${t.y}`, t);
  }

  const solutionRotations: Record<string, number> = {};

  for (const p of pathDefinitions) {
    tileMap.set(`${p.x},${p.y}`, {
      x: p.x,
      y: p.y,
      geometry: p.geometry,
      rotation: p.scrambledRotation,
      stop: p.stop,
      fixed: p.fixed ?? false,
    });
    solutionRotations[`${p.x},${p.y}`] = p.solvedRotation;
  }

  for (const d of decoyTiles) {
    tileMap.set(`${d.x},${d.y}`, {
      x: d.x,
      y: d.y,
      geometry: d.geometry,
      rotation: d.rotation,
      stop: 'NONE',
    });
    solutionRotations[`${d.x},${d.y}`] = d.rotation;
  }

  return {
    id,
    title,
    description,
    gridSize: 5,
    startTile: start,
    solutionRotations,
    tiles: Array.from(tileMap.values()),
  };
}

/**
 * Complete suite of 10 handcrafted levels
 */
export function generateHandcraftedLevels(): HandcraftedLevelData[] {
  const levels: HandcraftedLevelData[] = [];

  // LEVEL 1: Düz hat
  levels.push(
    buildLevel(
      1,
      'Seviye 1: Vaha Yolu',
      'Üreticiden çıkan kervanı İpek Hanı üzerinden Pazara ulaştırın.',
      { x: 0, y: 2, initialExitDir: 1 },
      [
        { x: 0, y: 2, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'PRODUCER', fixed: true },
        { x: 1, y: 2, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 0, stop: 'NONE' },
        { x: 2, y: 2, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 0, stop: 'INN' },
        { x: 3, y: 2, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 0, stop: 'NONE' },
        { x: 4, y: 2, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'MARKET', fixed: true },
      ]
    )
  );

  // LEVEL 2: Kıvrımlı Vadi (ELBOW kullanımı)
  // (0,1)[P] -> E -> (1,1)[L: rot1 W->S] -> S -> (1,2)[L: rot0 N->E] -> E -> (2,2)[H: rot1 W->E] -> E -> (3,2)[L: rot2 W->S] -> S -> (3,3)[M: rot0 N->S]
  levels.push(
    buildLevel(
      2,
      'Seviye 2: Altın Kıvrım',
      'Dirsek karolarını döndürerek kanyon boyunca Han durağına uğrayın.',
      { x: 0, y: 1, initialExitDir: 1 },
      [
        { x: 0, y: 1, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'PRODUCER', fixed: true },
        { x: 1, y: 1, geometry: 'ELBOW', solvedRotation: 2, scrambledRotation: 3, stop: 'NONE' },
        { x: 1, y: 2, geometry: 'ELBOW', solvedRotation: 0, scrambledRotation: 2, stop: 'NONE' },
        { x: 2, y: 2, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 0, stop: 'INN' },
        { x: 3, y: 2, geometry: 'ELBOW', solvedRotation: 2, scrambledRotation: 0, stop: 'NONE' },
        { x: 3, y: 3, geometry: 'STRAIGHT', solvedRotation: 0, scrambledRotation: 0, stop: 'MARKET', fixed: true },
      ]
    )
  );

  // LEVEL 3: T-Kavşak Seçimi (TEE tanışma)
  // (0,2)[P] -> E -> (1,2)[TEE: rot 1 (N, E, S), entry W? Wait: TEE base is [W, N, E] (3, 0, 1).
  // At rot 0: [3, 0, 1]. Entry from W (3). Straight is E (1). So rot 0 goes straight!
  // At rot 1: [0, 1, 2] (N, E, S).
  // Let's connect:
  // (0,2)[P] -> E -> (1,2)[TEE base [W, N, E], rot 0]. Straight goes to (2,2)[INN].
  // If (1,2) is turned, it branches to (1,1) [çıkmaz/decoy].
  // (2,2)[INN, STRAIGHT rot 1] -> (3,2)[ELBOW rot 1 (E, S)] -> (3,3)[MARKET, STRAIGHT rot 0]
  levels.push(
    buildLevel(
      3,
      'Seviye 3: Vaha Çatalı',
      'T-kavşak ile kervanın düz gitme önceliğini kullanarak Han ve Pazara bağlanın.',
      { x: 0, y: 2, initialExitDir: 1 },
      [
        { x: 0, y: 2, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'PRODUCER', fixed: true },
        { x: 1, y: 2, geometry: 'TEE', solvedRotation: 0, scrambledRotation: 2, stop: 'NONE' },
        { x: 2, y: 2, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 0, stop: 'INN' },
        { x: 3, y: 2, geometry: 'ELBOW', solvedRotation: 2, scrambledRotation: 3, stop: 'NONE' },
        { x: 3, y: 3, geometry: 'STRAIGHT', solvedRotation: 0, scrambledRotation: 0, stop: 'MARKET', fixed: true },
      ],
      [
        // Decoy on top of T
        { x: 1, y: 1, geometry: 'STRAIGHT', rotation: 0 },
      ]
    )
  );

  // LEVEL 4: Dört Yol Kavşağı (CROSS & Düz Önceliği)
  // (1,0)[P] -> S -> (1,1)[ELBOW rot 0 (N, E)? Wait, entry N(0), exit E(1) -> [0, 1] rot 0!]
  // (2,1)[CROSS rot 0 (all 4)] -> straight goes E to (3,1)[INN]
  // (3,1)[INN, ELBOW rot 1 (E, S) or rot 2 (S, W)] -> goes S to (3,2)[ELBOW rot 3 (W, N) or STRAIGHT] -> (3,3)[MARKET]
  // In CROSS (2,1), straight priority takes it to (3,1) where INN is located!
  levels.push(
    buildLevel(
      4,
      'Seviye 4: Dörtyol Hanı',
      'Dört yönlü kavşakta kervan düz devam eder. Doğru rotayı kurun.',
      { x: 1, y: 0, initialExitDir: 2 },
      [
        { x: 1, y: 0, geometry: 'STRAIGHT', solvedRotation: 0, scrambledRotation: 0, stop: 'PRODUCER', fixed: true },
        { x: 1, y: 1, geometry: 'ELBOW', solvedRotation: 0, scrambledRotation: 2, stop: 'NONE' }, // N & E
        { x: 2, y: 1, geometry: 'CROSS', solvedRotation: 0, scrambledRotation: 0, stop: 'NONE' },
        { x: 3, y: 1, geometry: 'ELBOW', solvedRotation: 2, scrambledRotation: 3, stop: 'INN' }, // W & S
        { x: 3, y: 2, geometry: 'STRAIGHT', solvedRotation: 0, scrambledRotation: 1, stop: 'NONE' },
        { x: 3, y: 3, geometry: 'STRAIGHT', solvedRotation: 0, scrambledRotation: 0, stop: 'MARKET', fixed: true },
      ],
      [
        { x: 2, y: 0, geometry: 'STRAIGHT', rotation: 0 },
        { x: 2, y: 2, geometry: 'STRAIGHT', rotation: 0 },
      ]
    )
  );

  // LEVEL 5: Köşe Kervansarayı (Detour to Han)
  // P at (0, 0) -> E -> (1, 0) -> S -> (1, 1) -> E -> (2, 1)[INN] -> E -> (3, 1) -> S -> (3, 2) -> E -> (4, 2)[M]
  levels.push(
    buildLevel(
      5,
      'Seviye 5: Köşe Kervansarayı',
      'Pazar doğrudan yakın gibi görünse de önce Han ziyaret edilmeli!',
      { x: 0, y: 0, initialExitDir: 1 },
      [
        { x: 0, y: 0, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'PRODUCER', fixed: true },
        { x: 1, y: 0, geometry: 'ELBOW', solvedRotation: 2, scrambledRotation: 3, stop: 'NONE' },
        { x: 1, y: 1, geometry: 'ELBOW', solvedRotation: 0, scrambledRotation: 2, stop: 'NONE' }, // entered from N(0), exit E(1) -> rot 0 [0,1]
        { x: 2, y: 1, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 0, stop: 'INN' }, // W to E
        { x: 3, y: 1, geometry: 'ELBOW', solvedRotation: 2, scrambledRotation: 0, stop: 'NONE' }, // entered from W(3), exit S(2) -> rot 2 [2,3]
        { x: 3, y: 2, geometry: 'ELBOW', solvedRotation: 0, scrambledRotation: 1, stop: 'NONE' }, // entered from N(0), exit E(1) -> rot 0 [0,1]
        { x: 4, y: 2, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'MARKET', fixed: true },
      ],
      [
        { x: 0, y: 1, geometry: 'STRAIGHT', rotation: 1 },
        { x: 0, y: 2, geometry: 'ELBOW', rotation: 0 },
      ]
    )
  );

  // LEVEL 6: Çıkmazlar Labirenti (Dead-end avoidance)
  // Path: (0, 3)[P] -> N -> (0, 2)[L rot 0 N,E: wait entered from S(2), needs S(2) and E(1) -> rot 1 [1, 2]!]
  // -> E -> (1, 2)[TEE rot 0 (3,0,1): straight goes E] -> E -> (2, 2)[INN, STRAIGHT rot 1]
  // -> E -> (3, 2)[L rot 2: entered W(3), exits S(2) -> [2,3] rot 2]
  // -> S -> (3, 3)[L rot 3: entered N(0), exits W(3) -> wait: entered N(0), exit E? M is at (4,3).
  // Entered N(0), exits E(1) -> rot 0 [0,1] -> (4,3)[MARKET]
  levels.push(
    buildLevel(
      6,
      'Seviye 6: Çıkmaz Labirenti',
      'Yoldaki yanıltıcı çıkmazlara sapmadan doğru hatları birleştirin.',
      { x: 0, y: 3, initialExitDir: 0 }, // North
      [
        { x: 0, y: 3, geometry: 'STRAIGHT', solvedRotation: 0, scrambledRotation: 0, stop: 'PRODUCER', fixed: true },
        { x: 0, y: 2, geometry: 'ELBOW', solvedRotation: 1, scrambledRotation: 3, stop: 'NONE' }, // [1, 2] S to E
        { x: 1, y: 2, geometry: 'TEE', solvedRotation: 0, scrambledRotation: 2, stop: 'NONE' },    // straight to E
        { x: 2, y: 2, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 0, stop: 'INN' },
        { x: 3, y: 2, geometry: 'ELBOW', solvedRotation: 2, scrambledRotation: 0, stop: 'NONE' }, // W to S
        { x: 3, y: 3, geometry: 'ELBOW', solvedRotation: 0, scrambledRotation: 1, stop: 'NONE' }, // N to E
        { x: 4, y: 3, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'MARKET', fixed: true },
      ],
      [
        { x: 1, y: 1, geometry: 'STRAIGHT', rotation: 0 },
        { x: 2, y: 1, geometry: 'ELBOW', rotation: 2 },
      ]
    )
  );

  // LEVEL 7: Saat Yönü Kuralı (Clockwise priority on T-junction)
  // Caravan enters T-junction where straight is closed/empty.
  // Must turn right (clockwise priority)!
  // (2, 0)[P] -> S -> (2, 1)[TEE]:
  // Entered from N(0). Opposite(0) is S(2).
  // If TEE has ports [N(0), E(1), W(3)] (rot 0):
  // Ports are [N, E, W]. Entry is N(0).
  // Straight is S(2). S is NOT in ports!
  // Clockwise from S(2):
  // Right is W(3) ((2 + 1) % 4 = 3).
  // Left is E(1) ((2 + 3) % 4 = 1).
  // So caravan prioritizes W(3)!
  // Thus at (2,1), it turns West to (1,1)[INN]!
  // (1,1)[INN, ELBOW rot 2 W&S: wait entered from E(1), needs E(1) and S(2) -> rot 1 [1,2]]
  // -> S to (1,2)[L rot 0 N&E] -> E to (2,2)[L rot 2 W&S] -> S to (2,3)[L rot 0 N&E] -> E to (3,3)[MARKET]
  levels.push(
    buildLevel(
      7,
      'Seviye 7: Saat Yönü Önceliği',
      'T-kavşakta düz yol kapalıyken kervan saat yönündeki ilk açık çıkışı seçer.',
      { x: 2, y: 0, initialExitDir: 2 }, // South
      [
        { x: 2, y: 0, geometry: 'STRAIGHT', solvedRotation: 0, scrambledRotation: 0, stop: 'PRODUCER', fixed: true },
        { x: 2, y: 1, geometry: 'TEE', solvedRotation: 0, scrambledRotation: 1, stop: 'NONE' }, // Ports [3, 0, 1]. Entry N(0). Chooses W(3)!
        { x: 1, y: 1, geometry: 'ELBOW', solvedRotation: 1, scrambledRotation: 3, stop: 'INN' }, // [1, 2] entered E(1), exits S(2)
        { x: 1, y: 2, geometry: 'ELBOW', solvedRotation: 0, scrambledRotation: 2, stop: 'NONE' }, // [0, 1] entered N(0), exits E(1)
        { x: 2, y: 2, geometry: 'ELBOW', solvedRotation: 2, scrambledRotation: 0, stop: 'NONE' }, // [2, 3] entered W(3), exits S(2)
        { x: 2, y: 3, geometry: 'ELBOW', solvedRotation: 0, scrambledRotation: 3, stop: 'NONE' }, // [0, 1] entered N(0), exits E(1)
        { x: 3, y: 3, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'MARKET', fixed: true },
      ]
    )
  );

  // LEVEL 8: İpek Koridoru (Uzun zikzak hat)
  // (0, 0)[P] -> E -> (1, 0)[L rot 2 W&S: [2,3]] -> S -> (1, 1)[L rot 0 N&E: [0,1]]
  // -> E -> (2, 1)[STRAIGHT rot 1] -> E -> (3, 1)[L rot 2 W&S: [2,3]]
  // -> S -> (3, 2)[INN, L rot 3 S&W? Entered N(0), exits W(3) -> rot 3 [3, 0]!]
  // -> W -> (2, 2)[L rot 1 E&S: [1, 2]] -> S -> (2, 3)[L rot 0 N&E: [0, 1]]
  // -> E -> (3, 3)[STRAIGHT rot 1] -> E -> (4, 3)[MARKET]
  levels.push(
    buildLevel(
      8,
      'Seviye 8: İpek Koridoru',
      'Zikzak çizen uzun ticaret yolunu doğru şekilde kurun.',
      { x: 0, y: 0, initialExitDir: 1 },
      [
        { x: 0, y: 0, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'PRODUCER', fixed: true },
        { x: 1, y: 0, geometry: 'ELBOW', solvedRotation: 2, scrambledRotation: 0, stop: 'NONE' },
        { x: 1, y: 1, geometry: 'ELBOW', solvedRotation: 0, scrambledRotation: 3, stop: 'NONE' },
        { x: 2, y: 1, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 0, stop: 'NONE' },
        { x: 3, y: 1, geometry: 'ELBOW', solvedRotation: 2, scrambledRotation: 1, stop: 'NONE' },
        { x: 3, y: 2, geometry: 'ELBOW', solvedRotation: 3, scrambledRotation: 0, stop: 'INN' },
        { x: 2, y: 2, geometry: 'ELBOW', solvedRotation: 1, scrambledRotation: 2, stop: 'NONE' },
        { x: 2, y: 3, geometry: 'ELBOW', solvedRotation: 0, scrambledRotation: 3, stop: 'NONE' },
        { x: 3, y: 3, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 0, stop: 'NONE' },
        { x: 4, y: 3, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'MARKET', fixed: true },
      ]
    )
  );

  // LEVEL 9: Çifte Kavşak Tuzağı (Dual T-junction loop trap)
  // (0, 1)[P] -> E -> (1, 1)[TEE rot 0 (3,0,1)]: straight goes E to (2, 1)[TEE rot 0 (3,0,1)]
  // From (2, 1), straight goes E to (3, 1)[INN, L rot 2 W&S: [2,3]]
  // S to (3, 2)[L rot 3 N&W: [3,0]] -> W to (2, 2)[L rot 1 E&S: [1,2]]
  // S to (2, 3)[L rot 0 N&E: [0,1]] -> E to (3, 3)[STRAIGHT rot 1] -> (4, 3)[MARKET]
  levels.push(
    buildLevel(
      9,
      'Seviye 9: Çifte Kavşak Tuzağı',
      'Birbiri ardına dizili T-kavşaklarda döngüye girmeden Han ve Pazara erişin.',
      { x: 0, y: 1, initialExitDir: 1 },
      [
        { x: 0, y: 1, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'PRODUCER', fixed: true },
        { x: 1, y: 1, geometry: 'TEE', solvedRotation: 0, scrambledRotation: 3, stop: 'NONE' },
        { x: 2, y: 1, geometry: 'TEE', solvedRotation: 0, scrambledRotation: 1, stop: 'NONE' },
        { x: 3, y: 1, geometry: 'ELBOW', solvedRotation: 2, scrambledRotation: 0, stop: 'INN' },
        { x: 3, y: 2, geometry: 'ELBOW', solvedRotation: 3, scrambledRotation: 2, stop: 'NONE' },
        { x: 2, y: 2, geometry: 'ELBOW', solvedRotation: 1, scrambledRotation: 0, stop: 'NONE' },
        { x: 2, y: 3, geometry: 'ELBOW', solvedRotation: 0, scrambledRotation: 3, stop: 'NONE' },
        { x: 3, y: 3, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 0, stop: 'NONE' },
        { x: 4, y: 3, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'MARKET', fixed: true },
      ],
      [
        { x: 1, y: 2, geometry: 'STRAIGHT', rotation: 0 },
        { x: 1, y: 0, geometry: 'STRAIGHT', rotation: 0 },
      ]
    )
  );

  // LEVEL 10: Büyük Kervan (5x5 Master Route)
  // Combines STRAIGHT, ELBOW, TEE, and CROSS in a comprehensive puzzle
  // (0, 0)[P] -> E -> (1, 0)[STRAIGHT rot 1] -> (2, 0)[TEE rot 0 (3,0,1)]
  // -> (3, 0)[ELBOW rot 2 W&S: [2,3]] -> S to (3, 1)[CROSS rot 0: straight goes S]
  // -> S to (3, 2)[INN, ELBOW rot 3 N&W: [3,0]] -> W to (2, 2)[CROSS rot 0: straight goes W]
  // -> W to (1, 2)[ELBOW rot 1 E&S: [1,2]] -> S to (1, 3)[ELBOW rot 0 N&E: [0,1]]
  // -> E to (2, 3)[STRAIGHT rot 1] -> (3, 3)[TEE rot 0: straight goes E]
  // -> E to (4, 3)[MARKET, STRAIGHT rot 1]
  levels.push(
    buildLevel(
      10,
      'Seviye 10: Büyük İpek Yolu',
      'Tüm geometri türlerini içeren usta kervancı rotası.',
      { x: 0, y: 0, initialExitDir: 1 },
      [
        { x: 0, y: 0, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'PRODUCER', fixed: true },
        { x: 1, y: 0, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 0, stop: 'NONE' },
        { x: 2, y: 0, geometry: 'TEE', solvedRotation: 0, scrambledRotation: 2, stop: 'NONE' },
        { x: 3, y: 0, geometry: 'ELBOW', solvedRotation: 2, scrambledRotation: 1, stop: 'NONE' },
        { x: 3, y: 1, geometry: 'CROSS', solvedRotation: 0, scrambledRotation: 0, stop: 'NONE' },
        { x: 3, y: 2, geometry: 'ELBOW', solvedRotation: 3, scrambledRotation: 1, stop: 'INN' },
        { x: 2, y: 2, geometry: 'CROSS', solvedRotation: 0, scrambledRotation: 0, stop: 'NONE' },
        { x: 1, y: 2, geometry: 'ELBOW', solvedRotation: 1, scrambledRotation: 3, stop: 'NONE' },
        { x: 1, y: 3, geometry: 'ELBOW', solvedRotation: 0, scrambledRotation: 2, stop: 'NONE' },
        { x: 2, y: 3, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 0, stop: 'NONE' },
        { x: 3, y: 3, geometry: 'TEE', solvedRotation: 0, scrambledRotation: 1, stop: 'NONE' },
        { x: 4, y: 3, geometry: 'STRAIGHT', solvedRotation: 1, scrambledRotation: 1, stop: 'MARKET', fixed: true },
      ],
      [
        { x: 4, y: 1, geometry: 'STRAIGHT', rotation: 0 },
        { x: 2, y: 1, geometry: 'ELBOW', rotation: 0 },
        { x: 0, y: 3, geometry: 'ELBOW', rotation: 1 },
      ]
    )
  );

  return levels;
}

/**
 * Generate a seeded level (Level 11+ or custom practice)
 */
export function generateSeededLevel(seed: number, id: number = 100): LevelConfig {
  const rng = createPRNG(seed);
  const grid = createEmptyGrid(5);
  const tileMap = new Map<string, TileData>();
  for (const t of grid) {
    tileMap.set(`${t.x},${t.y}`, t);
  }

  // Place stops and a guaranteed path
  const pathCoords = [
    { x: 0, y: 1, geom: 'STRAIGHT' as TileGeometry, solvedRot: 1, stop: 'PRODUCER' as StopType, fixed: true },
    { x: 1, y: 1, geom: 'ELBOW' as TileGeometry, solvedRot: 1, stop: 'NONE' as StopType },
    { x: 1, y: 2, geom: 'ELBOW' as TileGeometry, solvedRot: 0, stop: 'NONE' as StopType },
    { x: 2, y: 2, geom: 'STRAIGHT' as TileGeometry, solvedRot: 1, stop: 'INN' as StopType },
    { x: 3, y: 2, geom: 'ELBOW' as TileGeometry, solvedRot: 2, stop: 'NONE' as StopType },
    { x: 3, y: 3, geom: 'ELBOW' as TileGeometry, solvedRot: 0, stop: 'NONE' as StopType },
    { x: 4, y: 3, geom: 'STRAIGHT' as TileGeometry, solvedRot: 1, stop: 'MARKET' as StopType, fixed: true },
  ];

  for (const p of pathCoords) {
    // Randomize initial rotation unless fixed
    const scrambled = p.fixed ? p.solvedRot : Math.floor(rng() * 4);
    tileMap.set(`${p.x},${p.y}`, {
      x: p.x,
      y: p.y,
      geometry: p.geom,
      rotation: scrambled,
      stop: p.stop,
      fixed: p.fixed ?? false,
    });
  }

  // Add random filler tiles in empty slots
  const geometries: TileGeometry[] = ['STRAIGHT', 'ELBOW', 'TEE', 'CROSS'];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (!tileMap.has(`${x},${y}`) || tileMap.get(`${x},${y}`)?.geometry === 'EMPTY') {
        if (rng() > 0.4) {
          const g = geometries[Math.floor(rng() * geometries.length)];
          const r = Math.floor(rng() * 4);
          tileMap.set(`${x},${y}`, {
            x,
            y,
            geometry: g,
            rotation: r,
            stop: 'NONE',
          });
        }
      }
    }
  }

  return {
    id,
    title: `Prosedürel Çöl (Seed #${seed})`,
    description: `Tohum (Seed ${seed}) ile üretilen dinamik kervan yolu.`,
    gridSize: 5,
    seed,
    startTile: { x: 0, y: 1, initialExitDir: 1 },
    tiles: Array.from(tileMap.values()),
  };
}

/**
 * Validates a level configuration with solved rotations
 */
export function verifyLevelSolvable(level: HandcraftedLevelData) {
  // Apply solution rotations
  const solvedTiles = level.tiles.map((t) => ({
    ...t,
    rotation: level.solutionRotations[`${t.x},${t.y}`] ?? t.rotation,
  }));

  const result = simulateRoute(solvedTiles, level.gridSize, level.startTile);
  return result;
}
