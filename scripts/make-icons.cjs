// Renders the app icons in public/ from public/icon.svg and public/icon-maskable.svg.
// Needs Playwright with Chromium (not a project dependency):  node scripts/make-icons.cjs
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { chromium } = require('playwright');

const dir = join(__dirname, '..', 'public');
const icons = [
  // [source, output, size]: "any" icons keep the rounded tile; maskable and Apple icons are full bleed.
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  ['icon-maskable.svg', 'apple-touch-icon.png', 180],
];

(async () => {
  const browser = await chromium.launch();
  for (const [source, output, size] of icons) {
    const svg = readFileSync(join(dir, source), 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `);
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
    await page.screenshot({ path: join(dir, output), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log(`${output}: ${size}×${size}`);
  }
  await browser.close();
})();
