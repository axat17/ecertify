import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, ActivityItem } from '@/common/types';
import { biWeeklyDate, fmtDate, healthColor, timeAgo, ROLE_COLORS } from '@/common/utils';
import { StatusBadge } from '@/common/components/Badge';
import { ProgressBar } from '@/common/components/UI';

// ─── Hero Stats ───────────────────────────────────────────────────────────────

interface HeroStatsProps {
  projects: Project[];
  userName: string;
}

export function HeroStats({ projects, userName }: HeroStatsProps) {
  const navigate = useNavigate();
  const live = projects.filter(p => p.isLive);
  const totalStories = projects.reduce((s, p) => s + p.storyCount, 0);
  const totalDefects = projects.reduce((s, p) => s + p.defectCount, 0);

  return (
    <div style={{ background: 'linear-gradient(138deg,#121c4e 0%,#1a2660 50%,#0e183a 100%)', borderRadius: 16, padding: '28px 32px', marginBottom: 22, border: '1px solid rgba(208,39,29,.2)', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 12px rgba(18,28,78,.3)' }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(208,39,29,.18) 0%,transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.38)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6, fontWeight: 600 }}>ADP · Release Management Platform</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 5 }}>
            Good morning, <span style={{ color: '#fac8bf' }}>{userName?.split(' ')[0] || 'there'}</span> 👋
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', maxWidth: 520 }}>
            {live.length > 0
              ? <><strong style={{ color: '#fff' }}>{live.length} active release{live.length > 1 ? 's' : ''}</strong> in progress. <strong style={{ color: '#fff' }}>{live[0]?.currentRelease}</strong> is live now.</>
              : 'No active releases right now. All clear!'}
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 18 }}>
            {[
              { l: 'Projects',     v: projects.length,  c: '#fac8bf' },
              { l: 'Live',         v: live.length,       c: '#7ee8a2' },
              { l: 'Total Stories',v: totalStories,      c: '#fcd34d' },
              { l: 'Defects',      v: totalDefects,      c: '#f87171' },
            ].map(stat => (
              <div key={stat.l} style={{ borderLeft: '2px solid rgba(255,255,255,.14)', paddingLeft: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: stat.c, lineHeight: 1 }}>{stat.v}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.8px', marginTop: 2 }}>{stat.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
          {live.length > 0 && (
            <>
              <button onClick={() => navigate(`/projects/${live[0].projectId}`)} style={{ background: '#d0271d', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>🔐 Open Certification</button>
              <button onClick={() => navigate(`/projects/${live[0].projectId}/sessions`)} style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>📋 Active Sessions</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

interface QuickActionsProps {
  liveProjectId?: string;
  isAdmin: boolean;
}

export function QuickActions({ liveProjectId, isAdmin }: QuickActionsProps) {
  const navigate = useNavigate();
  const actions = [
    { icon: '🔐', label: 'Start Certification', action: () => liveProjectId ? navigate(`/projects/${liveProjectId}`) : alert('No live releases') },
    { icon: '📋', label: 'Active Sessions',     action: () => liveProjectId ? navigate(`/projects/${liveProjectId}/sessions`) : alert('No live releases') },
    { icon: '⚙️', label: 'Admin Panel',         action: () => navigate('/admin'), hidden: !isAdmin },
    { icon: '📊', label: 'Export Report',        action: () => alert('Export — coming soon') },
  ].filter(a => !a.hidden);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${actions.length},1fr)`, gap: 10, marginBottom: 22 }}>
      {actions.map(({ icon, label, action }) => (
        <button key={label} onClick={action}
          style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 10, padding: 14, cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'all .15s' }}
          onMouseOver={e => { (e.currentTarget).style.borderColor = '#d0271d'; (e.currentTarget).style.boxShadow = '0 4px 12px rgba(0,0,0,.08)'; }}
          onMouseOut={e => { (e.currentTarget).style.borderColor = '#e0e4ef'; (e.currentTarget).style.boxShadow = '0 1px 3px rgba(0,0,0,.06)'; }}>
          <div style={{ fontSize: 22, marginBottom: 5 }}>{icon}</div>
          <div style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{label}</div>
        </button>
      ))}
    </div>
  );
}

// ─── Project Tile ─────────────────────────────────────────────────────────────

interface ProjectTileProps { project: Project; onClick: () => void }

export function ProjectTile({ project: p, onClick }: ProjectTileProps) {
  const hc = healthColor(p.healthScore);
  const sc = p.status === 'Complete' ? '#18a057' : p.status === 'In Progress' ? '#d0271d' : '#9ca3af';

  const last = biWeeklyDate(p.releaseAnchorDate, -1);
  const current = biWeeklyDate(p.releaseAnchorDate, 0);
  const next = biWeeklyDate(p.releaseAnchorDate, 1);

  return (
    <div onClick={onClick}
      style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'all .2s' }}
      onMouseOver={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = '#121c4e'; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 12px 32px rgba(0,0,0,.1)'; }}
      onMouseOut={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = '#e0e4ef'; el.style.transform = ''; el.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)'; }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,${p.color},${p.color}88)` }} />
      <div style={{ padding: 18 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: p.color + '12', border: `1px solid ${p.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{p.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{p.ownerEmail} · {p.teamCount} teams</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {p.isLive && <span style={{ fontSize: 9, fontWeight: 700, color: '#d0271d', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#d0271d', animation: 'riq-pulse 2s infinite', display: 'inline-block' }} />LIVE
            </span>}
            <StatusBadge status={p.status} small />
          </div>
        </div>

        {/* Jira labels (Salesforce only) */}
        {p.type === 'salesforce' && (
          <div style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 7, padding: '6px 10px', marginBottom: 10, display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700 }}>LABELS:</span>
            <span style={{ background: '#f3f0ff', color: '#7967ae', border: '1px solid #ddd6fe', borderRadius: 12, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{p.copadoCICD}</span>
            <span style={{ background: '#eff6ff', color: '#2060d8', border: '1px solid #bfdbfe', borderRadius: 12, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{p.releaseLabel}</span>
            <span style={{ fontSize: 9, marginLeft: 'auto', color: p.syncStatus === 'synced' ? '#18a057' : p.syncStatus === 'error' ? '#d0271d' : '#d4840a', fontWeight: 600 }}>
              {p.syncStatus === 'synced' ? '✓ Synced' : p.syncStatus === 'error' ? '✗ Error' : p.syncStatus === 'syncing' ? '↻' : '⚠ Stale'}
            </span>
          </div>
        )}

        {/* Release rows */}
        {[
          { label: '▸ Last',  date: last,    bg: '#f8f9fc', border: '#e0e4ef',           labelColor: '#9ca3af', rel: `${p.shortName} (prev)` },
          { label: '● Now',   date: current, bg: 'rgba(208,39,29,.05)', border: 'rgba(208,39,29,.18)', labelColor: '#d0271d', rel: p.currentRelease },
          { label: '▷ Next',  date: next,    bg: 'rgba(32,96,216,.04)', border: 'rgba(32,96,216,.14)', labelColor: '#2060d8', rel: `${p.shortName} (next)` },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: r.bg, border: `1px solid ${r.border}`, borderRadius: 7, padding: '5px 9px', marginBottom: 4, fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: r.labelColor, fontWeight: 700, width: 44 }}>{r.label}</span>
              <span style={{ fontWeight: 600 }}>{r.rel}</span>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#9ca3af' }}>{fmtDate(r.date)}</span>
          </div>
        ))}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, margin: '10px 0' }}>
          {[
            { l: 'Stories',  v: p.storyCount,  c: '#2060d8' },
            { l: 'Done',     v: p.doneCount,    c: '#18a057' },
            { l: 'Defects',  v: p.defectCount,  c: p.defectCount > 5 ? '#d0271d' : p.defectCount > 0 ? '#d4840a' : '#18a057' },
          ].map(s => (
            <div key={s.l} style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 7, padding: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
              <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #e0e4ef' }}>
          <span style={{ fontSize: 10, color: '#9ca3af' }}>{p.teamCount} teams · {p.cadence}</span>
          <span style={{ fontWeight: 800, fontSize: 12, color: hc, fontFamily: "'JetBrains Mono', monospace" }}>{p.healthScore}%</span>
        </div>
        <ProgressBar value={p.healthScore} height={3} />
      </div>
    </div>
  );
}

// ─── Project List Table Row ───────────────────────────────────────────────────

interface ProjectListTableProps {
  projects: Project[];
  onOpen: (id: string) => void;
}

export function ProjectListTable({ projects, onOpen }: ProjectListTableProps) {
  if (projects.length === 0) {
    return <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No projects match this filter</div>;
  }
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)', marginBottom: 24 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Project', 'Labels', 'Current Release', 'Next', 'Stories', 'Health', 'Status', 'Sync', ''].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid #e0e4ef', background: '#f8f9fc', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => {
            const hc = healthColor(p.healthScore);
            return (
              <tr key={p.projectId} style={{ background: i % 2 !== 0 ? 'rgba(0,0,0,.01)' : '#fff', cursor: 'pointer', transition: 'background .1s' }}
                onClick={() => onOpen(p.projectId)}
                onMouseOver={e => (e.currentTarget as HTMLTableRowElement).style.background = '#f8f9fc'}
                onMouseOut={e => (e.currentTarget as HTMLTableRowElement).style.background = i % 2 !== 0 ? 'rgba(0,0,0,.01)' : '#fff'}>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{p.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{p.name}{p.isLive && <span style={{ marginLeft: 6, fontSize: 9, color: '#d0271d', fontWeight: 700 }}>● LIVE</span>}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{p.cadence} · {p.teamCount} teams</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {p.type === 'salesforce'
                    ? <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ background: '#f3f0ff', color: '#7967ae', border: '1px solid #ddd6fe', borderRadius: 12, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{p.copadoCICD}</span>
                        <span style={{ background: '#eff6ff', color: '#2060d8', border: '1px solid #bfdbfe', borderRadius: 12, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{p.releaseLabel}</span>
                      </div>
                    : <span style={{ color: '#9ca3af', fontSize: 10 }}>N/A</span>}
                </td>
                <td style={{ padding: '12px 14px', fontSize: 11, fontWeight: 600 }}>{p.currentRelease}</td>
                <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#6b7280' }}>{fmtDate(biWeeklyDate(p.releaseAnchorDate, 1))}</td>
                <td style={{ padding: '12px 14px', fontSize: 12 }}>
                  <span style={{ color: '#2060d8', fontWeight: 700 }}>{p.storyCount}</span>
                  <span style={{ color: '#9ca3af', fontSize: 10 }}> ({p.doneCount} done)</span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: hc, fontFamily: "'JetBrains Mono', monospace" }}>{p.healthScore}%</div>
                  <ProgressBar value={p.healthScore} height={4} />
                </td>
                <td style={{ padding: '12px 14px' }}><StatusBadge status={p.status} small /></td>
                <td style={{ padding: '12px 14px', fontSize: 10, color: p.syncStatus === 'synced' ? '#18a057' : p.syncStatus === 'error' ? '#d0271d' : '#d4840a' }}>
                  {p.syncStatus === 'synced' ? '✓ Synced' : p.syncStatus === 'error' ? '✗ Error' : '⚠ Stale'}
                  {p.lastJiraSync && <div style={{ fontSize: 9, color: '#9ca3af' }}>{timeAgo(p.lastJiraSync)}</div>}
                </td>
                <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => onOpen(p.projectId)} style={{ background: '#d0271d', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>Open →</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  const navigate = useNavigate();
  if (activities.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>No recent activity</div>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
      {activities.map(a => (
        <div key={a._id} onClick={() => navigate(`/projects/${a.projectId}`)}
          style={{ padding: '11px 16px', borderBottom: '1px solid #f0f2f7', display: 'flex', gap: 10, cursor: 'pointer', transition: 'background .1s' }}
          onMouseOver={e => (e.currentTarget as HTMLDivElement).style.background = '#f8f9fc'}
          onMouseOut={e => (e.currentTarget as HTMLDivElement).style.background = ''}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>{a.icon}</span>
          <div>
            <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}>{a.message}</div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{timeAgo(a.createdAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
