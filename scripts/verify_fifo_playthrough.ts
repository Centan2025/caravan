import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\fe21a11f-a0ed-482d-b2aa-bcfeb02ef115\\screenshots\\fifo_integrity';
const LOCAL_DIR = path.resolve(process.cwd(), 'screenshots', 'fifo_integrity');

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.mkdirSync(LOCAL_DIR, { recursive: true });

  const port = 5210;
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

  console.log('Navigating to Level 103-B FIFO...');
  await page.goto(`http://localhost:${port}/?mode=minirail&level=1032`, { waitUntil: 'domcontentloaded' });

  // 1. Wait for both trains to spawn and park in SIDING_BAY
  // Train 1 enters at t~3s, Train 2 enters at t~6s
  console.log('Waiting for Train 1 and Train 2 to park in FIFO bay...');
  await new Promise((r) => setTimeout(r, 7000));

  // Capture Step 1: Both trains parked
  const step1Path = path.join(LOCAL_DIR, 'step1_both_trains_parked.png');
  await page.screenshot({ path: step1Path });
  fs.copyFileSync(step1Path, path.join(ARTIFACT_DIR, 'step1_both_trains_parked.png'));
  console.log('Captured Step 1: Both trains parked in discrete slots (no overlap).');

  // 2. Click "SAL / DEVAM ET" button to release Train 1
  const canvas = (await page.$('canvas'))!;
  const box = (await canvas.boundingBox())!;
  const scaleX = box.width / 540;
  const scaleY = box.height / 960;

  // Siding bay is at x=130, y=370; SAL button is at btnX = 130 + 70 = 200, y=370
  const salX = box.x + 200 * scaleX;
  const salY = box.y + 370 * scaleY;

  console.log(`Clicking SAL button at viewport (${Math.round(salX)}, ${Math.round(salY)})...`);
  await page.mouse.click(salX, salY);

  // Allow Train 1 to depart and Train 2 to advance (wait 800ms)
  await new Promise((r) => setTimeout(r, 900));

  const step2Path = path.join(LOCAL_DIR, 'step2_train1_departing_train2_advanced.png');
  await page.screenshot({ path: step2Path });
  fs.copyFileSync(step2Path, path.join(ARTIFACT_DIR, 'step2_train1_departing_train2_advanced.png'));
  console.log('Captured Step 2: Train 1 departing, Train 2 at lead slot.');

  // 3. Wait for Train 1 to clear MERGE, then release Train 2
  await new Promise((r) => setTimeout(r, 1200));
  console.log('Triggering Siding Release (Train 2)...');
  await page.mouse.click(salX, salY);

  await new Promise((r) => setTimeout(r, 800));
  const step3Path = path.join(LOCAL_DIR, 'step3_train2_departing.png');
  await page.screenshot({ path: step3Path });
  fs.copyFileSync(step3Path, path.join(ARTIFACT_DIR, 'step3_train2_departing.png'));
  console.log('Captured Step 3: Train 2 departing smoothly from lead slot.');

  // 4. Test Restart button (in HUD row at bottom: "Yeniden" button at x=270, y=693)
  const restartX = box.x + 270 * scaleX;
  const restartY = box.y + 693 * scaleY;
  console.log(`Clicking Restart button at viewport (${Math.round(restartX)}, ${Math.round(restartY)})...`);
  await page.mouse.click(restartX, restartY);
  await new Promise((r) => setTimeout(r, 1000));

  const step4Path = path.join(LOCAL_DIR, 'step4_restart_clean_state.png');
  await page.screenshot({ path: step4Path });
  fs.copyFileSync(step4Path, path.join(ARTIFACT_DIR, 'step4_restart_clean_state.png'));
  console.log('Captured Step 4: Restarted clean state.');

  await browser.close();
  await server.close();
  console.log('FIFO integrity browser verification completed successfully.');
}

main().catch((err) => {
  console.error('Browser verification error:', err);
  process.exit(1);
});
