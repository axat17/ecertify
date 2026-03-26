import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, projectApi } from '@/services/api';
import type { Project, AdminRequest, ErrorLogEntry, User } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const ADP_RED = '#d0271d';
const ADP_BLUE = '#121c4e';

export default function AdminPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();
  const [activePanel, setActivePanel] = useState('dashboard');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const isMainAdmin = user?.role === 'main-admin';

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectApi.list,
  });

  const { data: requestsResponse } = useQuery({
    queryKey: ['adminRequests'],
    queryFn: adminApi.getRequests,
    enabled: isMainAdmin,
  });
  const requests: AdminRequest[] = requestsResponse?.data || [];
  const pendingRequests = requests.filter(r => r.status === 'pending');

  const { data: errorLogs = [] } = useQuery<ErrorLogEntry[]>({
    queryKey: ['errorLogs'],
    queryFn: () => adminApi.getErrors(),
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['allUsers'],
    queryFn: adminApi.getUsers,
    enabled: isMainAdmin,
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => adminApi.approveRequest(requestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminRequests'] }),
  });

  const denyMutation = useMutation({
    mutationFn: (requestId: string) => adminApi.denyRequest(requestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminRequests'] }),
  });

  const clearErrorsMutation = useMutation({
    mutationFn: adminApi.clearErrors,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['errorLogs'] }),
  });

  const resolveErrorMutation = useMutation({
    mutationFn: (id: string) => adminApi.resolveError(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['errorLogs'] }),
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) => projectApi.update(id, data),
    onSuccess: () => {
      setSaveStatus('saved');
      qc.invalidateQueries({ queryKey: ['projects'] });
      setTimeout(() => setSaveStatus(''), 3000);
    },
    onError: () => setSaveStatus('error'),
  });

  const toggleLiveMutation = useMutation({
    mutationFn: (projectId: string) => projectApi.toggleLive(projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: Partial<Project>) => projectApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setActivePanel('all-projects');
    },
  });

  const adminableProjects = projects.filter((p: Project) =>
    isMainAdmin || user?.projectAdminOf?.includes(p.projectId)
  );

  function handleSaveProject(p: Project, formData: Record<string, any>) {
    setSaveStatus('saving');
    updateProjectMutation.mutate({ id: p.projectId, data: formData });
  }

  return (
    <div style={{ padding: 24, maxWidth: 1300, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>⚙️ Admin Panel</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Signed in as <strong>{user?.name}</strong> ·{' '}
            <span style={{ color: user?.role === 'main-admin' ? ADP_RED : '#2060d8', fontWeight: 600 }}>
              {user?.role === 'main-admin' ? '★ Main Admin' : 'Project Admin'}
            </span>
          </div>
        </div>
        {isMainAdmin && (
          <button
            onClick={() => setActivePanel('create-project')}
            style={{ marginLeft: 'auto', background: ADP_RED, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
          >
            ➕ New Project
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        {/* Sidebar nav */}
        <div style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 12, overflow: 'hidden' }}>
          {isMainAdmin && (
            <>
              <NavItem label="🏠 Dashboard" active={activePanel === 'dashboard'} onClick={() => setActivePanel('dashboard')} />
              <NavItem label="📋 All Projects" active={activePanel === 'all-projects'} onClick={() => setActivePanel('all-projects')} />
              <NavItem label={`🔑 Access Requests ${pendingRequests.length ? `(${pendingRequests.length})` : ''}`} active={activePanel === 'access-requests'} onClick={() => setActivePanel('access-requests')} badge={pendingRequests.length} />
              <NavItem label="👥 Users" active={activePanel === 'users'} onClick={() => setActivePanel('users')} />
              <NavItem label={`🔴 Error Log ${errorLogs.filter(e => !e.resolved).length ? `(${errorLogs.filter(e => !e.resolved).length})` : ''}`} active={activePanel === 'error-log'} onClick={() => setActivePanel('error-log')} />
              <div style={{ height: 1, background: '#e0e4ef', margin: '4px 0' }} />
            </>
          )}
          <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1.2px', padding: '10px 16px 4px' }}>
            Project Settings
          </div>
          {adminableProjects.map((p: Project) => (
            <NavItem
              key={p.projectId}
              label={`${p.icon} ${p.shortName}`}
              active={activePanel === `proj-${p.projectId}`}
              onClick={() => { setActivePanel(`proj-${p.projectId}`); setSelectedProject(p); }}
            />
          ))}
          <div style={{ height: 1, background: '#e0e4ef', margin: '4px 0' }} />
          <NavItem
            label="🔑 Request Admin Access"
            active={false}
            onClick={() => setActivePanel('request-access')}
            style={{ color: '#2060d8' }}
          />
        </div>

        {/* Main panel */}
        <div>
          {/* ── Dashboard ── */}
          {activePanel === 'dashboard' && isMainAdmin && (
            <div>
              <Section title="📊 Platform Overview">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  {[
                    { l: 'Projects', v: projects.length, c: '#2060d8' },
                    { l: 'Live Now', v: projects.filter((p: Project) => p.isLive).length, c: '#18a057' },
                    { l: 'Pending Requests', v: pendingRequests.length, c: pendingRequests.length > 0 ? '#d4840a' : '#18a057' },
                    { l: 'Unresolved Errors', v: errorLogs.filter(e => !e.resolved).length, c: errorLogs.filter(e => !e.resolved).length > 0 ? ADP_RED : '#18a057' },
                  ].map(s => (
                    <div key={s.l} style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{s.l}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="🔒 SSO Configuration">
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 14, fontSize: 12, color: '#1d4ed8', lineHeight: 1.7 }}>
                  All ADP employees with valid Azure AD credentials can access ReleaseIQ.
                  Set <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: 3 }}>AUTH_MODE=azure</code> in your environment config and configure the Azure app registration below.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Azure Tenant ID"><input defaultValue="adp.onmicrosoft.com" style={inputStyle} readOnly /></Field>
                  <Field label="App Registration"><input defaultValue="releaseiq-prod" style={inputStyle} readOnly /></Field>
                </div>
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  SSO configuration is managed via environment config files. See <code>src/config/env/.env.production</code>.
                </p>
              </Section>
              <Section title="👤 Main Admin Roles">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {allUsers.filter(u => u.role === 'main-admin').map(u => (
                    <div key={u.email} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: ADP_RED, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{u.initials}</div>
                      <div><div style={{ fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 10, color: '#9ca3af' }}>{u.email}</div></div>
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: ADP_RED }}>★ Main Admin</span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ── All Projects ── */}
          {activePanel === 'all-projects' && (
            <Section title="All Projects">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Project', 'Type', 'Owner', 'Admins', 'Last Sync', 'Live', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid #e0e4ef', background: '#f8f9fc' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p: Project, i: number) => (
                    <tr key={p.projectId} style={{ background: i % 2 === 0 ? '#fff' : 'rgba(0,0,0,.01)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{p.icon}</span>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{p.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: p.type === 'salesforce' ? '#eff6ff' : '#ccfbf1', color: p.type === 'salesforce' ? '#2060d8' : '#0d9488', border: `1px solid ${p.type === 'salesforce' ? '#bfdbfe' : '#99f6e4'}`, borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{p.type}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 11, color: '#6b7280' }}>{p.ownerEmail}</td>
                      <td style={{ padding: '12px 14px', fontSize: 10, color: '#9ca3af' }}>{(p.adminEmails || []).length} admin{(p.adminEmails || []).length !== 1 ? 's' : ''}</td>
                      <td style={{ padding: '12px 14px', fontSize: 10, color: p.syncStatus === 'synced' ? '#18a057' : p.syncStatus === 'error' ? ADP_RED : '#d4840a' }}>
                        {p.syncStatus === 'synced' ? '✓ Synced' : p.syncStatus === 'error' ? '✗ Error' : p.syncStatus === 'never' ? '— Never' : '⚠ Stale'}
                        {p.lastJiraSync && <div style={{ fontSize: 9, color: '#9ca3af' }}>{new Date(p.lastJiraSync).toLocaleString()}</div>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 18, color: p.isLive ? '#18a057' : '#e0e4ef' }}>●</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setSelectedProject(p); setActivePanel(`proj-${p.projectId}`); }} style={{ background: '#f0f2f7', border: '1px solid #e0e4ef', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>Configure</button>
                          <button onClick={() => toggleLiveMutation.mutate(p.projectId)} style={{ background: p.isLive ? '#fef2f2' : '#f0fdf4', border: `1px solid ${p.isLive ? '#fecaca' : '#bbf7d0'}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: p.isLive ? ADP_RED : '#18a057' }}>
                            {p.isLive ? 'Set Offline' : 'Set Live'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── Access Requests ── */}
          {activePanel === 'access-requests' && (
            <Section title="🔑 Admin Access Requests">
              {pendingRequests.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20 }}>No pending requests ✓</p>}
              {pendingRequests.map(r => (
                <div key={r.requestId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.requesterName} <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 11 }}>({r.requesterEmail})</span></div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Project: <strong>{r.projectName}</strong> · {new Date(r.createdAt).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#374151', marginTop: 4, maxWidth: 480 }}>{r.reason}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                    <button onClick={() => approveMutation.mutate(r.requestId)} disabled={approveMutation.isPending} style={{ background: '#18a057', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✓ Approve</button>
                    <button onClick={() => denyMutation.mutate(r.requestId)} disabled={denyMutation.isPending} style={{ background: '#fef2f2', color: ADP_RED, border: '1px solid #fecaca', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✗ Deny</button>
                  </div>
                </div>
              ))}
              {requests.filter(r => r.status !== 'pending').length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginTop: 20, marginBottom: 8 }}>Resolved</div>
                  {requests.filter(r => r.status !== 'pending').map(r => (
                    <div key={r.requestId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 8, padding: '10px 14px', marginBottom: 8, opacity: .7 }}>
                      <div style={{ fontSize: 12 }}><strong>{r.requesterEmail}</strong> — {r.projectName}</div>
                      <span style={{ background: r.status === 'approved' ? '#f0fdf4' : '#fef2f2', color: r.status === 'approved' ? '#18a057' : ADP_RED, border: `1px solid ${r.status === 'approved' ? '#bbf7d0' : '#fecaca'}`, borderRadius: 12, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>
                        {r.status === 'approved' ? '✓ Approved' : '✗ Denied'}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </Section>
          )}

          {/* ── Users ── */}
          {activePanel === 'users' && (
            <Section title="👥 All Users">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Name', 'Email', 'Role', 'Admin Of', 'Last Login', 'Active'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid #e0e4ef', background: '#f8f9fc' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {allUsers.map((u: User, i: number) => (
                    <tr key={u.email} style={{ background: i % 2 === 0 ? '#fff' : 'rgba(0,0,0,.01)' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.role === 'main-admin' ? ADP_RED : '#2060d8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{u.initials}</div>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 11, color: '#6b7280' }}>{u.email}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ background: u.role === 'main-admin' ? '#fef2f2' : u.role === 'project-admin' ? '#eff6ff' : '#f8f9fc', color: u.role === 'main-admin' ? ADP_RED : u.role === 'project-admin' ? '#2060d8' : '#9ca3af', border: `1px solid ${u.role === 'main-admin' ? '#fecaca' : u.role === 'project-admin' ? '#bfdbfe' : '#e0e4ef'}`, borderRadius: 12, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>
                          {u.role === 'main-admin' ? '★ Main Admin' : u.role === 'project-admin' ? 'Project Admin' : 'User'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 10, color: '#9ca3af' }}>{u.projectAdminOf?.join(', ') || '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 10, color: '#9ca3af' }}>—</td>
                      <td style={{ padding: '11px 14px' }}><span style={{ color: '#18a057' }}>●</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── Error Log ── */}
          {activePanel === 'error-log' && (
            <Section title="🔴 Error Log" action={
              <button onClick={() => { if (window.confirm('Clear all error logs?')) clearErrorsMutation.mutate(); }} style={{ background: '#fef2f2', color: ADP_RED, border: '1px solid #fecaca', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Clear All</button>
            }>
              {errorLogs.length === 0 && <p style={{ textAlign: 'center', color: '#18a057', padding: 20, fontSize: 13 }}>✓ No errors logged</p>}
              {errorLogs.map(e => (
                <div key={e._id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', opacity: e.resolved ? .5 : 1 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 11, color: e.level === 'error' ? ADP_RED : '#d4840a' }}>{e.context}</span>
                      {e.projectId && <span style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 12, padding: '1px 7px', fontSize: 10, color: '#9ca3af' }}>{e.projectId}</span>}
                      {e.resolved && <span style={{ fontSize: 10, color: '#18a057' }}>✓ Resolved</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#374151' }}>{e.message}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{new Date(e.createdAt).toLocaleString()}</div>
                  </div>
                  {!e.resolved && (
                    <button onClick={() => resolveErrorMutation.mutate(e._id)} style={{ background: '#f0fdf4', color: '#18a057', border: '1px solid #bbf7d0', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 10, fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>
                      Mark Resolved
                    </button>
                  )}
                </div>
              ))}
              <div style={{ marginTop: 16, background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#6b7280' }}>
                <strong>Auto-Retry Policy:</strong> All Jira/Copado API calls retry up to 3 times with exponential backoff (1s, 2s, 3s) before logging here. Stale cached data is served during outages.
              </div>
            </Section>
          )}

          {/* ── Project Admin Panel ── */}
          {activePanel.startsWith('proj-') && selectedProject && (
            <ProjectAdminPanel
              project={selectedProject}
              onSave={handleSaveProject}
              saveStatus={saveStatus}
              onToggleLive={() => toggleLiveMutation.mutate(selectedProject.projectId)}
              showSecrets={showSecrets}
              toggleSecret={(k) => setShowSecrets(s => ({ ...s, [k]: !s[k] }))}
            />
          )}

          {/* ── Request Access ── */}
          {activePanel === 'request-access' && (
            <RequestAccessPanel projects={projects} userEmail={user?.email || ''} />
          )}

          {/* ── Create Project ── */}
          {activePanel === 'create-project' && isMainAdmin && (
            <CreateProjectPanel onCreate={(data) => createProjectMutation.mutate(data)} loading={createProjectMutation.isPending} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function NavItem({ label, active, onClick, badge, style: extraStyle }: { label: string; active: boolean; onClick: () => void; badge?: number; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} style={{ width: '100%', background: active ? 'rgba(208,39,29,.06)' : 'transparent', color: active ? ADP_RED : '#374151', borderLeft: `3px solid ${active ? ADP_RED : 'transparent'}`, border: 'none', padding: '11px 16px', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', fontFamily: 'inherit', borderBottom: '1px solid #e0e4ef', ...extraStyle }}>
      <span>{label}</span>
      {badge ? <span style={{ background: ADP_RED, color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '2px 6px' }}>{badge}</span> : null}
    </button>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f0f2f7' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 8, padding: '9px 12px', fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

function ProjectAdminPanel({ project, onSave, saveStatus, onToggleLive, showSecrets, toggleSecret }: {
  project: Project; onSave: (p: Project, data: Record<string, any>) => void;
  saveStatus: string; onToggleLive: () => void;
  showSecrets: Record<string, boolean>; toggleSecret: (k: string) => void;
}) {
  const [name, setName] = useState(project.name);
  const [releaseLabel, setReleaseLabel] = useState(project.releaseLabel);
  const [ownerEmail, setOwnerEmail] = useState(project.ownerEmail);
  const [teamCount, setTeamCount] = useState(project.teamCount);
  const [adminEmails, setAdminEmails] = useState((project.adminEmails || []).join('\n'));
  const [cadence, setCadence] = useState(project.cadence);
  const [copadoUrl, setCopadoUrl] = useState(project.copadoConfig?.url || '');
  const [copadoPipeline, setCopadoPipeline] = useState(project.copadoConfig?.pipelineName || '');
  const [copadoToken, setCopadoToken] = useState(project.copadoConfig?.apiToken || '');
  const [bundleNaming, setBundleNaming] = useState(project.copadoConfig?.bundleNamingConvention || 'Bundle_{n}');
  const [apexThreshold, setApexThreshold] = useState(project.copadoConfig?.apexCoverageThreshold || 75);
  const [trackedEnvs, setTrackedEnvs] = useState<string[]>(project.copadoConfig?.trackedEnvs || ['DEV', 'SIT', 'UAT', 'STG', 'PROD']);
  const isSF = project.type === 'salesforce';

  function handleSave() {
    const data: Record<string, any> = { name, releaseLabel, ownerEmail, teamCount, cadence, adminEmails: adminEmails.split('\n').map(e => e.trim()).filter(Boolean) };
    if (isSF) {
      data.copadoConfig = { url: copadoUrl, pipelineName: copadoPipeline, apiToken: copadoToken, bundleNamingConvention: bundleNaming, apexCoverageThreshold: apexThreshold, trackedEnvs };
    }
    onSave(project, data);
  }

  return (
    <div>
      {saveStatus && (
        <div style={{ background: saveStatus === 'saved' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${saveStatus === 'saved' ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: saveStatus === 'saved' ? '#15803d' : '#991b1b' }}>
          {saveStatus === 'saved' ? '✓ Settings saved successfully!' : `❌ ${saveStatus}`}
        </div>
      )}
      <Section title={`${project.icon} ${project.name} — Project Settings`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Project Name"><input value={name} onChange={e => setName(e.target.value)} style={inputStyle} /></Field>
          <Field label="Jira Project Key"><input defaultValue={project.jiraKey} style={{ ...inputStyle, background: '#f0f2f7' }} readOnly /></Field>
          <Field label="Release Label" hint="e.g. Salesforce_26.14 — shared across all teams"><input value={releaseLabel} onChange={e => setReleaseLabel(e.target.value)} style={inputStyle} /></Field>
          <Field label="Owner Email"><input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} style={inputStyle} /></Field>
          <Field label="Number of Teams"><input type="number" value={teamCount} onChange={e => setTeamCount(Number(e.target.value))} min={1} max={20} style={inputStyle} /></Field>
          <Field label="Release Cadence">
            <select value={cadence} onChange={e => setCadence(e.target.value as any)} style={inputStyle}>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="ondemand">On-demand</option>
            </select>
          </Field>
        </div>
        <Field label="Project Admin Emails (one per line)" hint="These users get Project Admin access for this project">
          <textarea value={adminEmails} onChange={e => setAdminEmails(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
        </Field>
        <button onClick={handleSave} style={{ background: ADP_RED, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>💾 Save Settings</button>
      </Section>

      {isSF && (
        <Section title="⬡ Copado Integration">
          <div style={{ background: 'rgba(121,103,174,.07)', border: '1px solid rgba(121,103,174,.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 11, color: '#374151', lineHeight: 1.6 }}>
            Configure the Copado Salesforce API to pull bundle status, Apex results, and validation data automatically. Requires a Connected App in your Salesforce org.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Copado API Base URL"><input value={copadoUrl} onChange={e => setCopadoUrl(e.target.value)} placeholder="https://copado.my.salesforce.com" style={inputStyle} /></Field>
            <Field label="Pipeline Name"><input value={copadoPipeline} onChange={e => setCopadoPipeline(e.target.value)} placeholder="e.g. Main Production Pipeline" style={inputStyle} /></Field>
          </div>
          <Field label="API Token / Connected App Secret" hint="Generate from Salesforce Setup → App Manager → Connected Apps. Stored encrypted.">
            <div style={{ position: 'relative' }}>
              <input type={showSecrets[`copado-${project.projectId}`] ? 'text' : 'password'} value={copadoToken} onChange={e => setCopadoToken(e.target.value)} placeholder="Client secret..." style={{ ...inputStyle, paddingRight: 60 }} />
              <button type="button" onClick={() => toggleSecret(`copado-${project.projectId}`)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: '#e0e4ef', border: 'none', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
                {showSecrets[`copado-${project.projectId}`] ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Bundle Naming Convention" hint="Use {n} for number, {release} for version"><input value={bundleNaming} onChange={e => setBundleNaming(e.target.value)} style={inputStyle} /></Field>
            <Field label="Apex Coverage Threshold (%)" hint="Minimum % required. Salesforce requires 75%."><input type="number" value={apexThreshold} onChange={e => setApexThreshold(Number(e.target.value))} min={0} max={100} style={inputStyle} /></Field>
          </div>
          <Field label="Tracked Environments">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {['DEV', 'SIT', 'UAT', 'STG', 'PROD'].map(env => (
                <button key={env} type="button" onClick={() => setTrackedEnvs(envs => envs.includes(env) ? envs.filter(e => e !== env) : [...envs, env])}
                  style={{ background: trackedEnvs.includes(env) ? '#eff6ff' : '#f8f9fc', color: trackedEnvs.includes(env) ? '#2060d8' : '#9ca3af', border: `1px solid ${trackedEnvs.includes(env) ? '#bfdbfe' : '#e0e4ef'}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>
                  {env}
                </button>
              ))}
            </div>
          </Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} style={{ background: '#2060d8', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>💾 Save Copado Config</button>
            <button onClick={() => alert('Test connection → check API status')} style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🔌 Test Connection</button>
          </div>
        </Section>
      )}

      <Section title="⚠️ Danger Zone">
        <div style={{ border: '1px solid #fecaca', borderRadius: 8, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>Toggle Live Status</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Current: {project.isLive ? '● LIVE' : '○ Offline'}</div>
            </div>
            <button onClick={onToggleLive} style={{ background: project.isLive ? '#fef2f2' : '#f0fdf4', color: project.isLive ? ADP_RED : '#18a057', border: `1px solid ${project.isLive ? '#fecaca' : '#bbf7d0'}`, borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {project.isLive ? 'Set Offline' : 'Set Live'}
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function RequestAccessPanel({ projects, userEmail }: { projects: Project[]; userEmail: string }) {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const mutation = useMutation({
    mutationFn: () => adminApi.submitRequest(projectId, reason),
    onSuccess: () => { setSubmitted(true); qc.invalidateQueries({ queryKey: ['adminRequests'] }); },
  });
  if (submitted) return <Section title="✅ Request Submitted"><p style={{ color: '#18a057', fontSize: 13 }}>Your admin access request has been submitted. A Main Admin will review it shortly.</p></Section>;
  return (
    <Section title="🔑 Request Admin Access">
      <Field label="Project">
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle}>
          <option value="">Select project...</option>
          {projects.map((p: Project) => <option key={p.projectId} value={p.projectId}>{p.icon} {p.name}</option>)}
        </select>
      </Field>
      <Field label="Your Email"><input defaultValue={userEmail} style={{ ...inputStyle, background: '#f0f2f7' }} readOnly /></Field>
      <Field label="Reason for Access"><textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} placeholder="Briefly explain why you need Project Admin access..." style={{ ...inputStyle, resize: 'vertical' }} /></Field>
      <button onClick={() => mutation.mutate()} disabled={!projectId || !reason || mutation.isPending} style={{ background: ADP_RED, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Submit Request</button>
    </Section>
  );
}

function CreateProjectPanel({ onCreate, loading }: { onCreate: (data: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ name: '', type: 'salesforce', jiraKey: '', ownerEmail: '', cadence: 'biweekly', teamCount: 7, releaseLabel: '', description: '', copadoUrl: '', copadoPipeline: '' });
  const f = (k: string) => (e: React.ChangeEvent<any>) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  return (
    <Section title="➕ Create New Project">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Project Name *"><input value={form.name} onChange={f('name')} placeholder="e.g. SF1 — Commerce Cloud" style={inputStyle} /></Field>
        <Field label="Type *">
          <select value={form.type} onChange={f('type')} style={inputStyle}>
            <option value="salesforce">Salesforce Release</option>
            <option value="react">React Application</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Jira Project Key *"><input value={form.jiraKey} onChange={f('jiraKey')} placeholder="e.g. SF, COM, SVC" style={inputStyle} /></Field>
        <Field label="Release Label" hint="e.g. Salesforce_{version}"><input value={form.releaseLabel} onChange={f('releaseLabel')} placeholder="e.g. Salesforce_26.14" style={inputStyle} /></Field>
        <Field label="Owner Email *"><input type="email" value={form.ownerEmail} onChange={f('ownerEmail')} placeholder="owner@adp.com" style={inputStyle} /></Field>
        <Field label="Number of Teams"><input type="number" value={form.teamCount} onChange={f('teamCount')} min={1} max={20} style={inputStyle} /></Field>
        <Field label="Cadence">
          <select value={form.cadence} onChange={f('cadence')} style={inputStyle}>
            <option value="biweekly">Bi-weekly</option><option value="monthly">Monthly</option><option value="weekly">Weekly</option>
          </select>
        </Field>
      </div>
      <Field label="Description"><textarea value={form.description} onChange={f('description')} rows={2} placeholder="Brief project description..." style={{ ...inputStyle, resize: 'vertical' }} /></Field>
      {form.type === 'salesforce' && (
        <>
          <div style={{ height: 1, background: '#f0f2f7', margin: '8px 0 14px' }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: '#7967ae', marginBottom: 12 }}>⬡ Copado Config (optional — can configure later)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Copado API URL"><input value={form.copadoUrl} onChange={f('copadoUrl')} placeholder="https://copado.my.salesforce.com" style={inputStyle} /></Field>
            <Field label="Pipeline Name"><input value={form.copadoPipeline} onChange={f('copadoPipeline')} placeholder="e.g. Main Production Pipeline" style={inputStyle} /></Field>
          </div>
        </>
      )}
      <button onClick={() => onCreate(form)} disabled={!form.name || !form.jiraKey || !form.ownerEmail || loading} style={{ background: loading ? '#9ca3af' : ADP_RED, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
        {loading ? 'Creating...' : 'Create Project'}
      </button>
    </Section>
  );
}
