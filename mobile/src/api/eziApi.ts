import { apiGet } from './client';
import type { ChallengeDetail, ChallengeSummary, HealthResponse } from './types';

export function fetchHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/health');
}

export function fetchChallenges(): Promise<ChallengeSummary[]> {
  return apiGet<ChallengeSummary[]>('/challenges');
}

export function fetchChallenge(id: string): Promise<ChallengeDetail> {
  return apiGet<ChallengeDetail>(`/challenges/${encodeURIComponent(id)}`);
}
