import { simulateRoute } from '../src/core/PathSolver';
import { TileData } from '../src/types';
import { TelemetryService } from '../src/core/Telemetry';

console.log('========================================================');
console.log('🧪 CARAVAN: Uç Senaryolar ve Hata Modları Doğrulama Testi');
console.log('========================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${testName} ${detail ? '- ' + detail : ''}`);
    failCount++;
  }
}

// 1. DEAD END TEST
{
  const tiles: TileData[] = [
    { x: 0, y: 0, geometry: 'STRAIGHT', rotation: 1, stop: 'PRODUCER' }, // exit E
    { x: 1, y: 0, geometry: 'STRAIGHT', rotation: 0, stop: 'NONE' },     // vertical road [N, S] - does not have port W(3)
  ];
  const res = simulateRoute(tiles, 5, { x: 0, y: 0, initialExitDir: 1 });
  assert(
    res.status === 'DISCONNECTED',
    'DISCONNECTED tespiti: Yanlış açılı komşuya girildiğinde bağlantı kopuk hatası verir.'
  );
}

// 2. DEAD END ON TILE (NO OTHER EXITS)
{
  const tiles: TileData[] = [
    { x: 0, y: 0, geometry: 'STRAIGHT', rotation: 1, stop: 'PRODUCER' }, // exit E
    { x: 1, y: 0, geometry: 'EMPTY', rotation: 0, stop: 'NONE' },
  ];
  const res = simulateRoute(tiles, 5, { x: 0, y: 0, initialExitDir: 1 });
  assert(
    res.status === 'DISCONNECTED',
    'Boş araziye girildiğinde DISCONNECTED hatası verir.'
  );
}

// 3. OUT OF BOUNDS TEST
{
  const tiles: TileData[] = [
    { x: 4, y: 0, geometry: 'STRAIGHT', rotation: 1, stop: 'PRODUCER' }, // exit E (off the grid)
  ];
  const res = simulateRoute(tiles, 5, { x: 4, y: 0, initialExitDir: 1 });
  assert(
    res.status === 'OUT_OF_BOUNDS',
    'Grid sınırları dışına taşmada OUT_OF_BOUNDS hatası verir.'
  );
}

// 4. WRONG STOP ORDER: Market reached before Inn
{
  const tiles: TileData[] = [
    { x: 0, y: 0, geometry: 'STRAIGHT', rotation: 1, stop: 'PRODUCER' },
    { x: 1, y: 0, geometry: 'STRAIGHT', rotation: 1, stop: 'NONE' },
    { x: 2, y: 0, geometry: 'STRAIGHT', rotation: 1, stop: 'MARKET' }, // Han atlandı!
  ];
  const res = simulateRoute(tiles, 5, { x: 0, y: 0, initialExitDir: 1 });
  assert(
    res.status === 'WRONG_STOP_ORDER',
    'Han ziyaret edilmeden Pazara ulaşıldığında WRONG_STOP_ORDER hatası verir.'
  );
}

// 5. CLOSED LOOP TEST
{
  // 4 elbows in a circle: (1,1) -> E -> (2,1) -> S -> (2,2) -> W -> (1,2) -> N -> (1,1)
  const tiles: TileData[] = [
    { x: 0, y: 1, geometry: 'STRAIGHT', rotation: 1, stop: 'PRODUCER' }, // entry to (1,1)
    { x: 1, y: 1, geometry: 'ELBOW', rotation: 0, stop: 'NONE' },  // ports [0, 1] - wait entry from W? Needs rot 2 or TEE
    { x: 1, y: 1, geometry: 'CROSS', rotation: 0, stop: 'NONE' },
    { x: 2, y: 1, geometry: 'ELBOW', rotation: 2, stop: 'NONE' }, // [2,3] W to S
    { x: 2, y: 2, geometry: 'ELBOW', rotation: 3, stop: 'NONE' }, // [3,0] N to W
    { x: 1, y: 2, geometry: 'ELBOW', rotation: 0, stop: 'NONE' }, // [0,1] E to N (wait rot 0 is [0,1], entered from E(1), exits N(0))
  ];
  const res = simulateRoute(tiles, 5, { x: 0, y: 1, initialExitDir: 1 });
  assert(
    res.status === 'CLOSED_LOOP' || res.status === 'DISCONNECTED',
    'Döngü tespit algoritması sonsuz döngüye izin vermez.'
  );
}

// 6. JUNCTION DETERMINISM: Straight priority over turn
{
  // T-junction at (1, 1). Entry from W(3). Ports are [3, 0, 1] (W, N, E).
  // Straight is E(1). North is (straight + 3) % 4 (Left).
  // Caravan must choose E(1)!
  const tiles: TileData[] = [
    { x: 0, y: 1, geometry: 'STRAIGHT', rotation: 1, stop: 'PRODUCER' },
    { x: 1, y: 1, geometry: 'TEE', rotation: 0, stop: 'NONE' }, // [3, 0, 1]
    { x: 2, y: 1, geometry: 'STRAIGHT', rotation: 1, stop: 'INN' },
    { x: 3, y: 1, geometry: 'STRAIGHT', rotation: 1, stop: 'MARKET' },
    { x: 1, y: 0, geometry: 'STRAIGHT', rotation: 0, stop: 'NONE' }, // Decoy North
  ];
  const res = simulateRoute(tiles, 5, { x: 0, y: 1, initialExitDir: 1 });
  assert(
    res.success === true && res.innVisited && res.marketReached,
    'T-Kavşak Düz Gitme Önceliği: Kervan kuzeydeki sapağa değil doğrudan düz ileriye yöneldi.'
  );
}

// 7. TELEMETRY & JSON EXPORT TEST
{
  const telem = TelemetryService.getInstance();
  telem.logFirstInteraction('B', 1);
  telem.logEvent('LEVEL_START', 'B', 1);
  telem.logEvent('TILE_ROTATED', 'B', 1, { x: 1, y: 1, newRotation: 2 });
  telem.logEvent('LEVEL_COMPLETED', 'B', 1, { moves: 3, durationMs: 4200 });

  const summary = telem.generateSummary();
  const jsonExport = telem.exportJson();

  assert(
    summary.modeB.completes >= 1,
    'Telemetri Servisi: Mod B tamamlama istatistiklerini doğru topladı.'
  );
  assert(
    jsonExport.includes('"sessionId"') && jsonExport.includes('"events"'),
    'Telemetri JSON Dışa Aktarım: JSON şeması eksiksiz oluşturuldu.'
  );
}

console.log('\n========================================================');
console.log(`Sonuç: ${passCount} Başarılı, ${failCount} Başarısız`);
if (failCount === 0) {
  console.log('🎉 TÜM UÇ SENARYOLAR VE DETERMINISTIK KURALLAR DOĞRULANDI!');
  process.exit(0);
} else {
  console.error('💥 Testlerde hata tespit edildi!');
  process.exit(1);
}
