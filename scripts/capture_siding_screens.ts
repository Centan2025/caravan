import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { ALL_SIDING_LEVELS } from '../src/core/switch/graph/SidingLevels';

const ARTIFACT_SCREENSHOT_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\fe21a11f-a0ed-482d-b2aa-bcfeb02ef115\\screenshots';
const LOCAL_SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');

async function main() {
  fs.mkdirSync(ARTIFACT_SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(LOCAL_SCREENSHOT_DIR, { recursive: true });

  const port = 5188;
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
    args: ['--no-sandbox', '--disable-gpu', '--window-size=580,1050'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });

  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0' });
  console.log('Page loaded');

  // Switch to Switch Rush tab and Siding submode
  await page.click('#nav-btn-switch');
  await new Promise((r) => setTimeout(r, 600));

  await page.click('#switch-submode-siding');
  await new Promise((r) => setTimeout(r, 800));

  // Capture all 7 levels
  for (let i = 0; i < ALL_SIDING_LEVELS.length; i++) {
    const sc = ALL_SIDING_LEVELS[i];
    console.log(`Capturing Level index ${i}: ID ${sc.id} - ${sc.title}...`);

    await page.evaluate((val) => {
      const sel = document.getElementById('level-select') as HTMLSelectElement;
      if (sel) {
        sel.value = val.toString();
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, i);

    // Give Phaser time to tick & draw
    await new Promise((r) => setTimeout(r, 1200));

    const filename = `level_${sc.id}_index_${i}.png`;
    const artifactPath = path.join(ARTIFACT_SCREENSHOT_DIR, filename);
    const localPath = path.join(LOCAL_SCREENSHOT_DIR, filename);

    // Capture canvas
    const canvas = await page.$('canvas');
    if (canvas) {
      await canvas.screenshot({ path: artifactPath });
      fs.copyFileSync(artifactPath, localPath);
    } else {
      await page.screenshot({ path: artifactPath });
      fs.copyFileSync(artifactPath, localPath);
    }

    console.log(`Saved screenshot: ${filename}`);
  }

  // Also capture full mobile page frame showing header, HUD, canvas, and bottom buttons
  const fullPageFilename = 'mobile_full_frame_level_104_dual.png';
  const fullArtifactPath = path.join(ARTIFACT_SCREENSHOT_DIR, fullPageFilename);
  const fullLocalPath = path.join(LOCAL_SCREENSHOT_DIR, fullPageFilename);
  await page.screenshot({ path: fullArtifactPath });
  fs.copyFileSync(fullArtifactPath, fullLocalPath);
  console.log(`Saved full frame screenshot: ${fullPageFilename}`);

  await browser.close();
  await server.close();
  console.log('Capture finished successfully.');
}

main().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
