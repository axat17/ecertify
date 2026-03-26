import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certApi, jiraApi } from '@/services/api';
import type { CertSession, Defect, JiraStory } from '@/services/api';

const ADP_RED = '#d0271d';
const ADP_BLUE = '#121c4e';

function fmt(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function CertSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Join form state (shown before session exists)
  const [joinForm, setJoinForm] = useState({ name: '', email: '', role: '', bu: '', env: 'UAT' });
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  // Active session state
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Defect form state
  const [showDefectForm, setShowDefectForm] = useState(false);
  const [defect, setDefect] = useState({ title: '', description: '', severity: 'Major' as 'Critical' | 'Major' | 'Minor', linkedStoryKey: '', environment: 'UAT', functionalArea: '', queuedForJira: true });
  const [defectError, setDefectError] = useState('');

  // Jira bulk create
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [selectedDefectIds, setSelectedDefectIds] = useState<string[]>([]);

  // Fetch session by ID (no auth — cert link is the credential)
  const { data: resumeData, isLoading, error } = useQuery({
    queryKey: ['certSession', sessionId],
    queryFn: () => certApi.resume(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 60000, // keep alive
    retry: 2,
  });

  const session: CertSession | null = resumeData?.data?.session || null;
  const projectInfo = resumeData?.data?.project;

  // Start elapsed timer from session startedAt
  useEffect(() => {
    if (!session || session.status !== 'In Progress') return;
    const startSecs = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    setElapsed(startSecs);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session?.sessionId, session?.status]);

  // Join mutation (used when session doesn't exist yet — new certifier)
  const joinMutation = useMutation({
    mutationFn: (payload: Parameters<typeof certApi.join>[0]) => certApi.join(payload),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ['certSession', sessionId] });
      // Store session link locally as backup
      if (response.data) {
        const link = `${window.location.origin}/cert/${response.data.sessionId}`;
        localStorage.setItem(`releaseiq_cert_link_${response.data.sessionId}`, link);
      }
    },
  });

  const defectMutation = useMutation({
    mutationFn: ({ sid, d }: { sid: string; d: Parameters<typeof certApi.logDefect>[1] }) =>
      certApi.logDefect(sid, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certSession', sessionId] }); setShowDefectForm(false); setDefect({ title: '', description: '', severity: 'Major', linkedStoryKey: '', environment: 'UAT', functionalArea: '', queuedForJira: true }); },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ storyKey, verified }: { storyKey: string; verified: boolean }) =>
      certApi.verifyStory(sessionId!, storyKey, verified),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certSession', sessionId] }),
  });

  const completeMutation = useMutation({
    mutationFn: () => certApi.complete(sessionId!),
    onSuccess: () => {
      if (timerRef.current) clearInterval(timerRef.current);
      qc.invalidateQueries({ queryKey: ['certSession', sessionId] });
      // Show bulk create if there are defects
      const queuedDefects = session?.defects.filter(d => d.queuedForJira && !d.jiraIssueKey) || [];
      if (queuedDefects.length > 0) {
        setSelectedDefectIds(queuedDefects.map(d => d.id));
        setShowBulkCreate(true);
      }
    },
  });

  const jiraCreateMutation = useMutation({
    mutationFn: () => certApi.createJiraIssues(sessionId!, selectedDefectIds),
    onSuccess: () => { setShowBulkCreate(false); qc.invalidateQueries({ queryKey: ['certSession', sessionId] }); },
  });

  // Fetch stories for verification
  const { data: storiesResponse } = useQuery({
    queryKey: ['stories', session?.projectId],
    queryFn: () => jiraApi.stories(session!.projectId, { hasCopadoCICD: 'true', hasReleaseLabel: 'true' }),
    enabled: !!session?.projectId && session.status === 'In Progress',
  });
  const stories: JiraStory[] = storiesResponse?.data || [];

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError('');
    if (!joinForm.name.trim()) { setJoinError('Name is required'); return; }
    if (!joinForm.email.includes('@')) { setJoinError('Valid email required'); return; }
    if (!joinForm.role) { setJoinError('Role is required'); return; }
    if (joinForm.role === 'bu' && !joinForm.bu) { setJoinError('Business Unit required for BU Rep'); return; }
    setJoining(true);
    try {
      await joinMutation.mutateAsync({
        projectId: 'ecertify', // will be resolved server-side from sessionId context
        releaseVersion: projectInfo?.currentRelease || 'IAT Salesforce 26.14',
        certifierName: joinForm.name,
        certifierEmail: joinForm.email,
        certifierRole: joinForm.role as any,
        businessUnit: joinForm.bu,
        environment: joinForm.env,
      });
    } catch (err: any) {
      setJoinError(err?.response?.data?.error || 'Failed to join. Please try again.');
    } finally { setJoining(false); }
  }

  function handleLogDefect(e: React.FormEvent) {
    e.preventDefault();
    if (!defect.title.trim()) { setDefectError('Title is required'); return; }
    setDefectError('');
    defectMutation.mutate({ sid: sessionId!, d: defect });
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ADP_BLUE, marginBottom: 8 }}>ReleaseIQ</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Loading session...</div>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 14, padding: 32, maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Session Not Found</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>This certification link is invalid or has expired. Contact your Release Manager for a new link.</div>
          <button onClick={() => navigate('/')} style={{ background: ADP_RED, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  // No session yet — show join form
  if (!session && !isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: ADP_RED, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>ADP</div>
              <span style={{ fontSize: 20, fontWeight: 800, color: ADP_BLUE }}>ReleaseIQ</span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Release Certification</div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 14, padding: 28, boxShadow: '0 4px 12px rgba(0,0,0,.06)' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#15803d', display: 'flex', gap: 8 }}>
              <span>✓</span><span>Certification link is valid. Fill in your details to join.</span>
            </div>

            {projectInfo && (
              <div style={{ display: 'flex', gap: 16, marginBottom: 18, fontSize: 12 }}>
                <div><div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>RELEASE</div><div style={{ fontWeight: 700 }}>{projectInfo.currentRelease}</div></div>
                <div><div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>PROJECT</div><div style={{ fontWeight: 700 }}>{projectInfo.icon} {projectInfo.name}</div></div>
              </div>
            )}

            {joinError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#991b1b' }}>⚠️ {joinError}</div>}

            <form onSubmit={handleJoin}>
              <FormField label="Full Name *">
                <input value={joinForm.name} onChange={e => setJoinForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name" style={inputStyle} />
              </FormField>
              <FormField label="Email *">
                <input type="email" value={joinForm.email} onChange={e => setJoinForm(f => ({ ...f, email: e.target.value }))} placeholder="name@adp.com" style={inputStyle} />
              </FormField>
              <FormField label="Role *">
                <select value={joinForm.role} onChange={e => setJoinForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
                  <option value="">Select role...</option>
                  <option value="bu">Business Unit Rep</option>
                  <option value="qa">QA Team</option>
                  <option value="rm">Release Manager</option>
                </select>
              </FormField>
              {joinForm.role === 'bu' && (
                <FormField label="Business Unit *">
                  <select value={joinForm.bu} onChange={e => setJoinForm(f => ({ ...f, bu: e.target.value }))} style={inputStyle}>
                    <option value="">Select BU...</option>
                    {['Enterprise', 'MAS', 'NAS', 'Canada', 'SBS', 'Tax Direct', 'Wisely-Wage Pay'].map(bu => <option key={bu}>{bu}</option>)}
                  </select>
                </FormField>
              )}
              <FormField label="Environment">
                <select value={joinForm.env} onChange={e => setJoinForm(f => ({ ...f, env: e.target.value }))} style={inputStyle}>
                  <option value="UAT">UAT</option>
                  <option value="PROD">PROD (Release Night)</option>
                  <option value="STG">STG</option>
                </select>
              </FormField>
              <button type="submit" disabled={joining} style={{ width: '100%', background: joining ? '#9ca3af' : ADP_RED, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, fontWeight: 700, cursor: joining ? 'not-allowed' : 'pointer' }}>
                {joining ? 'Joining...' : '🔐 Join Certification'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  // Complete state
  if (session.status === 'Complete') {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 14, padding: 32, maxWidth: 500, width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,.06)' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Certification Complete</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{session.certifierName} — {session.releaseVersion}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { l: 'Duration', v: fmt(session.durationSeconds) },
              { l: 'Environment', v: session.environment },
              { l: 'Defects Logged', v: String(session.defectCount) },
              { l: 'Stories Verified', v: String(session.verifiedStoryKeys.length) },
            ].map(({ l, v }) => (
              <div key={l} style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{l}</div>
                <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{v}</div>
              </div>
            ))}
          </div>
          {session.defectCount > 0 && !session.jiraIssuesCreated && (
            <button onClick={() => { setSelectedDefectIds(session.defects.filter(d => d.queuedForJira && !d.jiraIssueKey).map(d => d.id)); setShowBulkCreate(true); }} style={{ width: '100%', background: ADP_BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
              📋 Create Jira Issues ({session.defects.filter(d => d.queuedForJira && !d.jiraIssueKey).length} defects)
            </button>
          )}
          {session.jiraIssuesCreated && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: '#15803d', textAlign: 'center' }}>✅ Jira issues created: {session.jiraIssueKeys.join(', ')}</div>}
          <button onClick={() => navigate('/')} style={{ width: '100%', background: '#f0f2f7', color: '#374151', border: '1px solid #e0e4ef', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back to Dashboard</button>
        </div>

        {/* Jira bulk create modal */}
        {showBulkCreate && <JiraBulkCreateModal session={session} selectedIds={selectedDefectIds} onToggle={(id) => setSelectedDefectIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])} onSelectAll={() => setSelectedDefectIds(session.defects.filter(d => d.queuedForJira && !d.jiraIssueKey).map(d => d.id))} onDeselectAll={() => setSelectedDefectIds([])} onClose={() => setShowBulkCreate(false)} onConfirm={() => jiraCreateMutation.mutate()} loading={jiraCreateMutation.isPending} />}
      </div>
    );
  }

  // ─── ACTIVE SESSION VIEW ──────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f7', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Session header */}
      <div style={{ background: ADP_BLUE, borderBottom: `2px solid ${ADP_RED}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 30, height: 30, background: ADP_RED, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>ADP</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{session.certifierName} — {session.businessUnit || (session.certifierRole === 'qa' ? 'QA Team' : 'Release Manager')}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{session.releaseVersion} · {session.environment}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 36, fontWeight: 800, color: '#27c96a', lineHeight: 1 }}>{fmt(elapsed)}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>ELAPSED</div>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => setShowDefectForm(true)} style={{ background: ADP_RED, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>🐛 Log Defect</button>
          <button onClick={() => certApi.block(sessionId!, 'Blocked by certifier')} style={{ background: '#fff', color: '#d4840a', border: '1px solid #fed7aa', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>⏸ Mark Blocked</button>
          <button onClick={() => { if (window.confirm('Complete this certification session?')) completeMutation.mutate(); }} style={{ background: '#18a057', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✓ Complete &amp; Certify</button>
        </div>

        {/* Defects logged */}
        <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Defects Logged ({session.defectCount})</div>
          {session.defects.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 12, padding: '12px 0', textAlign: 'center' }}>No defects yet</div>
          ) : (
            session.defects.map((d: Defect) => (
              <div key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{d.title}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{d.environment} · {d.functionalArea || 'General'}{d.linkedStoryKey ? ` · ${d.linkedStoryKey}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                  <Chip label={d.severity} color={d.severity === 'Critical' ? '#d0271d' : d.severity === 'Major' ? '#c85f1a' : '#d4840a'} />
                  {d.queuedForJira && !d.jiraIssueKey && <Chip label="→ Jira" color="#2060d8" />}
                  {d.jiraIssueKey && <Chip label={d.jiraIssueKey} color="#18a057" />}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Stories to verify */}
        <div style={{ background: '#fff', border: '1px solid rgba(13,148,136,.25)', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Stories to Verify</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>Check off each story after testing it in {session.environment}</div>
          {stories.slice(0, 12).map((s: JiraStory) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f2f7' }}>
              <input type="checkbox" checked={session.verifiedStoryKeys.includes(s.key)} onChange={e => verifyMutation.mutate({ storyKey: s.key, verified: e.target.checked })} style={{ accentColor: '#18a057', width: 16, height: 16, flexShrink: 0 }} />
              <a href={s.jiraUrl} target="_blank" rel="noreferrer" style={{ color: '#2060d8', fontWeight: 700, fontSize: 11, textDecoration: 'none', flexShrink: 0 }}>{s.key}</a>
              <span style={{ flex: 1, fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
              <Chip label={s.team} color="#0d9488" small />
              {s.bundle && <Chip label={s.bundle} color="#7967ae" small />}
            </div>
          ))}
        </div>
      </div>

      {/* Defect form modal */}
      {showDefectForm && (
        <Modal title="🐛 Log Defect" onClose={() => setShowDefectForm(false)}>
          {defectError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#991b1b' }}>⚠️ {defectError}</div>}
          <form onSubmit={handleLogDefect}>
            <FormField label="Title *"><input value={defect.title} onChange={e => setDefect(d => ({ ...d, title: e.target.value }))} placeholder="Brief defect summary..." style={inputStyle} autoFocus /></FormField>
            <FormField label="Linked Story Key"><input value={defect.linkedStoryKey} onChange={e => setDefect(d => ({ ...d, linkedStoryKey: e.target.value }))} placeholder="e.g. SF-1001 — optional" style={inputStyle} /></FormField>
            <FormField label="Description"><textarea value={defect.description} onChange={e => setDefect(d => ({ ...d, description: e.target.value }))} rows={3} placeholder="Steps to reproduce..." style={{ ...inputStyle, resize: 'vertical' }} /></FormField>
            <FormField label="Severity → Jira Priority">
              <div style={{ display: 'flex', gap: 8 }}>
                {(['Critical', 'Major', 'Minor'] as const).map(sev => (
                  <button key={sev} type="button" onClick={() => setDefect(d => ({ ...d, severity: sev }))} style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 11, border: `1px solid ${sev === 'Critical' ? '#d0271d' : sev === 'Major' ? '#c85f1a' : '#d4840a'}`, background: defect.severity === sev ? (sev === 'Critical' ? '#fef2f2' : sev === 'Major' ? '#fff7ed' : '#fffbeb') : '#fff', color: sev === 'Critical' ? '#d0271d' : sev === 'Major' ? '#c85f1a' : '#d4840a' }}>
                    {sev === 'Critical' ? '🔴 Critical → P1' : sev === 'Major' ? '🟠 Major → P2' : '🟡 Minor → P3'}
                  </button>
                ))}
              </div>
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Environment"><select value={defect.environment} onChange={e => setDefect(d => ({ ...d, environment: e.target.value }))} style={inputStyle}><option>UAT</option><option>PROD</option><option>STG</option></select></FormField>
              <FormField label="Functional Area"><input value={defect.functionalArea} onChange={e => setDefect(d => ({ ...d, functionalArea: e.target.value }))} placeholder="e.g. Payroll" style={inputStyle} /></FormField>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input type="checkbox" id="queueJira" checked={defect.queuedForJira} onChange={e => setDefect(d => ({ ...d, queuedForJira: e.target.checked }))} style={{ accentColor: ADP_RED, width: 'auto' }} />
              <label htmlFor="queueJira" style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>Queue for Jira bulk creation at end of session</label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={defectMutation.isPending} style={{ background: ADP_RED, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>{defectMutation.isPending ? 'Logging...' : 'Log Defect'}</button>
              <button type="button" onClick={() => setShowDefectForm(false)} style={{ background: '#f0f2f7', color: '#374151', border: '1px solid #e0e4ef', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Jira bulk create modal */}
      {showBulkCreate && <JiraBulkCreateModal session={session} selectedIds={selectedDefectIds} onToggle={(id) => setSelectedDefectIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])} onSelectAll={() => setSelectedDefectIds(session.defects.filter(d => d.queuedForJira && !d.jiraIssueKey).map(d => d.id))} onDeselectAll={() => setSelectedDefectIds([])} onClose={() => setShowBulkCreate(false)} onConfirm={() => jiraCreateMutation.mutate()} loading={jiraCreateMutation.isPending} />}
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────

function Chip({ label, color, small }: { label: string; color: string; small?: boolean }) {
  return <span style={{ background: color + '14', color, border: `1px solid ${color}28`, borderRadius: 12, padding: small ? '2px 7px' : '3px 9px', fontSize: small ? 10 : 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>{children}</div>;
}

const inputStyle: React.CSSProperties = { width: '100%', background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 8, padding: '9px 12px', fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)', padding: 24 }}>
      <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 16, padding: 26, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 10px 32px rgba(0,0,0,.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #e0e4ef' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function JiraBulkCreateModal({ session, selectedIds, onToggle, onSelectAll, onDeselectAll, onClose, onConfirm, loading }: { session: CertSession; selectedIds: string[]; onToggle: (id: string) => void; onSelectAll: () => void; onDeselectAll: () => void; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  const queue = session.defects.filter(d => d.queuedForJira && !d.jiraIssueKey);
  return (
    <Modal title="📋 Review & Create Jira Issues" onClose={onClose}>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 11, color: '#1d4ed8' }}>
        <strong>Auto-populated:</strong> Project: SF · Type: Bug · Labels: CopadoCICD + Salesforce_26.14 + BU label
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e0e4ef', borderRadius: 8, marginBottom: 16 }}>
        {queue.map((d: Defect) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderBottom: '1px solid #f0f2f7' }}>
            <input type="checkbox" checked={selectedIds.includes(d.id)} onChange={() => onToggle(d.id)} style={{ accentColor: '#d0271d', width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>{d.title}</div>
              {[
                { l: 'Priority', v: d.jiraPriority + ` (${d.severity})` },
                { l: 'Environment', v: d.environment },
                { l: 'Reporter', v: `${d.reporterName} (${d.reporterRole === 'qa' ? 'QA Team' : d.reporterRole === 'rm' ? 'Release Mgr' : `BU Rep — ${d.businessUnit}`})` },
                ...(d.linkedStoryKey ? [{ l: 'Linked Story', v: d.linkedStoryKey }] : []),
                { l: 'Functional Area', v: d.functionalArea || 'General' },
              ].map(({ l, v }) => (
                <div key={l} style={{ display: 'flex', gap: 8, fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#9ca3af', fontWeight: 600, minWidth: 90 }}>{l}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {queue.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>No defects queued for Jira</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{selectedIds.length} issue{selectedIds.length !== 1 ? 's' : ''} selected</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ background: '#f0f2f7', border: '1px solid #e0e4ef', color: '#374151', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          <button onClick={onSelectAll} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2060d8', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Select All</button>
          <button onClick={onDeselectAll} style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', color: '#6b7280', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12 }}>Deselect All</button>
          <button onClick={onConfirm} disabled={loading || selectedIds.length === 0} style={{ background: loading ? '#9ca3af' : '#d0271d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: loading || selectedIds.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}>
            {loading ? 'Creating...' : `Create ${selectedIds.length} Issue${selectedIds.length !== 1 ? 's' : ''} in Jira`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
