import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\fe21a11f-a0ed-482d-b2aa-bcfeb02ef115\\screenshots\\minirail';
const LOCAL_DIR = path.resolve(process.cwd(), 'screenshots', 'minirail');

const SHOWCASE_LEVELS = [
  { id: 101, key: 'lvl_101_meadow', title: 'Seviye 101 — Çayır & Vadi (Tek Park Cebi)' },
  { id: 104, key: 'lvl_104_logistics_dual', title: 'Seviye 104 Dual — Lojistik Dağıtım Garı (Çift Park Cebi)' },
  { id: 1032, key: 'lvl_103b_quarry_fifo', title: 'Seviye 103-B FIFO — Maden & Kanyon (2x FIFO Yükleme)' },
];

const VIEWPORTS = [
  { name: '540x960_native', width: 540, height: 960, scale: 2 },
  { name: '390x844_iphone', width: 390, height: 844, scale: 2 },
  { name: '360x800_android', width: 360, height: 800, scale: 2 },
];

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.mkdirSync(LOCAL_DIR, { recursive: true });

  const port = 5198;
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

  for (const vp of VIEWPORTS) {
    console.log(`\n========================================`);
    console.log(`Capturing Mini Rail City on Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`========================================`);

    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.scale });

    for (const lvl of SHOWCASE_LEVELS) {
      console.log(`Rendering Level ${lvl.id} [${lvl.title}]...`);
      const targetUrl = `http://localhost:${port}/?mode=minirail&level=${lvl.id}`;
      await page.goto(targetUrl, { waitUntil: 'networkidle0' });

      // Give Phaser ample time to render board, props, tracks, and trains
      await new Promise((r) => setTimeout(r, 1400));

      const filename = `${vp.name}_${lvl.key}.png`;
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
  console.log('\nAll Mini Rail City showcase screenshots successfully captured.');
}

main().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
