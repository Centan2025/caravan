import { LevelDefinition } from './ChainTypes';

export const CHAIN_LEVELS: LevelDefinition[] = [
  // LEVEL 1: Introductory straight column
  {
    id: 1,
    title: 'Seviye 1: İlk Kıvılcım',
    grid: [
      '....G',
      '....U',
      '....U',
      '....U',
      '....U',
    ],
    maxIgnitions: 1,
    hint: 'En alttaki oku ateşleyerek zinciri yukarıya doğru başlatın.',
  },

  // LEVEL 2: Simple Turn (R -> D -> G) with decoy
  {
    id: 2,
    title: 'Seviye 2: Köşeyi Dönmek',
    grid: [
      'RRRD.',
      '...D.',
      '...D.',
      '...G.',
      'L....',
    ],
    maxIgnitions: 1,
    hint: 'Hedefe doğru dönen oku bulun.',
  },

  // LEVEL 3: Split Relay H (Dual emission left & right)
  {
    id: 3,
    title: 'Seviye 3: İkili Dalga (H)',
    grid: [
      'D....',
      '#....',
      'GLHRG',
      '.....',
      '.....',
    ],
    maxIgnitions: 1,
    hint: 'H karosu yatayda her iki yana birden darbe yayar.',
  },

  // LEVEL 4: Split Relay V (Up & Down with turns)
  {
    id: 4,
    title: 'Seviye 4: Dikey Çatal (V)',
    grid: [
      '..G..',
      '..U..',
      '..V.R',
      '..D..',
      '..G..',
    ],
    maxIgnitions: 1,
    hint: 'V karosu dikeyde iki yöne birden yayılır.',
  },

  // LEVEL 5: Branching Corners
  {
    id: 5,
    title: 'Seviye 5: Çift Kanat',
    grid: [
      'G...G',
      'U...U',
      'ULHRU',
      '.....',
      '...D.',
    ],
    maxIgnitions: 1,
    hint: 'Merkezdeki bölücü iki kanadı birden yukarı yönlendirir.',
  },

  // LEVEL 6: Dual Ignition Required (maxIgnitions = 2)
  {
    id: 6,
    title: 'Seviye 6: İki Ayrı Hat',
    grid: [
      'RD#..',
      '.D#..',
      '.G#G.',
      '..#U.',
      'D.#UL',
    ],
    maxIgnitions: 2,
    hint: 'Duvarla ayrılmış iki farklı hedef için iki ateşleme hakkınızı kullanın.',
  },

  // LEVEL 7: Two Isolated Chambers (maxIgnitions = 2)
  {
    id: 7,
    title: 'Seviye 7: Çifte Kemer',
    grid: [
      'DL#D.',
      'GU#..',
      '#####',
      '..#DG',
      '..#RU',
    ],
    maxIgnitions: 2,
    hint: 'Duvarla ayrılmış iki farklı kıvrımlı hattı sırayla ateşleyin.',
  },

  // LEVEL 8: H Split Relay + Long Line (maxIgnitions = 2)
  {
    id: 8,
    title: 'Seviye 8: İkili Dalga ve Hat',
    grid: [
      'D....',
      '#....',
      'GLHRG',
      '#####',
      'RRRRG',
    ],
    maxIgnitions: 2,
    hint: 'H bölücüsü ile iki hedefi, alttaki hat ile üçüncü hedefi toplayın.',
  },

  // LEVEL 9: Triple Chamber (maxIgnitions = 3)
  {
    id: 9,
    title: 'Seviye 9: Üçlü Oda',
    grid: [
      'D.#.D',
      'G.#.G',
      '#####',
      '..D.L',
      '..G.#',
    ],
    maxIgnitions: 3,
    hint: 'Üç ayrı bağımsız bölgedeki hedefleri sırayla vurun.',
  },

  // LEVEL 10: Grand Master Network (maxIgnitions = 3, 4 Goals)
  {
    id: 10,
    title: 'Seviye 10: Dörtlü Hasat',
    grid: [
      '....D',
      '....G',
      'GLHRG',
      '##.##',
      'RRRG.',
    ],
    maxIgnitions: 3,
    hint: 'Dört altını da toplamak için en verimli 3 ateşlemeyi planlayın.',
  },
];
