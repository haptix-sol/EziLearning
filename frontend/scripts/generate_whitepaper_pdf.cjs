const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const snapshotsDir = path.resolve(__dirname, '../public/images/snapshots');
const imagesDir = path.resolve(__dirname, '../public/images');
const outputPdf = path.resolve(__dirname, '../../EziLearning_Platform_Architecture_and_Approach.pdf');

// Read images as base64 for reliable PDF embedding
function getBase64Image(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const ext = path.extname(filePath).replace('.', '');
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

const owlbertImg = getBase64Image(path.join(imagesDir, 'owlbert_avatar.jpg'));
const showcaseHeroImg = getBase64Image(path.join(snapshotsDir, 'showcase_hero.png'));
const videoLessonsImg = getBase64Image(path.join(snapshotsDir, 'video_lessons.png'));
const whatsappMentorImg = getBase64Image(path.join(snapshotsDir, 'whatsapp_mentor.png'));
const codingArenaImg = getBase64Image(path.join(snapshotsDir, 'coding_arena.png'));
const dashboardImg = getBase64Image(path.join(snapshotsDir, 'dashboard_overview.png'));
const roadmapImg = getBase64Image(path.join(snapshotsDir, 'roadmap_graph.png'));

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>EziLearning — Platform Architecture & Educational Approach</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:ital,opsz,wght@0,14..32,400..700;1,14..32,400..600&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
      @bottom-right {
        content: counter(page);
        font-family: 'Inter', sans-serif;
        font-size: 9pt;
        color: #6b655c;
      }
    }
    
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      background: #fdfbf9;
      color: #171717;
      font-family: 'Inter', sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3, h4 {
      font-family: 'DM Serif Display', Georgia, serif;
      color: #2b1a07;
      font-weight: 600;
      margin: 0 0 10px;
      line-height: 1.15;
    }

    h1 {
      font-size: 26pt;
      letter-spacing: -0.02em;
    }

    h2 {
      font-size: 17pt;
      margin-top: 24pt;
      padding-bottom: 6pt;
      border-bottom: 1.5px solid rgba(23, 23, 23, 0.1);
    }

    h3 {
      font-size: 12.5pt;
      margin-top: 14pt;
    }

    p {
      margin: 0 0 10pt;
      color: #3b352e;
    }

    .badge {
      display: inline-block;
      background: #ff6f1e;
      color: #fdfbf9;
      padding: 2pt 8pt;
      border-radius: 12pt;
      font-size: 8pt;
      font-weight: 700;
      text-transform: lowercase;
      letter-spacing: 0.02em;
      margin-bottom: 8pt;
    }

    .accent-text {
      color: #ff6f1e;
      font-weight: 600;
    }

    .card {
      background: #f7efe9;
      border: 1.2px solid rgba(23, 23, 23, 0.12);
      border-radius: 10pt;
      padding: 12pt 14pt;
      margin: 10pt 0;
      page-break-inside: avoid;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12pt;
      margin: 10pt 0;
      page-break-inside: avoid;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10pt;
      margin: 10pt 0;
      page-break-inside: avoid;
    }

    .snapshot-box {
      background: #fff;
      border: 1.2px solid #171717;
      border-radius: 8pt;
      padding: 6pt;
      margin: 12pt 0;
      box-shadow: rgba(0, 0, 0, 0.06) 0px 3px 12px 0px;
      page-break-inside: avoid;
    }

    .snapshot-box img {
      width: 100%;
      height: auto;
      border-radius: 4pt;
      display: block;
    }

    .snapshot-caption {
      font-size: 8pt;
      color: #6b655c;
      text-align: center;
      margin-top: 5pt;
      font-weight: 500;
    }

    .page-break {
      page-break-before: always;
    }

    .pillar-num {
      display: inline-block;
      width: 20pt;
      height: 20pt;
      border-radius: 50%;
      background: #2b1a07;
      color: #fff;
      text-align: center;
      line-height: 20pt;
      font-size: 9pt;
      font-weight: 700;
      margin-right: 6pt;
    }

    .footer-band {
      background: #ff6f1e;
      color: #fff;
      border-radius: 16pt 16pt 0 0;
      padding: 20pt;
      margin-top: 30pt;
      text-align: center;
    }

    .mascot-row {
      display: flex;
      align-items: center;
      gap: 14pt;
      background: #f7efe9;
      border: 1.2px solid rgba(23, 23, 23, 0.12);
      border-radius: 10pt;
      padding: 12pt;
      margin: 12pt 0;
    }

    .mascot-img {
      width: 60pt;
      height: 60pt;
      border-radius: 50%;
      border: 1.5px solid #171717;
      object-fit: cover;
    }
  </style>
</head>
<body>

  <!-- COVER / HEADER -->
  <div style="border-bottom: 2px solid #171717; padding-bottom: 16pt; margin-bottom: 20pt;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <span class="badge">Architecture Whitepaper · Fall 2026</span>
        <h1 style="margin: 4pt 0 6pt;">ezilearning</h1>
        <p style="font-size: 13pt; color: #2b1a07; font-weight: 600; margin: 0;">
          The Unified Engineering Skill &amp; Career Readiness Ecosystem
        </p>
      </div>
      <div style="text-align: right; font-size: 8.5pt; color: #6b655c; line-height: 1.4;">
        <strong>EziLearning Technical Whitepaper</strong><br>
        Style: Superr Warm Notebook<br>
        Version: 2.4.0 (Live Prototype)
      </div>
    </div>
  </div>

  <!-- SECTION 1: EXECUTIVE SUMMARY & PROBLEM STATEMENT -->
  <h2>1. Executive Summary &amp; The Problem Statement</h2>
  <p>
    Higher education and engineering institutions worldwide face an acute crisis of <strong>fragmented skill preparation</strong>.
    Traditional Learning Management Systems (LMS) like Canvas, Blackboard, or Moodle are designed primarily for passive,
    theoretical rote learning: PDF reading, static slides, and multiple-choice quizzes.
  </p>
  
  <div class="card" style="border-left: 4pt solid #ff6f1e;">
    <strong style="color: #2b1a07; font-size: 10.5pt;">The Core Problem Statement:</strong><br>
    <em>
      "Existing Learning Management Systems (LMS) primarily focus on theoretical learning, while coding, project development,
      competitions, mentoring and industry-readiness activities are often managed through separate platforms and tools. This
      fragmented approach makes it difficult for students and institutions to manage and coordinate the complete learning and
      skill-development journey. There is a need for a unified, scalable and user-friendly platform that integrates AI-powered
      learning, mentoring, coding support, project development, competitions and learning analytics to support practical skill
      development and improve student readiness for higher education and industry opportunities."
    </em>
  </div>

  <p>
    As a result, an ambitious computer science student currently juggles up to six distinct subscriptions:
    <strong>Coursera/Udemy</strong> for lectures, <strong>LeetCode/HackerRank</strong> for algorithmic coding,
    <strong>GitHub</strong> for project repositories, <strong>WhatsApp/Slack</strong> for mentor queries,
    and disconnected spreadsheets for campus placements. Context is shattered, momentum is lost, and institutional
    placement cells lack real-time visibility into actual student competence.
  </p>

  <p>
    <strong>EziLearning</strong> solves this dilemma by consolidating the entire lifecycle into a single tactile,
    game-inspired notebook interface.
  </p>

  <!-- SNAPSHOT 1: DASHBOARD OVERVIEW -->
  <div class="snapshot-box">
    <img src="${dashboardImg}" alt="EziLearning Overview Workspace">
    <div class="snapshot-caption">Figure 1.1: EziLearning Unified Overview Workspace — momentum streak tracking, roadmap focus lanes, and practice stats in one clean view.</div>
  </div>

  <div class="page-break"></div>

  <!-- SECTION 2: THE 6 PILLARS -->
  <h2>2. The Six Unified Platform Pillars</h2>
  <p>
    EziLearning replaces the disparate toolchain with six tightly integrated pillars designed to guide a student
    from day one of college through to day-one industry productivity.
  </p>

  <div class="grid-2">
    <div class="card">
      <h3 style="margin-top: 0;"><span class="pillar-num">1</span> Adaptive AI Roadmaps</h3>
      <p style="font-size: 9pt; margin: 0;">
        Instead of a linear, rigid syllabus, the system generates a Directed Acyclic Graph (DAG) tailored to the student's
        target career role (e.g., Full-Stack, AI/ML, Cloud Infrastructure). Nodes automatically update their status, pacing,
        and prerequisites based on real performance.
      </p>
    </div>
    <div class="card">
      <h3 style="margin-top: 0;"><span class="pillar-num">2</span> Custom Video Lessons (Varin Engine)</h3>
      <p style="font-size: 9pt; margin: 0;">
        When a student struggles with a specific concept (e.g., dynamic programming memoization vs. tabulation), the platform
        synthesizes a personalized animated video explainer with step-by-step visual proofs rather than generic third-party clips.
      </p>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <h3 style="margin-top: 0;"><span class="pillar-num">3</span> In-Browser Coding Arena</h3>
      <p style="font-size: 9pt; margin: 0;">
        Zero-install interactive sandbox supporting Python, C++, Java, and TypeScript with instantaneous test execution,
        automated memory and execution-time benchmarking, and immediate feedback.
      </p>
    </div>
    <div class="card">
      <h3 style="margin-top: 0;"><span class="pillar-num">4</span> Real Project Development</h3>
      <p style="font-size: 9pt; margin: 0;">
        Hands-on full-stack and systems engineering projects with step-by-step architectural checkpoints, PR reviews,
        and instant generation of verified recruiter-facing live portfolio pages.
      </p>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <h3 style="margin-top: 0;"><span class="pillar-num">5</span> Campus &amp; Global Competitions</h3>
      <p style="font-size: 9pt; margin: 0;">
        Weekly 60-minute algorithmic sprint contests across 45+ colleges, offering verifiable Grandmaster/Master badges,
        automated anti-plagiarism verification, and live institutional leaderboards.
      </p>
    </div>
    <div class="card">
      <h3 style="margin-top: 0;"><span class="pillar-num">6</span> 24/7 WhatsApp AI Mentor</h3>
      <p style="font-size: 9pt; margin: 0;">
        Powered by "Owlbert the Owl", students receive daily 8:30 AM 60-second quiz pings on WhatsApp to keep streaks alive,
        and can ask complex algorithmic questions with instant voice/code responses right from their phone.
      </p>
    </div>
  </div>

  <!-- SNAPSHOT 2: SHOWCASE HERO & ROADMAP -->
  <div class="snapshot-box">
    <img src="${showcaseHeroImg}" alt="Interactive Demo Hero and Student Passport">
    <div class="snapshot-caption">Figure 2.1: EziLearning Interactive Showcase — Student Persona Passport with dynamic Level progression, XP breakdown, and verified daily milestones.</div>
  </div>

  <div class="page-break"></div>

  <!-- SECTION 3: PERSONALIZED VIDEO LESSONS (VARIN ENGINE) -->
  <h2>3. Deep Dive: AI-Synthesized Customized Video Lessons</h2>
  <p>
    A major innovation within EziLearning is the <strong>Varin Video Generation Engine</strong>. In traditional LMS courses,
    30% of students drop out because static recorded videos either move too fast over complex logic or waste time on concepts
    the student has already mastered.
  </p>

  <p>
    <strong>How Customized Video Synthesis Works:</strong>
  </p>
  <ol style="margin-top: 0; padding-left: 18pt; font-size: 9.5pt;">
    <li><strong>Misconception Detection:</strong> When a student fails test cases in the Coding Arena (e.g. infinite loops or off-by-one pointer errors), the telemetry engine isolates the exact conceptual bottleneck.</li>
    <li><strong>Automated Script &amp; Visual Storyboard:</strong> The AI compiles a structured lesson plan targeting only the gap, pairing visual graph animations with clear explanatory narration.</li>
    <li><strong>Local High-Fidelity Rendering:</strong> Utilizing optimized animation render pipelines (FFmpeg and Manim), a 90-second to 3-minute bespoke explainer video is produced and embedded directly into the student's study plan.</li>
  </ol>

  <!-- SNAPSHOT: VIDEO LESSON PLAYER -->
  <div class="snapshot-box">
    <img src="${videoLessonsImg}" alt="Customized Video Explainer Player">
    <div class="snapshot-caption">Figure 3.1: The Embedded Varin Video Player in EziLearning — showcasing an AI-generated algorithm animation tailored to Dijkstra graph relaxation (captured at frame 1:58).</div>
  </div>

  <div class="page-break"></div>

  <!-- SECTION 4: WHATSAPP AI MENTOR INTEGRATION -->
  <h2>4. Deep Dive: WhatsApp Integration &amp; "Owlbert the Owl"</h2>
  <p>
    Desktop-only LMS platforms suffer from high attrition because students spend hours away from their computers.
    EziLearning bridges the daily habit loop by bringing the learning platform directly to <strong>WhatsApp</strong>,
    the world's most ubiquitous messaging interface.
  </p>

  <div class="mascot-row">
    <img src="${owlbertImg}" alt="Owlbert Mascot" class="mascot-img">
    <div>
      <h3 style="margin: 0 0 4pt; color: #2b1a07;">Meet Owlbert the Wise Owl 🦉 — The EziLearning AI Mentor</h3>
      <p style="font-size: 9pt; margin: 0; color: #4a443c;">
        Owlbert is the smart, friendly owl mascot of EziLearning. Wearing spectacles and a graduation cap,
        Owlbert delivers non-intimidating, high-yield coaching, daily motivation, and instant code explanations with zero friction.
      </p>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <strong style="color: #2b1a07;">Daily 8:30 AM Morning Quizzes:</strong>
      <p style="font-size: 9pt; margin-top: 4pt;">
        Every morning, Owlbert sends a bite-sized 60-second multiple choice question directly to WhatsApp.
        Students simply tap option A, B, C, or D in chat. Correct answers award instant XP and keep learning streaks unbroken.
      </p>
    </div>
    <div class="card">
      <strong style="color: #2b1a07;">Pocket Doubt-Clearing:</strong>
      <p style="font-size: 9pt; margin-top: 4pt;">
        Whether stuck during a college lecture or late at night, students can snap a picture of code or send a voice note.
        Owlbert explains the underlying time complexity, edge cases, and architectural best practices Socratically.
      </p>
    </div>
  </div>

  <!-- SNAPSHOT: WHATSAPP MOCKUP -->
  <div class="snapshot-box">
    <img src="${whatsappMentorImg}" alt="WhatsApp AI Mentor Interface">
    <div class="snapshot-caption">Figure 4.1: The EziLearning WhatsApp Mentor Simulator — displaying Owlbert's interactive morning quiz flow, student answers, and real-time streak compounding.</div>
  </div>

  <div class="page-break"></div>

  <!-- SECTION 5: CODING ARENA & LEARNING ANALYTICS -->
  <h2>5. In-Browser Coding Sandbox &amp; Readiness Analytics</h2>
  <p>
    To ensure true industry readiness, EziLearning features a browser-based algorithmic sandbox where students immediately
    apply concepts without leaving the lesson.
  </p>

  <!-- SNAPSHOT: CODING ARENA -->
  <div class="snapshot-box">
    <img src="${codingArenaImg}" alt="Coding Arena Interface">
    <div class="snapshot-caption">Figure 5.1: The In-Browser Coding Arena — executing Python 3.12 algorithms with live test cases, execution time benchmarking, and memory profiling.</div>
  </div>

  <h3>Industry Placement Readiness Scoring</h3>
  <p>
    Instead of simple course completion percentages, EziLearning calculates a multi-factor <strong>Readiness Index (0–100%)</strong>:
  </p>
  <ul style="font-size: 9pt; color: #3b352e; line-height: 1.6;">
    <li><strong>Algorithmic Mastery (30%):</strong> Performance across easy, medium, and hard challenges, with time and space complexity evaluations.</li>
    <li><strong>Project Completeness (25%):</strong> Verified repository commits, architecture reviews, and working live deployment URLs.</li>
    <li><strong>Practice Consistency (20%):</strong> Daily active streak length, WhatsApp quiz accuracy, and steady XP compounding.</li>
    <li><strong>Mock Interview Verdicts (15%):</strong> AI-evaluated technical communication, structured reasoning, and problem clarification skills.</li>
    <li><strong>Resume Alignment (10%):</strong> Verified skill tags mapped against actual market employer job descriptions.</li>
  </ul>

  <!-- SNAPSHOT: ROADMAP GRAPH -->
  <div class="snapshot-box">
    <img src="${roadmapImg}" alt="Interactive Roadmap DAG">
    <div class="snapshot-caption">Figure 5.2: Role-Aware Roadmap Graph — visualizing skill prerequisites, mastered topics, and upcoming level milestones in real time.</div>
  </div>

  <!-- CONCLUSION & FOOTER -->
  <div class="footer-band">
    <h2 style="color: #fff; margin: 0 0 8pt; border: none; font-size: 18pt;">ready to build real engineering momentum?</h2>
    <p style="color: #fff; opacity: 0.95; font-size: 10pt; max-width: 480pt; margin: 0 auto 12pt;">
      EziLearning bridges the gap between academic theory and high-growth industry careers.
      One unified workspace: learn, build, compete, and get hired.
    </p>
    <div style="font-size: 8.5pt; opacity: 0.85;">
      © 2026 EziLearning Inc. · Demo available at https://ezilearning.haptix.in · WhatsApp Bot: EziLearning with Owlbert the Owl
    </div>
  </div>

</body>
</html>
`;

async function generatePdf() {
  const tempHtmlPath = path.resolve(__dirname, '../public/temp_document.html');
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');
  console.log('Saved temporary HTML document at:', tempHtmlPath);

  console.log('Launching browser to print PDF...');
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.goto('file:///' + tempHtmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Printing PDF to:', outputPdf);
  await page.pdf({
    path: outputPdf,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0mm',
      bottom: '0mm',
      left: '0mm',
      right: '0mm'
    }
  });

  await browser.close();
  console.log('PDF successfully created at:', outputPdf);

  // Also copy to frontend public directory so it can be downloaded via browser directly!
  const publicPdf = path.resolve(__dirname, '../public/EziLearning_Platform_Architecture_and_Approach.pdf');
  fs.copyFileSync(outputPdf, publicPdf);
  console.log('Copied PDF to frontend public directory at:', publicPdf);
}

generatePdf().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
