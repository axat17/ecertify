import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certApi } from '@/services/api';
import type { CertSession } from '@/services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const STATUS_COLOR: Record<string, string> = {
  'In Progress': '#2060d8',
  'Complete': '#18a057',
  'Blocked': '#d4840a',
  'Waiting': '#9ca3af',
};

const ROLE_LABEL: Record<string, string> = {
  bu: 'BU Rep', qa: 'QA Team', rm: 'Release Mgr', dev: 'Dev Lead',
};

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function ActiveSessionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'In Progress' | 'Complete' | 'Blocked'>('all');

  // Auto-refresh every 30 seconds — keeps session durations live
  const { data: response, isLoading, error, isFetching } = useQuery({
    queryKey: ['activeSessions', projectId],
    queryFn: () => certApi.getActive(projectId),
    refetchInterval: 30000,
  });

  const sessions: CertSession[] = response?.data || [];
  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);
  const inProgress = sessions.filter(s => s.status === 'In Progress');
  const complete = sessions.filter(s => s.status === 'Complete');
  const blocked = sessions.filter(s => s.status === 'Blocked');

  const completeMutation = useMutation({
    mutationFn: (sessionId: string) => certApi.complete(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activeSessions'] }),
  });

  function copyLink(sessionId: string) {
    const link = `${window.location.origin}/cert/${sessionId}`;
    navigator.clipboard.writeText(link).then(() => alert('Session link copied!'));
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ background: '#f0f2f7', border: '1px solid #e0e4ef', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>← Back</button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Active Certification Sessions</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Manage all sessions for this release. Auto-refreshes every 30s.
            {isFetching && <span style={{ marginLeft: 8, color: '#2060d8' }}>↻ Refreshing...</span>}
          </div>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['activeSessions'] })}
          style={{ marginLeft: 'auto', background: '#fff', border: '1px solid #e0e4ef', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
        >
          ↻ Refresh Now
        </button>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Sessions', value: sessions.length, color: '#2060d8' },
          { label: 'In Progress', value: inProgress.length, color: '#2060d8' },
          { label: 'Complete', value: complete.length, color: '#18a057' },
          { label: 'Blocked', value: blocked.length, color: '#d4840a' },
          { label: 'Total Defects', value: sessions.reduce((s, c) => s + c.defectCount, 0), color: '#d0271d' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 10, padding: 16, flex: 1, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>{stat.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Warning if someone lost their link */}
      {inProgress.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>⚠️</span>
          <span><strong>{inProgress.length} session{inProgress.length > 1 ? 's' : ''} in progress.</strong> If a tester lost their link, use the 🔗 button below to resend it.</span>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#fff', border: '1px solid #e0e4ef', borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
        {(['all', 'In Progress', 'Complete', 'Blocked'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? '#121c4e' : 'transparent', color: filter === f ? '#fff' : '#6b7280',
            border: 'none', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all .15s',
          }}>
            {f === 'all' ? `All (${sessions.length})` : `${f} (${sessions.filter(s => s.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 12 }}>
          ❌ Failed to load sessions. {(error as Error).message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          Loading sessions...
        </div>
      )}

      {/* Sessions table */}
      {!isLoading && (
        <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No sessions match this filter
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Certifier', 'Role', 'Business Unit', 'Environment', 'Started', 'Duration', 'Defects', 'Verified Stories', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid #e0e4ef', background: '#f8f9fc', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((session, i) => (
                  <tr key={session.sessionId} style={{ background: i % 2 === 0 ? '#fff' : 'rgba(0,0,0,.01)' }}>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, color: '#111827' }}>{session.certifierName}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        background: session.certifierRole === 'qa' ? '#f3f0ff' : session.certifierRole === 'rm' ? '#fff7ed' : '#eff6ff',
                        color: session.certifierRole === 'qa' ? '#7967ae' : session.certifierRole === 'rm' ? '#c85f1a' : '#2060d8',
                        border: `1px solid ${session.certifierRole === 'qa' ? '#ddd6fe' : session.certifierRole === 'rm' ? '#fed7aa' : '#bfdbfe'}`,
                        borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                      }}>
                        {ROLE_LABEL[session.certifierRole] || session.certifierRole}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#374151' }}>{session.businessUnit || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: '#374151' }}>{session.environment}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: '#6b7280', fontFamily: "'JetBrains Mono', monospace" }}>
                      {dayjs(session.startedAt).format('HH:mm')}
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{dayjs(session.startedAt).fromNow()}</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#374151' }}>
                      {formatDuration(session.status === 'In Progress'
                        ? Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
                        : session.durationSeconds)}
                      {session.status === 'In Progress' && <span style={{ marginLeft: 4, fontSize: 9, color: '#2060d8' }}>LIVE</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: session.defectCount > 3 ? '#d0271d' : session.defectCount > 0 ? '#d4840a' : '#18a057' }}>
                      {session.defectCount}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#374151' }}>{session.verifiedStoryKeys.length}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: STATUS_COLOR[session.status] + '14', color: STATUS_COLOR[session.status], border: `1px solid ${STATUS_COLOR[session.status]}28`, borderRadius: 12, padding: '3px 9px', fontSize: 10, fontWeight: 700 }}>
                        {session.status === 'In Progress' && '● '}{session.status}
                      </span>
                      {session.blockedReason && (
                        <div style={{ fontSize: 10, color: '#d4840a', marginTop: 3 }} title={session.blockedReason}>⚠ {session.blockedReason.substring(0, 30)}...</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => copyLink(session.sessionId)}
                          style={{ background: '#eff6ff', color: '#2060d8', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                          title="Copy session link to resend to tester"
                        >
                          🔗 Link
                        </button>
                        <button
                          onClick={() => navigate(`/cert/${session.sessionId}`)}
                          style={{ background: '#f0fdf4', color: '#18a057', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                          title="View session details"
                        >
                          View
                        </button>
                        {session.status === 'In Progress' && (
                          <button
                            onClick={() => { if (window.confirm(`Force complete session for ${session.certifierName}?`)) completeMutation.mutate(session.sessionId); }}
                            style={{ background: '#fff7ed', color: '#c85f1a', border: '1px solid #fed7aa', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                            title="Force complete this session (use if tester is done but window closed)"
                          >
                            Force ✓
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: '#9ca3af' }}>
        💡 <strong>Lost session link?</strong> Click 🔗 Link next to any In Progress session and resend the URL to the tester. Their session data is fully preserved in MongoDB.
      </div>
    </div>
  );
}
