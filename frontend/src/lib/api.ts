import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: string | null;
  language: string;
  starter_code: string | null;
  test_cases: { input: string; expected_output: string; is_hidden: boolean }[];
  required_skills: string[];
  time_limit_seconds: number;
  created_at: string;
  animation_url?: string | null;  // Varin prerender when topic matches
}

export interface Question {
  id: string;
  question_text: string;
  answer_text: string | null;
  skill_name: string;
  difficulty: string | null;
  category: string | null;
  created_at: string;
}

export interface Execution {
  id: string;
  status: string;
  stdout: string | null;
  stderr: string | null;
  test_results: { passed: boolean; input?: string; expected?: string; actual?: string }[] | null;
  execution_time_ms: number | null;
  created_at: string;
}

export interface Progress {
  challenges_completed: number;
  questions_answered: number;
  total_time_minutes: number;
  skills_strength: Record<string, number> | null;
}

export interface ResumeProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  experience_level: string | null;
  years_experience: number | null;
  target_role: string | null;
  target_industry: string | null;
  education_summary: string | null;
  professional_summary: string | null;
  avatar_url?: string | null;
  skills: { skill_name: string; category: string | null; confidence: number | null }[];
  created_at: string;
}

export interface ResumeData {
  id: string;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
  profile: ResumeProfile | null;
}

export interface StudyPlan {
  id: string;
  duration_days: number;
  plan_type: string;
  focus_area: string | null;
  created_at: string;
  total_days: number;
  completed_days: number;
}

export interface TopicVideoStatus {
  topic: string;
  video_id: string | null;
  status: 'completed' | 'generating' | 'failed' | 'none';
  url: string | null;
  captions_url?: string | null;
  progress_percent: number;
  status_message?: string | null;
  segments_done?: number | null;
  segments_total?: number | null;
  is_static?: boolean;
  estimated_seconds_remaining?: number | null;
}

export interface DayPlan {
  id: string;
  day_number: number;
  title: string;
  topics: string[];
  subtopics?: Record<string, string[]>;
  topic_videos?: TopicVideoStatus[];
  notes: string | null;
  duration_minutes: number;
  activity_type: string;
  level: number;
  is_completed: boolean;
  xp_earned: number | null;
  challenge_id?: string | null;
}

export interface McqOption {
  id: string;
  text: string;
}

export interface Mcq {
  id: string;
  question_text: string;
  options: McqOption[];
  order_index: number;
  answered?: boolean;
  is_correct?: boolean | null;
}

export interface EarnedBadge {
  role_name: string;
  goal_id: string;
}

export interface LevelProgress {
  level: number;
  xp: number;
  xp_to_next_level: number;
  progress_percent: number;
  streak_days: number;
}

export interface JobStatusUpdate {
  date: string;
  status: string;
  message?: string | null;
  email_id?: string | null;
}

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  sector: string;
  source: string;
  status: string;
  applied_date: string | null;
  notification_date?: string | null;
  notification_type?: string | null;
  notes: string | null;
  external_id?: string | null;
  status_updates?: JobStatusUpdate[] | null;
  company_details?: Record<string, string> | null;
  government_portal?: string | null;
  portal_username?: string | null;
  portal_password_masked?: boolean;
  last_synced_at?: string | null;
  created_at: string;
}
