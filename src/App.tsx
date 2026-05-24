import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DesktopNotifications } from './components/layout/DesktopNotifications';
import { useRepos, useRecordSnapshots } from './hooks/useGitHubQuery';
import { useMonitoredRepos } from './hooks/useMonitoredRepos';

const OverviewPage = lazy(() =>
  import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
);
const RepositoriesPage = lazy(() =>
  import('./pages/RepositoriesPage').then((m) => ({ default: m.RepositoriesPage })),
);
const PullRequestsPage = lazy(() =>
  import('./pages/PullRequestsPage').then((m) => ({ default: m.PullRequestsPage })),
);
const ActionsPage = lazy(() =>
  import('./pages/ActionsPage').then((m) => ({ default: m.ActionsPage })),
);
const IssuesPage = lazy(() =>
  import('./pages/IssuesPage').then((m) => ({ default: m.IssuesPage })),
);
const ReviewQueuePage = lazy(() =>
  import('./pages/ReviewQueuePage').then((m) => ({ default: m.ReviewQueuePage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const InsightsPage = lazy(() =>
  import('./pages/InsightsPage').then((m) => ({ default: m.InsightsPage })),
);

const SecurityPage = lazy(() =>
  import('./pages/SecurityPage').then((m) => ({ default: m.SecurityPage })),
);
const KanbanPage = lazy(() =>
  import('./pages/KanbanPage').then((m) => ({ default: m.KanbanPage })),
);
const CIHealthPage = lazy(() =>
  import('./pages/CIHealthPage').then((m) => ({ default: m.CIHealthPage })),
);

function App() {
  const { data: repoData } = useRepos();
  const { monitoredRepos, setAll } = useMonitoredRepos();
  const recordSnapshots = useRecordSnapshots();

  useEffect(() => {
    if (repoData && repoData.length > 0 && monitoredRepos.length === 0) {
      setAll(repoData.map((r: any) => r.full_name));
    }
  }, [repoData, monitoredRepos.length, setAll]);

  useEffect(() => {
    if (repoData && repoData.length > 0) {
      const payload = repoData.map((r: any) => ({
        full_name: r.full_name,
        stargazers_count: r.stargazers_count || 0,
        forks_count: r.forks_count || 0,
        open_issues_count: r.open_issues_count || 0,
      }));
      recordSnapshots.mutate(payload);
    }
  }, [repoData]);

  return (
    <Layout>
      <DesktopNotifications />
      <Suspense fallback={<div />}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/repositories" element={<RepositoriesPage />} />
          <Route path="/insights" element={<InsightsPage />} />

          <Route path="/pull-requests" element={<PullRequestsPage />} />
          <Route path="/actions" element={<ActionsPage />} />
          <Route path="/issues" element={<IssuesPage />} />

          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/ci-health" element={<CIHealthPage />} />
          <Route path="/review-queue" element={<ReviewQueuePage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default App;
