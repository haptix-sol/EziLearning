const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve(__dirname, '../public/images/snapshots');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

async function run() {
  console.log('Launching browser with edgePath:', edgePath);
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  console.log('1. Navigating to /showcase...');
  await page.goto('http://localhost:5173/showcase', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: path.join(outputDir, 'showcase_hero.png'), fullPage: false });
  console.log('Saved showcase_hero.png');

  // Video section screenshot (seek video to 1:58 so it shows the active lesson frame)
  await page.evaluate(async () => {
    const video = document.querySelector('#video-lessons video');
    if (video) {
      video.currentTime = 118; // 1:58
      await new Promise(r => video.onseeked = r);
    }
  });
  await new Promise(r => setTimeout(r, 800));

  const videoElem = await page.$('#video-lessons');
  if (videoElem) {
    await videoElem.screenshot({ path: path.join(outputDir, 'video_lessons.png') });
    console.log('Saved video_lessons.png (frame at 1:58)');
  }

  // WhatsApp section screenshot
  const waElem = await page.$('#whatsapp-mentor');
  if (waElem) {
    await waElem.screenshot({ path: path.join(outputDir, 'whatsapp_mentor.png') });
    console.log('Saved whatsapp_mentor.png');
  }

  // Coding arena screenshot
  const codingElem = await page.$('#coding-arena');
  if (codingElem) {
    await codingElem.screenshot({ path: path.join(outputDir, 'coding_arena.png') });
    console.log('Saved coding_arena.png');
  }

  // Dashboard page
  console.log('2. Navigating to / ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(outputDir, 'dashboard_overview.png'), fullPage: false });
  console.log('Saved dashboard_overview.png');

  // Roadmap page
  console.log('3. Navigating to /roadmap ...');
  await page.goto('http://localhost:5173/roadmap', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(outputDir, 'roadmap_graph.png'), fullPage: false });
  console.log('Saved roadmap_graph.png');

  await browser.close();
  console.log('All snapshots captured successfully in', outputDir);
}

run().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
