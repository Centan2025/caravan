import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\fe21a11f-a0ed-482d-b2aa-bcfeb02ef115\\design';
const LOCAL_DIR = path.resolve(process.cwd(), 'design');

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  // 1. Asset Design Sheet
  console.log('Rendering Asset Design Sheet...');
  const assetSheetUrl = 'file:///' + path.resolve(LOCAL_DIR, 'assets', 'asset_sheet.html').replace(/\\/g, '/');
  await page.setViewport({ width: 1280, height: 1100, deviceScaleFactor: 2 });
  await page.goto(assetSheetUrl, { waitUntil: 'networkidle0' });
  const sheetElement = await page.$('.sheet-container');
  if (sheetElement) {
    const localAssetPath = path.resolve(LOCAL_DIR, 'assets', 'asset_design_sheet.png');
    const artifactAssetPath = path.resolve(ARTIFACT_DIR, 'asset_design_sheet.png');
    await sheetElement.screenshot({ path: localAssetPath });
    fs.copyFileSync(localAssetPath, artifactAssetPath);
    console.log(`[Generated] ${localAssetPath}`);
  }

  // 2. Concept A Screen (390x844 mobile frame)
  console.log('Rendering Concept A Mobile Screen...');
  const conceptAUrl = 'file:///' + path.resolve(LOCAL_DIR, 'concepts', 'concept_a_screen.html').replace(/\\/g, '/');
  await page.setViewport({ width: 440, height: 900, deviceScaleFactor: 2 });
  await page.goto(conceptAUrl, { waitUntil: 'networkidle0' });
  const frameA = await page.$('.mobile-frame');
  if (frameA) {
    const localAPath = path.resolve(LOCAL_DIR, 'concepts', 'concept_a_compact_board_390x844.png');
    const artifactAPath = path.resolve(ARTIFACT_DIR, 'concept_a_compact_board_390x844.png');
    await frameA.screenshot({ path: localAPath });
    fs.copyFileSync(localAPath, artifactAPath);
    console.log(`[Generated] ${localAPath}`);
  }

  // 3. Concept B Screen (390x844 mobile frame)
  console.log('Rendering Concept B Mobile Screen...');
  const conceptBUrl = 'file:///' + path.resolve(LOCAL_DIR, 'concepts', 'concept_b_screen.html').replace(/\\/g, '/');
  await page.setViewport({ width: 440, height: 900, deviceScaleFactor: 2 });
  await page.goto(conceptBUrl, { waitUntil: 'networkidle0' });
  const frameB = await page.$('.mobile-frame');
  if (frameB) {
    const localBPath = path.resolve(LOCAL_DIR, 'concepts', 'concept_b_diagonal_yard_390x844.png');
    const artifactBPath = path.resolve(ARTIFACT_DIR, 'concept_b_diagonal_yard_390x844.png');
    await frameB.screenshot({ path: localBPath });
    fs.copyFileSync(localBPath, artifactBPath);
    console.log(`[Generated] ${localBPath}`);
  }

  // 4. Topology Mapping Diagram
  console.log('Rendering Topology Mapping Diagram...');
  const topoUrl = 'file:///' + path.resolve(LOCAL_DIR, 'diagrams', 'topology_mapping.html').replace(/\\/g, '/');
  await page.setViewport({ width: 1280, height: 1050, deviceScaleFactor: 2 });
  await page.goto(topoUrl, { waitUntil: 'networkidle0' });
  const topoElement = await page.$('.container');
  if (topoElement) {
    const localTopoPath = path.resolve(LOCAL_DIR, 'diagrams', 'topology_mapping_diagram.png');
    const artifactTopoPath = path.resolve(ARTIFACT_DIR, 'topology_mapping_diagram.png');
    await topoElement.screenshot({ path: localTopoPath });
    fs.copyFileSync(localTopoPath, artifactTopoPath);
    console.log(`[Generated] ${localTopoPath}`);
  }

  await browser.close();
  console.log('\n[SUCCESS] All design concept PNGs and diagrams successfully rendered.');
}

main().catch((err) => {
  console.error('[FAILED]:', err);
  process.exit(1);
});
