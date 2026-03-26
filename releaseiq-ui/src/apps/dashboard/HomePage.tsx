import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectApi, activityApi } from '@/services/api';
import type { Project, ActivityItem } from '@/common/types';
import { useAuthStore } from '@/store/authStore';
import { useDebounce } from '@/common/hooks';
import { HeroStats, QuickActions, ProjectTile, ProjectListTable, ActivityFeed } from './components';

type FilterKey = 'all' | 'salesforce' | 'react';
type ViewKey   = 'tile' | 'list';

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [view, setView] = useState<ViewKey>('tile');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  const { data: projects = [], isLoading: projLoading, error: projError } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectApi.list,
  });

  const { data: activities = [] } = useQuery<ActivityItem[]>({
    queryKey: ['activity'],
    queryFn: () => activityApi.list(undefined, 12),
    refetchInterval: 60000,
  });

  const live = projects.filter(p => p.isLive);
  const isAdmin = user?.role === 'main-admin' || user?.role === 'project-admin';

  // Filter + search
  const visible = projects
    .filter(p => filter === 'all' || (filter === 'salesforce' ? p.type === 'salesforce' : p.type !== 'salesforce'))
    .filter(p => !debouncedSearch || p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || p.tags?.some(t => t.toLowerCase().includes(debouncedSearch.toLowerCase())));

  return (
    <div style={{ padding: 24, maxWidth: 1300, fontFamily: "'DM Sans', sans-serif" }}>
      <HeroStats projects={projects} userName={user?.name ?? ''} />
      <QuickActions liveProjectId={live[0]?.projectId} isAdmin={isAdmin} />

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>All Projects</span>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'salesforce', 'react'] as FilterKey[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ background: filter === f ? '#121c4e' : '#fff', color: filter === f ? '#fff' : '#9ca3af', border: `1px solid ${filter === f ? '#121c4e' : '#e0e4ef'}`, borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: filter === f ? 700 : 500, fontFamily: 'inherit' }}>
                {f === 'all' ? `All (${projects.length})` : f === 'salesforce' ? 'Salesforce' : 'React/Other'}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 8, padding: '6px 12px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: 180 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {user?.role === 'main-admin' && (
            <button onClick={() => navigate('/admin')} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>➕ New Project</button>
          )}
          {/* View toggle */}
          <div style={{ display: 'flex', background: '#fff', border: '1px solid #e0e4ef', borderRadius: 8, padding: 3, gap: 2 }}>
            {(['tile', 'list'] as ViewKey[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ background: view === v ? '#121c4e' : 'transparent', color: view === v ? '#fff' : '#9ca3af', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13, transition: 'all .15s', fontFamily: 'inherit' }}>
                {v === 'tile' ? '⊞' : '≡'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {projError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 12 }}>
          ❌ Failed to load projects. Is the API running on :4000?
        </div>
      )}

      {/* Grid / List */}
      {projLoading ? (
        <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading projects…</div>
      ) : view === 'tile' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16, marginBottom: 24 }}>
          {visible.map(p => <ProjectTile key={p.projectId} project={p} onClick={() => navigate(`/projects/${p.projectId}`)} />)}
          {visible.length === 0 && <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No projects match your search</div>}
        </div>
      ) : (
        <ProjectListTable projects={visible} onOpen={id => navigate(`/projects/${id}`)} />
      )}

      {/* Activity feed */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Platform Activity</div>
        <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
}
