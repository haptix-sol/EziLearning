import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataLoadingBar } from './components/DataLoadingBar';
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
import { VideoTutorialPage } from './pages/VideoTutorialPage';
import { MyGoalsPage } from './pages/MyGoalsPage';
import { ChallengesPage } from './pages/ChallengesPage';
import { ProgressPage } from './pages/ProgressPage';
import { LevelMapPage } from './pages/LevelMapPage';
import { LevelDetailPage } from './pages/LevelDetailPage';

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
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="resume" element={<ResumePage />} />
            <Route path="challenges" element={<ChallengesPage />} />
            <Route path="challenges/:challengeId" element={<CodingChallengePage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="levels" element={<LevelMapPage />} />
            <Route path="levels/:levelNumber" element={<LevelDetailPage />} />
            <Route path="questions" element={<QuestionsPage />} />
            <Route path="roadmap" element={<RoadmapPage />} />
            <Route path="goals" element={<MyGoalsPage />} />
            <Route path="study" element={<StudyPlanPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="videos" element={<VideoTutorialPage />} />
            <Route path="jobs" element={<JobsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
