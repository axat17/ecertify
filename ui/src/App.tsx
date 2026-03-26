import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useAuthStore } from '@/store/authStore';

// ─── Lazy load pages ──────────────────────────────────────────
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const HomePage = lazy(() => import('@/pages/HomePage'));
const ProjectPage = lazy(() => import('@/pages/ProjectPage'));
const CertSessionPage = lazy(() => import('@/pages/CertSessionPage'));
const ActiveSessionsPage = lazy(() => import('@/pages/ActiveSessionsPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const Layout = lazy(() => import('@/components/layout/Layout'));

// ─── React Query Client ───────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 min before refetch
      gcTime: 1000 * 60 * 10,          // 10 min cache
      retry: 2,
      refetchOnWindowFocus: false,
      throwOnError: false,             // handle errors in component
    },
    mutations: {
      retry: 0,
    },
  },
});

// ─── Auth guard ───────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// ─── Loading fallback ─────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f0f2f7' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#121c4e', marginBottom: 8 }}>ReleaseIQ</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Loading...</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Certification join via shared link — no auth required to land on it
                (the page itself will prompt for name/role before creating session) */}
            <Route path="/cert/:sessionId" element={<CertSessionPage />} />

            {/* Protected routes */}
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route path="/" element={<HomePage />} />
              <Route path="/projects/:projectId" element={<ProjectPage />} />
              <Route path="/projects/:projectId/sessions" element={<ActiveSessionsPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
