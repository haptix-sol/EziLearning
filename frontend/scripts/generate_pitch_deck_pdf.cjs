const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const inputHtmlPath = path.resolve(__dirname, '../public/pitch_deck.html');
const outputPdfPath = path.resolve(__dirname, '../../EziLearning_Pitch_Deck.pdf');
const publicPdfPath = path.resolve(__dirname, '../public/EziLearning_Pitch_Deck.pdf');

async function generatePitchDeckPdf() {
  console.log('Generating 16:9 Widescreen Pitch Deck PDF from:', inputHtmlPath);

  if (!fs.existsSync(inputHtmlPath)) {
    throw new Error('Input HTML not found: ' + inputHtmlPath);
  }

  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  // 16:9 HD viewport
  await page.setViewport({ width: 1920, height: 1080 });

  const fileUrl = 'file:///' + inputHtmlPath.replace(/\\/g, '/');
  console.log('Navigating to:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Printing 16:9 Presentation Slides PDF to:', outputPdfPath);
  await page.pdf({
    path: outputPdfPath,
    width: '16in',
    height: '9in',
    printBackground: true,
    margin: {
      top: '0mm',
      bottom: '0mm',
      left: '0mm',
      right: '0mm'
    }
  });

  await browser.close();
  console.log('Pitch deck PDF created successfully at:', outputPdfPath);

  // Copy to public folder for direct browser download
  fs.copyFileSync(outputPdfPath, publicPdfPath);
  console.log('Copied pitch deck PDF to frontend public folder at:', publicPdfPath);
}

generatePitchDeckPdf().catch(err => {
  console.error('Error generating pitch deck PDF:', err);
  process.exit(1);
});
