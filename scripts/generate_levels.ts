import { LevelDefinition } from '../src/core/chain/ChainTypes';
import { ChainSolver } from '../src/core/chain/ChainSolver';
import * as fs from 'fs';
import * as path from 'path';

export const LEVELS: LevelDefinition[] = [
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

async function main() {
  console.log('====================================================');
  console.log('🧪 CHAIN DOMINO: 10 Sabit Seviyenin Doğrulanması');
  console.log('====================================================\n');

  const outDir = path.resolve('levels/chain');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let allPassed = true;
  const levelsMdRows: string[] = [];

  for (const lvl of LEVELS) {
    const res = ChainSolver.solve(lvl);

    const hasMinOneGoal = res.goalsTotal >= 1;
    const hasMinTwoRelays = res.initialEligibleTaps.length >= 2;
    const isSolvable = res.solvable;
    const hasLosingOpening = lvl.id === 1 ? true : res.losingOpeningTaps.length >= 1;

    const passed = hasMinOneGoal && hasMinTwoRelays && isSolvable && hasLosingOpening;

    if (passed) {
      console.log(
        `✅ Seviye ${lvl.id} [${lvl.title}]: GEÇTİ! Hedef: ${res.goalsTotal}, Başlangıç Röleleri: ${res.initialEligibleTaps.length}, Çözüm Sayısı: ${res.totalSolutions}, Kaybeden Açılışlar: ${res.losingOpeningTaps.length}`
      );
      console.log(
        `   En iyi çözüm sırası: ${res.bestSequence.map((t) => `(${t.x},${t.y})`).join(' -> ')} (${res.bestSequence.length} hamle / max: ${lvl.maxIgnitions})`
      );

      // Save level JSON
      const jsonPath = path.join(outDir, `level_${lvl.id.toString().padStart(2, '0')}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(lvl, null, 2), 'utf-8');

      // Append to LEVELS.md
      levelsMdRows.push(`### Seviye ${lvl.id}: ${lvl.title}
- **Hak (maxIgnitions):** ${lvl.maxIgnitions}
- **Hedef Sayısı:** ${res.goalsTotal}
- **Izgara:**
\`\`\`
${lvl.grid.join('\n')}
\`\`\`
- **Çözücü Tarafından Onaylanmış Kazanan Dokunuş Sırası:** ${res.bestSequence.map((t) => `(${t.x},${t.y})`).join(' ➔ ')}
- **Kaybettiren Açılış Örneği:** ${res.losingOpeningTaps.length > 0 ? `(${res.losingOpeningTaps[0].x},${res.losingOpeningTaps[0].y})` : 'Yok (Seviye 1 Giriş)'}
- **Toplam Çözüm Yolu:** ${res.totalSolutions}
`);
    } else {
      allPassed = false;
      console.error(
        `❌ Seviye ${lvl.id} [${lvl.title}]: BAŞARISIZ! (Goal>=1: ${hasMinOneGoal}, Relays>=2: ${hasMinTwoRelays}, Solvable: ${isSolvable}, LosingOpening: ${hasLosingOpening})`
      );
    }
  }

  // Write LEVELS.md
  const levelsMdContent = `# LEVELS.md — Chain Domino Doğrulanmış Seviyeler

Bu belge GDD v1.0 gereksinimlerine göre oluşturulmuş ve \`ChainSolver\` otomatik çözücüsü tarafından tüm açılış kombinasyonları taranarak onaylanmış 10 sabit seviyeyi belgeler.

## Kabul Kriterleri Doğrulaması
1. Her seviyede en az 1 hedef (\`G\`) bulunur.
2. Her seviyede başlangıçta dokunulabilecek en az 2 uygun röle bulunur.
3. Her seviyenin orijinal tahtadan başlayan en az 1 kazanan çözümü vardır.
4. Seviye 1 hariç her seviyede ilk dokunuşta doğrudan kaybettiren en az 1 yanlış açılış dokunuşu mevcuttur.
5. Seviyeler artan karar yüküne (decision burden) göre kademeli tasarlanmıştır.

---

${levelsMdRows.join('\n---\n')}
`;

  fs.writeFileSync('LEVELS.md', levelsMdContent, 'utf-8');
  console.log('\n📄 LEVELS.md ve levels/chain/*.json oluşturuldu.');

  if (!allPassed) {
    process.exit(1);
  }
}

main();
