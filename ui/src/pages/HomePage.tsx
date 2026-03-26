// ─── HomePage.tsx ─────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectApi, activityApi } from '@/services/api';
import type { Project, ActivityItem } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const ADP_RED = '#d0271d';
const ADP_BLUE = '#121c4e';

function healthColor(h: number) { return h >= 80 ? '#18a057' : h >= 50 ? '#d4840a' : '#d0271d'; }

function bwDate(anchor: string, offset: number) {
  const d = new Date(anchor);
  d.setDate(d.getDate() + offset * 14);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [view, setView] = useState<'tile' | 'list'>('tile');
  const [filter, setFilter] = useState<'all' | 'salesforce' | 'react'>('all');

  const { data: projects = [], isLoading: projLoading, error: projError } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.list,
  });

  const { data: activities = [] } = useQuery<ActivityItem[]>({
    queryKey: ['activity'],
    queryFn: () => activityApi.list(undefined, 12),
    refetchInterval: 60000,
  });

  const live = projects.filter((p: Project) => p.isLive);
  const filtered = filter === 'all' ? projects : filter === 'salesforce' ? projects.filter((p: Project) => p.type === 'salesforce') : projects.filter((p: Project) => p.type !== 'salesforce');

  return (
    <div style={{ padding: 24, maxWidth: 1300, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(138deg, ${ADP_BLUE} 0%, #1a2660 50%, #0e183a 100%)`, borderRadius: 16, padding: '28px 32px', marginBottom: 22, border: '1px solid rgba(208,39,29,.2)', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 12px rgba(18,28,78,.3)' }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(208,39,29,.18) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.38)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6, fontWeight: 600 }}>ADP · Release Management Platform</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 5 }}>Good morning, <span style={{ color: '#fac8bf' }}>{user?.name?.split(' ')[0] || 'there'}</span> 👋</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', maxWidth: 520 }}>
              {live.length > 0 ? <><strong style={{ color: '#fff' }}>{live.length} active release{live.length > 1 ? 's' : ''}</strong> in progress. <strong style={{ color: '#fff' }}>{live[0]?.currentRelease}</strong> is live now.</> : 'No active releases right now. All clear!'}
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 18 }}>
              {[{ l: 'Projects', v: projects.length, c: '#fac8bf' }, { l: 'Live', v: live.length, c: '#7ee8a2' }, { l: 'Total Stories', v: projects.reduce((s: number, p: Project) => s + p.storyCount, 0), c: '#fcd34d' }, { l: 'Defects', v: projects.reduce((s: number, p: Project) => s + p.defectCount, 0), c: '#f87171' }].map(stat => (
                <div key={stat.l} style={{ borderLeft: '2px solid rgba(255,255,255,.14)', paddingLeft: 16 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: stat.c, lineHeight: 1 }}>{stat.v}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.8px', marginTop: 2 }}>{stat.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
            {live.length > 0 && <button onClick={() => navigate(`/projects/${live[0].projectId}`)} style={{ background: ADP_RED, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>🔐 Open Certification</button>}
            {live.length > 0 && <button onClick={() => navigate(`/projects/${live[0].projectId}/sessions`)} style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📋 Active Sessions</button>}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 22 }}>
        {[
          { icon: '🔐', label: 'Start Certification', action: () => live.length > 0 ? navigate(`/projects/${live[0].projectId}`) : alert('No live releases') },
          { icon: '📋', label: 'Active Sessions', action: () => live.length > 0 ? navigate(`/projects/${live[0].projectId}/sessions`) : alert('No live releases') },
          { icon: '⚙️', label: 'Admin Panel', action: () => navigate('/admin') },
          { icon: '📊', label: 'Export Report', action: () => alert('Report export — coming soon') },
        ].map(({ icon, label, action }) => (
          <button key={label} onClick={action} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 10, padding: 14, cursor: 'pointer', transition: 'all .15s', textAlign: 'center', fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ADP_RED; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,.08)'; }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e0e4ef'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,.06)'; }}>
            <div style={{ fontSize: 22, marginBottom: 5 }}>{icon}</div>
            <div style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{label}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>All Projects</div>
          <div style={{ display: 'flex', gap: 5 }}>
            {(['all', 'salesforce', 'react'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? ADP_BLUE : '#fff', color: filter === f ? '#fff' : '#6b7280', border: '1px solid ' + (filter === f ? ADP_BLUE : '#e0e4ef'), borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: filter === f ? 700 : 500 }}>
                {f === 'all' ? `All (${projects.length})` : f === 'salesforce' ? 'Salesforce' : 'React/Other'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {user?.role === 'main-admin' && <button onClick={() => navigate('/admin')} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>➕ New Project</button>}
          <div style={{ display: 'flex', background: '#fff', border: '1px solid #e0e4ef', borderRadius: 8, padding: 3, gap: 2 }}>
            {['tile', 'list'].map(v => <button key={v} onClick={() => setView(v as any)} style={{ background: view === v ? ADP_BLUE : 'transparent', color: view === v ? '#fff' : '#9ca3af', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13, transition: 'all .15s' }}>{v === 'tile' ? '⊞' : '≡'}</button>)}
          </div>
        </div>
      </div>

      {/* Error */}
      {projError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 12 }}>❌ Failed to load projects. Is the API running?</div>}

      {/* Projects */}
      {projLoading ? (
        <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading projects...</div>
      ) : view === 'tile' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16, marginBottom: 24 }}>
          {filtered.map((p: Project) => <ProjectTile key={p.projectId} project={p} onClick={() => navigate(`/projects/${p.projectId}`)} />)}
        </div>
      ) : (
        <ProjectListTable projects={filtered} onOpen={(id) => navigate(`/projects/${id}`)} />
      )}

      {/* Activity */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Platform Activity</div>
        <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
          {activities.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12, gridColumn: '1/-1' }}>No recent activity</div>
          ) : activities.map((a: ActivityItem) => (
            <div key={a._id} style={{ padding: '11px 16px', borderBottom: '1px solid #f0f2f7', display: 'flex', gap: 10, cursor: 'pointer' }} onClick={() => navigate(`/projects/${a.projectId}`)}>
              <span style={{ fontSize: 14 }}>{a.icon}</span>
              <div>
                <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}>{a.message}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{dayjs(a.createdAt).fromNow()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectTile({ project: p, onClick }: { project: Project; onClick: () => void }) {
  const hc = healthColor(p.healthScore);
  const sc = p.status === 'Complete' ? '#18a057' : p.status === 'In Progress' ? ADP_RED : '#9ca3af';
  return (
    <div onClick={onClick} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'all .2s' }}
      onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = ADP_BLUE; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,.1)'; }}
      onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e0e4ef'; (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,.06)'; }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,${p.color},${p.color}88)` }} />
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: p.color + '12', border: `1px solid ${p.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{p.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{p.ownerEmail} · {p.teamCount} teams</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {p.isLive && <span style={{ fontSize: 9, fontWeight: 700, color: ADP_RED, display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: ADP_RED, display: 'inline-block' }} />LIVE</span>}
            <span style={{ background: sc + '14', color: sc, border: `1px solid ${sc}28`, borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{p.status}</span>
          </div>
        </div>
        {p.type === 'salesforce' && (
          <div style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 7, padding: '6px 10px', marginBottom: 10, display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700 }}>LABELS:</span>
            <span style={{ background: '#f3f0ff', color: '#7967ae', border: '1px solid #ddd6fe', borderRadius: 12, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{p.copadoCICD}</span>
            <span style={{ background: '#eff6ff', color: '#2060d8', border: '1px solid #bfdbfe', borderRadius: 12, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{p.releaseLabel}</span>
            <span style={{ fontSize: 9, color: p.syncStatus === 'synced' ? '#18a057' : p.syncStatus === 'error' ? ADP_RED : '#d4840a', marginLeft: 'auto' }}>
              {p.syncStatus === 'synced' ? '✓ Synced' : p.syncStatus === 'error' ? '✗ Error' : p.syncStatus === 'syncing' ? '↻ Syncing' : '⚠ Never synced'}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
          {[{ l: 'Releases', v: bwDate(p.releaseAnchorDate, -1), label: 'Last' }, { v: bwDate(p.releaseAnchorDate, 0), label: '● Now' }, { v: bwDate(p.releaseAnchorDate, 1), label: '▷ Next' }].map((r, i) => (
            <div key={i} style={{ flex: 1, background: i === 1 ? 'rgba(208,39,29,.05)' : '#f8f9fc', border: `1px solid ${i === 1 ? 'rgba(208,39,29,.18)' : '#e0e4ef'}`, borderRadius: 7, padding: '5px 8px' }}>
              <div style={{ fontSize: 9, color: i === 1 ? ADP_RED : '#9ca3af', fontWeight: 700, marginBottom: 1 }}>{r.label}</div>
              <div style={{ fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{r.v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginBottom: 10 }}>
          {[{ l: 'Stories', v: p.storyCount, c: '#2060d8' }, { l: 'Done', v: p.doneCount, c: '#18a057' }, { l: 'Defects', v: p.defectCount, c: p.defectCount > 5 ? ADP_RED : p.defectCount > 0 ? '#d4840a' : '#18a057' }].map(s => (
            <div key={s.l} style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 7, padding: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
              <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #e0e4ef' }}>
          <span style={{ fontSize: 10, color: '#9ca3af' }}>{p.teamCount} teams · {p.cadence}</span>
          <span style={{ fontWeight: 800, fontSize: 12, color: hc, fontFamily: "'JetBrains Mono', monospace" }}>{p.healthScore}%</span>
        </div>
        <div style={{ height: 3, background: '#f0f2f7', borderRadius: 2, overflow: 'hidden', marginTop: 8 }}>
          <div style={{ width: `${p.healthScore}%`, height: '100%', background: hc, borderRadius: 2, transition: 'width .6s ease' }} />
        </div>
      </div>
    </div>
  );
}

function ProjectListTable({ projects, onOpen }: { projects: Project[]; onOpen: (id: string) => void }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)', marginBottom: 24 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Project', 'Labels', 'Last Release', 'Current', 'Next', 'Stories', 'Health', 'Status', 'Sync', ''].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid #e0e4ef', background: '#f8f9fc', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p: Project, i: number) => {
            const hc = healthColor(p.healthScore);
            const sc = p.status === 'Complete' ? '#18a057' : p.status === 'In Progress' ? ADP_RED : '#9ca3af';
            return (
              <tr key={p.projectId} style={{ background: i % 2 === 0 ? '#fff' : 'rgba(0,0,0,.01)', cursor: 'pointer' }} onClick={() => onOpen(p.projectId)}>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{p.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{p.name}{p.isLive && <span style={{ marginLeft: 6, fontSize: 9, color: ADP_RED, fontWeight: 700 }}>● LIVE</span>}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{p.cadence} · {p.teamCount} teams</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 11 }}>
                  {p.type === 'salesforce' ? <>
                    <span style={{ background: '#f3f0ff', color: '#7967ae', border: '1px solid #ddd6fe', borderRadius: 12, padding: '2px 7px', fontSize: 10, fontWeight: 700, marginRight: 5 }}>{p.copadoCICD}</span>
                    <span style={{ background: '#eff6ff', color: '#2060d8', border: '1px solid #bfdbfe', borderRadius: 12, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{p.releaseLabel}</span>
                  </> : <span style={{ color: '#9ca3af', fontSize: 10 }}>N/A</span>}
                </td>
                <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#6b7280' }}>{bwDate(p.releaseAnchorDate, -1)}</td>
                <td style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{bwDate(p.releaseAnchorDate, 0)}</td>
                <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace', color: '#6b7280'" }}>{bwDate(p.releaseAnchorDate, 1)}</td>
                <td style={{ padding: '12px 14px', fontSize: 12 }}><span style={{ color: '#2060d8', fontWeight: 700 }}>{p.storyCount}</span> <span style={{ color: '#9ca3af', fontSize: 10 }}>({p.doneCount} done)</span></td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: hc, fontFamily: "'JetBrains Mono', monospace" }}>{p.healthScore}%</div>
                  <div style={{ width: 60, height: 4, background: '#f0f2f7', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${p.healthScore}%`, height: '100%', background: hc, borderRadius: 2 }} />
                  </div>
                </td>
                <td style={{ padding: '12px 14px' }}><span style={{ background: sc + '14', color: sc, border: `1px solid ${sc}28`, borderRadius: 12, padding: '3px 9px', fontSize: 10, fontWeight: 700 }}>{p.status}</span></td>
                <td style={{ padding: '12px 14px', fontSize: 10, color: p.syncStatus === 'synced' ? '#18a057' : p.syncStatus === 'error' ? ADP_RED : '#d4840a' }}>
                  {p.syncStatus === 'synced' ? '✓ Synced' : p.syncStatus === 'error' ? '✗ Error' : '⚠ Stale'}
                  {p.lastJiraSync && <div style={{ fontSize: 10, color: '#9ca3af' }}>{dayjs(p.lastJiraSync).fromNow()}</div>}
                </td>
                <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => onOpen(p.projectId)} style={{ background: ADP_RED, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Open →</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
