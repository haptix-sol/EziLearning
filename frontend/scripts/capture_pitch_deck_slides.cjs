const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const inputHtml = path.resolve(__dirname, '../public/pitch_deck.html');
const outputDir = path.resolve(__dirname, '../../backend/scripts/temp_tour_assets/slides');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function captureSlides() {
  console.log('Capturing pitch deck slides to:', outputDir);
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const url = 'file:///' + inputHtml.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  for (let i = 1; i <= 10; i++) {
    const elem = await page.$('#slide-' + i);
    if (elem) {
      const outPath = path.join(outputDir, `slide_${i}.png`);
      await elem.screenshot({ path: outPath });
      console.log(`Captured Slide ${i} -> ${outPath}`);
    } else {
      console.warn(`Element #slide-${i} not found!`);
    }
  }

  await browser.close();
  console.log('All slides captured successfully.');
}

captureSlides().catch(err => {
  console.error('Error capturing slides:', err);
  process.exit(1);
});
