/** Mirrors `ChallengeResponse` / `ChallengeDetailResponse` from the FastAPI backend. */

export interface TestCase {
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

export interface ChallengeSummary {
  id: string;
  title: string;
  description: string;
  difficulty: string | null;
  language: string;
  starter_code: string | null;
  test_cases: TestCase[];
  required_skills: string[] | null;
  topics: string[];
  time_limit_seconds: number;
  created_at: string;
  animation_url?: string | null;
}

export type ChallengeDetail = ChallengeSummary;

export interface HealthResponse {
  status: string;
  llm_provider: string | null;
}
