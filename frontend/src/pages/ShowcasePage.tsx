import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Code2,
  Compass,
  Flame,
  Layers,
  MessageCircle,
  MessageSquare,
  Play,
  QrCode,
  Send,
  Sparkles,
  Target,
  Trophy,
  Users,
  Video,
  Volume2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface DemoStudent {
  name: string;
  role: string;
  avatar: string;
  college: string;
  level: number;
  xp: number;
  streakDays: number;
  readinessScore: number;
}

const DEMO_STUDENTS: DemoStudent[] = [
  {
    name: 'Priya Sharma',
    role: 'Full-Stack & Systems Engineer',
    avatar: 'PS',
    college: 'IIT Delhi · CSE 2026',
    level: 7,
    xp: 2840,
    streakDays: 24,
    readinessScore: 92,
  },
  {
    name: 'Arjun Mehta',
    role: 'AI / ML Engineer',
    avatar: 'AM',
    college: 'BITS Pilani · ECE 2025',
    level: 5,
    xp: 1950,
    streakDays: 14,
    readinessScore: 84,
  },
  {
    name: 'Sara Khan',
    role: 'Frontend Architect',
    avatar: 'SK',
    college: 'NIT Trichy · IT 2026',
    level: 8,
    xp: 3420,
    streakDays: 31,
    readinessScore: 96,
  },
];

const WEEKLY_HOURS = [
  { day: 'Mon', hours: 3.5, problems: 4 },
  { day: 'Tue', hours: 4.2, problems: 6 },
  { day: 'Wed', hours: 2.8, problems: 3 },
  { day: 'Thu', hours: 5.1, problems: 8 },
  { day: 'Fri', hours: 4.6, problems: 7 },
  { day: 'Sat', hours: 6.4, problems: 11 },
  { day: 'Sun', hours: 5.0, problems: 9 },
];

const LEADERBOARD = [
  { rank: 1, name: 'Sara Khan', score: 3420, streak: 31, badge: 'Grandmaster' },
  { rank: 2, name: 'Priya Sharma (You)', score: 2840, streak: 24, badge: 'Master' },
  { rank: 3, name: 'Rohan Gupta', score: 2610, streak: 19, badge: 'Master' },
  { rank: 4, name: 'Arjun Mehta', score: 1950, streak: 14, badge: 'Diamond' },
  { rank: 5, name: 'Devika Nair', score: 1820, streak: 12, badge: 'Diamond' },
];

export function ShowcasePage() {
  const [activeStudent, setActiveStudent] = useState<DemoStudent>(DEMO_STUDENTS[0]);
  const [activeVideoTopic, setActiveVideoTopic] = useState<'dijkstra' | 'lru' | 'dp'>('dijkstra');
  const [showQrModal, setShowQrModal] = useState(false);

  // Live Coding Sandbox State
  const [codeSnippet, setCodeSnippet] = useState<string>(
`def two_sum(nums: list[int], target: int) -> list[int]:
    lookup = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in lookup:
            return [lookup[complement], i]
        lookup[num] = i
    return []

print(two_sum([2, 7, 11, 15], 9))  # -> [0, 1]`
  );
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [isRunningCode, setIsRunningCode] = useState(false);

  // WhatsApp Interactive Demo State
  const [selectedQuizOption, setSelectedQuizOption] = useState<string | null>(null);
  const [waMessages, setWaMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: "☀️ Rise and shine Priya! It's Owlbert 🦉 from EziLearning! Here is your 60-second morning challenge to fuel your 24-day streak 🔥:\n\nQ: What is the worst-case lookup time in a balanced Red-Black Tree?\n\nA) O(1)\nB) O(log N)\nC) O(N)\nD) O(N log N)",
      time: '08:30 AM',
    },
  ]);
  const [waInput, setWaInput] = useState('');

  const handleRunCode = () => {
    setIsRunningCode(true);
    setTestOutput(null);
    setTimeout(() => {
      setIsRunningCode(false);
      setTestOutput('[0, 1]\n\n✓ Test 1: [2, 7, 11, 15], target 9 -> [0, 1] — PASSED (0.4ms)\n✓ Test 2: [3, 2, 4], target 6 -> [1, 2] — PASSED (0.3ms)\n✓ Test 3: [3, 3], target 6 -> [0, 1] — PASSED (0.2ms)\n✓ Memory: 14.8 MB (Beats 91.4% of Python 3 submissions)');
    }, 500);
  };

  const handleQuizAnswer = (opt: string) => {
    setSelectedQuizOption(opt);
    const now = '08:31 AM';
    if (opt === 'B') {
      setWaMessages((prev) => [
        ...prev,
        { sender: 'user', text: 'B) O(log N)', time: now },
        {
          sender: 'bot',
          text: 'Bingo! 🎯 In a balanced BST (like Red-Black or AVL), height is strictly bounded by 2·log₂(N+1), ensuring O(log N) worst-case search, insert, and delete.\n\n✨ +20 XP awarded! Streak kept blazing 🔥!',
          time: '08:31 AM',
        },
      ]);
    } else {
      setWaMessages((prev) => [
        ...prev,
        { sender: 'user', text: `${opt}`, time: now },
        {
          sender: 'bot',
          text: "Close! Remember that trees partition data hierarchically at each branch, dividing the search space by 2 at each level: that's O(log N)!\n\nCheck out the customized video lesson on Trees in your workspace to visualize it!",
          time: '08:31 AM',
        },
      ]);
    }
  };

  const handleSendWa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waInput.trim()) return;
    const userMsg = waInput.trim();
    setWaInput('');
    setWaMessages((prev) => [...prev, { sender: 'user', text: userMsg, time: 'Just now' }]);

    setTimeout(() => {
      setWaMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `Great question on ${userMsg.slice(0, 30)}! 🦉 Owlbert says: Always start by analyzing constraints (N ≤ 10⁵ means O(N log N) max). I've added a custom practice prompt to your daily study plan!`,
          time: 'Just now',
        },
      ]);
    }, 700);
  };

  return (
    <div
      style={{
        background: '#fdfbf9',
        color: '#171717',
        minHeight: '100vh',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Top Bar with Demo Persona Switcher ── */}
      <div
        style={{
          borderBottom: '1.5px solid rgba(23, 23, 23, 0.08)',
          background: '#f7efe9',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#2b1a07' }}>
          <span
            style={{
              background: '#ff6f1e',
              color: '#fdfbf9',
              padding: '3px 10px',
              borderRadius: 20,
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            live interactive demo
          </span>
          <span style={{ fontWeight: 500 }}>
            Unified LMS · AI roadmaps, video lessons, coding arena, WhatsApp mentor &amp; analytics
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={{ color: '#6b655c', fontWeight: 500 }}>Switch persona:</span>
          {DEMO_STUDENTS.map((st) => (
            <button
              key={st.name}
              onClick={() => setActiveStudent(st)}
              style={{
                background: activeStudent.name === st.name ? '#fdfbf9' : 'transparent',
                border: activeStudent.name === st.name ? '1.5px solid #171717' : '1.5px solid transparent',
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: activeStudent.name === st.name ? '#2b1a07' : '#6b655c',
                cursor: 'pointer',
                boxShadow: activeStudent.name === st.name ? 'rgba(0, 0, 0, 0.15) 0px 1px 2px 0px' : 'none',
              }}
            >
              {st.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Header Navigation ── */}
      <nav
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: '#2b1a07',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#ff6f1e',
              color: '#fdfbf9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            ez
          </div>
          <div>
            <span
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 24,
                fontWeight: 600,
                color: '#2b1a07',
                letterSpacing: '-0.02em',
                display: 'block',
                lineHeight: 1,
              }}
            >
              ezilearning
            </span>
            <span style={{ fontSize: 11, color: '#6b655c', letterSpacing: '0.02em' }}>
              unified practical skill ecosystem
            </span>
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a
            href="#video-lessons"
            style={{
              textDecoration: 'none',
              color: '#171717',
              fontSize: 14,
              fontWeight: 500,
              padding: '6px 12px',
            }}
          >
            custom videos
          </a>
          <a
            href="#whatsapp-mentor"
            style={{
              textDecoration: 'none',
              color: '#171717',
              fontSize: 14,
              fontWeight: 500,
              padding: '6px 12px',
            }}
          >
            whatsapp mentor
          </a>
          <a
            href="#coding-arena"
            style={{
              textDecoration: 'none',
              color: '#171717',
              fontSize: 14,
              fontWeight: 500,
              padding: '6px 12px',
            }}
          >
            coding arena
          </a>
          <Link
            to="/pitch"
            style={{
              background: '#fdfbf9',
              border: '1.5px solid #171717',
              borderRadius: 20,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 600,
              color: '#171717',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: 'rgba(0, 0, 0, 0.15) 0px 1px 2px 0px',
            }}
          >
            📊 pitch deck (16:9)
          </Link>
          <a
            href="/EziLearning_Platform_Architecture_and_Approach.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#f7efe9',
              border: '1.5px solid #171717',
              borderRadius: 20,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 600,
              color: '#2b1a07',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: 'rgba(0, 0, 0, 0.15) 0px 1px 2px 0px',
            }}
          >
            📄 whitepaper pdf
          </a>
          <Link
            to="/"
            style={{
              background: '#fdfbf9',
              border: '1.5px solid #171717',
              borderRadius: 20,
              padding: '8px 22px',
              fontSize: 14,
              fontWeight: 600,
              color: '#171717',
              textDecoration: 'none',
              boxShadow: 'rgba(0, 0, 0, 0.25) 0px 1px 2px 0px',
            }}
          >
            open app
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '40px 24px 64px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 48,
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 20,
              border: '1.5px solid rgba(23, 23, 23, 0.14)',
              background: '#f7efe9',
              color: '#2b1a07',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 20,
            }}
          >
            <Sparkles size={14} color="#ff6f1e" />
            solving the fragmented lms problem
          </div>

          <h1
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 'clamp(2.75rem, 5.2vw, 4.25rem)',
              lineHeight: 1.08,
              fontWeight: 600,
              color: '#2b1a07',
              margin: '0 0 20px',
              letterSpacing: '-0.02em',
            }}
          >
            stop juggling ten platforms to become industry ready.
          </h1>

          <p
            style={{
              fontSize: 18,
              lineHeight: 1.6,
              color: '#4a443c',
              maxWidth: 540,
              margin: '0 0 32px',
            }}
          >
            Traditional learning management systems only deliver videos and text quizzes.
            EziLearning combines{' '}
            <span style={{ color: '#ff6f1e', fontWeight: 600, textDecoration: 'underline 2px #ff6f1e' }}>
              adaptive roadmaps
            </span>
            , AI-synthesized animated videos, an in-browser coding sandbox, and a 24/7 WhatsApp AI mentor
            into one notebook workspace.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <a
              href="#video-lessons"
              style={{
                background: '#fdfbf9',
                border: '1.5px solid #171717',
                borderRadius: 20,
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 600,
                color: '#171717',
                textDecoration: 'none',
                boxShadow: 'rgba(0, 0, 0, 0.25) 0px 1px 2px 0px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              watch customized video <Play size={15} fill="#ff6f1e" color="#ff6f1e" />
            </a>

            <a
              href="#whatsapp-mentor"
              style={{
                background: '#f7efe9',
                border: '1.5px solid #171717',
                borderRadius: 20,
                padding: '12px 24px',
                fontSize: 15,
                fontWeight: 600,
                color: '#2b1a07',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              meet owlbert the owl on whatsapp 🦉
            </a>
          </div>

          {/* Quick Metrics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              marginTop: 36,
              paddingTop: 28,
              borderTop: '1px solid rgba(23, 23, 23, 0.1)',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: 28,
                  fontWeight: 600,
                  color: '#2b1a07',
                }}
              >
                100%
              </div>
              <div style={{ fontSize: 13, color: '#6b655c', marginTop: 2 }}>customized video lessons</div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: 28,
                  fontWeight: 600,
                  color: '#ff6f1e',
                }}
              >
                24/7
              </div>
              <div style={{ fontSize: 13, color: '#6b655c', marginTop: 2 }}>whatsapp ai mentor</div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: 28,
                  fontWeight: 600,
                  color: '#2b1a07',
                }}
              >
                92%
              </div>
              <div style={{ fontSize: 13, color: '#6b655c', marginTop: 2 }}>industry placement readiness</div>
            </div>
          </div>
        </div>

        {/* ── Student Passport / Interactive Status Card ── */}
        <div
          style={{
            background: '#fdfbf9',
            border: '1.5px solid #171717',
            borderRadius: 16,
            boxShadow: 'rgba(0, 0, 0, 0.08) 0px 4px 24px 0px',
            padding: 28,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -14,
              right: 24,
              background: '#f7efe9',
              border: '1.5px solid #171717',
              borderRadius: 8,
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: 700,
              color: '#2b1a07',
              transform: 'rotate(2deg)',
            }}
          >
            verified student id: #{activeStudent.avatar}-2026
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: '#2b1a07',
                color: '#fdfbf9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'DM Serif Display', serif",
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {activeStudent.avatar}
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: 22,
                  fontWeight: 600,
                  color: '#2b1a07',
                }}
              >
                {activeStudent.name}
              </div>
              <div style={{ fontSize: 13, color: '#6b655c' }}>
                {activeStudent.role} · {activeStudent.college}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 20,
              background: '#f7efe9',
              padding: 16,
              borderRadius: 12,
              border: '1px solid rgba(23, 23, 23, 0.08)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#6b655c' }}>level &amp; xp</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#2b1a07', marginTop: 2 }}>
                Lv. {activeStudent.level}
              </div>
              <div style={{ fontSize: 11, color: '#ff6f1e', fontWeight: 600 }}>{activeStudent.xp} xp</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b655c' }}>learning streak</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#ff6f1e',
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Flame size={16} fill="#ff6f1e" /> {activeStudent.streakDays}d
              </div>
              <div style={{ fontSize: 11, color: '#6b655c' }}>unbroken daily</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b655c' }}>readiness score</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e', marginTop: 2 }}>
                {activeStudent.readinessScore}%
              </div>
              <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>tier-1 ready</div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: '#6b655c',
                marginBottom: 6,
              }}
            >
              <span>Milestone Pacing: Level {activeStudent.level} → {activeStudent.level + 1}</span>
              <span style={{ fontWeight: 600, color: '#2b1a07' }}>
                {Math.round((activeStudent.xp % 1000) / 10)}%
              </span>
            </div>
            <div
              style={{
                height: 8,
                background: '#f7efe9',
                borderRadius: 20,
                overflow: 'hidden',
                border: '1px solid rgba(23, 23, 23, 0.08)',
              }}
            >
              <div
                style={{
                  width: `${(activeStudent.xp % 1000) / 10}%`,
                  height: '100%',
                  background: '#ff6f1e',
                  borderRadius: 20,
                }}
              />
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#2b1a07',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Target size={14} color="#ff6f1e" /> today's verified roadmap milestones:
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: '#2b1a07',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: '#f7efe9',
                }}
              >
                <CheckCircle2 size={16} color="#22c55e" />
                <span style={{ textDecoration: 'line-through', opacity: 0.75 }}>
                  Watch custom animated video on Dijkstra graph relaxation
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: '#2b1a07',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: '#f7efe9',
                }}
              >
                <CheckCircle2 size={16} color="#22c55e" />
                <span style={{ textDecoration: 'line-through', opacity: 0.75 }}>
                  Answer morning WhatsApp quiz from Owlbert
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: '#2b1a07',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: '#fdfbf9',
                  border: '1px solid rgba(23, 23, 23, 0.12)',
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: '1.5px solid #ff6f1e',
                  }}
                />
                <span style={{ fontWeight: 600 }}>Solve 1 priority-queue challenge in the arena</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── NEW SECTION 1: AI-Crafted Customized Video Lessons ── */}
      <section
        id="video-lessons"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '64px 24px',
          borderTop: '1px solid rgba(23, 23, 23, 0.08)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 40px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 14px',
              borderRadius: 20,
              background: '#f7efe9',
              border: '1.5px solid rgba(23, 23, 23, 0.1)',
              fontSize: 12,
              fontWeight: 600,
              color: '#2b1a07',
              marginBottom: 14,
            }}
          >
            <Video size={14} color="#ff6f1e" /> customized video engine
          </div>

          <h2
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 'clamp(2.2rem, 3.8vw, 3rem)',
              color: '#2b1a07',
              margin: '0 0 14px',
              fontWeight: 600,
              lineHeight: 1.15,
            }}
          >
            videos generated specifically for your learning gaps.
          </h2>

          <p style={{ fontSize: 16, color: '#6b655c', lineHeight: 1.5, margin: 0 }}>
            Instead of forcing every student through the exact same 45-minute generic lecture, our engine detects your
            specific friction points and generates concise, step-by-step animated video lessons based on your individual path.
          </p>
        </div>

        {/* Video Player Card */}
        <div
          style={{
            background: '#fdfbf9',
            border: '1.5px solid #171717',
            borderRadius: 16,
            boxShadow: 'rgba(0, 0, 0, 0.08) 0px 4px 24px 0px',
            overflow: 'hidden',
          }}
        >
          {/* Player Topbar */}
          <div
            style={{
              background: '#f7efe9',
              borderBottom: '1.5px solid #171717',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#22c55e',
                }}
              />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#2b1a07' }}>
                AI Video Lesson: Personalized Algorithm Walkthrough (Varin Engine)
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <span
                style={{
                  background: '#fdfbf9',
                  border: '1px solid rgba(23, 23, 23, 0.15)',
                  padding: '4px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  color: '#6b655c',
                }}
              >
                Generated in 1.4s
              </span>
              <span
                style={{
                  background: '#ff6f1e',
                  color: '#fdfbf9',
                  padding: '4px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                1080p HD
              </span>
            </div>
          </div>

          {/* Embedded Video Element */}
          <div style={{ background: '#000', position: 'relative' }}>
            <video
              controls
              poster="/images/varin_video_poster.jpg"
              src="/videos/varin-demo-video.mp4"
              style={{
                width: '100%',
                maxHeight: '640px',
                display: 'block',
                margin: '0 auto',
                background: '#000',
              }}
            >
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Video Metadata & Capabilities Callouts */}
          <div
            style={{
              padding: 24,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 20,
              background: '#fdfbf9',
            }}
          >
            <div style={{ borderLeft: '3px solid #ff6f1e', paddingLeft: 14 }}>
              <div style={{ fontSize: 12, color: '#6b655c', textTransform: 'lowercase' }}>capability #1</div>
              <div style={{ fontWeight: 700, color: '#2b1a07', fontSize: 15, margin: '2px 0 4px' }}>
                Dynamic Concept Visualizer
              </div>
              <p style={{ fontSize: 13, color: '#6b655c', margin: 0, lineHeight: 1.45 }}>
                Renders graph nodes, pointer movements, and memory stack frames in sync with narrated explanations.
              </p>
            </div>

            <div style={{ borderLeft: '3px solid #3b82f6', paddingLeft: 14 }}>
              <div style={{ fontSize: 12, color: '#6b655c', textTransform: 'lowercase' }}>capability #2</div>
              <div style={{ fontWeight: 700, color: '#2b1a07', fontSize: 15, margin: '2px 0 4px' }}>
                Adaptive Pacing &amp; Depth
              </div>
              <p style={{ fontSize: 13, color: '#6b655c', margin: 0, lineHeight: 1.45 }}>
                Advanced students receive rigorous mathematical proofs; beginners receive intuitive spatial analogies.
              </p>
            </div>

            <div style={{ borderLeft: '3px solid #22c55e', paddingLeft: 14 }}>
              <div style={{ fontSize: 12, color: '#6b655c', textTransform: 'lowercase' }}>capability #3</div>
              <div style={{ fontWeight: 700, color: '#2b1a07', fontSize: 15, margin: '2px 0 4px' }}>
                Direct Coding Arena Sync
              </div>
              <p style={{ fontSize: 13, color: '#6b655c', margin: 0, lineHeight: 1.45 }}>
                The video pauses at key logic forks and prompts you to test your hypothesis in the live editor below.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── NEW SECTION 2: EziLearning on WhatsApp with AI Mentor Owlbert the Owl ── */}
      <section
        id="whatsapp-mentor"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '64px 24px',
          borderTop: '1px solid rgba(23, 23, 23, 0.08)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 40px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 14px',
              borderRadius: 20,
              background: '#f0faf4',
              border: '1.5px solid #22c55e',
              fontSize: 12,
              fontWeight: 600,
              color: '#15803d',
              marginBottom: 14,
            }}
          >
            <MessageCircle size={14} color="#22c55e" /> always at your fingertips
          </div>

          <h2
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 'clamp(2.2rem, 3.8vw, 3rem)',
              color: '#2b1a07',
              margin: '0 0 14px',
              fontWeight: 600,
              lineHeight: 1.15,
            }}
          >
            meet your ai mentor on whatsapp: ezilearning with owlbert 🦉
          </h2>

          <p style={{ fontSize: 16, color: '#6b655c', lineHeight: 1.5, margin: 0 }}>
            Learning shouldn't stop when you close your laptop. Connect your WhatsApp to receive daily morning quizzes,
            extend your streak on the go, and ask tricky technical questions right from your pocket.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 36,
            alignItems: 'center',
          }}
        >
          {/* Left: Interactive WhatsApp Phone Mockup */}
          <div
            style={{
              maxWidth: 420,
              margin: '0 auto',
              width: '100%',
              background: '#efeae2',
              borderRadius: 36,
              border: '4px solid #171717',
              boxShadow: 'rgba(0, 0, 0, 0.16) 0px 12px 32px 0px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: 600,
            }}
          >
            {/* WhatsApp Header */}
            <div
              style={{
                background: '#075e54',
                color: '#fff',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <img
                src="/images/owlbert_avatar.jpg"
                alt="Owlbert the Owl AI Mentor"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #fff',
                  background: '#fff',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                  EziLearning 🦉
                  <span style={{ fontSize: 11, background: '#25d366', color: '#fff', padding: '1px 5px', borderRadius: 6 }}>
                    ✓ Bot
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>Online · Owlbert the Wise Owl</div>
              </div>
            </div>

            {/* WhatsApp Chat Area */}
            <div
              style={{
                flex: 1,
                padding: 16,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                backgroundImage: 'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 0)',
                backgroundSize: '16px 16px',
              }}
            >
              <div
                style={{
                  alignSelf: 'center',
                  background: 'rgba(255, 255, 255, 0.85)',
                  padding: '3px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  color: '#667781',
                  boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
                }}
              >
                Today
              </div>

              {waMessages.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                    background: m.sender === 'user' ? '#d9fdd3' : '#ffffff',
                    color: '#111b21',
                    padding: '8px 12px',
                    borderRadius: 10,
                    maxWidth: '85%',
                    fontSize: 13,
                    lineHeight: 1.45,
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                    position: 'relative',
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                  <div style={{ textAlign: 'right', fontSize: 10, color: '#667781', marginTop: 4 }}>
                    {m.time}
                  </div>
                </div>
              ))}

              {/* Interactive Quiz Buttons inside the WhatsApp mockup */}
              {!selectedQuizOption && (
                <div
                  style={{
                    background: '#fff',
                    padding: 12,
                    borderRadius: 10,
                    border: '1.5px solid #ff6f1e',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2b1a07', marginBottom: 8 }}>
                    👇 Tap to answer Owlbert's morning quiz:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button
                      onClick={() => handleQuizAnswer('A')}
                      style={{
                        background: '#f7efe9',
                        border: '1px solid #171717',
                        borderRadius: 8,
                        padding: '6px 8px',
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: 600,
                      }}
                    >
                      A) O(1)
                    </button>
                    <button
                      onClick={() => handleQuizAnswer('B')}
                      style={{
                        background: '#f7efe9',
                        border: '1.5px solid #22c55e',
                        borderRadius: 8,
                        padding: '6px 8px',
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: 700,
                        color: '#15803d',
                      }}
                    >
                      B) O(log N) ✓
                    </button>
                    <button
                      onClick={() => handleQuizAnswer('C')}
                      style={{
                        background: '#f7efe9',
                        border: '1px solid #171717',
                        borderRadius: 8,
                        padding: '6px 8px',
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: 600,
                      }}
                    >
                      C) O(N)
                    </button>
                    <button
                      onClick={() => handleQuizAnswer('D')}
                      style={{
                        background: '#f7efe9',
                        border: '1px solid #171717',
                        borderRadius: 8,
                        padding: '6px 8px',
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: 600,
                      }}
                    >
                      D) O(N log N)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp Input Bar */}
            <form
              onSubmit={handleSendWa}
              style={{
                background: '#f0f2f5',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderTop: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              <input
                type="text"
                placeholder="Ask Owlbert a doubt..."
                value={waInput}
                onChange={(e) => setWaInput(e.target.value)}
                style={{
                  flex: 1,
                  background: '#fff',
                  border: 'none',
                  borderRadius: 20,
                  padding: '9px 16px',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#00a884',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>

          {/* Right: How WhatsApp AI Mentoring Works */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: '#f7efe9',
                padding: 20,
                borderRadius: 16,
                border: '1.5px solid rgba(23, 23, 23, 0.1)',
                marginBottom: 24,
              }}
            >
              <img
                src="/images/owlbert_avatar.jpg"
                alt="Owlbert Mascot"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  objectFit: 'cover',
                  border: '2px solid #171717',
                  background: '#fff',
                }}
              />
              <div>
                <h3
                  style={{
                    fontFamily: "'DM Serif Display', Georgia, serif",
                    fontSize: 22,
                    color: '#2b1a07',
                    margin: '0 0 4px',
                  }}
                >
                  meet owlbert the wise owl
                </h3>
                <p style={{ fontSize: 13, color: '#6b655c', margin: 0, lineHeight: 1.45 }}>
                  The official EziLearning AI mascot. Owlbert keeps you motivated, explains algorithms in plain English, and
                  never lets you fall behind your roadmap.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: '#25d366',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Flame size={20} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#2b1a07' }}>
                    Daily 60-Second Quizzes
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#6b655c', lineHeight: 1.5 }}>
                    Sent straight to WhatsApp at 8:30 AM every morning. Answer directly in chat to preserve and build your
                    verified practice streak.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: '#ff6f1e',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#2b1a07' }}>
                    Instant Concept Doubts on the Go
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#6b655c', lineHeight: 1.5 }}>
                    Stuck during class or commuting? Send a voice note or code snippet. Owlbert breaks down time complexities and
                    edge cases without giving away solutions.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: '#171717',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Target size={20} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#2b1a07' }}>
                    Automated Study Plan Reminders
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#6b655c', lineHeight: 1.5 }}>
                    If you haven't reviewed today's scheduled topic by 7 PM, Owlbert sends a gentle nudge with a 3-minute summary
                    so you stay on track.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 28, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowQrModal(true)}
                style={{
                  background: '#25d366',
                  color: '#fff',
                  border: '1.5px solid #171717',
                  borderRadius: 20,
                  padding: '12px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: 'rgba(0, 0, 0, 0.25) 0px 1px 2px 0px',
                }}
              >
                <QrCode size={16} /> Connect Your WhatsApp
              </button>

              <a
                href="https://wa.me/?text=Hi%20Owlbert!%20Connect%20me%20to%20Easy%20Learning"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#fdfbf9',
                  border: '1.5px solid #171717',
                  borderRadius: 20,
                  padding: '12px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#171717',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                Open in WhatsApp Web <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* QR Code Connection Modal */}
        {showQrModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(23, 23, 23, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 20,
            }}
          >
            <div
              style={{
                background: '#fdfbf9',
                border: '2px solid #171717',
                borderRadius: 20,
                padding: 32,
                maxWidth: 420,
                width: '100%',
                textAlign: 'center',
                boxShadow: 'rgba(0, 0, 0, 0.25) 0px 8px 32px 0px',
              }}
            >
              <img
                src="/images/owlbert_avatar.jpg"
                alt="Owlbert the Owl"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  margin: '0 auto 12px',
                  border: '2px solid #171717',
                }}
              />
              <h3
                style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: 24,
                  color: '#2b1a07',
                  margin: '0 0 6px',
                }}
              >
                connect to ezilearning 🦉
              </h3>
              <p style={{ fontSize: 13, color: '#6b655c', margin: '0 0 20px', lineHeight: 1.45 }}>
                Scan the QR code on your phone's WhatsApp to pair your account with Owlbert and receive daily quizzes.
              </p>

              {/* Mock QR Code Card */}
              <div
                style={{
                  background: '#f7efe9',
                  border: '1.5px solid #171717',
                  borderRadius: 16,
                  padding: 24,
                  display: 'inline-block',
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    width: 180,
                    height: 180,
                    background: '#171717',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fdfbf9',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    padding: 12,
                    textAlign: 'center',
                  }}
                >
                  [QR CODE: WA-EZI-AI-BOT#98765]
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={() => setShowQrModal(false)}
                  style={{
                    background: '#fdfbf9',
                    border: '1.5px solid #171717',
                    borderRadius: 20,
                    padding: '8px 24px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Interactive Coding Arena ── */}
      <section
        id="coding-arena"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '64px 24px',
          borderTop: '1px solid rgba(23, 23, 23, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 28,
                color: '#2b1a07',
                margin: '0 0 6px',
              }}
            >
              interactive coding arena: live test execution
            </h2>
            <p style={{ fontSize: 14, color: '#6b655c', margin: 0 }}>
              Edit the Python solution and click <strong>Run tests</strong> to execute against verified test cases.
            </p>
          </div>
          <button
            onClick={handleRunCode}
            disabled={isRunningCode}
            style={{
              background: '#fdfbf9',
              border: '1.5px solid #171717',
              borderRadius: 20,
              padding: '10px 22px',
              fontSize: 14,
              fontWeight: 600,
              color: '#171717',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: 'rgba(0, 0, 0, 0.25) 0px 1px 2px 0px',
            }}
          >
            <Play size={14} fill="#ff6f1e" color="#ff6f1e" />
            {isRunningCode ? 'Running...' : 'Run tests (Ctrl + Enter)'}
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 20,
            background: '#171717',
            borderRadius: 14,
            padding: 20,
            color: '#fdfbf9',
            boxShadow: 'rgba(0, 0, 0, 0.15) 0px 4px 20px 0px',
          }}
        >
          {/* Left: Code Editor */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 12,
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: 12,
                fontSize: 12,
                color: '#bebcbb',
              }}
            >
              <span style={{ fontWeight: 600 }}>solution.py — Two Sum (Python 3.12)</span>
              <span>Time limit: 2000ms</span>
            </div>
            <textarea
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              rows={11}
              style={{
                width: '100%',
                background: 'transparent',
                color: '#fdfbf9',
                fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                fontSize: 13,
                border: 'none',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Right: Test Results / Problem Spec */}
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: 20 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#bebcbb',
                paddingBottom: 12,
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: 12,
              }}
            >
              Test Case Verification Output
            </div>

            {testOutput ? (
              <pre
                style={{
                  fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                  fontSize: 12,
                  color: '#22c55e',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                }}
              >
                {testOutput}
              </pre>
            ) : (
              <div style={{ color: '#bebcbb', fontSize: 13, lineHeight: 1.6 }}>
                <p>
                  <strong>Problem:</strong> Given an array of integers <code style={{ color: '#ff6f1e' }}>nums</code> and an integer{' '}
                  <code style={{ color: '#ff6f1e' }}>target</code>, return indices of the two numbers such that they add up to target.
                </p>
                <p>
                  Click <strong>Run tests</strong> above to execute your solution in the browser.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Learning Analytics & Campus Leaderboard ── */}
      <section
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '48px 24px 64px',
          borderTop: '1px solid rgba(23, 23, 23, 0.08)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 32,
          }}
        >
          {/* Analytics Chart */}
          <div
            style={{
              background: '#fdfbf9',
              border: '1.5px solid rgba(23, 23, 23, 0.12)',
              borderRadius: 16,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3
                  style={{
                    fontFamily: "'DM Serif Display', Georgia, serif",
                    fontSize: 22,
                    color: '#2b1a07',
                    margin: '0 0 4px',
                  }}
                >
                  weekly learning velocity
                </h3>
                <div style={{ fontSize: 12, color: '#6b655c' }}>
                  Hours practiced vs. verified problems solved
                </div>
              </div>
              <span
                style={{
                  background: '#f7efe9',
                  border: '1px solid rgba(23, 23, 23, 0.1)',
                  borderRadius: 20,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#2b1a07',
                }}
              >
                Last 7 Days
              </span>
            </div>

            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={WEEKLY_HOURS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(23, 23, 23, 0.06)" />
                  <XAxis dataKey="day" stroke="#6b655c" fontSize={11} />
                  <YAxis stroke="#6b655c" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: '#fdfbf9',
                      border: '1.5px solid #171717',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="hours" name="Hours Practiced" fill="#ff6f1e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="problems" name="Problems Solved" fill="#171717" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Campus Competition Leaderboard */}
          <div
            style={{
              background: '#fdfbf9',
              border: '1.5px solid rgba(23, 23, 23, 0.12)',
              borderRadius: 16,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3
                  style={{
                    fontFamily: "'DM Serif Display', Georgia, serif",
                    fontSize: 22,
                    color: '#2b1a07',
                    margin: '0 0 4px',
                  }}
                >
                  campus sprint leaderboard #14
                </h3>
                <div style={{ fontSize: 12, color: '#6b655c' }}>
                  Live rankings across 45 participating engineering colleges
                </div>
              </div>
              <span style={{ fontSize: 12, color: '#ff6f1e', fontWeight: 600 }}>24 hrs left</span>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {LEADERBOARD.map((item) => (
                <div
                  key={item.rank}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: item.rank === 2 ? '#fef8f4' : '#f7efe9',
                    border: item.rank === 2 ? '1.5px solid #ff6f1e' : '1px solid rgba(23, 23, 23, 0.06)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, width: 22 }}>#{item.rank}</span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#2b1a07' }}>{item.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                    <span style={{ color: '#ff6f1e', fontWeight: 700 }}>{item.score} XP</span>
                    <span>🔥 {item.streak}d</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer Brand Band (Superr signature: full-width #ff6f1e with 56px top radius) ── */}
      <footer
        style={{
          background: '#ff6f1e',
          borderRadius: '56px 56px 0 0',
          padding: '64px 24px 48px',
          color: '#fdfbf9',
          marginTop: 64,
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              margin: '0 0 16px',
              fontWeight: 600,
              lineHeight: 1.1,
              color: '#fdfbf9',
            }}
          >
            ready to build real engineering momentum?
          </h2>

          <p
            style={{
              fontSize: 18,
              maxWidth: 580,
              margin: '0 auto 32px',
              opacity: 0.95,
              lineHeight: 1.5,
            }}
          >
            Join over 2,800 students bridging the gap between theory and industry opportunities.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 48 }}>
            <Link
              to="/onboarding"
              style={{
                background: '#fdfbf9',
                color: '#171717',
                border: '1.5px solid #171717',
                borderRadius: 20,
                padding: '12px 32px',
                fontSize: 16,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: 'rgba(0, 0, 0, 0.25) 0px 2px 4px 0px',
              }}
            >
              start learning now
            </Link>
            <Link
              to="/"
              style={{
                background: 'transparent',
                color: '#fdfbf9',
                border: '1.5px solid #fdfbf9',
                borderRadius: 20,
                padding: '12px 32px',
                fontSize: 16,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              open student dashboard
            </Link>
          </div>

          <div
            style={{
              paddingTop: 32,
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              fontSize: 13,
              opacity: 0.85,
            }}
          >
            <div>© {new Date().getFullYear()} EziLearning — The Unified Practical Learning Ecosystem.</div>
            <div style={{ display: 'flex', gap: 20 }}>
              <Link to="/roadmap" style={{ color: '#fdfbf9', textDecoration: 'none' }}>
                roadmap
              </Link>
              <Link to="/challenges" style={{ color: '#fdfbf9', textDecoration: 'none' }}>
                coding
              </Link>
              <Link to="/resume" style={{ color: '#fdfbf9', textDecoration: 'none' }}>
                resume
              </Link>
              <Link to="/jobs" style={{ color: '#fdfbf9', textDecoration: 'none' }}>
                applications
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
