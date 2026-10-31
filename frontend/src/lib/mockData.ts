// Comprehensive mock dataset for standalone Vercel deployment (Zero Python Required)
import type {
  Challenge,
  DayPlan,
  LevelProgress,
  Progress,
  ResumeProfile,
  StudyPlan,
  Mcq,
  EarnedBadge,
  JobApplication,
  CpUnifiedPrivate,
  Question,
} from './api';

export const INITIAL_USER_PROFILE: ResumeProfile = {
  id: 'profile-sunil',
  full_name: 'Sunil Kumar',
  email: 'sunil@haptix.in',
  phone: '+91 98765 43210',
  experience_level: 'Full Stack & AI Specialist',
  years_experience: 3,
  target_role: 'Senior Full Stack & AI Systems Engineer',
  target_industry: 'Technology / AI Ecosystems',
  education_summary: 'B.Tech in Computer Science & Engineering (First Class with Distinction)',
  professional_summary:
    'Full-stack and AI software engineer with a track record of building production web platforms, distributed AI microservices, and interactive learning systems. Experienced in TypeScript, React, Python, FastAPI, and cloud infrastructure.',
  avatar_url: '/assets/owlbert.png',
  skills: [
    { skill_name: 'React 19 & TypeScript', category: 'Frontend', confidence: 95 },
    { skill_name: 'Python & FastAPI', category: 'Backend', confidence: 92 },
    { skill_name: 'System Design & Distributed Systems', category: 'Architecture', confidence: 88 },
    { skill_name: 'Algorithms & Data Structures', category: 'CS Fundamentals', confidence: 90 },
    { skill_name: 'PostgreSQL & Redis', category: 'Databases', confidence: 87 },
    { skill_name: 'Docker & Cloud Deployment', category: 'DevOps', confidence: 85 },
  ],
  created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
};

export const INITIAL_LEVEL_PROGRESS: LevelProgress = {
  level: 4,
  xp: 1450,
  xp_to_next_level: 2000,
  progress_percent: 72,
  streak_days: 9,
};

export const INITIAL_PROGRESS: Progress = {
  challenges_completed: 14,
  questions_answered: 38,
  total_time_minutes: 420,
  skills_strength: {
    'Algorithms': 88,
    'Frontend': 94,
    'Backend': 89,
    'System Design': 82,
    'Databases': 85,
  },
};

export const INITIAL_TRENDING_ROLES = [
  {
    id: 'role-fullstack',
    name: 'Full Stack Developer',
    description: 'Master React, TypeScript, APIs, Microservices, and Cloud Systems',
    popularity_score: 96,
    skills: ['React', 'TypeScript', 'Node.js', 'SQL', 'Docker', 'REST API'],
  },
  {
    id: 'role-ai-engineer',
    name: 'AI & ML Systems Engineer',
    description: 'LLM orchestration, agentic workflows, embeddings, and API design',
    popularity_score: 94,
    skills: ['Python', 'PyTorch', 'FastAPI', 'Vector DBs', 'LangChain'],
  },
  {
    id: 'role-backend-architect',
    name: 'Backend & Systems Architect',
    description: 'High-throughput APIs, distributed caching, event pipelines',
    popularity_score: 91,
    skills: ['Python', 'Go', 'PostgreSQL', 'Redis', 'Kafka', 'System Design'],
  },
];

export const INITIAL_CHALLENGES: Challenge[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    description:
      'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nExample 1:\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].',
    difficulty: 'easy',
    language: 'javascript',
    topics: ['arrays', 'hash-table'],
    starter_code: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
    test_cases: [
      { input: 'nums = [2,7,11,15], target = 9', expected_output: '[0,1]', is_hidden: false },
      { input: 'nums = [3,2,4], target = 6', expected_output: '[1,2]', is_hidden: false },
      { input: 'nums = [3,3], target = 6', expected_output: '[0,1]', is_hidden: true },
    ],
    required_skills: ['JavaScript', 'Algorithms'],
    time_limit_seconds: 15,
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    animation_url: null,
  },
  {
    id: 'fizz-buzz',
    title: 'FizzBuzz',
    description:
      'Given an integer n, return a string array answer (1-indexed) where:\n- answer[i] == "FizzBuzz" if i is divisible by 3 and 5.\n- answer[i] == "Fizz" if i is divisible by 3.\n- answer[i] == "Buzz" if i is divisible by 5.\n- answer[i] == i (as a string) if none of the above conditions are true.',
    difficulty: 'easy',
    language: 'javascript',
    topics: ['math', 'strings'],
    starter_code: `/**
 * @param {number} n
 * @return {string[]}
 */
function fizzBuzz(n) {
  const result = [];
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) result.push("FizzBuzz");
    else if (i % 3 === 0) result.push("Fizz");
    else if (i % 5 === 0) result.push("Buzz");
    else result.push(String(i));
  }
  return result;
}`,
    test_cases: [
      { input: 'n = 3', expected_output: '["1","2","Fizz"]', is_hidden: false },
      { input: 'n = 5', expected_output: '["1","2","Fizz","4","Buzz"]', is_hidden: false },
    ],
    required_skills: ['JavaScript'],
    time_limit_seconds: 10,
    created_at: new Date(Date.now() - 9 * 86400000).toISOString(),
    animation_url: null,
  },
  {
    id: 'binary-search',
    title: 'Binary Search',
    description:
      'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.\n\nYou must write an algorithm with O(log n) runtime complexity.',
    difficulty: 'easy',
    language: 'javascript',
    topics: ['arrays', 'binary-search'],
    starter_code: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
function search(nums, target) {
  let left = 0;
  let right = nums.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}`,
    test_cases: [
      { input: 'nums = [-1,0,3,5,9,12], target = 9', expected_output: '4', is_hidden: false },
      { input: 'nums = [-1,0,3,5,9,12], target = 2', expected_output: '-1', is_hidden: false },
    ],
    required_skills: ['JavaScript', 'Algorithms'],
    time_limit_seconds: 15,
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    animation_url: null,
  },
  {
    id: 'valid-palindrome',
    title: 'Valid Palindrome',
    description:
      'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.\n\nGiven a string s, return true if it is a palindrome, or false otherwise.',
    difficulty: 'easy',
    language: 'javascript',
    topics: ['strings', 'two-pointers'],
    starter_code: `/**
 * @param {string} s
 * @return {boolean}
 */
function isPalindrome(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let l = 0, r = clean.length - 1;
  while (l < r) {
    if (clean[l] !== clean[r]) return false;
    l++;
    r--;
  }
  return true;
}`,
    test_cases: [
      { input: 's = "A man, a plan, a canal: Panama"', expected_output: 'true', is_hidden: false },
      { input: 's = "race a car"', expected_output: 'false', is_hidden: false },
    ],
    required_skills: ['JavaScript', 'Strings'],
    time_limit_seconds: 10,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    animation_url: null,
  },
];

export const INITIAL_STUDY_PLANS: StudyPlan[] = [
  {
    id: 'plan-30day-fs',
    duration_days: 30,
    plan_type: 'Full Stack Engineering Readiness',
    focus_area: 'React 19, TypeScript, Backend Architecture & System Design',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    total_days: 30,
    completed_days: 12,
  },
];

export const INITIAL_DAY_PLANS: DayPlan[] = [
  {
    id: 'day-1',
    day_number: 1,
    title: 'Modern JavaScript & TypeScript Type System',
    topics: ['TypeScript Generics', 'Utility Types', 'Closures'],
    notes: null,
    duration_minutes: 45,
    activity_type: 'theory_and_code',
    level: 1,
    is_completed: true,
    xp_earned: 50,
    challenge_id: 'two-sum',
  },
  {
    id: 'day-2',
    day_number: 2,
    title: 'React 19 Hooks & Server Components Architecture',
    topics: ['useActionState', 'useOptimistic', 'Transitions', 'Suspense Boundaries'],
    notes: null,
    duration_minutes: 60,
    activity_type: 'interactive_lesson',
    level: 1,
    is_completed: true,
    xp_earned: 60,
  },
  {
    id: 'day-3',
    day_number: 3,
    title: 'Asynchronous Programming & Event Loop',
    topics: ['Microtasks vs Macrotasks', 'Promises', 'AbortController'],
    notes: null,
    duration_minutes: 50,
    activity_type: 'hands_on_lab',
    level: 1,
    is_completed: true,
    xp_earned: 55,
  },
  {
    id: 'day-4',
    day_number: 4,
    title: 'Data Structures: Arrays, Hash Maps & Two Pointers',
    topics: ['Hash Tables', 'Time-Space Complexity', 'Sliding Window'],
    notes: null,
    duration_minutes: 60,
    activity_type: 'coding_challenge',
    level: 2,
    is_completed: true,
    xp_earned: 70,
    challenge_id: 'two-sum',
  },
  {
    id: 'day-5',
    day_number: 5,
    title: 'Binary Search & Divide and Conquer Patterns',
    topics: ['Binary Search on Arrays', 'Rotated Sorted Array', 'Logarithmic Bounds'],
    notes: null,
    duration_minutes: 55,
    activity_type: 'coding_challenge',
    level: 2,
    is_completed: true,
    xp_earned: 70,
    challenge_id: 'binary-search',
  },
  {
    id: 'day-6',
    day_number: 6,
    title: 'RESTful API Engineering & Validation',
    topics: ['HTTP Semantics', 'Idempotency', 'Pydantic/Zod Schemas', 'JWT Auth'],
    notes: null,
    duration_minutes: 50,
    activity_type: 'system_design',
    level: 2,
    is_completed: true,
    xp_earned: 65,
  },
  {
    id: 'day-7',
    day_number: 7,
    title: 'Relational Database Modeling & Indexing Strategies',
    topics: ['PostgreSQL B-Tree Indexes', 'Foreign Keys', 'Query Plan Analysis'],
    notes: null,
    duration_minutes: 65,
    activity_type: 'database_lab',
    level: 3,
    is_completed: true,
    xp_earned: 75,
  },
  {
    id: 'day-8',
    day_number: 8,
    title: 'Caching with Redis & Distributed Locks',
    topics: ['Cache-Aside Pattern', 'Write-Through', 'Redis Expirations', 'Race Conditions'],
    notes: null,
    duration_minutes: 55,
    activity_type: 'interactive_lesson',
    level: 3,
    is_completed: false,
    xp_earned: null,
  },
  {
    id: 'day-9',
    day_number: 9,
    title: 'Asynchronous Job Queues & Message Brokers',
    topics: ['Celery / BullMQ', 'Dead-Letter Queues', 'Worker Concurrency'],
    notes: null,
    duration_minutes: 60,
    activity_type: 'hands_on_lab',
    level: 3,
    is_completed: false,
    xp_earned: null,
  },
  {
    id: 'day-10',
    day_number: 10,
    title: 'System Design: Scalable URL Shortener & Rate Limiting',
    topics: ['Token Bucket Algorithm', 'Distributed Counter', 'Database Sharding'],
    notes: null,
    duration_minutes: 75,
    activity_type: 'system_design',
    level: 4,
    is_completed: false,
    xp_earned: null,
  },
];

export const INITIAL_MCQS: Mcq[] = [
  {
    id: 'mcq-1',
    question_text: 'What is the primary benefit of using a B-Tree index in PostgreSQL?',
    options: [
      { id: 'opt-1', text: 'Enables O(1) constant-time key lookups like a hash table' },
      { id: 'opt-2', text: 'Supports equality lookups and range queries in O(log n) time' },
      { id: 'opt-3', text: 'Compresses large text blobs automatically' },
      { id: 'opt-4', text: 'Eliminates the need for foreign key constraints' },
    ],
    order_index: 0,
    answered: true,
    is_correct: true,
  },
  {
    id: 'mcq-2',
    question_text: 'In React 19, what does the useOptimistic hook accomplish?',
    options: [
      { id: 'opt-1', text: 'Performs automatic background database sync without fetch calls' },
      { id: 'opt-2', text: 'Shows an anticipated immediate UI state while an async action is pending' },
      { id: 'opt-3', text: 'Memoizes callback functions across re-renders like useCallback' },
      { id: 'opt-4', text: 'Enables server-side rendering of client components' },
    ],
    order_index: 1,
    answered: false,
  },
];

export const INITIAL_BADGES: EarnedBadge[] = [
  { role_name: 'Full Stack Engineer', goal_id: 'plan-30day-fs' },
  { role_name: 'Algorithmic Problem Solver', goal_id: 'plan-30day-fs' },
  { role_name: 'TypeScript Maestro', goal_id: 'plan-30day-fs' },
];

export const INITIAL_JOBS: JobApplication[] = [
  {
    id: 'job-1',
    company: 'Razorpay',
    role: 'Software Development Engineer - Frontend / Full Stack',
    sector: 'FinTech',
    source: 'LinkedIn',
    status: 'Interview Scheduled',
    applied_date: '2026-10-18',
    notification_date: '2026-10-25',
    notification_type: 'Technical Round 2 scheduled for Tuesday 3:00 PM',
    notes: 'Completed Online Assessment with 100% test cases passed. System design round next.',
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: 'job-2',
    company: 'Flipkart',
    role: 'SDE 1 (Platform Infrastructure)',
    sector: 'E-commerce',
    source: 'Referral',
    status: 'Under Review',
    applied_date: '2026-10-22',
    notification_date: '2026-10-24',
    notification_type: 'Profile shortlisted by hiring committee',
    notes: 'Referral submitted via engineering lead. Awaiting interviewer allocation.',
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: 'job-3',
    company: 'Swiggy',
    role: 'Full Stack Developer',
    sector: 'FoodTech & Quick Commerce',
    source: 'Career Portal',
    status: 'Applied',
    applied_date: '2026-10-28',
    notes: 'Submitted customized resume matching high-concurrency microservices requirements.',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export const INITIAL_CP_PORTFOLIO: CpUnifiedPrivate = {
  settings: {
    public_slug: 'sunil-dev',
    public_enabled: true,
    headline: 'Competitive Programmer & Full Stack Engineer | 250+ Problems Solved',
  },
  display_name: 'Sunil Kumar',
  connections: [
    {
      id: 'conn-leetcode',
      platform: 'leetcode',
      handle: 'sunil_codes',
      verification_status: 'verified',
      verified_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      last_sync_at: new Date().toISOString(),
      last_sync_error: null,
      stats_json: {
        totalSolved: 184,
        easySolved: 82,
        mediumSolved: 86,
        hardSolved: 16,
        ranking: 'Top 8.4%',
        rating: 1820,
      },
    },
    {
      id: 'conn-github',
      platform: 'github',
      handle: 'sunil-haptix',
      verification_status: 'verified',
      verified_at: new Date(Date.now() - 25 * 86400000).toISOString(),
      last_sync_at: new Date().toISOString(),
      last_sync_error: null,
      stats_json: {
        publicRepos: 28,
        totalStars: 142,
        contributionsLastYear: 840,
        followers: 46,
      },
    },
    {
      id: 'conn-codeforces',
      platform: 'codeforces',
      handle: 'sunil_algo',
      verification_status: 'verified',
      verified_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      last_sync_at: new Date().toISOString(),
      last_sync_error: null,
      stats_json: {
        rating: 1540,
        maxRating: 1612,
        rank: 'Specialist',
      },
    },
  ],
};

export const INITIAL_QUESTIONS: Question[] = [
  {
    id: 'q-1',
    question_text: 'Explain the difference between mutable and immutable data structures in JavaScript / Python and why immutability matters in React.',
    skill_name: 'Frontend & Architecture',
    difficulty: 'medium',
    category: 'conceptual',
    created_at: new Date().toISOString(),
  },
  {
    id: 'q-2',
    question_text: 'What is the difference between an inner join, left join, and outer join in SQL?',
    skill_name: 'Databases',
    difficulty: 'easy',
    category: 'conceptual',
    created_at: new Date().toISOString(),
  },
  {
    id: 'q-3',
    question_text: 'How does the CAP theorem apply when designing distributed databases?',
    skill_name: 'System Design',
    difficulty: 'hard',
    category: 'architecture',
    created_at: new Date().toISOString(),
  },
];
