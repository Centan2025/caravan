import {
  generateHandcraftedLevels,
  verifyLevelSolvable,
  generateSeededLevel,
} from '../src/core/LevelManager';

console.log('====================================================');
console.log('🧪 CARAVAN: 10 El Yapımı Seviye Otomatik Çözüm Testi');
console.log('====================================================\n');

const levels = generateHandcraftedLevels();
let allPassed = true;

for (const level of levels) {
  const result = verifyLevelSolvable(level);
  if (result.success && result.innVisited && result.marketReached) {
    console.log(
      `✅ Seviye ${level.id} (${level.title}): Başarılı! Adım sayısı: ${result.steps.length}, Han: OK, Pazar: OK`
    );
  } else {
    allPassed = false;
    console.error(
      `❌ Seviye ${level.id} (${level.title}): BAŞARISIZ! Durum: ${result.status}, Hata: ${result.errorMessage}`
    );
    if (result.errorStep) {
      console.error(
        `   Hata koordinatı: (${result.errorStep.x}, ${result.errorStep.y}) Giriş Yönü: ${result.errorStep.entrySide}`
      );
    }
  }
}

console.log('\n----------------------------------------------------');
console.log('🎲 Seed Tekrar Üretilebilirlik Testi:');
const seed1 = 12345;
const genA = generateSeededLevel(seed1, 101);
const genB = generateSeededLevel(seed1, 101);

const match = JSON.stringify(genA.tiles) === JSON.stringify(genB.tiles);
if (match) {
  console.log(`✅ Seed ${seed1}: İki üretim birebir eşleşti (Deterministik).`);
} else {
  allPassed = false;
  console.error(`❌ Seed ${seed1}: Üretimler uyuşmadı!`);
}

console.log('====================================================');
if (allPassed) {
  console.log('🎉 TÜM 10 SEVİYE VE SEED TESTLERİ BAŞARIYLA GEÇTİ!');
  process.exit(0);
} else {
  console.error('💥 BAZI SEVİYELER DOĞRULAMAYI GEÇEMEDİ!');
  process.exit(1);
}
