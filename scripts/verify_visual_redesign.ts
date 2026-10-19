import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { ALL_SIDING_LEVELS } from '../src/core/switch/graph/SidingLevels';

const ARTIFACT_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\fe21a11f-a0ed-482d-b2aa-bcfeb02ef115\\screenshots\\redesign';
const LOCAL_DIR = path.resolve(process.cwd(), 'screenshots', 'redesign');

const VIEWPORTS = [
  { name: '540x960_native', width: 540, height: 960 },
  { name: '390x844_iphone', width: 390, height: 844 },
  { name: '360x800_android', width: 360, height: 800 },
];

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.mkdirSync(LOCAL_DIR, { recursive: true });

  const port = 5199;
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
    args: ['--no-sandbox', '--disable-gpu', '--window-size=600,1050'],
  });

  const page = await browser.newPage();

  // Test across all 3 requested resolutions
  for (const vp of VIEWPORTS) {
    console.log(`\n========================================`);
    console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`========================================`);

    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
    await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0' });

    // Navigate to Switch tab and Siding submode
    await page.click('#nav-btn-switch');
    await new Promise((r) => setTimeout(r, 400));
    await page.click('#switch-submode-siding');
    await new Promise((r) => setTimeout(r, 600));

    // For native 540x960, capture all 7 levels. For other viewports, capture key reference levels
    const levelsToCapture = vp.name.includes('native')
      ? ALL_SIDING_LEVELS.map((_, i) => i)
      : [0, 5, 6]; // 101, 104 Dual, 103-B FIFO

    for (const lvlIdx of levelsToCapture) {
      const sc = ALL_SIDING_LEVELS[lvlIdx];
      console.log(`Capturing Level index ${lvlIdx}: ID ${sc.id} [${sc.title}] on ${vp.name}...`);

      await page.evaluate((val) => {
        const sel = document.getElementById('level-select') as HTMLSelectElement;
        if (sel) {
          sel.value = val.toString();
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, lvlIdx);

      await new Promise((r) => setTimeout(r, 1000));

      const filename = `${vp.name}_lvl_${sc.id}.png`;
      const artifactPath = path.join(ARTIFACT_DIR, filename);
      const localPath = path.join(LOCAL_DIR, filename);

      const canvas = await page.$('canvas');
      if (canvas && vp.name.includes('native')) {
        await canvas.screenshot({ path: artifactPath });
      } else {
        await page.screenshot({ path: artifactPath });
      }
      fs.copyFileSync(artifactPath, localPath);

      console.log(`Saved: ${filename}`);
    }
  }

  await browser.close();
  await server.close();
  console.log('\nAll redesigned screenshots captured successfully.');
}

main().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
