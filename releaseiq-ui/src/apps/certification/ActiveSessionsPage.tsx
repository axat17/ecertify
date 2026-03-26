import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certApi } from '@/services/api';
import type { CertSession } from '@/common/types';
import { fmtDuration, fmtDateTime, timeAgo, ROLE_LABELS } from '@/common/utils';
import { useTimer } from '@/common/hooks';
import { Alert, EmptyState } from '@/common/components/UI';
import Badge from '@/common/components/Badge';
import Button from '@/common/components/Button';
import { useClipboard } from '@/common/hooks';

export default function ActiveSessionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate      = useNavigate();
  const qc            = useQueryClient();
  const { copy, copied } = useClipboard();
  const [filter, setFilter] = useState<'all'|'In Progress'|'Complete'|'Blocked'>('all');

  const { data: response, isLoading, error, isFetching } = useQuery({
    queryKey: ['activeSessions', projectId],
    queryFn:  () => certApi.getActive(projectId),
    refetchInterval: 30000,
  });

  const sessions: CertSession[] = (response as any)?.data ?? [];
  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);

  const completeMut = useMutation({
    mutationFn: (sid: string) => certApi.complete(sid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activeSessions'] }),
  });

  const counts = {
    inProgress: sessions.filter(s => s.status === 'In Progress').length,
    complete:   sessions.filter(s => s.status === 'Complete').length,
    blocked:    sessions.filter(s => s.status === 'Blocked').length,
    defects:    sessions.reduce((n, s) => n + s.defectCount, 0),
  };

  return (
    <div style={{ padding:24, maxWidth:1200, fontFamily:"'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Button>
        <div>
          <div style={{ fontSize:20, fontWeight:800 }}>Active Certification Sessions</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
            Auto-refreshes every 30s.
            {isFetching && <span style={{ marginLeft:8, color:'#2060d8' }}>↻ Refreshing…</span>}
          </div>
        </div>
        <Button variant="ghost" size="sm" style={{ marginLeft:'auto' }}
          onClick={() => qc.invalidateQueries({ queryKey:['activeSessions'] })}>
          ↻ Refresh Now
        </Button>
      </div>

      {/* Stats */}
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        {[
          { l:'Total',       v: sessions.length,   c:'#2060d8' },
          { l:'In Progress', v: counts.inProgress,  c:'#2060d8' },
          { l:'Complete',    v: counts.complete,    c:'#18a057' },
          { l:'Blocked',     v: counts.blocked,     c:'#d4840a' },
          { l:'Total Defects',v:counts.defects,     c:'#d0271d' },
        ].map(s => (
          <div key={s.l} style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:10, padding:16, flex:1, boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'.8px', marginBottom:6 }}>{s.l}</div>
            <div style={{ fontSize:26, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tip */}
      {counts.inProgress > 0 && (
        <Alert type="warning" style={{ marginBottom:16 }}>
          <strong>{counts.inProgress} session{counts.inProgress>1?'s':''} in progress.</strong> If a tester lost their link, use the 🔗 button to resend it.
        </Alert>
      )}

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:4, background:'#fff', border:'1px solid #e0e4ef', borderRadius:10, padding:4, marginBottom:16, width:'fit-content' }}>
        {(['all','In Progress','Complete','Blocked'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter===f ? '#121c4e' : 'transparent', color: filter===f ? '#fff' : '#6b7280',
            border:'none', borderRadius:7, padding:'7px 14px', cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:'inherit',
          }}>
            {f === 'all' ? `All (${sessions.length})` : `${f} (${sessions.filter(s => s.status === f).length})`}
          </button>
        ))}
      </div>

      {error && <Alert type="error" style={{ marginBottom:16 }}>Failed to load sessions. {(error as Error).message}</Alert>}

      {isLoading
        ? <EmptyState icon="⏳" title="Loading sessions…" />
        : filtered.length === 0
          ? <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:12 }}><EmptyState title="No sessions match this filter" /></div>
          : (
            <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>
                  {['Certifier','Role','BU','Env','Started','Duration','Defects','Verified','Status','Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.6px', borderBottom:'1px solid #e0e4ef', background:'#f8f9fc', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <SessionRow key={s.sessionId} session={s} striped={i%2!==0}
                      onCopyLink={() => copy(`${window.location.origin}/cert/${s.sessionId}`)}
                      onForceComplete={() => { if (window.confirm(`Force complete for ${s.certifierName}?`)) completeMut.mutate(s.sessionId); }}
                      onView={() => navigate(`/cert/${s.sessionId}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )
      }

      <div style={{ marginTop:14, fontSize:11, color:'#9ca3af' }}>
        💡 <strong>Lost session link?</strong> Click 🔗 Link next to any In Progress session to copy and resend the URL. Session data is preserved in MongoDB — the tester can rejoin from where they left off.
      </div>
    </div>
  );
}

function SessionRow({ session: s, striped, onCopyLink, onForceComplete, onView }: {
  session: CertSession; striped: boolean;
  onCopyLink: ()=>void; onForceComplete: ()=>void; onView: ()=>void;
}) {
  const elapsed = useTimer(s.startedAt, s.status === 'In Progress');
  const statusColor = s.status==='In Progress'?'#2060d8': s.status==='Complete'?'#18a057': s.status==='Blocked'?'#d4840a':'#9ca3af';

  return (
    <tr style={{ background: striped ? 'rgba(0,0,0,.01)' : '#fff' }}>
      <td style={{ padding:'12px 14px', fontSize:12, fontWeight:600 }}>{s.certifierName}</td>
      <td style={{ padding:'12px 14px' }}>
        <Badge label={ROLE_LABELS[s.certifierRole] ?? s.certifierRole} color={s.certifierRole==='qa'?'#7967ae':s.certifierRole==='rm'?'#c85f1a':'#2060d8'} small />
      </td>
      <td style={{ padding:'12px 14px', fontSize:12, color:'#374151' }}>{s.businessUnit || '—'}</td>
      <td style={{ padding:'12px 14px', fontSize:11, color:'#374151' }}>{s.environment}</td>
      <td style={{ padding:'12px 14px', fontSize:11, color:'#6b7280', fontFamily:"'JetBrains Mono',monospace" }}>
        {new Date(s.startedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
        <div style={{ fontSize:10, color:'#9ca3af' }}>{timeAgo(s.startedAt)}</div>
      </td>
      <td style={{ padding:'12px 14px', fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>
        {fmtDuration(s.status==='In Progress' ? elapsed : s.durationSeconds)}
        {s.status==='In Progress' && <span style={{ marginLeft:4, fontSize:9, color:'#2060d8' }}>LIVE</span>}
      </td>
      <td style={{ padding:'12px 14px', fontSize:13, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:s.defectCount>3?'#d0271d':s.defectCount>0?'#d4840a':'#18a057' }}>
        {s.defectCount}
      </td>
      <td style={{ padding:'12px 14px', fontSize:12 }}>{s.verifiedStoryKeys.length}</td>
      <td style={{ padding:'12px 14px' }}>
        <span style={{ background:statusColor+'14', color:statusColor, border:`1px solid ${statusColor}28`, borderRadius:12, padding:'3px 9px', fontSize:10, fontWeight:700 }}>
          {s.status==='In Progress'&&'● '}{s.status}
        </span>
        {s.blockedReason && <div style={{ fontSize:10, color:'#d4840a', marginTop:3 }}>⚠ {s.blockedReason.slice(0,30)}…</div>}
      </td>
      <td style={{ padding:'12px 14px' }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <Button variant="ghost" size="xs" onClick={onCopyLink} style={{ color:'#2060d8', borderColor:'#bfdbfe', background:'#eff6ff' }} title="Copy cert link to resend">🔗 Link</Button>
          <Button variant="ghost" size="xs" onClick={onView}     style={{ color:'#18a057', borderColor:'#bbf7d0', background:'#f0fdf4' }}>View</Button>
          {s.status === 'In Progress' && (
            <Button variant="ghost" size="xs" onClick={onForceComplete} style={{ color:'#c85f1a', borderColor:'#fed7aa', background:'#fff7ed' }} title="Force complete if tester's window closed">Force ✓</Button>
          )}
        </div>
      </td>
    </tr>
  );
}
