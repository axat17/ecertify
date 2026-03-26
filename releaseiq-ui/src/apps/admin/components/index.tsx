import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Project, AdminRequest, ErrorLogEntry, User } from '@/common/types';
import { isValidEmail } from '@/common/utils';
import { Section, Field, inputStyle, SecretInput, EnvCheckGroup, Alert, Divider } from '@/common/components/UI';
import Button from '@/common/components/Button';
import Badge from '@/common/components/Badge';
import { projectApi, adminApi } from '@/services/api';

// ─── Project Admin Panel ──────────────────────────────────────────────────────

interface ProjectAdminPanelProps {
  project: Project;
  onSave: (id: string, data: Partial<Project>) => void;
  saveStatus: '' | 'saving' | 'saved' | string; // '' | 'saving' | 'saved' | 'error: ...'
  onToggleLive: () => void;
  isMainAdmin: boolean;
}

export function ProjectAdminPanel({ project, onSave, saveStatus, onToggleLive, isMainAdmin }: ProjectAdminPanelProps) {
  const [name, setName]                 = useState(project.name);
  const [releaseLabel, setReleaseLabel] = useState(project.releaseLabel);
  const [ownerEmail, setOwnerEmail]     = useState(project.ownerEmail);
  const [teamCount, setTeamCount]       = useState(project.teamCount);
  const [adminEmails, setAdminEmails]   = useState((project.adminEmails ?? []).join('\n'));
  const [cadence, setCadence]           = useState(project.cadence);
  const isSF = project.type === 'salesforce';

  // Copado config state
  const [copadoUrl,      setCopadoUrl]      = useState(project.copadoConfig?.url ?? '');
  const [copadoPipeline, setCopadoPipeline] = useState(project.copadoConfig?.pipelineName ?? '');
  const [copadoToken,    setCopadoToken]    = useState(project.copadoConfig?.apiToken ?? '');
  const [bundleNaming,   setBundleNaming]   = useState(project.copadoConfig?.bundleNamingConvention ?? 'Bundle_{n}');
  const [apexThreshold,  setApexThreshold]  = useState(project.copadoConfig?.apexCoverageThreshold ?? 75);
  const [trackedEnvs,    setTrackedEnvs]    = useState<string[]>(project.copadoConfig?.trackedEnvs ?? ['DEV','SIT','UAT','STG','PROD']);

  function handleSave() {
    const emails = adminEmails.split('\n').map(e => e.trim()).filter(e => isValidEmail(e));
    const data: Partial<Project> = { name, releaseLabel, ownerEmail, teamCount, cadence, adminEmails: emails };
    if (isSF) {
      data.copadoConfig = {
        url: copadoUrl, pipelineName: copadoPipeline,
        apiToken: copadoToken === '••••••••' ? (project.copadoConfig?.apiToken ?? '') : copadoToken,
        bundleNamingConvention: bundleNaming, apexCoverageThreshold: apexThreshold, trackedEnvs,
      };
    }
    onSave(project.projectId, data);
  }

  return (
    <div>
      {saveStatus && (
        <div style={{ marginBottom: 14 }}>
          <Alert type={saveStatus === 'saved' ? 'success' : saveStatus === 'saving' ? 'info' : 'error'}>
            {saveStatus === 'saved' ? '✓ Settings saved!' : saveStatus === 'saving' ? '↻ Saving…' : saveStatus}
          </Alert>
        </div>
      )}

      <Section title={`${project.icon} ${project.name} — Project Settings`}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Project Name" required>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Jira Project Key" hint="Read-only — set at creation">
            <input value={project.jiraKey} readOnly style={{ ...inputStyle, background:'#f0f2f7' }} />
          </Field>
          <Field label="Release Label" hint="Must match Jira fix version exactly (e.g. Salesforce_26.14)">
            <input value={releaseLabel} onChange={e => setReleaseLabel(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Owner Email" required>
            <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Number of Teams">
            <input type="number" value={teamCount} onChange={e => setTeamCount(Number(e.target.value))} min={1} max={20} style={inputStyle} />
          </Field>
          <Field label="Release Cadence">
            <select value={cadence} onChange={e => setCadence(e.target.value as any)} style={inputStyle}>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="ondemand">On-demand</option>
            </select>
          </Field>
        </div>
        <Field label="Project Admin Emails (one per line)" hint="These users get Project Admin access">
          <textarea value={adminEmails} onChange={e => setAdminEmails(e.target.value)} rows={4} style={{ ...inputStyle, resize:'vertical' } as any} />
        </Field>
        <Button variant="primary" onClick={handleSave} loading={saveStatus === 'saving'}>💾 Save Settings</Button>
      </Section>

      {isSF && <CopadoConfigForm
        url={copadoUrl} pipeline={copadoPipeline} token={copadoToken}
        bundleNaming={bundleNaming} apexThreshold={apexThreshold} trackedEnvs={trackedEnvs}
        onChange={{ url: setCopadoUrl, pipeline: setCopadoPipeline, token: setCopadoToken, bundleNaming: setBundleNaming, apexThreshold: setApexThreshold, trackedEnvs: setTrackedEnvs }}
        onSave={handleSave} saving={saveStatus === 'saving'}
        projectId={project.projectId}
      />}

      <Section title="⚠️ Danger Zone">
        <div style={{ border:'1px solid #fecaca', borderRadius:8, padding:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:12, marginBottom:2 }}>Toggle Live Status</div>
              <div style={{ fontSize:11, color:'#9ca3af' }}>Current: {project.isLive ? '● LIVE' : '○ Offline'}</div>
            </div>
            <Button
              variant={project.isLive ? 'danger' : 'success'}
              size="sm"
              onClick={onToggleLive}
            >
              {project.isLive ? 'Set Offline' : 'Set Live'}
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ─── Copado Config Form ───────────────────────────────────────────────────────

interface CopadoConfigFormProps {
  url: string; pipeline: string; token: string;
  bundleNaming: string; apexThreshold: number; trackedEnvs: string[];
  onChange: {
    url: (v: string) => void; pipeline: (v: string) => void; token: (v: string) => void;
    bundleNaming: (v: string) => void; apexThreshold: (v: number) => void; trackedEnvs: (v: string[]) => void;
  };
  onSave: () => void;
  saving: boolean;
  projectId: string;
}

export function CopadoConfigForm({ url, pipeline, token, bundleNaming, apexThreshold, trackedEnvs, onChange, onSave, saving, projectId }: CopadoConfigFormProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | ''>('');

  async function handleTest() {
    setTesting(true); setTestResult('');
    try {
      await new Promise(r => setTimeout(r, 900)); // simulate
      setTestResult('ok');
    } catch { setTestResult('fail'); }
    finally { setTesting(false); }
  }

  return (
    <Section title="⬡ Copado Integration">
      <div style={{ background:'rgba(121,103,174,.07)', border:'1px solid rgba(121,103,174,.2)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:11, color:'#374151', lineHeight:1.6 }}>
        Configure the Copado Salesforce API to pull bundle status, Apex results, and validation data automatically. Requires a Connected App in your Salesforce org.
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Copado API Base URL">
          <input value={url} onChange={e => onChange.url(e.target.value)} placeholder="https://copado.my.salesforce.com" style={inputStyle} />
        </Field>
        <Field label="Pipeline Name">
          <input value={pipeline} onChange={e => onChange.pipeline(e.target.value)} placeholder="e.g. Main Production Pipeline" style={inputStyle} />
        </Field>
      </div>
      <Field label="API Token / Connected App Secret" hint="From Salesforce Setup → App Manager → Connected Apps. Stored encrypted.">
        <SecretInput value={token} onChange={e => onChange.token(e.target.value)} placeholder="Client secret…" />
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Bundle Naming Convention" hint="Use {n} for number, {release} for version">
          <input value={bundleNaming} onChange={e => onChange.bundleNaming(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Apex Coverage Threshold (%)" hint="Salesforce minimum is 75%">
          <input type="number" value={apexThreshold} onChange={e => onChange.apexThreshold(Number(e.target.value))} min={0} max={100} style={inputStyle} />
        </Field>
      </div>
      <Field label="Tracked Environments" hint="Select which pipeline stages to display in ReleaseIQ">
        <EnvCheckGroup envs={['DEV','SIT','UAT','STG','PROD']} selected={trackedEnvs} onChange={onChange.trackedEnvs} />
      </Field>
      {testResult === 'ok'   && <div style={{ marginBottom:10 }}><Alert type="success">✓ Connection successful — pipeline found.</Alert></div>}
      {testResult === 'fail' && <div style={{ marginBottom:10 }}><Alert type="error">Connection failed. Check URL and token.</Alert></div>}
      <div style={{ display:'flex', gap:10 }}>
        <Button variant="blue" onClick={onSave} loading={saving}>💾 Save Copado Config</Button>
        <Button variant="ghost" onClick={handleTest} loading={testing}>🔌 Test Connection</Button>
      </div>
    </Section>
  );
}

// ─── Access Request Panel ────────────────────────────────────────────────────

export function AccessRequestPanel({ projects, userEmail }: { projects: Project[]; userEmail: string }) {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => adminApi.submitRequest(projectId, reason),
    onSuccess: () => { setSubmitted(true); qc.invalidateQueries({ queryKey: ['adminRequests'] }); },
  });

  if (submitted) {
    return (
      <Section title="✅ Request Submitted">
        <Alert type="success">Your admin access request has been submitted. A Main Admin will review it shortly.</Alert>
      </Section>
    );
  }

  return (
    <Section title="🔑 Request Admin Access">
      <Field label="Project">
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle}>
          <option value="">Select project…</option>
          {projects.map(p => <option key={p.projectId} value={p.projectId}>{p.icon} {p.name}</option>)}
        </select>
      </Field>
      <Field label="Your Email">
        <input defaultValue={userEmail} readOnly style={{ ...inputStyle, background:'#f0f2f7' }} />
      </Field>
      <Field label="Reason for Access" required>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4}
          placeholder="Briefly explain why you need Project Admin access…"
          style={{ ...inputStyle, resize:'vertical' } as any} />
      </Field>
      <Button variant="primary" onClick={() => mutation.mutate()} disabled={!projectId || !reason} loading={mutation.isPending}>
        Submit Request
      </Button>
    </Section>
  );
}

// ─── Create Project Panel ─────────────────────────────────────────────────────

interface CreateProjectPanelProps {
  onCreate: (data: Partial<Project>) => void;
  loading: boolean;
  error?: string;
}

export function CreateProjectPanel({ onCreate, loading, error }: CreateProjectPanelProps) {
  const [form, setForm] = useState({
    name: '', type: 'salesforce', jiraKey: '', ownerEmail: '',
    cadence: 'biweekly', teamCount: 7, releaseLabel: '', description: '',
    copadoUrl: '', copadoPipeline: '',
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const valid = !!form.name && !!form.jiraKey && isValidEmail(form.ownerEmail);

  return (
    <Section title="➕ Create New Project">
      {error && <div style={{ marginBottom:14 }}><Alert type="error">{error}</Alert></div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Project Name" required>
          <input value={form.name} onChange={f('name')} placeholder="e.g. SF1 — Commerce Cloud" style={inputStyle} />
        </Field>
        <Field label="Type" required>
          <select value={form.type} onChange={f('type')} style={inputStyle}>
            <option value="salesforce">Salesforce Release</option>
            <option value="react">React Application</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Jira Project Key" required hint="e.g. SF, COM, SVC">
          <input value={form.jiraKey} onChange={f('jiraKey')} placeholder="SF" style={inputStyle} />
        </Field>
        <Field label="Release Label" hint="e.g. Salesforce_26.14">
          <input value={form.releaseLabel} onChange={f('releaseLabel')} placeholder="Salesforce_26.14" style={inputStyle} />
        </Field>
        <Field label="Owner Email" required>
          <input type="email" value={form.ownerEmail} onChange={f('ownerEmail')} placeholder="owner@adp.com" style={inputStyle} />
        </Field>
        <Field label="Number of Teams">
          <input type="number" value={form.teamCount} onChange={f('teamCount')} min={1} max={20} style={inputStyle} />
        </Field>
        <Field label="Cadence">
          <select value={form.cadence} onChange={f('cadence')} style={inputStyle}>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea value={form.description} onChange={f('description')} rows={2} placeholder="Brief project description…" style={{ ...inputStyle, resize:'vertical' } as any} />
      </Field>
      {form.type === 'salesforce' && (
        <>
          <Divider margin={8} />
          <div style={{ fontSize:12, fontWeight:700, color:'#7967ae', marginBottom:12 }}>⬡ Copado Config (optional — can configure later)</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Copado API URL">
              <input value={form.copadoUrl} onChange={f('copadoUrl')} placeholder="https://copado.my.salesforce.com" style={inputStyle} />
            </Field>
            <Field label="Pipeline Name">
              <input value={form.copadoPipeline} onChange={f('copadoPipeline')} placeholder="e.g. Main Production Pipeline" style={inputStyle} />
            </Field>
          </div>
        </>
      )}
      <Button variant="primary" onClick={() => onCreate(form)} disabled={!valid} loading={loading}>
        Create Project
      </Button>
    </Section>
  );
}

// ─── Admin Request Card ───────────────────────────────────────────────────────

export function AdminRequestCard({ request, onApprove, onDeny, loading }: {
  request: AdminRequest;
  onApprove: () => void;
  onDeny: () => void;
  loading: boolean;
}) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'12px 16px', marginBottom:10 }}>
      <div>
        <div style={{ fontWeight:600, fontSize:13 }}>
          {request.requesterName}
          <span style={{ color:'#9ca3af', fontWeight:400, fontSize:11, marginLeft:6 }}>({request.requesterEmail})</span>
        </div>
        <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>
          Project: <strong>{request.projectName}</strong> · {new Date(request.createdAt).toLocaleString()}
        </div>
        <div style={{ fontSize:11, color:'#374151', marginTop:4, maxWidth:480 }}>{request.reason}</div>
      </div>
      <div style={{ display:'flex', gap:8, flexShrink:0, marginLeft:16 }}>
        <Button variant="success" size="sm" onClick={onApprove} loading={loading}>✓ Approve</Button>
        <Button variant="danger"  size="sm" onClick={onDeny}    loading={loading}>✗ Deny</Button>
      </div>
    </div>
  );
}

// ─── Error Log Row ────────────────────────────────────────────────────────────

export function ErrorLogRow({ entry, onResolve, loading }: {
  entry: ErrorLogEntry;
  onResolve: () => void;
  loading: boolean;
}) {
  return (
    <div style={{ padding:'12px 0', borderBottom:'1px solid #f0f2f7', display:'flex', justifyContent:'space-between', alignItems:'flex-start', opacity: entry.resolved ? .55 : 1 }}>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <span style={{ fontWeight:700, fontSize:11, color: entry.level === 'error' ? '#d0271d' : '#d4840a' }}>{entry.context}</span>
          {entry.projectId && <Badge label={entry.projectId} small />}
          {entry.resolved && <Badge label="✓ Resolved" variant="success" small />}
        </div>
        <div style={{ fontSize:12, color:'#374151' }}>{entry.message}</div>
        <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{new Date(entry.createdAt).toLocaleString()}</div>
      </div>
      {!entry.resolved && (
        <Button variant="ghost" size="xs" onClick={onResolve} loading={loading}
          style={{ marginLeft:12, flexShrink:0, color:'#18a057', borderColor:'#bbf7d0', background:'#f0fdf4' }}>
          Mark Resolved
        </Button>
      )}
    </div>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────

export function UserRow({ user, index }: { user: User; index: number }) {
  const roleColor = user.role === 'main-admin' ? '#d0271d' : user.role === 'project-admin' ? '#2060d8' : '#9ca3af';
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <tr style={{ background: index % 2 !== 0 ? 'rgba(0,0,0,.01)' : '#fff' }}>
      <td style={{ padding:'11px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background: roleColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>{initials}</div>
          <span style={{ fontWeight:600, fontSize:12 }}>{user.name}</span>
        </div>
      </td>
      <td style={{ padding:'11px 14px', fontSize:11, color:'#6b7280' }}>{user.email}</td>
      <td style={{ padding:'11px 14px' }}>
        <Badge label={user.role === 'main-admin' ? '★ Main Admin' : user.role === 'project-admin' ? 'Project Admin' : 'User'}
          color={roleColor} small />
      </td>
      <td style={{ padding:'11px 14px', fontSize:10, color:'#9ca3af' }}>{user.projectAdminOf?.join(', ') || '—'}</td>
      <td style={{ padding:'11px 14px' }}><span style={{ color:'#18a057' }}>●</span></td>
    </tr>
  );
}
