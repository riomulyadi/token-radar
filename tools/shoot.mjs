// Shoot the three screenshots the bounty asks for: the board, a protocol's detail view and a
// filtered view. The page is static and holds no network reference, so it is loaded from the built
// output with the file: scheme and rendered with Playwright.
//
//   node tools/shoot.mjs [outDir] [pageUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = process.argv[2] || 'screenshots';
const PAGE = process.argv[3]
  || pathToFileURL(resolve('out/dashboard/index.html')).href;

mkdirSync(OUT, { recursive: true });

// The gate: long side at most 1440, short side at least 800, and the rules ask for 300-350 KB.
const WIDTH = 1400;
const HEIGHT = 900;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto(PAGE, { waitUntil: 'load' });
await page.waitForSelector('tbody tr', { timeout: 30000 });

// 1. The board, as it lands.
await page.screenshot({ path: join(OUT, '1-board.png'), type: 'png' });
console.log('shot 1-board.png');

// 2. A protocol's detail view: open the top row and let the panel settle.
await page.click('tbody tr:first-child');
await page.waitForSelector('.detail.open', { timeout: 10000 });
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, '2-detail.png'), type: 'png' });
console.log('shot 2-detail.png');

// 3. A filtered view: the share-quality filter and a search term, so the shot shows the
//    filtering working and the median-share rows the model fell back on.
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.click('.chip[data-token="median"]');
await page.waitForTimeout(200);
await page.selectOption('#cat', { index: 1 });
await page.waitForTimeout(400);
const shown = await page.locator('tbody tr').count();
const note = await page.locator('.count').textContent();
await page.screenshot({ path: join(OUT, '3-filtered.png'), type: 'png' });
console.log(`shot 3-filtered.png (${shown} rows, count reads "${note.trim()}")`);

if (errors.length > 0) {
  console.log('PAGE ERRORS:');
  for (const e of errors) console.log('  ' + e);
  process.exitCode = 1;
} else {
  console.log('no page errors');
}

await browser.close();
