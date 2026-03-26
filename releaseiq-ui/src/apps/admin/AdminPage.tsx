import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { adminApi, projectApi } from '@/services/api';
import type { Project, AdminRequest, ErrorLogEntry, User } from '@/common/types';
import { Section, Alert, EmptyState } from '@/common/components/UI';
import Badge from '@/common/components/Badge';
import Button from '@/common/components/Button';
import { ProjectAdminPanel, AccessRequestPanel, CreateProjectPanel, AdminRequestCard, ErrorLogRow, UserRow } from './components';

const ADP_RED = '#d0271d';

export default function AdminPage() {
  const user   = useAuthStore(s => s.user);
  const qc     = useQueryClient();
  const isMain = user?.role === 'main-admin';

  const [panel,        setPanel]        = useState<string>(isMain ? 'dashboard' : '');
  const [selectedProj, setSelectedProj] = useState<Project | null>(null);
  const [saveStatus,   setSaveStatus]   = useState('');

  const { data: projects = [] }  = useQuery<Project[]>({ queryKey:['projects'], queryFn: projectApi.list });
  const { data: reqResp }        = useQuery({ queryKey:['adminRequests'], queryFn: adminApi.getRequests, enabled: isMain });
  const { data: errors = [] }    = useQuery<ErrorLogEntry[]>({ queryKey:['errorLogs'], queryFn: adminApi.getErrors });
  const { data: allUsers = [] }  = useQuery<User[]>({ queryKey:['allUsers'], queryFn: adminApi.getUsers, enabled: isMain });

  const requests: AdminRequest[] = (reqResp as any)?.data ?? [];
  const pending = requests.filter((r: AdminRequest) => r.status === 'pending');

  const approveMut    = useMutation({ mutationFn: adminApi.approveRequest, onSuccess: () => qc.invalidateQueries({ queryKey:['adminRequests'] }) });
  const denyMut       = useMutation({ mutationFn: adminApi.denyRequest,    onSuccess: () => qc.invalidateQueries({ queryKey:['adminRequests'] }) });
  const clearErrMut   = useMutation({ mutationFn: adminApi.clearErrors,    onSuccess: () => qc.invalidateQueries({ queryKey:['errorLogs'] }) });
  const resolveErrMut = useMutation({ mutationFn: adminApi.resolveError,   onSuccess: () => qc.invalidateQueries({ queryKey:['errorLogs'] }) });
  const toggleLiveMut = useMutation({ mutationFn: projectApi.toggleLive,   onSuccess: () => qc.invalidateQueries({ queryKey:['projects'] }) });

  const updateProjMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) => projectApi.update(id, data),
    onMutate:  () => setSaveStatus('saving'),
    onSuccess: () => { setSaveStatus('saved'); qc.invalidateQueries({ queryKey:['projects'] }); setTimeout(() => setSaveStatus(''), 3000); },
    onError:   (e: any) => setSaveStatus('error: ' + (e?.response?.data?.error ?? 'Save failed')),
  });

  const createProjMut = useMutation({
    mutationFn: (data: Partial<Project>) => projectApi.create(data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey:['projects'] }); setPanel('all-projects'); },
  });

  const adminable = projects.filter((p: Project) => isMain || user?.projectAdminOf?.includes(p.projectId));
  const unresolvedErrors = errors.filter((e: ErrorLogEntry) => !e.resolved).length;

  function openProj(p: Project) { setSelectedProj(p); setPanel(`proj-${p.projectId}`); setSaveStatus(''); }

  return (
    <div style={{ padding:24, maxWidth:1280, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800 }}>⚙️ Admin Panel</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
            {user?.name} · <span style={{ color: isMain ? ADP_RED : '#2060d8', fontWeight:600 }}>{isMain ? '★ Main Admin' : 'Project Admin'}</span>
          </div>
        </div>
        {isMain && <Button variant="primary" size="sm" style={{ marginLeft:'auto' }} onClick={() => setPanel('create-project')}>➕ New Project</Button>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20 }}>
        {/* Sidebar */}
        <div style={{ background:'#f8f9fc', border:'1px solid #e0e4ef', borderRadius:12, overflow:'hidden', alignSelf:'start' }}>
          {isMain && <>
            <NI label="🏠 Dashboard"         active={panel==='dashboard'}        onClick={() => setPanel('dashboard')} />
            <NI label="📋 All Projects"      active={panel==='all-projects'}     onClick={() => setPanel('all-projects')} />
            <NI label={`🔑 Requests${pending.length ? ` (${pending.length})` : ''}`} active={panel==='access-requests'} onClick={() => setPanel('access-requests')} badge={pending.length} />
            <NI label="👥 Users"             active={panel==='users'}            onClick={() => setPanel('users')} />
            <NI label={`🔴 Errors${unresolvedErrors ? ` (${unresolvedErrors})` : ''}`} active={panel==='error-log'} onClick={() => setPanel('error-log')} />
            <div style={{ height:1, background:'#e0e4ef', margin:'4px 0' }} />
          </>}
          <div style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'1.2px', padding:'10px 16px 4px' }}>Projects</div>
          {adminable.map((p: Project) => (
            <NI key={p.projectId} label={`${p.icon} ${p.shortName}`} active={panel===`proj-${p.projectId}`} onClick={() => openProj(p)} />
          ))}
          <div style={{ height:1, background:'#e0e4ef', margin:'4px 0' }} />
          <NI label="🔑 Request Admin Access" active={panel==='request-access'} onClick={() => setPanel('request-access')} style={{ color:'#2060d8' }} />
        </div>

        {/* Main panel */}
        <div>
          {/* DASHBOARD */}
          {panel === 'dashboard' && isMain && (
            <div>
              <Section title="📊 Platform Overview">
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                  {[
                    { l:'Projects', v:projects.length, c:'#2060d8' },
                    { l:'Live Now', v:projects.filter((p: Project)=>p.isLive).length, c:'#18a057' },
                    { l:'Pending Requests', v:pending.length, c:pending.length?'#d4840a':'#18a057' },
                    { l:'Unresolved Errors', v:unresolvedErrors, c:unresolvedErrors?ADP_RED:'#18a057' },
                  ].map(s => (
                    <div key={s.l} style={{ background:'#f8f9fc', border:'1px solid #e0e4ef', borderRadius:10, padding:16 }}>
                      <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{s.l}</div>
                      <div style={{ fontSize:26, fontWeight:800, color:s.c, fontFamily:"'JetBrains Mono',monospace" }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="🔒 SSO Configuration">
                <Alert type="info" style={{ marginBottom:14 }}>
                  All ADP employees with valid Azure AD credentials can access ReleaseIQ. Set <code style={{ background:'#dbeafe', padding:'1px 5px', borderRadius:3 }}>AUTH_MODE=azure</code> in your environment config to enable SSO.
                </Alert>
                <p style={{ fontSize:11, color:'#9ca3af' }}>Config managed via <code>api/src/config/env/.env.production</code>. Contact ADP IT Security to update Azure app registration.</p>
              </Section>
            </div>
          )}

          {/* ALL PROJECTS */}
          {panel === 'all-projects' && (
            <Section title="All Projects">
              <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:12, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>
                    {['Project','Type','Owner','Admins','Sync','Live','Actions'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.6px', borderBottom:'1px solid #e0e4ef', background:'#f8f9fc' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {projects.map((p: Project, i: number) => (
                      <tr key={p.projectId} style={{ background:i%2!==0?'rgba(0,0,0,.01)':'#fff' }}>
                        <td style={{ padding:'12px 14px' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><span>{p.icon}</span><span style={{ fontWeight:600, fontSize:12 }}>{p.name}</span></div></td>
                        <td style={{ padding:'12px 14px' }}><Badge label={p.type} color={p.type==='salesforce'?'#2060d8':'#0d9488'} small /></td>
                        <td style={{ padding:'12px 14px', fontSize:11, color:'#6b7280' }}>{p.ownerEmail}</td>
                        <td style={{ padding:'12px 14px', fontSize:11, color:'#9ca3af' }}>{(p.adminEmails??[]).length}</td>
                        <td style={{ padding:'12px 14px', fontSize:10, color:p.syncStatus==='synced'?'#18a057':p.syncStatus==='error'?ADP_RED:'#d4840a' }}>
                          {p.syncStatus==='synced'?'✓':p.syncStatus==='error'?'✗':p.syncStatus==='never'?'—':'⚠'}
                        </td>
                        <td style={{ padding:'12px 14px' }}><span style={{ color:p.isLive?'#18a057':'#e0e4ef', fontSize:18 }}>●</span></td>
                        <td style={{ padding:'12px 14px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <Button variant="ghost" size="xs" onClick={() => openProj(p)}>Configure</Button>
                            <Button variant={p.isLive?'danger':'success'} size="xs" onClick={() => toggleLiveMut.mutate(p.projectId)}>{p.isLive?'Offline':'Live'}</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ACCESS REQUESTS */}
          {panel === 'access-requests' && (
            <Section title="🔑 Admin Access Requests">
              {pending.length === 0 && <EmptyState icon="✓" title="No pending requests" />}
              {pending.map((r: AdminRequest) => (
                <AdminRequestCard key={r.requestId} request={r}
                  onApprove={() => approveMut.mutate(r.requestId)}
                  onDeny={() => denyMut.mutate(r.requestId)}
                  loading={approveMut.isPending || denyMut.isPending}
                />
              ))}
              {requests.filter((r: AdminRequest) => r.status !== 'pending').length > 0 && <>
                <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', margin:'16px 0 8px' }}>Resolved</div>
                {requests.filter((r: AdminRequest) => r.status !== 'pending').map((r: AdminRequest) => (
                  <div key={r.requestId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8f9fc', border:'1px solid #e0e4ef', borderRadius:8, padding:'10px 14px', marginBottom:8, opacity:.7 }}>
                    <div style={{ fontSize:12 }}><strong>{r.requesterEmail}</strong> — {r.projectName}</div>
                    <Badge label={r.status==='approved'?'✓ Approved':'✗ Denied'} variant={r.status==='approved'?'success':'danger'} small />
                  </div>
                ))}
              </>}
            </Section>
          )}

          {/* USERS */}
          {panel === 'users' && (
            <Section title="👥 All Users">
              <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:12, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>
                    {['Name','Email','Role','Admin Of','Active'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.6px', borderBottom:'1px solid #e0e4ef', background:'#f8f9fc' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{allUsers.map((u: User, i: number) => <UserRow key={u.email} user={u} index={i} />)}</tbody>
                </table>
                {allUsers.length === 0 && <EmptyState title="No users found" />}
              </div>
            </Section>
          )}

          {/* ERROR LOG */}
          {panel === 'error-log' && (
            <Section title="🔴 Error Log" action={
              <Button variant="danger" size="sm" loading={clearErrMut.isPending}
                onClick={() => { if (window.confirm('Clear all error logs?')) clearErrMut.mutate(); }}>
                Clear All
              </Button>
            }>
              {errors.length === 0
                ? <EmptyState icon="✓" title="No errors logged" description="All API calls are healthy." />
                : errors.map((e: ErrorLogEntry) => (
                    <ErrorLogRow key={e._id} entry={e}
                      onResolve={() => resolveErrMut.mutate(e._id)}
                      loading={resolveErrMut.isPending}
                    />
                  ))}
              <div style={{ marginTop:16, background:'#f8f9fc', border:'1px solid #e0e4ef', borderRadius:8, padding:'10px 14px', fontSize:11, color:'#6b7280' }}>
                <strong>Auto-Retry Policy:</strong> All Jira/Copado API calls retry up to 3× with exponential backoff (1s, 2s, 3s) before logging here. Stale cached data is served during outages.
              </div>
            </Section>
          )}

          {/* PROJECT ADMIN PANEL */}
          {panel.startsWith('proj-') && selectedProj && (
            <ProjectAdminPanel
              project={selectedProj}
              onSave={(id, data) => updateProjMut.mutate({ id, data })}
              saveStatus={saveStatus}
              onToggleLive={() => toggleLiveMut.mutate(selectedProj.projectId)}
              isMainAdmin={isMain}
            />
          )}

          {/* REQUEST ACCESS */}
          {panel === 'request-access' && <AccessRequestPanel projects={projects} userEmail={user?.email ?? ''} />}

          {/* CREATE PROJECT */}
          {panel === 'create-project' && isMain && (
            <CreateProjectPanel
              onCreate={data => createProjMut.mutate(data)}
              loading={createProjMut.isPending}
              error={(createProjMut.error as any)?.response?.data?.error}
            />
          )}

          {!panel && <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:12 }}><EmptyState icon="⚙️" title="Select a section from the left" /></div>}
        </div>
      </div>
    </div>
  );
}

function NI({ label, active, onClick, badge, style: extra }: { label:string; active:boolean; onClick:()=>void; badge?:number; style?:React.CSSProperties }) {
  return (
    <button onClick={onClick} style={{ width:'100%', background:active?'rgba(208,39,29,.06)':'transparent', color:active?'#d0271d':'#374151', borderLeft:`3px solid ${active?'#d0271d':'transparent'}`, border:'none', padding:'11px 16px', cursor:'pointer', fontSize:12, fontWeight:active?600:500, display:'flex', alignItems:'center', justifyContent:'space-between', textAlign:'left', fontFamily:'inherit', borderBottom:'1px solid #e0e4ef', transition:'all .15s', ...extra }}>
      <span>{label}</span>
      {badge ? <span style={{ background:'#d0271d', color:'#fff', borderRadius:10, fontSize:9, fontWeight:700, padding:'2px 6px' }}>{badge}</span> : null}
    </button>
  );
}
