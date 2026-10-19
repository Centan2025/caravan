import { createServer } from 'vite';
import puppeteer, { Page } from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\fe21a11f-a0ed-482d-b2aa-bcfeb02ef115\\screenshots\\showcase';
const LOCAL_DIR = path.resolve(process.cwd(), 'screenshots', 'showcase');

async function getCanvasTransform(page: Page) {
  const canvas = await page.$('canvas');
  if (!canvas) throw new Error('[Assertion Failed] Canvas element not found in DOM.');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('[Assertion Failed] Canvas bounding box is null.');
  const scaleX = box.width / 540;
  const scaleY = box.height / 960;
  return {
    box,
    toViewport: (gameX: number, gameY: number) => ({
      x: box.x + gameX * scaleX,
      y: box.y + gameY * scaleY,
    }),
  };
}

async function captureStep(page: Page, filename: string, desc: string) {
  const localFile = path.join(LOCAL_DIR, filename);
  const artifactFile = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: localFile });
  fs.copyFileSync(localFile, artifactFile);
  console.log(`[Captured] ${filename} — ${desc}`);
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.mkdirSync(LOCAL_DIR, { recursive: true });

  const port = 5250;
  const server = await createServer({
    server: { port },
    logLevel: 'error',
  });
  await server.listen();
  console.log(`Vite server running on http://localhost:${port}`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=540,960'],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(25000);
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });

  // =========================================================================
  // SCENE 1: LEVEL 101 MEADOW & VALLEY (Tek Park Cebi)
  // =========================================================================
  console.log('\n========================================');
  console.log('RECORDING SCENE 1: Level 101 Meadow & Valley');
  console.log('========================================');
  await page.goto(`http://localhost:${port}/?mode=minirail&level=101`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof (window as any).__MINIRAIL_API__ !== 'undefined', { timeout: 10000 });

  let transform = await getCanvasTransform(page);

  // Frame 1: Initial Start & Spawn
  await page.waitForFunction(() => (window as any).__MINIRAIL_API__.getSimulationState().vehicles.length > 0, { timeout: 6000 });
  await captureStep(page, 'lvl_101_01_start_spawn.png', 'Başlangıç: Tren kargo hangarından hareket ediyor');

  // Frame 2: Switch Stand Toggle (İstasyon Makası Değişimi & Geri Alma)
  const swCoords101 = await page.evaluate(() => (window as any).__MINIRAIL_API__.getButtonCoordinates().switchLever('SW_STATION'));
  if (swCoords101) {
    const vpSw = transform.toViewport(swCoords101.x, swCoords101.y);
    await page.mouse.click(vpSw.x, vpSw.y);
    console.log(`Toggled SW_STATION to BLUE at (${Math.round(vpSw.x)}, ${Math.round(vpSw.y)})`);
  }
  await new Promise((r) => setTimeout(r, 400));
  await captureStep(page, 'lvl_101_02_switch_toggled.png', 'Makas Değişimi: İstasyon makası ve kurbağa ray göstergesi');
  if (swCoords101) {
    const vpSw = transform.toViewport(swCoords101.x, swCoords101.y);
    await page.mouse.click(vpSw.x, vpSw.y);
    console.log(`Toggled SW_STATION back to RED`);
  }

  // Frame 3: Train Enters Siding & Parks
  await page.waitForFunction(() => (window as any).__MINIRAIL_API__.getSimulationState().parkedVehicleSlots.length > 0, { timeout: 8000 });
  await captureStep(page, 'lvl_101_03_train_parked.png', 'Park: Tren tekli park cebine park etti (SAL aktif)');

  // Frame 4: Siding SAL Release Triggered
  const salCoords101 = await page.evaluate(() => (window as any).__MINIRAIL_API__.getButtonCoordinates().sidingSal('SIDING_BAY'));
  if (salCoords101) {
    const vpSal = transform.toViewport(salCoords101.x, salCoords101.y);
    await page.mouse.click(vpSal.x, vpSal.y);
  }
  await new Promise((r) => setTimeout(r, 700));
  await captureStep(page, 'lvl_101_04_siding_departing.png', 'SAL Çıkışı: Tren park cebinden birleşme noktasına ilerliyor');

  // Frame 5: Delivery Completed
  await page.waitForFunction(() => (window as any).__MINIRAIL_API__.getSimulationState().correctCount >= 1, { timeout: 8000 });
  await captureStep(page, 'lvl_101_05_delivered_success.png', 'Teslimat: Hedef gara ulaşıldı ve görev tamamlandı');

  // =========================================================================
  // SCENE 2: LEVEL 104 DUAL SIDING LOGISTICS (Çift Park Cebi)
  // =========================================================================
  console.log('\n========================================');
  console.log('RECORDING SCENE 2: Level 104 Logistics Dual Siding');
  console.log('========================================');
  await page.goto(`http://localhost:${port}/?mode=minirail&level=104`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof (window as any).__MINIRAIL_API__ !== 'undefined', { timeout: 10000 });
  transform = await getCanvasTransform(page);

  // Frame 1: Start
  await page.waitForFunction(() => (window as any).__MINIRAIL_API__.getSimulationState().vehicles.length > 0, { timeout: 6000 });
  await captureStep(page, 'lvl_104_01_start.png', 'Başlangıç: Lojistik dağıtım garında ilk tren harekette');

  // Frame 2: Switch Stand Toggles (SW_SIDING_B to MAIN, SW_STATION to BLUE)
  const swBCoords = await page.evaluate(() => (window as any).__MINIRAIL_API__.getButtonCoordinates().switchLever('SW_SIDING_B'));
  if (swBCoords) {
    const vpSwB = transform.toViewport(swBCoords.x, swBCoords.y);
    await page.mouse.click(vpSwB.x, vpSwB.y);
    console.log(`Toggled SW_SIDING_B to MAIN`);
  }

  const swStation104 = await page.evaluate(() => (window as any).__MINIRAIL_API__.getButtonCoordinates().switchLever('SW_STATION'));
  if (swStation104) {
    const vpSwSt = transform.toViewport(swStation104.x, swStation104.y);
    await page.mouse.click(vpSwSt.x, vpSwSt.y);
    console.log(`Toggled SW_STATION to BLUE at (${Math.round(vpSwSt.x)}, ${Math.round(vpSwSt.y)})`);
  }
  await captureStep(page, 'lvl_104_02_switches_routed.png', 'Makas Ayarları: Peron B baypas ve İstasyon makasları ayarlandı');

  // Frame 3: Parking in Siding A
  await page.waitForFunction(() => (window as any).__MINIRAIL_API__.getSimulationState().parkedVehicleSlots.some((s: any) => s.bayId === 'SIDING_A'), { timeout: 10000 });
  await captureStep(page, 'lvl_104_03_pocket_parked.png', 'Park: İlk tren Peron A park cebine park etti');

  // Frame 4: Releasing Siding A
  const salACoords = await page.evaluate(() => (window as any).__MINIRAIL_API__.getButtonCoordinates().sidingSal('SIDING_A'));
  if (salACoords) {
    const vpSalA = transform.toViewport(salACoords.x, salACoords.y);
    await page.mouse.click(vpSalA.x, vpSalA.y);
  }
  await page.waitForFunction(() => !(window as any).__MINIRAIL_API__.getSimulationState().parkedVehicleSlots.some((s: any) => s.bayId === 'SIDING_A'), { timeout: 8000 });
  await captureStep(page, 'lvl_104_04_pocket_departing.png', 'SAL Çıkışı: Peron A serbest bırakıldı, tren ana hatta dönüyor');

  // Frame 5: Delivery
  await page.waitForFunction(
    () => {
      const s = (window as any).__MINIRAIL_API__.getSimulationState();
      return s.correctCount >= 1;
    },
    { timeout: 15000 }
  );
  await captureStep(page, 'lvl_104_05_delivered_stations.png', 'Teslimat: Mavi antrepoya teslimat başarıyla tamamlandı');

  // =========================================================================
  // SCENE 3: LEVEL 103-B FIFO QUARRY CANYON (2x FIFO Yükleme)
  // =========================================================================
  console.log('\n========================================');
  console.log('RECORDING SCENE 3: Level 103-B FIFO Quarry Canyon');
  console.log('========================================');
  await page.goto(`http://localhost:${port}/?mode=minirail&level=1032`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof (window as any).__MINIRAIL_API__ !== 'undefined', { timeout: 10000 });
  transform = await getCanvasTransform(page);

  // Frame 1: Start & Both Trains Parked
  await page.waitForFunction(() => (window as any).__MINIRAIL_API__.getSimulationState().parkedVehicleSlots.length === 2, { timeout: 15000 });
  await captureStep(page, 'lvl_103b_01_both_trains_parked.png', 'FIFO Park: İki maden vagonu ayrı slotlarda park halinde (üst üste binme yok)');

  // Frame 2: Release Train 1 & Train 2 Advance
  const salFIFO = await page.evaluate(() => (window as any).__MINIRAIL_API__.getButtonCoordinates().sidingSal('SIDING_BAY'));
  if (salFIFO) {
    const vpSalF = transform.toViewport(salFIFO.x, salFIFO.y);
    await page.mouse.click(vpSalF.x, vpSalF.y);
  }
  await page.waitForFunction(
    () => {
      const s = (window as any).__MINIRAIL_API__.getSimulationState();
      return s.vehicles.some((v: any) => v.id === 1 && v.state === 'MOVING') && s.parkedVehicleSlots.some((slot: any) => slot.id === 2 && slot.slotIndex === 0);
    },
    { timeout: 8000 }
  );
  await captureStep(page, 'lvl_103b_02_train1_exit_train2_lead.png', 'FIFO Ayrılma: Tren 1 çıkışta, Tren 2 pürüzsüzce lider slota kaydı');

  // Frame 3: Release Train 2
  await page.waitForFunction(
    () => {
      const s = (window as any).__MINIRAIL_API__.getSimulationState();
      const t1 = s.vehicles.find((v: any) => v.id === 1);
      return t1 && t1.currentNode !== 'MERGE' && t1.toNode !== 'MERGE';
    },
    { timeout: 10000 }
  );
  if (salFIFO) {
    const vpSalF = transform.toViewport(salFIFO.x, salFIFO.y);
    await page.mouse.click(vpSalF.x, vpSalF.y);
  }
  await new Promise((r) => setTimeout(r, 600));
  await captureStep(page, 'lvl_103b_03_train2_exit.png', 'FIFO İkinci Çıkış: Tren 2 sıçrama olmadan lider slottan ayrıldı');

  // Frame 4: Deliveries Completed
  await page.waitForFunction(() => (window as any).__MINIRAIL_API__.getSimulationState().correctCount >= 1 || (window as any).__MINIRAIL_API__.getSimulationState().vehicles.some((v: any) => v.state === 'DELIVERED'), { timeout: 20000 });
  await captureStep(page, 'lvl_103b_04_deliveries_complete.png', 'FIFO Tamamlandı: Vagonlar başarıyla teslim edildi');

  await browser.close();
  await server.close();
  console.log('\n[SUCCESS] Real gameplay showcase recordings generated across all 3 dioramas.');
}

main().catch((err) => {
  console.error('\n[FATAL SHOWCASE GENERATION FAILURE]:', err);
  process.exit(1);
});
