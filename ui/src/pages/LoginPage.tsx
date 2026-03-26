import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const IS_MOCK = import.meta.env.VITE_AUTH_MODE === 'mock' || !import.meta.env.VITE_AUTH_MODE;

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [email, setEmail] = useState('john.doe@adp.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reason = params.get('reason');

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  async function handleMockLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required'); return; }
    if (!email.includes('@')) { setError('Enter a valid email'); return; }
    setLoading(true); setError('');
    try {
      const { token, user } = await authApi.mockLogin(email.trim().toLowerCase());
      setAuth(token, user);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed. Is the API running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: '#d0271d', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>ADP</div>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#121c4e' }}>ReleaseIQ</span>
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>Release Management Platform</div>
        </div>

        {/* Session expired banner */}
        {reason === 'session_expired' && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#991b1b', display: 'flex', gap: 8 }}>
            <span>⚠️</span><span>Your session expired. Please sign in again.</span>
          </div>
        )}

        {/* Card */}
        <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 14, padding: '28px 28px', boxShadow: '0 4px 12px rgba(0,0,0,.06)' }}>
          {IS_MOCK ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: '#111827' }}>Local Development Login</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>Enter any ADP email to log in. Role is determined by seed data.</div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', marginBottom: 20, fontSize: 11, color: '#1d4ed8' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Demo Accounts</div>
                <div>🔴 Main Admin: john.doe@adp.com</div>
                <div>🔵 Project Admin: jane.smith@adp.com</div>
                <div>⚪ BU Tester: tester.bu@adp.com</div>
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#991b1b' }}>
                  ❌ {error}
                </div>
              )}

              <form onSubmit={handleMockLogin}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@adp.com"
                  style={{ width: '100%', background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', background: loading ? '#9ca3af' : '#d0271d', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? 'Signing in...' : 'Sign In (Mock)'}
                </button>
              </form>

              <div style={{ marginTop: 16, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 11, color: '#92400e' }}>
                ⚠️ Mock mode. Set <code>VITE_AUTH_MODE=azure</code> in .env for Azure SSO.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: '#111827' }}>Sign in with ADP</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 24 }}>Use your ADP Azure AD account. No separate password needed.</div>
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#991b1b' }}>
                  ❌ {error}
                </div>
              )}
              <button
                disabled={loading}
                onClick={() => { setLoading(true); setError(''); /* MSAL redirect happens here in production */ }}
                style={{ width: '100%', background: '#121c4e', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                <svg width="16" height="16" viewBox="0 0 21 21" fill="none"><rect x="0" y="0" width="10" height="10" fill="#f25022"/><rect x="11" y="0" width="10" height="10" fill="#7fba00"/><rect x="0" y="11" width="10" height="10" fill="#00a4ef"/><rect x="11" y="11" width="10" height="10" fill="#ffb900"/></svg>
                {loading ? 'Redirecting...' : 'Sign in with Microsoft'}
              </button>
              <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>Secured by Azure Active Directory SSO</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
