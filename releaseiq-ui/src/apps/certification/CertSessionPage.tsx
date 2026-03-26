import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certApi, jiraApi } from '@/services/api';
import type { CertSession, JiraStory } from '@/common/types';
import { fmtDuration, ROLE_LABELS } from '@/common/utils';
import { useTimer } from '@/common/hooks';
import { Alert, EmptyState, Modal } from '@/common/components/UI';
import Button from '@/common/components/Button';
import { JoinForm, DefectForm, JiraBulkModal, SessionCompleteSummary, DefectItem } from './components';
import type { JoinFormValues, DefectFormValues } from './components';

const ADP_RED  = '#d0271d';
const ADP_BLUE = '#121c4e';

export default function CertSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showDefectForm,  setShowDefectForm]  = useState(false);
  const [showBulkCreate,  setShowBulkCreate]  = useState(false);
  const [selectedIds,     setSelectedIds]     = useState<string[]>([]);
  const [joinError,       setJoinError]       = useState('');

  /* ── Fetch session (no auth required — UUID is the credential) ── */
  const { data: resumeData, isLoading, error } = useQuery({
    queryKey: ['certSession', sessionId],
    queryFn:  () => certApi.resume(sessionId!),
    enabled:  !!sessionId,
    refetchInterval: 60000,
    retry: 2,
  });

  const session: CertSession | null = (resumeData as any)?.data?.session ?? null;
  const projectInfo                 = (resumeData as any)?.data?.project ?? null;
  const elapsed = useTimer(session?.startedAt, session?.status === 'In Progress');

  /* ── Stories to verify ── */
  const { data: storiesResp } = useQuery({
    queryKey: ['stories', session?.projectId],
    queryFn:  () => jiraApi.stories(session!.projectId, { hasCopadoCICD:'true', hasReleaseLabel:'true' }),
    enabled:  !!session?.projectId && session.status === 'In Progress',
  });
  const stories: JiraStory[] = (storiesResp as any)?.data ?? [];

  /* ── Mutations ── */
  const joinMut = useMutation({
    mutationFn: certApi.join,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certSession', sessionId] }),
    onError: (e: any) => setJoinError(e?.response?.data?.error ?? 'Failed to join. Please try again.'),
  });

  const defectMut = useMutation({
    mutationFn: (d: DefectFormValues) => certApi.logDefect(sessionId!, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certSession', sessionId] }); setShowDefectForm(false); },
  });

  const verifyMut = useMutation({
    mutationFn: ({ key, verified }: { key: string; verified: boolean }) => certApi.verifyStory(sessionId!, key, verified),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certSession', sessionId] }),
  });

  const completeMut = useMutation({
    mutationFn: () => certApi.complete(sessionId!),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['certSession', sessionId] });
      const queued = session?.defects.filter(d => d.queuedForJira && !d.jiraIssueKey) ?? [];
      if (queued.length) { setSelectedIds(queued.map(d => d.id)); setShowBulkCreate(true); }
    },
  });

  const jiraMut = useMutation({
    mutationFn: () => certApi.createJiraIssues(sessionId!, selectedIds),
    onSuccess: () => { setShowBulkCreate(false); qc.invalidateQueries({ queryKey: ['certSession', sessionId] }); },
  });

  /* ── Loading / error states ── */
  if (isLoading) return <CenteredShell><div style={{ fontSize:13, color:'#6b7280' }}>Loading session…</div></CenteredShell>;

  if (error && !session) {
    return (
      <CenteredShell>
        <div style={{ background:'#fff', border:'1px solid #fecaca', borderRadius:14, padding:32, maxWidth:420, textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>❌</div>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Session Not Found</div>
          <div style={{ fontSize:13, color:'#6b7280', marginBottom:20 }}>This link is invalid or has expired. Contact your Release Manager for a new link.</div>
          <Button variant="primary" onClick={() => navigate('/')}>Go to Dashboard</Button>
        </div>
      </CenteredShell>
    );
  }

  /* ── Join form (no active session yet) ── */
  if (!session) {
    return (
      <CenteredShell>
        <div style={{ width:'100%', maxWidth:440 }}>
          <LogoHeader />
          <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:14, padding:28, boxShadow:'0 4px 12px rgba(0,0,0,.06)' }}>
            <Alert type="success" style={{ marginBottom:18 }}>✓ Certification link is valid. Fill in your details to join.</Alert>
            <JoinForm project={projectInfo} onSubmit={async (vals: JoinFormValues) => {
              setJoinError('');
              await joinMut.mutateAsync({
                projectId: projectInfo?.projectId ?? 'ecertify',
                releaseVersion: projectInfo?.currentRelease ?? 'IAT Salesforce 26.14',
                certifierName: vals.name, certifierEmail: vals.email,
                certifierRole: vals.role as any, businessUnit: vals.bu, environment: vals.env,
              });
            }} error={joinError} />
          </div>
        </div>
      </CenteredShell>
    );
  }

  /* ── Complete state ── */
  if (session.status === 'Complete') {
    return (
      <CenteredShell>
        <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:14, padding:32, maxWidth:520, width:'100%', boxShadow:'0 4px 12px rgba(0,0,0,.06)' }}>
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
            <div style={{ fontSize:18, fontWeight:800 }}>Certification Complete</div>
            <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>{session.certifierName} — {session.releaseVersion}</div>
          </div>
          <SessionCompleteSummary session={session} />
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:16 }}>
            {session.defectCount > 0 && !session.jiraIssuesCreated && (
              <Button variant="secondary" fullWidth onClick={() => { setSelectedIds(session.defects.filter(d => d.queuedForJira && !d.jiraIssueKey).map(d => d.id)); setShowBulkCreate(true); }}>
                📋 Create Jira Issues ({session.defects.filter(d => d.queuedForJira && !d.jiraIssueKey).length} defects)
              </Button>
            )}
            {session.jiraIssuesCreated && <Alert type="success">✅ Jira issues created: {session.jiraIssueKeys.join(', ')}</Alert>}
            <Button variant="ghost" fullWidth onClick={() => navigate('/')}>← Back to Dashboard</Button>
          </div>
          {showBulkCreate && <JiraBulkModal session={session} selectedIds={selectedIds}
            onToggle={id => setSelectedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])}
            onSelectAll={() => setSelectedIds(session.defects.filter(d => d.queuedForJira && !d.jiraIssueKey).map(d => d.id))}
            onDeselectAll={() => setSelectedIds([])}
            onClose={() => setShowBulkCreate(false)}
            onConfirm={() => jiraMut.mutate()}
            loading={jiraMut.isPending}
          />}
        </div>
      </CenteredShell>
    );
  }

  /* ── Active session ── */
  return (
    <div style={{ minHeight:'100vh', background:'#f0f2f7', fontFamily:"'DM Sans',sans-serif" }}>
      {/* Session header */}
      <div style={{ background: ADP_BLUE, borderBottom:`2px solid ${ADP_RED}`, padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:30, height:30, background:ADP_RED, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#fff' }}>ADP</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>
              {session.certifierName} — {session.businessUnit || (session.certifierRole==='qa'?'QA Team':'Release Manager')}
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.5)' }}>{session.releaseVersion} · {session.environment}</div>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:36, fontWeight:800, color:'#27c96a', lineHeight:1 }}>{fmtDuration(elapsed)}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:2 }}>ELAPSED</div>
        </div>
      </div>

      <div style={{ padding:24, maxWidth:900, margin:'0 auto' }}>
        {/* Action bar */}
        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          <Button variant="primary"   onClick={() => setShowDefectForm(true)}>🐛 Log Defect</Button>
          <Button variant="ghost"     onClick={() => certApi.block(sessionId!, 'Blocked by certifier')}>⏸ Mark Blocked</Button>
          <Button variant="success"   onClick={() => { if (window.confirm('Complete this certification?')) completeMut.mutate(); }} loading={completeMut.isPending}>✓ Complete &amp; Certify</Button>
        </div>

        {/* Defect list */}
        <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:12, padding:16, marginBottom:16, boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>Defects Logged ({session.defectCount})</div>
          {session.defects.length === 0
            ? <div style={{ color:'#9ca3af', fontSize:12, padding:'12px 0', textAlign:'center' }}>No defects yet</div>
            : session.defects.map(d => <DefectItem key={d.id} defect={d} />)
          }
        </div>

        {/* Stories to verify */}
        <div style={{ background:'#fff', border:'1px solid rgba(13,148,136,.25)', borderRadius:12, padding:16, boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>Stories to Verify</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginBottom:12 }}>Check off each story after testing it in {session.environment}</div>
          {stories.length === 0
            ? <div style={{ color:'#9ca3af', fontSize:12, textAlign:'center', padding:12 }}>Sync from Jira to load stories</div>
            : stories.slice(0, 12).map(s => (
                <div key={s.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f0f2f7' }}>
                  <input type="checkbox" checked={session.verifiedStoryKeys.includes(s.key)} onChange={e => verifyMut.mutate({ key:s.key, verified:e.target.checked })}
                    style={{ accentColor:'#18a057', width:16, height:16, flexShrink:0 }} />
                  <a href={s.jiraUrl} target="_blank" rel="noreferrer" style={{ color:'#2060d8', fontWeight:700, fontSize:11, textDecoration:'none', flexShrink:0 }}>{s.key}</a>
                  <span style={{ flex:1, fontSize:11, color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</span>
                  <span style={{ background:'#ccfbf1', color:'#0d9488', border:'1px solid #99f6e4', borderRadius:12, padding:'2px 7px', fontSize:10, fontWeight:700, flexShrink:0 }}>{s.team}</span>
                  {s.bundle && <span style={{ fontSize:9, color:'#7967ae', flexShrink:0 }}>● {s.bundle}</span>}
                </div>
              ))
          }
        </div>
      </div>

      {/* Defect form modal */}
      {showDefectForm && (
        <Modal title="🐛 Log Defect" onClose={() => setShowDefectForm(false)}>
          <DefectForm
            defaultEnv={session.environment}
            onSubmit={async (vals: DefectFormValues) => { await defectMut.mutateAsync(vals); }}
            onCancel={() => setShowDefectForm(false)}
            error={(defectMut.error as any)?.response?.data?.error}
          />
        </Modal>
      )}

      {/* Jira bulk create modal */}
      {showBulkCreate && (
        <JiraBulkModal session={session} selectedIds={selectedIds}
          onToggle={id => setSelectedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])}
          onSelectAll={() => setSelectedIds(session.defects.filter(d => d.queuedForJira && !d.jiraIssueKey).map(d => d.id))}
          onDeselectAll={() => setSelectedIds([])}
          onClose={() => setShowBulkCreate(false)}
          onConfirm={() => jiraMut.mutate()}
          loading={jiraMut.isPending}
        />
      )}
    </div>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight:'100vh', background:'#f0f2f7', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:"'DM Sans',sans-serif" }}>
      {children}
    </div>
  );
}

function LogoHeader() {
  return (
    <div style={{ textAlign:'center', marginBottom:28 }}>
      <div style={{ display:'inline-flex', alignItems:'center', gap:10 }}>
        <div style={{ width:36, height:36, background:'#d0271d', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff' }}>ADP</div>
        <span style={{ fontSize:20, fontWeight:800, color:'#121c4e' }}>ReleaseIQ</span>
      </div>
      <div style={{ fontSize:12, color:'#6b7280', marginTop:4 }}>Release Certification</div>
    </div>
  );
}
