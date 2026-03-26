import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { projectApi, authApi } from '@/services/api';
import type { Project } from '@/services/api';

const ADP_BLUE = '#121c4e';
const ADP_RED = '#d0271d';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const { data: projects = [] } = useQuery({
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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" }}>
      {/* SIDEBAR */}
      <div style={{ width: collapsed ? 52 : 216, background: ADP_BLUE, display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width .2s', overflow: 'hidden' }}>
        {/* Logo */}
        <div style={{ padding: '14px 14px', borderBottom: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ width: 28, height: 28, background: ADP_RED, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>ADP</div>
          {!collapsed && <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-.3px', whiteSpace: 'nowrap' }}>ReleaseIQ</span>}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          <NavItem icon="🏠" label="Home" to="/" active={location.pathname === '/'} collapsed={collapsed} />

          {!collapsed && <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '1.3px', padding: '10px 16px 4px' }}>Projects</div>}

          {projects.map((p: Project) => (
            <NavItem
              key={p.projectId}
              icon={p.icon}
              label={p.shortName}
              to={`/projects/${p.projectId}`}
              active={isActive(`/projects/${p.projectId}`)}
              collapsed={collapsed}
              badge={p.isLive ? 'LIVE' : undefined}
            />
          ))}

          {!collapsed && <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '8px 0' }} />}
          {!collapsed && <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '1.3px', padding: '6px 16px 4px' }}>Platform</div>}

          {(user?.role === 'main-admin' || user?.role === 'project-admin') && (
            <NavItem icon="⚙️" label="Admin" to="/admin" active={isActive('/admin')} collapsed={collapsed} />
          )}
        </div>

        {/* Bottom: user + collapse */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', padding: '10px 0' }}>
          {!collapsed && (
            <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: ADP_RED, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {user?.initials || 'JD'}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.role === 'main-admin' ? '★ Main Admin' : user?.role === 'project-admin' ? 'Project Admin' : 'User'}</div>
              </div>
            </div>
          )}
          <button onClick={handleLogout} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', padding: '8px 14px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
            <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>↩️</span>
            {!collapsed && 'Sign Out'}
          </button>
          <button onClick={() => setCollapsed(c => !c)} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', padding: '6px 14px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{collapsed ? '▶' : '◀'}</span>
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ height: 54, background: ADP_BLUE, borderBottom: `2px solid ${ADP_RED}`, display: 'flex', alignItems: 'center', padding: '0 22px', flexShrink: 0, boxShadow: '0 2px 12px rgba(18,28,78,.4)' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.42)', fontWeight: 500 }}>
            {location.pathname === '/' ? 'Dashboard' : location.pathname.startsWith('/projects') ? 'Project Detail' : location.pathname.startsWith('/admin') ? 'Admin Panel' : 'ReleaseIQ'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', background: 'rgba(255,255,255,.1)', borderRadius: 20, padding: '4px 12px', border: '1px solid rgba(255,255,255,.14)' }}>
              {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#f0f2f7' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, to, active, collapsed, badge }: { icon: string; label: string; to: string; active: boolean; collapsed: boolean; badge?: string }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px 9px 16px',
        color: active ? '#fff' : 'rgba(255,255,255,.6)',
        background: active ? 'rgba(208,39,29,.2)' : 'transparent',
        borderLeft: `3px solid ${active ? '#d0271d' : 'transparent'}`,
        textDecoration: 'none', fontSize: 12, fontWeight: active ? 600 : 500,
        transition: 'all .15s', whiteSpace: 'nowrap', overflow: 'hidden',
      }}
    >
      <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      {!collapsed && (
        <>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          {badge && (
            <span style={{ fontSize: 9, fontWeight: 700, background: '#d0271d', color: '#fff', borderRadius: 10, padding: '2px 6px', animation: 'pulse 2s infinite' }}>
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}
