import type { CpUnifiedPublic } from './api';
import {
  INITIAL_USER_PROFILE,
  INITIAL_LEVEL_PROGRESS,
  INITIAL_PROGRESS,
  INITIAL_TRENDING_ROLES,
  INITIAL_CHALLENGES,
  INITIAL_STUDY_PLANS,
  INITIAL_DAY_PLANS,
  INITIAL_MCQS,
  INITIAL_BADGES,
  INITIAL_JOBS,
  INITIAL_CP_PORTFOLIO,
  INITIAL_QUESTIONS,
} from './mockData';

// Storage helpers with fallback
function getStored<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(`ezilearning_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`ezilearning_${key}`, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function handleMockRoute(url: string, method: string = 'GET', data?: any): { status: number; data: any } | null {
  const cleanUrl = url.replace(/^\/api/, '').split('?')[0];

  // 1. Profile & Resume
  if (cleanUrl === '/resumes/me-display' || cleanUrl === '/resumes/profile' || cleanUrl === '/resumes/me') {
    const profile = getStored('profile', INITIAL_USER_PROFILE);
    if (method === 'PATCH' && data) {
      const updated = { ...profile, ...data };
      setStored('profile', updated);
      return { status: 200, data: updated };
    }
    return { status: 200, data: profile };
  }

  if (cleanUrl === '/resumes/avatar') {
    return { status: 200, data: { avatar_url: '/assets/owlbert.png', message: 'Avatar updated' } };
  }

  if (cleanUrl === '/content/generate') {
    return {
      status: 200,
      data: {
        success: true,
        resume_markdown: `# Sunil Kumar\nFull Stack & AI Engineer\n\n- Developed scalable microservices in TypeScript & Python\n- Built interactive UI systems with React 19`,
      },
    };
  }

  // 2. Level & Progress
  if (cleanUrl === '/study/level') {
    const lvl = getStored('level_progress', INITIAL_LEVEL_PROGRESS);
    return { status: 200, data: lvl };
  }

  if (cleanUrl === '/progress') {
    const prog = getStored('progress', INITIAL_PROGRESS);
    return { status: 200, data: prog };
  }

  if (cleanUrl === '/levels/map') {
    return {
      status: 200,
      data: {
        levels: [
          { level_number: 1, completed: true, unlocked: true, stars: 3, is_current: false },
          { level_number: 2, completed: true, unlocked: true, stars: 3, is_current: false },
          { level_number: 3, completed: true, unlocked: true, stars: 2, is_current: false },
          { level_number: 4, completed: false, unlocked: true, stars: 1, is_current: true },
          { level_number: 5, completed: false, unlocked: false, stars: null, is_current: false },
          { level_number: 6, completed: false, unlocked: false, stars: null, is_current: false },
        ],
        current_level: 4,
        total_levels: 6,
        completed_count: 3,
      },
    };
  }

  const levelContentMatch = cleanUrl.match(/^\/levels\/(\d+)\/content$/);
  if (levelContentMatch) {
    const lvl = parseInt(levelContentMatch[1], 10);
    return {
      status: 200,
      data: {
        level_number: lvl,
        challenges: INITIAL_CHALLENGES.map((c, i) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          difficulty: c.difficulty,
          completed: i === 0,
        })),
        questions: INITIAL_QUESTIONS.map((q, i) => ({
          id: q.id,
          question_text: q.question_text,
          skill_name: q.skill_name,
          difficulty: q.difficulty,
          answered: i === 0,
        })),
        all_complete: false,
        can_complete: true,
      },
    };
  }

  if (cleanUrl.match(/^\/levels\/(\d+)\/complete$/)) {
    return { status: 200, data: { success: true, message: 'Level completed! XP awarded.' } };
  }

  // 3. Onboarding & Goals
  if (cleanUrl === '/onboarding/status') {
    return {
      status: 200,
      data: {
        has_resume: true,
        has_goal: true,
        primary_goal: 'Full Stack Developer',
        onboarding_complete: true,
      },
    };
  }

  if (cleanUrl === '/onboarding/trending') {
    return { status: 200, data: INITIAL_TRENDING_ROLES };
  }

  if (cleanUrl === '/onboarding/goals') {
    return {
      status: 200,
      data: [
        {
          id: 'goal-fullstack',
          goal_type: 'role',
          goal_text: 'Full Stack Engineering Readiness',
          goal_label: 'Full Stack Developer',
          study_plan_id: 'plan-30day-fs',
          duration_days: 30,
          completed_days: 12,
          total_days: 30,
          created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
        },
      ],
    };
  }

  if (cleanUrl === '/onboarding/goal' && method === 'POST') {
    return { status: 200, data: { success: true, message: 'Goal created and study plan generated.' } };
  }

  // 4. Challenges & Code Execution
  if (cleanUrl === '/challenges') {
    const challenges = getStored('challenges', INITIAL_CHALLENGES);
    return { status: 200, data: challenges };
  }

  const challengeDetailMatch = cleanUrl.match(/^\/challenges\/([a-zA-Z0-9_-]+)$/);
  if (challengeDetailMatch) {
    const id = challengeDetailMatch[1];
    const challenges = getStored('challenges', INITIAL_CHALLENGES);
    const found = challenges.find((c: any) => c.id === id) || INITIAL_CHALLENGES[0];
    return { status: 200, data: found };
  }

  if (cleanUrl === '/challenges/reset') {
    setStored('challenges', INITIAL_CHALLENGES);
    return { status: 200, data: { deleted: 0, message: 'Challenges restored to initial state' } };
  }

  if (cleanUrl === '/executions' && method === 'POST') {
    return {
      status: 200,
      data: {
        id: `exec-${Date.now()}`,
        status: 'success',
        stdout: `Executing automated test suite...\n✓ Test Case 1: Passed (0.8ms)\n✓ Test Case 2: Passed (1.2ms)\n✓ Test Case 3: Passed (Hidden tests)\n\nAll test cases verified! Optimal O(n) time complexity achieved.`,
        stderr: null,
        test_results: [
          { passed: true, input: '[2, 7, 11, 15], 9', expected: '[0, 1]', actual: '[0, 1]' },
          { passed: true, input: '[3, 2, 4], 6', expected: '[1, 2]', actual: '[1, 2]' },
        ],
        execution_time_ms: 18,
        created_at: new Date().toISOString(),
      },
    };
  }

  if (cleanUrl.includes('/anne-hint') && method === 'POST') {
    return {
      status: 200,
      data: {
        reply:
          "Anne AI Tutor: Great strategy! You can achieve optimal O(n) linear time complexity by using a hash map to keep track of complements as you iterate through the list. When checking element x, see if (target - x) is in the map. If yes, you've found the pair!",
        fallback: false,
      },
    };
  }

  // 5. Study Plans & Days
  if (cleanUrl === '/study/plans') {
    return { status: 200, data: INITIAL_STUDY_PLANS };
  }

  if (cleanUrl.match(/^\/study\/plans\/[a-zA-Z0-9_-]+\/days$/)) {
    const days = getStored('day_plans', INITIAL_DAY_PLANS);
    return { status: 200, data: days };
  }

  if (cleanUrl.match(/^\/study\/goals\/[a-zA-Z0-9_-]+\/roadmap$/)) {
    const days = getStored('day_plans', INITIAL_DAY_PLANS);
    return {
      status: 200,
      data: {
        goal: {
          id: 'goal-fullstack',
          goal_label: 'Full Stack Developer',
          study_plan_id: 'plan-30day-fs',
          completed_days: 12,
          total_days: 30,
        },
        days,
      },
    };
  }

  if (cleanUrl === '/study/badges') {
    return { status: 200, data: { badges: INITIAL_BADGES } };
  }

  if (cleanUrl.includes('/complete') && method === 'POST') {
    return { status: 200, data: { success: true, message: 'Day completed! +50 XP awarded.' } };
  }

  if (cleanUrl.includes('/mcqs')) {
    if (cleanUrl.includes('/answer') && method === 'POST') {
      return { status: 200, data: { is_correct: true, explanation: 'Correct! B-Tree indexes provide logarithmic search and range traversal.' } };
    }
    return { status: 200, data: INITIAL_MCQS };
  }

  // Visual Lesson
  if (cleanUrl.includes('/visual-lesson')) {
    if (method === 'POST') {
      return { status: 200, data: { success: true } };
    }
    return {
      status: 200,
      data: {
        lesson_title: 'Interactive Visual Architecture: Hash Tables & Pointers',
        lesson_objective: 'Understand how memory addressing, buckets, and collision resolution work under the hood.',
        lesson_type: 'interactive_explainer',
        topic_key: 'hash-tables',
        slides: [
          {
            id: 'slide-1',
            kind: 'intro',
            title: 'Welcome to Hash Map Internals',
            short_explanation: 'Hash maps translate arbitrary keys into array indices in O(1) average time.',
            diagram_type: 'memory_blocks',
            diagram_data: { buckets: [0, 1, 2, 3, 4] },
            narration_text: 'Let us see how keys map into contiguous memory blocks through hash functions.',
          },
          {
            id: 'slide-2',
            kind: 'step',
            title: 'Hashing and Index Computation',
            short_explanation: 'The hash function hashes the key and computes modulo array length.',
            diagram_type: 'pipeline',
            diagram_data: { steps: ['Key String', 'Hash Function (Murmur3)', 'Modulo Array Length', 'Target Bucket'] },
          },
        ],
      },
    };
  }

  // 6. Notes
  if (cleanUrl === '/study/notes') {
    return {
      status: 200,
      data: INITIAL_DAY_PLANS.slice(0, 5).map((d) => ({
        day_id: d.id,
        day_number: d.day_number,
        title: d.title,
        has_notes: true,
        summary: `Comprehensive engineering notes covering ${d.topics.join(', ')} with code patterns and interview questions.`,
      })),
    };
  }

  if (cleanUrl.includes('/notes/build')) {
    return { status: 200, data: { day_id: 'day-1', cached: true } };
  }

  if (cleanUrl.includes('/notes/rendered')) {
    return {
      status: 200,
      data: {
        title: 'Tactile Engineering Notes: Algorithms & Distributed Systems',
        html: `
          <div style="font-family: inherit; line-height: 1.7; color: #e6edf3;">
            <h2 style="color: #58a6ff; border-bottom: 1px solid #30363d; padding-bottom: 8px;">Key Engineering Takeaways</h2>
            <p>Mastering time-space trade-offs is essential for high-throughput distributed systems and technical evaluations.</p>
            <div style="background: rgba(56, 189, 248, 0.08); border-left: 4px solid #38bdf8; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
              <strong>Pattern Spotlight:</strong> When performing complement searches in an unsorted array, storing historical items in an auxiliary hash map converts an O(n²) nested scan into an O(n) single pass.
            </div>
            <h3 style="color: #7ee787; margin-top: 24px;">Complexity Matrix</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px;">
              <thead>
                <tr style="border-bottom: 1px solid #30363d; text-align: left;">
                  <th style="padding: 8px;">Operation</th>
                  <th style="padding: 8px;">Array</th>
                  <th style="padding: 8px;">Hash Map</th>
                  <th style="padding: 8px;">B-Tree</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #21262d;">
                  <td style="padding: 8px;">Access / Lookup</td>
                  <td style="padding: 8px; color: #7ee787;">O(1)</td>
                  <td style="padding: 8px; color: #7ee787;">O(1) avg</td>
                  <td style="padding: 8px; color: #d29922;">O(log n)</td>
                </tr>
                <tr style="border-bottom: 1px solid #21262d;">
                  <td style="padding: 8px;">Insertion</td>
                  <td style="padding: 8px; color: #d29922;">O(n)</td>
                  <td style="padding: 8px; color: #7ee787;">O(1) avg</td>
                  <td style="padding: 8px; color: #d29922;">O(log n)</td>
                </tr>
                <tr>
                  <td style="padding: 8px;">Range Query</td>
                  <td style="padding: 8px; color: #f85149;">O(n)</td>
                  <td style="padding: 8px; color: #f85149;">O(n)</td>
                  <td style="padding: 8px; color: #7ee787;">O(log n + k)</td>
                </tr>
              </tbody>
            </table>
          </div>
        `,
        animation_url: null,
      },
    };
  }

  // 7. Competitive Programming Portfolio
  if (cleanUrl === '/cp/me/unified') {
    const portfolio = getStored('cp_portfolio', INITIAL_CP_PORTFOLIO);
    return { status: 200, data: portfolio };
  }

  if (cleanUrl === '/cp/me/settings' && method === 'PUT') {
    const portfolio = getStored('cp_portfolio', INITIAL_CP_PORTFOLIO);
    const updated = { ...portfolio, settings: { ...portfolio.settings, ...data } };
    setStored('cp_portfolio', updated);
    return { status: 200, data: updated };
  }

  if (cleanUrl === '/cp/me/connections') {
    const portfolio = getStored('cp_portfolio', INITIAL_CP_PORTFOLIO);
    if (method === 'POST') {
      const newConn = {
        id: `conn-${Date.now()}`,
        platform: data.platform,
        handle: data.handle,
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
        stats_json: { totalSolved: 45, rating: 1420 },
      };
      portfolio.connections.push(newConn);
      setStored('cp_portfolio', portfolio);
      return { status: 200, data: newConn };
    }
    return { status: 200, data: portfolio.connections };
  }

  if (cleanUrl.match(/^\/cp\/me\/connections\/[a-zA-Z0-9_-]+\/(verify|sync|regenerate-token)$/)) {
    return {
      status: 200,
      data: {
        id: 'conn-verified',
        platform: 'leetcode',
        handle: 'verified_handle',
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
        stats_json: { totalSolved: 210, rating: 1850 },
      },
    };
  }

  const cpPublicMatch = cleanUrl.match(/^\/cp\/public\/([a-zA-Z0-9_-]+)$/);
  if (cpPublicMatch) {
    const publicProfile: CpUnifiedPublic = {
      slug: cpPublicMatch[1],
      headline: 'Competitive Programmer & Full Stack Engineer | 250+ Problems Solved',
      display_name: 'Sunil Kumar',
      platforms: [
        { platform: 'leetcode', handle: 'sunil_codes', stats: { solved: 184, rating: 1820 } },
        { platform: 'github', handle: 'sunil-haptix', stats: { repos: 28, stars: 142 } },
        { platform: 'codeforces', handle: 'sunil_algo', stats: { rating: 1540, rank: 'Specialist' } },
      ],
    };
    return { status: 200, data: publicProfile };
  }

  // 8. Jobs
  if (cleanUrl === '/jobs') {
    const jobs = getStored('jobs', INITIAL_JOBS);
    if (method === 'POST') {
      const newJob = {
        id: `job-${Date.now()}`,
        ...data,
        status: data.status || 'Applied',
        created_at: new Date().toISOString(),
      };
      const updated = [newJob, ...jobs];
      setStored('jobs', updated);
      return { status: 200, data: newJob };
    }
    return { status: 200, data: jobs };
  }

  const jobMatch = cleanUrl.match(/^\/jobs\/([a-zA-Z0-9_-]+)$/);
  if (jobMatch) {
    const jobs = getStored('jobs', INITIAL_JOBS);
    const id = jobMatch[1];
    if (method === 'PATCH') {
      const updated = jobs.map((j: any) => (j.id === id ? { ...j, ...data } : j));
      setStored('jobs', updated);
      return { status: 200, data: { success: true } };
    }
    if (method === 'DELETE') {
      const updated = jobs.filter((j: any) => j.id !== id);
      setStored('jobs', updated);
      return { status: 200, data: { success: true } };
    }
  }

  if (cleanUrl === '/gmail/status') {
    return { status: 200, data: { connected: true, email: 'sunil@haptix.in', last_sync: '10 mins ago' } };
  }

  if (cleanUrl === '/gmail/sync') {
    return { status: 200, data: { synced_count: 2, message: 'Found 2 new application status updates!' } };
  }

  // 9. Technical Questions
  if (cleanUrl === '/questions/quiz' || cleanUrl === '/questions/trending') {
    return { status: 200, data: INITIAL_QUESTIONS };
  }

  if (cleanUrl === '/questions/solved') {
    return { status: 200, data: [{ question_id: 'q-1', solved_at: new Date().toISOString() }] };
  }

  if (cleanUrl.match(/^\/questions\/[a-zA-Z0-9_-]+\/answer$/) && method === 'POST') {
    return {
      status: 200,
      data: {
        message: 'Great answer! Thorough explanation covering core principles.',
        verdict: 'correct',
        feedback:
          'Your answer correctly highlights how immutability enables reference-equality checks (Object.is) in React, preventing unnecessary sub-tree re-renders.',
      },
    };
  }

  // Catch-all
  return { status: 200, data: { success: true, message: 'Action simulated successfully' } };
}
