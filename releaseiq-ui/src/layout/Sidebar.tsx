import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { projectApi, authApi } from '@/services/api';
import type { Project } from '@/common/types';

const ADP_BLUE = '#121c4e';
const ADP_RED  = '#d0271d';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectApi.list,
    staleTime: 1000 * 60 * 5,
  });

  function handleLogout() {
    authApi.logout().catch(() => {});
    logout();
    navigate('/login');
  }

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  }

  const W = collapsed ? 52 : 216;

  return (
    <div style={{ width: W, background: ADP_BLUE, display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width .2s', overflow: 'hidden' }}>
      {/* Logo */}
      <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('/')}>
        <div style={{ width: 28, height: 28, background: ADP_RED, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>ADP</div>
        {!collapsed && <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-.3px', whiteSpace: 'nowrap' }}>ReleaseIQ</span>}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <NavLink icon="🏠" label="Home" to="/" active={location.pathname === '/'} collapsed={collapsed} />

        {!collapsed && <SectionLabel>Projects</SectionLabel>}

        {projects.map((p: Project) => (
          <NavLink
            key={p.projectId}
            icon={p.icon}
            label={p.shortName}
            to={`/projects/${p.projectId}`}
            active={isActive(`/projects/${p.projectId}`)}
            collapsed={collapsed}
            badge={p.isLive ? 'LIVE' : undefined}
            badgeColor={ADP_RED}
          />
        ))}

        <Divider />
        {!collapsed && <SectionLabel>Platform</SectionLabel>}

        {(user?.role === 'main-admin' || user?.role === 'project-admin') && (
          <NavLink icon="⚙️" label="Admin" to="/admin" active={isActive('/admin')} collapsed={collapsed} />
        )}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', padding: '8px 0', flexShrink: 0 }}>
        {!collapsed && user && (
          <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar name={user.name} size={26} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>
                {user.role === 'main-admin' ? '★ Main Admin' : user.role === 'project-admin' ? 'Project Admin' : 'User'}
              </div>
            </div>
          </div>
        )}
        <SbBtn icon="↩️" label="Sign Out" onClick={handleLogout} collapsed={collapsed} />
        <SbBtn icon={collapsed ? '▶' : '◀'} label={collapsed ? 'Expand' : 'Collapse'} onClick={onToggleCollapse} collapsed={collapsed} />
      </div>
    </div>
  );
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function NavLink({ icon, label, to, active, collapsed, badge, badgeColor }: { icon: string; label: string; to: string; active: boolean; collapsed: boolean; badge?: string; badgeColor?: string }) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '9px 14px 9px 16px',
      color: active ? '#fff' : 'rgba(255,255,255,.6)',
      background: active ? 'rgba(208,39,29,.2)' : 'transparent',
      borderLeft: `3px solid ${active ? '#d0271d' : 'transparent'}`,
      textDecoration: 'none', fontSize: 12, fontWeight: active ? 600 : 500,
      transition: 'all .15s', whiteSpace: 'nowrap', overflow: 'hidden',
    }}>
      <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      {!collapsed && (
        <>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          {badge && (
            <span style={{ fontSize: 9, fontWeight: 700, background: badgeColor ?? '#d0271d', color: '#fff', borderRadius: 10, padding: '2px 6px', flexShrink: 0 }}>{badge}</span>
          )}
        </>
      )}
    </Link>
  );
}

function SbBtn({ icon, label, onClick, collapsed }: { icon: string; label: string; onClick: () => void; collapsed: boolean }) {
  return (
    <button onClick={onClick} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,.45)', padding: '8px 14px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', transition: 'color .15s' }}
      onMouseOver={e => (e.currentTarget.style.color = 'rgba(255,255,255,.8)')}
      onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,.45)')}>
      <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      {!collapsed && label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '1.3px', padding: '10px 16px 4px' }}>{children}</div>;
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '4px 0' }} />;
}

function Avatar({ name, size }: { name: string; size: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#d0271d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  );
}
