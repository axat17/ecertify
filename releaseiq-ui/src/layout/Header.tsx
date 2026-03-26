import React from 'react';
import { useLocation } from 'react-router-dom';
import { useToastProvider } from '@/common/hooks';

const ADP_BLUE = '#121c4e';
const ADP_RED  = '#d0271d';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/admin': 'Admin Panel',
};

export default function Header() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname]
    ?? (location.pathname.startsWith('/projects') ? 'Project Detail'
    : location.pathname.startsWith('/cert') ? 'Certification Session'
    : 'ReleaseIQ');

  return (
    <>
      <div style={{ height: 54, background: ADP_BLUE, borderBottom: `2px solid ${ADP_RED}`, display: 'flex', alignItems: 'center', padding: '0 22px', flexShrink: 0, boxShadow: '0 2px 12px rgba(18,28,78,.4)' }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.42)', fontWeight: 500 }}>{title}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', background: 'rgba(255,255,255,.1)', borderRadius: 20, padding: '4px 12px', border: '1px solid rgba(255,255,255,.14)' }}>
            {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
          </span>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}

// ─── Toast Container (mounted once inside Header) ─────────────────────────────

export function ToastContainer() {
  const toasts = useToastProvider();
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: '#fff', border: '1px solid #e0e4ef', borderLeft: `3px solid ${t.color ?? '#d0271d'}`,
          borderRadius: 10, padding: '12px 18px', fontSize: 12, color: '#111827',
          boxShadow: '0 10px 32px rgba(0,0,0,.1)', display: 'flex', alignItems: 'center', gap: 10,
          minWidth: 240, maxWidth: 360,
          animation: 'riq-fadeup .2s ease',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
