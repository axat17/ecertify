import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useAuthStore } from '@/store/authStore';

const LoginPage       = lazy(() => import('@/apps/auth/LoginPage'));
const HomePage        = lazy(() => import('@/apps/dashboard/HomePage'));
const ProjectPage     = lazy(() => import('@/apps/project/ProjectPage'));
const CertSessionPage = lazy(() => import('@/apps/certification/CertSessionPage'));
const ActiveSessions  = lazy(() => import('@/apps/certification/ActiveSessionsPage'));
const AdminPage       = lazy(() => import('@/apps/admin/AdminPage'));
const Layout          = lazy(() => import('@/layout/Layout'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000*60*2, gcTime: 1000*60*10, retry: 2, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PageLoader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#f0f2f7', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:22, fontWeight:800, color:'#121c4e', marginBottom:8 }}>ReleaseIQ</div>
        <div style={{ fontSize:13, color:'#6b7280' }}>Loading…</div>
      </div>
    </div>
  );
}

const GLOBAL_CSS = `
  @keyframes riq-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes riq-spin   { to{transform:rotate(360deg)} }
  @keyframes riq-fadeup { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  *{ box-sizing:border-box; margin:0; padding:0; }
  body{ font-family:'DM Sans',sans-serif; background:#f0f2f7; color:#111827; }
  ::-webkit-scrollbar{ width:5px; height:5px; }
  ::-webkit-scrollbar-track{ background:transparent; }
  ::-webkit-scrollbar-thumb{ background:#c8cedf; border-radius:4px; }
  a{ text-decoration:none; }
  input,textarea,select,button{ font-family:inherit; }
`;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <style>{GLOBAL_CSS}</style>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login"          element={<LoginPage />} />
            <Route path="/cert/:sessionId" element={<CertSessionPage />} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route path="/"                             element={<HomePage />} />
              <Route path="/projects/:projectId"          element={<ProjectPage />} />
              <Route path="/projects/:projectId/sessions" element={<ActiveSessions />} />
              <Route path="/admin"                        element={<AdminPage />} />
              <Route path="*"                             element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
