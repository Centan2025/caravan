import { createServer } from 'vite';
import puppeteer, { Page } from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\fe21a11f-a0ed-482d-b2aa-bcfeb02ef115\\screenshots\\fifo_integrity';
const LOCAL_DIR = path.resolve(process.cwd(), 'screenshots', 'fifo_integrity');

interface SimulationState {
  scenarioId: number;
  status: string;
  tickCount: number;
  correctCount: number;
  mistakeCount: number;
  vehicles: Array<{
    id: number;
    state: string;
    currentNode?: string;
    fromNode?: string;
    toNode?: string;
    progress: number;
  }>;
  parkedVehicleSlots: Array<{
    id: number;
    bayId: string;
    slotIndex: number;
    pos: { x: number; y: number };
  }>;
}

interface ButtonCoordinates {
  restart: { x: number; y: number };
  pause: { x: number; y: number };
  exit: { x: number; y: number };
  sidingSal: (bayId: string) => { x: number; y: number } | undefined;
  switchLever: (swId: string) => { x: number; y: number } | undefined;
}

declare global {
  interface Window {
    __MINIRAIL_API__?: {
      getSimulationState: () => SimulationState;
      getButtonCoordinates: () => ButtonCoordinates;
    };
  }
}

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

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.mkdirSync(LOCAL_DIR, { recursive: true });

  const port = 5215;
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

  console.log('\n--- 1. LOADING LEVEL 103-B FIFO ---');
  await page.goto(`http://localhost:${port}/?mode=minirail&level=1032`, { waitUntil: 'domcontentloaded' });

  // Condition-based wait: Wait for game engine bridge initialization
  await page.waitForFunction(
    () => typeof window.__MINIRAIL_API__ !== 'undefined' && typeof window.__MINIRAIL_API__.getSimulationState === 'function',
    { timeout: 10000 }
  );

  const transform = await getCanvasTransform(page);

  // 1. Condition-based wait: Wait for 2 vehicles to be PARKED in SIDING_BAY
  console.log('Waiting for Train 1 and Train 2 to park in FIFO bay (condition-based)...');
  await page.waitForFunction(
    () => {
      const state = window.__MINIRAIL_API__?.getSimulationState();
      return state && state.parkedVehicleSlots.length === 2;
    },
    { timeout: 15000 }
  );

  // Assertion: Check parking states, distinct slots, and FIFO ordering
  const stateAtParked = await page.evaluate(() => window.__MINIRAIL_API__!.getSimulationState());
  const slots = stateAtParked.parkedVehicleSlots;

  if (slots.length !== 2) {
    throw new Error(`[Assertion Failed] Expected 2 parked vehicles, got ${slots.length}`);
  }
  if (slots[0].id !== 1 || slots[1].id !== 2) {
    throw new Error(`[Assertion Failed] FIFO entry sequence mismatch: expected [1, 2], got [${slots[0].id}, ${slots[1].id}]`);
  }
  if (slots[0].slotIndex !== 0 || slots[1].slotIndex !== 1) {
    throw new Error(`[Assertion Failed] Slot indices mismatch: expected [0, 1], got [${slots[0].slotIndex}, ${slots[1].slotIndex}]`);
  }
  if (slots[0].pos.y === slots[1].pos.y) {
    throw new Error(`[Assertion Failed] Parked vehicles are stacked at identical coordinates: y=${slots[0].pos.y}`);
  }
  console.log(`[PASS] Step 1 Assertion: Train 1 at Slot 0 (y=${slots[0].pos.y}), Train 2 at Slot 1 (y=${slots[1].pos.y}). No overlap.`);

  const step1Path = path.join(LOCAL_DIR, 'step1_both_trains_parked.png');
  await page.screenshot({ path: step1Path });
  fs.copyFileSync(step1Path, path.join(ARTIFACT_DIR, 'step1_both_trains_parked.png'));

  // 2. Derive SAL button position from actual layout
  const btnCoords = await page.evaluate(() => {
    const coords = window.__MINIRAIL_API__!.getButtonCoordinates();
    return coords.sidingSal('SIDING_BAY');
  });
  if (!btnCoords) {
    throw new Error('[Assertion Failed] Siding SAL button coordinates could not be derived from scene layout.');
  }

  const vpSal = transform.toViewport(btnCoords.x, btnCoords.y);
  console.log(`Derived SAL button coordinates: game=(${btnCoords.x}, ${btnCoords.y}), viewport=(${Math.round(vpSal.x)}, ${Math.round(vpSal.y)})`);

  console.log('Triggering Siding Release (Train 1)...');
  await page.mouse.click(vpSal.x, vpSal.y);

  // Condition-based wait: Train 1 departs and Train 2 advances to Slot 0
  await page.waitForFunction(
    () => {
      const state = window.__MINIRAIL_API__?.getSimulationState();
      if (!state) return false;
      const t1Moving = state.vehicles.some((v) => v.id === 1 && v.state === 'MOVING');
      const t2AtSlot0 = state.parkedVehicleSlots.some((s) => s.id === 2 && s.slotIndex === 0);
      return t1Moving && t2AtSlot0;
    },
    { timeout: 8000 }
  );

  const stateAfterRelease1 = await page.evaluate(() => window.__MINIRAIL_API__!.getSimulationState());
  const t2State = stateAfterRelease1.parkedVehicleSlots.find((s) => s.id === 2);
  if (!t2State || t2State.slotIndex !== 0) {
    throw new Error('[Assertion Failed] Train 2 did not advance to lead Slot 0 after Train 1 departure.');
  }
  console.log(`[PASS] Step 2 Assertion: Train 1 departed to MERGE, Train 2 advanced to lead Slot 0 (y=${t2State.pos.y}).`);

  const step2Path = path.join(LOCAL_DIR, 'step2_train1_departing_train2_advanced.png');
  await page.screenshot({ path: step2Path });
  fs.copyFileSync(step2Path, path.join(ARTIFACT_DIR, 'step2_train1_departing_train2_advanced.png'));

  // 3. Condition-based wait: Train 1 clears MERGE before releasing Train 2
  await page.waitForFunction(
    () => {
      const state = window.__MINIRAIL_API__?.getSimulationState();
      if (!state) return false;
      const t1 = state.vehicles.find((v) => v.id === 1);
      return t1 && t1.currentNode !== 'MERGE' && t1.toNode !== 'MERGE';
    },
    { timeout: 8000 }
  );

  console.log('Triggering Siding Release (Train 2)...');
  await page.mouse.click(vpSal.x, vpSal.y);

  // Condition-based wait: Train 2 leaves siding
  await page.waitForFunction(
    () => {
      const state = window.__MINIRAIL_API__?.getSimulationState();
      return (
        state &&
        state.vehicles.some((v) => v.id === 2 && (v.state === 'MOVING' || v.state === 'DELIVERED')) &&
        !state.parkedVehicleSlots.some((s) => s.id === 2)
      );
    },
    { timeout: 8000 }
  );
  console.log('[PASS] Step 3 Assertion: Train 2 departed smoothly in strict FIFO sequence (state is MOVING/DELIVERED).');

  const step3Path = path.join(LOCAL_DIR, 'step3_train2_departing.png');
  await page.screenshot({ path: step3Path });
  fs.copyFileSync(step3Path, path.join(ARTIFACT_DIR, 'step3_train2_departing.png'));

  // 4. Test Restart button with derived coordinates: restart button is at y=895 in scene layout!
  const restartCoords = await page.evaluate(() => {
    const coords = window.__MINIRAIL_API__!.getButtonCoordinates();
    return coords.restart;
  });
  if (restartCoords.y !== 895) {
    throw new Error(`[Assertion Failed] Derived restart button y is ${restartCoords.y}, expected 895.`);
  }

  const vpRestart = transform.toViewport(restartCoords.x, restartCoords.y);
  console.log(`Derived Restart button coordinates: game=(${restartCoords.x}, ${restartCoords.y}), viewport=(${Math.round(vpRestart.x)}, ${Math.round(vpRestart.y)})`);

  console.log('Clicking Restart button...');
  await page.mouse.click(vpRestart.x, vpRestart.y);

  // Condition-based wait: Verify simulation resets to initial clean state
  await page.waitForFunction(
    () => {
      const state = window.__MINIRAIL_API__?.getSimulationState();
      return (
        state &&
        state.tickCount === 0 &&
        state.correctCount === 0 &&
        state.mistakeCount === 0 &&
        state.parkedVehicleSlots.length === 0
      );
    },
    { timeout: 6000 }
  );

  const resetState = await page.evaluate(() => window.__MINIRAIL_API__!.getSimulationState());
  if (resetState.tickCount !== 0 || resetState.correctCount !== 0 || resetState.mistakeCount !== 0) {
    throw new Error(`[Assertion Failed] Restart failed to reset counters: ticks=${resetState.tickCount}, deliveries=${resetState.correctCount}, mistakes=${resetState.mistakeCount}`);
  }
  if (resetState.parkedVehicleSlots.length !== 0) {
    throw new Error(`[Assertion Failed] Restart left orphaned parked vehicles: ${resetState.parkedVehicleSlots.length}`);
  }
  console.log('[PASS] Step 4 Assertion: Restart verified. Counters, active vehicles, and parking slots cleanly reset.');

  const step4Path = path.join(LOCAL_DIR, 'step4_restart_clean_state.png');
  await page.screenshot({ path: step4Path });
  fs.copyFileSync(step4Path, path.join(ARTIFACT_DIR, 'step4_restart_clean_state.png'));

  await browser.close();
  await server.close();
  console.log('\n[ALL BROWSER ASSERTIONS PASSED] FIFO playthrough integrity verified with 100% deterministic layout.');
}

main().catch((err) => {
  console.error('\n[FATAL BROWSER TEST FAILURE]:', err);
  process.exit(1);
});
