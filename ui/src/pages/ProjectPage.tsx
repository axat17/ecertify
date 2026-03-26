// ─── ProjectPage.tsx ──────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi, certApi, jiraApi, copadoApi } from '@/services/api';
import type { Project, JiraStory, CopadoBundle, FixVersionData } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const ADP_RED = '#d0271d';
const ADP_BLUE = '#121c4e';

function StatusChip({ status }: { status: string }) {
  const col = status === 'Complete' || status === 'Deployed' || status === 'Passed' ? '#18a057' : status === 'In Progress' ? ADP_BLUE : status === 'Failed' ? ADP_RED : '#d4840a';
  return <span style={{ background: col + '14', color: col, border: `1px solid ${col}28`, borderRadius: 12, padding: '3px 9px', fontSize: 10, fontWeight: 700 }}>{status}</span>;
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [labelFilter, setLabelFilter] = useState<'all' | 'ready' | 'missing'>('all');
  const [openTeams, setOpenTeams] = useState<Record<string, boolean>>({});
  const [syncStatus, setSyncStatus] = useState<string>('');

  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: sessions } = useQuery({
    queryKey: ['sessions', projectId, 'active'],
    queryFn: () => certApi.getByProject(projectId!, { status: 'In Progress' }),
    enabled: !!projectId,
    refetchInterval: 30000,
  });

  const { data: storiesResponse } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: () => jiraApi.stories(projectId!),
    enabled: !!projectId && project?.type === 'salesforce',
  });

  const { data: fixData } = useQuery<FixVersionData>({
    queryKey: ['fixVersions', projectId],
    queryFn: () => jiraApi.fixVersions(projectId!),
    enabled: !!projectId && project?.type === 'salesforce',
  });

  const { data: bundles = [] } = useQuery<CopadoBundle[]>({
    queryKey: ['bundles', projectId],
    queryFn: () => copadoApi.bundles(projectId!),
    enabled: !!projectId && project?.type === 'salesforce',
  });

  const syncMutation = useMutation({
    mutationFn: () => jiraApi.sync(projectId!),
    onMutate: () => setSyncStatus('syncing'),
    onSuccess: (r) => {
      setSyncStatus('synced');
      qc.invalidateQueries({ queryKey: ['stories', projectId] });
      qc.invalidateQueries({ queryKey: ['fixVersions', projectId] });
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err: any) => setSyncStatus('error: ' + (err?.response?.data?.error || 'Sync failed')),
  });

  const addLabelMutation = useMutation({
    mutationFn: ({ key, label }: { key: string; label: string }) => jiraApi.addLabel(projectId!, key, label),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', projectId] }),
  });

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontFamily: "'DM Sans', sans-serif" }}>Loading project...</div>;
  if (error || !project) return (
    <div style={{ padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 20, color: '#991b1b' }}>
        ❌ Project not found or failed to load. <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: ADP_BLUE, cursor: 'pointer', fontWeight: 600 }}>← Go Home</button>
      </div>
    </div>
  );

  const stories: JiraStory[] = storiesResponse?.data || [];
  const inProgressSessions = sessions || [];
  const isSF = project.type === 'salesforce';
  const isAdmin = user?.role === 'main-admin' || (user?.role === 'project-admin' && user?.projectAdminOf.includes(projectId!));

  const tabs = ['◉ Certification', ...(isSF ? ['⬡ Bundles + Copado'] : []), '📅 Release Plan', ...(isSF ? ['🏷️ Jira Labels', '👥 Team View'] : []), '🐛 Defects', '📈 Metrics'];

  const filteredStories = labelFilter === 'all' ? stories : labelFilter === 'ready' ? stories.filter(s => s.hasCopadoCICD && s.hasReleaseLabel) : stories.filter(s => !s.hasCopadoCICD || !s.hasReleaseLabel);

  return (
    <div style={{ padding: 24, maxWidth: 1280, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Breadcrumb + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={() => navigate('/')} style={{ background: '#f0f2f7', border: '1px solid #e0e4ef', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>← All Projects</button>
        <span style={{ fontSize: 20 }}>{project.icon}</span>
        <span style={{ fontSize: 20, fontWeight: 800 }}>{project.name}</span>
        <StatusChip status={project.status} />
        {project.isLive && <span style={{ fontSize: 11, fontWeight: 700, color: ADP_RED, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: ADP_RED, display: 'inline-block' }} />LIVE</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {inProgressSessions.length > 0 && (
            <button onClick={() => navigate(`/projects/${projectId}/sessions`)} style={{ background: '#eff6ff', color: ADP_BLUE, border: '1px solid #bfdbfe', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              📋 {inProgressSessions.length} Active Session{inProgressSessions.length > 1 ? 's' : ''}
            </button>
          )}
          {isSF && <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} style={{ background: syncMutation.isPending ? '#9ca3af' : '#fff', border: '1px solid #e0e4ef', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {syncMutation.isPending ? '↻ Syncing...' : '⟳ Sync Jira'}
          </button>}
          {isAdmin && <button onClick={() => navigate('/admin')} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>⚙ Admin</button>}
          <button onClick={() => { const l = `${window.location.origin}/cert/${projectId}`; navigator.clipboard.writeText(l); }} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🔗 Copy Cert Link</button>
          <button onClick={() => navigate(`/projects/${projectId}/sessions`)} style={{ background: ADP_RED, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Join Session</button>
        </div>
      </div>

      {/* Sync status */}
      {syncStatus && !syncMutation.isPending && (
        <div style={{ background: syncStatus.startsWith('error') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${syncStatus.startsWith('error') ? '#fecaca' : '#bbf7d0'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: syncStatus.startsWith('error') ? '#991b1b' : '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}>
          {syncStatus.startsWith('error') ? '❌' : '✓'} {syncStatus.startsWith('error') ? syncStatus : `Sync complete — ${storiesResponse?.meta?.total || 0} stories loaded`}
          {project.lastSyncError && !syncStatus.startsWith('error') === false && <button onClick={() => syncMutation.mutate()} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: ADP_RED, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>Retry ↺</button>}
        </div>
      )}
      {project.syncStatus === 'stale' && !syncStatus && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚠️ Data may be stale. Last sync: {project.lastJiraSync ? new Date(project.lastJiraSync).toLocaleString() : 'Never'}
          <button onClick={() => syncMutation.mutate()} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#d4840a', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>Refresh now ↺</button>
        </div>
      )}

      {/* Hero */}
      <div style={{ background: `linear-gradient(138deg,${ADP_BLUE} 0%,#1a2660 55%,#0e183a 100%)`, borderRadius: 14, padding: '22px 26px', marginBottom: 18, border: '1px solid rgba(208,39,29,.18)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(208,39,29,.16) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: 8 }}>{isSF ? 'Salesforce' : 'React/Other'} · {project.teamCount} Teams · {project.cadence}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', maxWidth: 500, lineHeight: 1.55, marginBottom: 14 }}>{project.description}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: 9, color: 'rgba(255,255,255,.38)', textTransform: 'uppercase', marginBottom: 3 }}>Last</div><div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{project.shortName} (prev)</div></div>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,.12)', paddingLeft: 16 }}><div style={{ fontSize: 9, color: '#fac8bf', textTransform: 'uppercase', marginBottom: 3 }}>● CURRENT</div><div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{project.currentRelease}</div></div>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,.12)', paddingLeft: 16 }}><div style={{ fontSize: 9, color: 'rgba(255,255,255,.38)', textTransform: 'uppercase', marginBottom: 3 }}>Next</div><div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{project.shortName} (next)</div></div>
            </div>
            {isSF && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {[project.copadoCICD, project.releaseLabel].map(l => l && l !== 'N/A' ? <span key={l} style={{ background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '3px 10px', fontSize: 11, color: 'rgba(255,255,255,.8)', fontWeight: 600 }}>{l}</span> : null)}
            </div>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', marginBottom: 4 }}>Health</div>
            <div style={{ fontSize: 38, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: project.healthScore >= 80 ? '#7ee8a2' : project.healthScore >= 50 ? '#fcd34d' : '#f87171', lineHeight: 1 }}>{project.healthScore}%</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 4 }}>{project.ownerEmail}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        {[{ l: 'Stories', v: project.storyCount, c: '#2060d8' }, { l: 'Done', v: project.doneCount, c: '#18a057' }, { l: 'Defects', v: project.defectCount, c: project.defectCount > 5 ? ADP_RED : project.defectCount > 0 ? '#d4840a' : '#18a057' }, ...(isSF ? [{ l: 'Bundles', v: bundles.length, c: '#7967ae' }] : []), { l: 'Teams', v: project.teamCount, c: '#0d9488' }, { l: 'Active Sessions', v: inProgressSessions.length, c: inProgressSessions.length > 0 ? ADP_RED : '#9ca3af' }].map(s => (
          <div key={s.l} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 10, padding: 15, flex: 1, minWidth: 110, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>{s.l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 10, display: 'flex', padding: 4, gap: 3, marginBottom: 18, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActiveTab(i)} style={{ background: activeTab === i ? ADP_BLUE : 'transparent', color: activeTab === i ? '#fff' : '#9ca3af', border: 'none', borderRadius: 7, padding: '8px 15px', cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all .15s', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{t}</button>
        ))}
      </div>

      {/* TAB 0: CERTIFICATION */}
      {activeTab === 0 && (
        <div>
          {inProgressSessions.length > 0 && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1d4ed8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>● <strong>{inProgressSessions.length} active session{inProgressSessions.length > 1 ? 's' : ''}</strong> in progress for {project.currentRelease}</span>
              <button onClick={() => navigate(`/projects/${projectId}/sessions`)} style={{ background: ADP_BLUE, color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>View All Sessions</button>
            </div>
          )}
          <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Share Certification Link</div>
            <div style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#374151', marginBottom: 12, fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all' }}>
              {window.location.origin}/cert/[sessionId]
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>When BU testers click this link, they land on a Join Session screen with your release pre-loaded. Their session is saved to MongoDB — even if they close the browser, they can rejoin via the same link.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => navigate(`/projects/${projectId}/sessions`)} style={{ background: ADP_RED, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Join Session</button>
              <button onClick={() => navigate(`/projects/${projectId}/sessions`)} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📋 Manage All Sessions</button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1 (SF): BUNDLES */}
      {isSF && activeTab === 1 && (
        <div>
          {bundles.map((b, i) => {
            const col = b.status === 'Deployed' ? '#18a057' : b.status === 'In Progress' ? '#d4840a' : '#9ca3af';
            const apc = Math.round(b.apexResults.coveragePercent);
            return (
              <div key={b._id} style={{ background: '#fff', border: `1px solid ${col}28`, borderLeft: `3px solid ${col}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ padding: '14px 16px', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{b.name}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{b.storyCount} stories · Teams: {b.teams.join(', ')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 800, color: apc >= 80 ? '#18a057' : apc >= 75 ? '#d4840a' : '#d0271d' }}>{apc}%</div><div style={{ fontSize: 9, color: '#9ca3af' }}>Apex</div></div>
                    <StatusChip status={b.validationResult.status} />
                    <StatusChip status={b.status} />
                  </div>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {/* Promotions */}
                    <div style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 10 }}>Promotion Status</div>
                      {b.promotions.map(p => <div key={p.env} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f0f2f7', fontSize: 11 }}>
                        <span style={{ background: (p.status === 'Passed' ? '#18a057' : p.status === 'In Progress' ? '#2060d8' : '#9ca3af') + '14', color: (p.status === 'Passed' ? '#18a057' : p.status === 'In Progress' ? '#2060d8' : '#9ca3af'), border: `1px solid ${(p.status === 'Passed' ? '#18a057' : p.status === 'In Progress' ? '#2060d8' : '#9ca3af')}28`, borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{p.env}</span>
                        <span style={{ fontWeight: 600, color: p.status === 'Passed' ? '#18a057' : '#374151', fontSize: 11 }}>{p.status}</span>
                        {p.promotedAt && <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: "'JetBrains Mono', monospace" }}>{new Date(p.promotedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>}
                      </div>)}
                    </div>
                    {/* Apex */}
                    <div style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 10 }}>Apex Test Results</div>
                      <div style={{ textAlign: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: apc >= 80 ? '#18a057' : apc >= 75 ? '#d4840a' : '#d0271d' }}>{apc}%</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>Coverage (min {project.copadoConfig?.apexCoverageThreshold || 75}%)</div>
                      </div>
                      <div style={{ height: 6, background: '#e0e4ef', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                        <div style={{ width: `${apc}%`, height: '100%', background: apc >= 80 ? '#18a057' : apc >= 75 ? '#d4840a' : '#d0271d', borderRadius: 3 }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
                        {[{ l: 'Passed', v: b.apexResults.passed, c: '#18a057' }, { l: 'Failed', v: b.apexResults.failed, c: b.apexResults.failed > 0 ? '#d0271d' : '#9ca3af' }, { l: 'Skipped', v: b.apexResults.skipped, c: '#9ca3af' }].map(s => (
                          <div key={s.l} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 6, padding: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: s.c }}>{s.v}</div>
                            <div style={{ fontSize: 9, color: '#9ca3af' }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Validation */}
                    <div style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 10 }}>Validation</div>
                      <StatusChip status={b.validationResult.status} />
                      <div style={{ marginTop: 10 }}>
                        {b.validationResult.checks.map(c => <div key={c} style={{ fontSize: 11, color: '#374151', padding: '4px 0', borderBottom: '1px solid #f0f2f7', display: 'flex', gap: 6 }}><span style={{ color: '#18a057' }}>✓</span>{c}</div>)}
                        {b.validationResult.warnings?.map(w => <div key={w} style={{ fontSize: 10, color: '#d4840a', marginTop: 4 }}>⚠ {w}</div>)}
                      </div>
                    </div>
                  </div>
                  {b.backPromoHistory.length > 0 && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 11, color: '#92400e' }}>
                      <strong>Back-Promo History:</strong> {b.backPromoHistory.map(h => `${h.fromEnv}→${h.toEnv} (${h.reason})`).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {bundles.length === 0 && <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No bundles found. Sync from Copado to load bundle data.</div>}
        </div>
      )}

      {/* Jira Labels Tab */}
      {isSF && activeTab === 3 && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {[{ l: '✓ Both Labels', v: stories.filter(s => s.hasCopadoCICD && s.hasReleaseLabel).length, c: '#18a057' }, { l: '⚠ Missing CopadoCICD', v: stories.filter(s => !s.hasCopadoCICD).length, c: ADP_RED }, { l: '⚠ Missing Release Label', v: stories.filter(s => !s.hasReleaseLabel).length, c: '#d4840a' }, { l: 'Total', v: stories.length, c: '#2060d8' }].map(s => (
              <div key={s.l} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 10, padding: 15, flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>{s.l}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[{ k: 'all', l: 'All Stories' }, { k: 'ready', l: '✓ Ready' }, { k: 'missing', l: '⚠ Missing' }].map(f => (
              <button key={f.k} onClick={() => setLabelFilter(f.k as any)} style={{ background: labelFilter === f.k ? ADP_BLUE : '#fff', color: labelFilter === f.k ? '#fff' : '#9ca3af', border: '1px solid ' + (labelFilter === f.k ? ADP_BLUE : '#e0e4ef'), borderRadius: 7, padding: '6px 13px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>{f.l}</button>
            ))}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Key', 'Title', 'Team', 'Status', 'CopadoCICD', 'Release Label', 'Bundle', 'Action'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid #e0e4ef', background: '#f8f9fc' }}>{h}</th>)}</tr></thead>
              <tbody>
                {filteredStories.slice(0, 30).map((s, i) => (
                  <tr key={s.key} style={{ background: (!s.hasCopadoCICD || !s.hasReleaseLabel) ? 'rgba(208,39,29,.02)' : i % 2 === 0 ? '#fff' : 'rgba(0,0,0,.01)' }}>
                    <td style={{ padding: '10px 14px' }}><a href={s.jiraUrl} target="_blank" rel="noreferrer" style={{ color: '#2060d8', fontWeight: 700, fontSize: 11, textDecoration: 'none' }}>{s.key}</a></td>
                    <td style={{ padding: '10px 14px', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.title}>{s.title}</td>
                    <td style={{ padding: '10px 14px' }}><span style={{ background: '#ccfbf1', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{s.team}</span></td>
                    <td style={{ padding: '10px 14px' }}><StatusChip status={s.status} /></td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>{s.hasCopadoCICD ? <span style={{ color: '#18a057', fontWeight: 700 }}>✓</span> : <button onClick={() => addLabelMutation.mutate({ key: s.key, label: project.copadoCICD })} style={{ background: '#f3f0ff', color: '#7967ae', border: '1px solid #ddd6fe', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>+ Add</button>}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>{s.hasReleaseLabel ? <span style={{ background: '#eff6ff', color: '#2060d8', border: '1px solid #bfdbfe', borderRadius: 12, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{project.releaseLabel}</span> : <button onClick={() => addLabelMutation.mutate({ key: s.key, label: project.releaseLabel })} style={{ background: '#eff6ff', color: '#2060d8', border: '1px solid #bfdbfe', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>+ Add</button>}</td>
                    <td style={{ padding: '10px 14px', fontSize: 10, color: s.bundle ? '#7967ae' : '#9ca3af' }}>{s.bundle || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {(!s.hasCopadoCICD || !s.hasReleaseLabel) ? (
                        <button onClick={() => { if (!s.hasCopadoCICD) addLabelMutation.mutate({ key: s.key, label: project.copadoCICD }); if (!s.hasReleaseLabel) addLabelMutation.mutate({ key: s.key, label: project.releaseLabel }); }} style={{ background: ADP_RED, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Fix All</button>
                      ) : <span style={{ color: '#18a057', fontSize: 11 }}>✓ Ready</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStories.length > 30 && <div style={{ padding: '12px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 12, borderTop: '1px solid #e0e4ef' }}>Showing 30 of {filteredStories.length} stories. Sync to load all.</div>}
          </div>
        </div>
      )}

      {/* Team View Tab */}
      {isSF && activeTab === 4 && (
        <div>
          {fixData && (
            <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Consolidated — {project.releaseLabel}</div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                {[{ l: 'Total', v: fixData.consolidated.totalStories, c: '#2060d8' }, { l: 'Done', v: fixData.consolidated.done, c: '#18a057' }, { l: 'In Progress', v: fixData.consolidated.inProgress, c: '#2060d8' }, { l: 'To Do', v: fixData.consolidated.todo, c: '#9ca3af' }].map(s => (
                  <div key={s.l} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 14, borderRadius: 7, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${Math.round(fixData.consolidated.done / fixData.consolidated.totalStories * 100)}%`, background: '#18a057' }} />
                <div style={{ width: `${Math.round(fixData.consolidated.inProgress / fixData.consolidated.totalStories * 100)}%`, background: '#2060d8' }} />
                <div style={{ flex: 1, background: '#f0f2f7' }} />
              </div>
            </div>
          )}
          {fixData?.perTeam.map(tv => {
            const isOpen = openTeams[tv.team];
            const teamStories = stories.filter(s => s.team === tv.team);
            const pct = Math.round(tv.doneCount / tv.storyCount * 100);
            const hc = pct >= 80 ? '#18a057' : pct >= 50 ? '#d4840a' : '#d0271d';
            return (
              <div key={tv.team} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: '#fafafa' }} onClick={() => setOpenTeams(o => ({ ...o, [tv.team]: !o[tv.team] }))}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: ADP_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>{tv.team.split('-')[1]}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{tv.team}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>Fix Version: {tv.versionName}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {teamStories.filter(s => !s.hasCopadoCICD || !s.hasReleaseLabel).length > 0 && <span style={{ fontSize: 11, color: ADP_RED, fontWeight: 600 }}>⚠ {teamStories.filter(s => !s.hasCopadoCICD || !s.hasReleaseLabel).length} label issue{teamStories.filter(s => !s.hasCopadoCICD || !s.hasReleaseLabel).length > 1 ? 's' : ''}</span>}
                    <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 800, fontSize: 16, color: hc, fontFamily: "'JetBrains Mono', monospace" }}>{tv.doneCount}/{tv.storyCount}</div><div style={{ fontSize: 9, color: '#9ca3af' }}>done</div></div>
                    <span style={{ color: '#9ca3af', fontSize: 13 }}>{isOpen ? '▾' : '▸'}</span>
                  </div>
                </div>
                {isOpen && (
                  <div>
                    {teamStories.slice(0, 10).map(s => (
                      <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', borderTop: '1px solid #f0f2f7', fontSize: 11, background: (!s.hasCopadoCICD || !s.hasReleaseLabel) ? 'rgba(208,39,29,.02)' : 'transparent' }}>
                        <a href={s.jiraUrl} target="_blank" rel="noreferrer" style={{ color: '#2060d8', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>{s.key}</a>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }} title={s.title}>{s.title}</span>
                        <StatusChip status={s.status} />
                        <span style={{ color: '#9ca3af', fontSize: 10, flexShrink: 0 }}>{s.assignee}</span>
                        {s.bundle && <span style={{ fontSize: 10, fontWeight: 700, color: '#7967ae', flexShrink: 0 }}>● {s.bundle}</span>}
                        {(!s.hasCopadoCICD || !s.hasReleaseLabel) && <span style={{ fontSize: 9, color: ADP_RED, flexShrink: 0 }}>⚠ Label</span>}
                        {s.isBlocker && <span style={{ fontSize: 9, color: '#d4840a', flexShrink: 0 }}>🚧</span>}
                      </div>
                    ))}
                    {teamStories.length > 10 && <div style={{ padding: '8px 18px', fontSize: 10, color: '#9ca3af', borderTop: '1px solid #f0f2f7' }}>+{teamStories.length - 10} more stories</div>}
                  </div>
                )}
              </div>
            );
          })}
          {!fixData && <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Sync from Jira to load team breakdown</div>}
        </div>
      )}
    </div>
  );
}
