import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataLoadingBar } from './components/DataLoadingBar';
import { MinimalAppChrome } from './components/Layout/MinimalAppChrome';
import { DashboardLayout } from './components/Layout/DashboardLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ResumePage } from './pages/ResumePage';
import { JobsPage } from './pages/JobsPage';
import { CodingChallengePage } from './pages/CodingChallengePage';
import { QuestionsPage } from './pages/QuestionsPage';
import { StudyPlanPage } from './pages/StudyPlanPage';
import { ProfilePage } from './pages/ProfilePage';
import { RoadmapPage } from './pages/RoadmapPage';
import { NotesPage } from './pages/NotesPage';
import { NotesDayViewPage } from './pages/NotesDayViewPage';
import { ChallengesPage } from './pages/ChallengesPage';
import { LevelDetailPage } from './pages/LevelDetailPage';
import { GrowthTrackPage } from './pages/GrowthTrackPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DailyLessonVisualPage } from './pages/DailyLessonVisualPage';
import { CpPortfolioPage } from './pages/CpPortfolioPage';
import { PublicCpPortfolioPage } from './pages/PublicCpPortfolioPage';
import { ShowcasePage } from './pages/ShowcasePage';
import { PitchDeckPage } from './pages/PitchDeckPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DataLoadingBar />
      <BrowserRouter>
        <Routes>
          <Route path="/pitch" element={<PitchDeckPage />} />
          <Route path="/deck" element={<PitchDeckPage />} />
          <Route path="/showcase" element={<ShowcasePage />} />
          <Route path="/demo" element={<ShowcasePage />} />
          <Route
            path="/onboarding"
            element={
              <MinimalAppChrome>
                <OnboardingPage />
              </MinimalAppChrome>
            }
          />
          <Route
            path="/study/day/:dayId/visual"
            element={
              <MinimalAppChrome>
                <DailyLessonVisualPage />
              </MinimalAppChrome>
            }
          />
          <Route
            path="/p/:slug"
            element={
              <MinimalAppChrome>
                <PublicCpPortfolioPage />
              </MinimalAppChrome>
            }
          />
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="resume" element={<ResumePage />} />
            <Route path="challenges" element={<ChallengesPage />} />
            <Route path="challenges/:challengeId" element={<CodingChallengePage />} />
            <Route path="growth" element={<GrowthTrackPage />} />
            <Route path="levels/:levelNumber" element={<LevelDetailPage />} />
            <Route path="levels" element={<Navigate to="/growth?focus=levels" replace />} />
            <Route path="goals" element={<Navigate to="/growth?focus=goals" replace />} />
            <Route path="progress" element={<Navigate to="/growth?focus=activity" replace />} />
            <Route path="questions" element={<QuestionsPage />} />
            <Route path="roadmap" element={<RoadmapPage />} />
            <Route path="study" element={<StudyPlanPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="study/notes/:dayId" element={<NotesDayViewPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="cp-portfolio" element={<CpPortfolioPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
