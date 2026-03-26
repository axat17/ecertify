import React, { useState } from 'react';
import type { CertSession, Defect, Project } from '@/common/types';
import { BUSINESS_UNITS, ROLE_LABELS, SEVERITY_TO_PRIORITY, fmtDuration } from '@/common/utils';
import { useTimer } from '@/common/hooks';
import { Alert, Modal, Field, inputStyle } from '@/common/components/UI';
import Badge from '@/common/components/Badge';
import Button from '@/common/components/Button';

// ─── Join Form ────────────────────────────────────────────────────────────────

export interface JoinFormValues {
  name: string;
  email: string;
  role: string;
  bu: string;
  env: string;
}

interface JoinFormProps {
  project?: Pick<Project, 'currentRelease' | 'name' | 'icon'> | null;
  onSubmit: (values: JoinFormValues) => Promise<void>;
  error?: string;
}

export function JoinForm({ project, onSubmit, error }: JoinFormProps) {
  const [values, setValues] = useState<JoinFormValues>({ name: '', email: '', role: '', bu: '', env: 'UAT' });
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<JoinFormValues>>({});

  function validate(): boolean {
    const errs: Partial<JoinFormValues> = {};
    if (!values.name.trim()) errs.name = 'Name is required';
    if (!values.email.includes('@')) errs.email = 'Valid email required';
    if (!values.role) errs.role = 'Role is required';
    if (values.role === 'bu' && !values.bu) errs.bu = 'Business Unit required for BU Rep';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try { await onSubmit(values); } finally { setLoading(false); }
  }

  const set = (key: keyof JoinFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues(v => ({ ...v, [key]: e.target.value }));

  return (
    <form onSubmit={handleSubmit}>
      {project && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 18, fontSize: 12 }}>
          <div><div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>RELEASE</div><div style={{ fontWeight: 700 }}>{project.currentRelease}</div></div>
          <div><div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>PROJECT</div><div style={{ fontWeight: 700 }}>{project.icon} {project.name}</div></div>
        </div>
      )}

      {error && <div style={{ marginBottom: 14 }}><Alert type="error">{error}</Alert></div>}

      <Field label="Full Name" required error={fieldErrors.name}>
        <input value={values.name} onChange={set('name')} placeholder="Your full name" style={inputStyle} autoFocus />
      </Field>
      <Field label="Email" required error={fieldErrors.email}>
        <input type="email" value={values.email} onChange={set('email')} placeholder="name@adp.com" style={inputStyle} />
      </Field>
      <Field label="Role" required error={fieldErrors.role}>
        <select value={values.role} onChange={set('role')} style={inputStyle}>
          <option value="">Select role…</option>
          <option value="bu">Business Unit Rep</option>
          <option value="qa">QA Team</option>
          <option value="rm">Release Manager</option>
        </select>
      </Field>
      {values.role === 'bu' && (
        <Field label="Business Unit" required error={fieldErrors.bu}>
          <select value={values.bu} onChange={set('bu')} style={inputStyle}>
            <option value="">Select BU…</option>
            {BUSINESS_UNITS.map(bu => <option key={bu}>{bu}</option>)}
          </select>
        </Field>
      )}
      <Field label="Environment">
        <select value={values.env} onChange={set('env')} style={inputStyle}>
          <option value="UAT">UAT</option>
          <option value="PROD">PROD (Release Night)</option>
          <option value="STG">STG</option>
        </select>
      </Field>

      <Button variant="primary" size="md" loading={loading} fullWidth type="submit">
        🔐 Join Certification
      </Button>
    </form>
  );
}

// ─── Session Timer ─────────────────────────────────────────────────────────────

export function SessionTimer({ startedAt, running }: { startedAt: string; running: boolean }) {
  const elapsed = useTimer(startedAt, running);
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 36, fontWeight: 800, color: '#27c96a', lineHeight: 1 }}>
        {fmtDuration(elapsed)}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>ELAPSED</div>
    </div>
  );
}

// ─── Defect Form ──────────────────────────────────────────────────────────────

export interface DefectFormValues {
  title: string;
  description: string;
  severity: 'Critical' | 'Major' | 'Minor';
  linkedStoryKey: string;
  environment: string;
  functionalArea: string;
  queuedForJira: boolean;
}

interface DefectFormProps {
  defaultEnv?: string;
  onSubmit: (values: DefectFormValues) => Promise<void>;
  onCancel: () => void;
  error?: string;
}

export function DefectForm({ defaultEnv = 'UAT', onSubmit, onCancel, error }: DefectFormProps) {
  const [values, setValues] = useState<DefectFormValues>({
    title: '', description: '', severity: 'Major',
    linkedStoryKey: '', environment: defaultEnv,
    functionalArea: '', queuedForJira: true,
  });
  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState('');

  const set = (key: keyof DefectFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues(v => ({ ...v, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) { setTitleError('Title is required'); return; }
    setLoading(true);
    try { await onSubmit(values); } finally { setLoading(false); }
  }

  const SEV_OPTIONS: Array<{ sev: DefectFormValues['severity']; label: string; color: string }> = [
    { sev: 'Critical', label: '🔴 Critical → P1', color: '#d0271d' },
    { sev: 'Major',    label: '🟠 Major → P2',    color: '#c85f1a' },
    { sev: 'Minor',    label: '🟡 Minor → P3',    color: '#d4840a' },
  ];

  return (
    <form onSubmit={handleSubmit}>
      {error && <div style={{ marginBottom: 14 }}><Alert type="error">{error}</Alert></div>}
      <Field label="Title" required error={titleError}>
        <input value={values.title} onChange={set('title')} placeholder="Brief defect summary…" style={inputStyle} autoFocus />
      </Field>
      <Field label="Linked Story Key" hint="e.g. SF-1001 — optional">
        <input value={values.linkedStoryKey} onChange={set('linkedStoryKey')} placeholder="e.g. SF-1001" style={inputStyle} />
      </Field>
      <Field label="Description">
        <textarea value={values.description} onChange={set('description') as any} rows={3} placeholder="Steps to reproduce…" style={{ ...inputStyle, resize: 'vertical' } as any} />
      </Field>
      <Field label="Severity → Jira Priority">
        <div style={{ display: 'flex', gap: 8 }}>
          {SEV_OPTIONS.map(({ sev, label, color }) => (
            <button key={sev} type="button" onClick={() => setValues(v => ({ ...v, severity: sev }))}
              style={{ flex: 1, padding: 8, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 11, fontFamily: 'inherit', border: `1px solid ${color}`, background: values.severity === sev ? color + '20' : '#fff', color }}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Environment">
          <select value={values.environment} onChange={set('environment')} style={inputStyle}>
            <option>UAT</option><option>PROD</option><option>STG</option>
          </select>
        </Field>
        <Field label="Functional Area">
          <input value={values.functionalArea} onChange={set('functionalArea')} placeholder="e.g. Payroll" style={inputStyle} />
        </Field>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <input type="checkbox" id="queueJira" checked={values.queuedForJira} onChange={e => setValues(v => ({ ...v, queuedForJira: e.target.checked }))} style={{ accentColor: '#d0271d', width: 'auto' }} />
        <label htmlFor="queueJira" style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>Queue for Jira bulk creation at end of session</label>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="primary" loading={loading} type="submit">Log Defect</Button>
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ─── Defect List Item ─────────────────────────────────────────────────────────

export function DefectItem({ defect }: { defect: Defect }) {
  const col = defect.severity === 'Critical' ? '#d0271d' : defect.severity === 'Major' ? '#c85f1a' : '#d4840a';
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #f0f2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 12 }}>{defect.title}</div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
          {defect.environment}{defect.functionalArea ? ` · ${defect.functionalArea}` : ''}{defect.linkedStoryKey ? ` · ${defect.linkedStoryKey}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
        <Badge label={defect.severity} color={col} small />
        {defect.queuedForJira && !defect.jiraIssueKey && <Badge label="→ Jira" color="#2060d8" small />}
        {defect.jiraIssueKey && <Badge label={defect.jiraIssueKey} color="#18a057" small />}
      </div>
    </div>
  );
}

// ─── Jira Bulk Create Modal ───────────────────────────────────────────────────

interface JiraBulkModalProps {
  session: CertSession;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

export function JiraBulkModal({ session, selectedIds, onToggle, onSelectAll, onDeselectAll, onClose, onConfirm, loading }: JiraBulkModalProps) {
  const queue = session.defects.filter(d => d.queuedForJira && !d.jiraIssueKey);

  return (
    <Modal title="📋 Review & Create Jira Issues" subtitle="Auto-populated from session data — review before creating" onClose={onClose} size="lg">
      <Alert type="info" style={{ marginBottom: 16 }}>
        <strong>Auto-populated:</strong> Project: SF · Type: Bug · Labels: CopadoCICD + Salesforce release label + BU label
      </Alert>

      <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e0e4ef', borderRadius: 8, marginBottom: 16 }}>
        {queue.length === 0
          ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>No defects queued for Jira</div>
          : queue.map(d => {
              const pc = d.severity === 'Critical' ? '#d0271d' : d.severity === 'Major' ? '#c85f1a' : '#d4840a';
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderBottom: '1px solid #f0f2f7' }}>
                  <input type="checkbox" checked={selectedIds.includes(d.id)} onChange={() => onToggle(d.id)} style={{ accentColor: '#d0271d', width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>{d.title}</div>
                    {[
                      { l: 'Priority',       v: `${d.jiraPriority} (${d.severity})` },
                      { l: 'Environment',    v: d.environment },
                      { l: 'Reporter',       v: `${d.reporterName} (${ROLE_LABELS[d.reporterRole] ?? d.reporterRole}${d.businessUnit ? ` — ${d.businessUnit}` : ''})` },
                      ...(d.linkedStoryKey ? [{ l: 'Linked Story', v: d.linkedStoryKey }] : []),
                      { l: 'Functional Area', v: d.functionalArea || 'General' },
                    ].map(({ l, v }) => (
                      <div key={l} style={{ display: 'flex', gap: 8, fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: '#9ca3af', fontWeight: 600, minWidth: 100 }}>{l}</span>
                        <span style={{ color: '#374151' }}>{v}</span>
                      </div>
                    ))}
                    {d.description && <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 6, padding: '8px 10px', marginTop: 8, fontSize: 10, color: '#6b7280', lineHeight: 1.5 }}>{d.description}</div>}
                  </div>
                </div>
              );
            })
        }
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{selectedIds.length} issue{selectedIds.length !== 1 ? 's' : ''} selected</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="ghost" size="sm" onClick={onSelectAll}>Select All</Button>
          <Button variant="ghost" size="sm" onClick={onDeselectAll}>Deselect All</Button>
          <Button variant="primary" size="sm" loading={loading} disabled={selectedIds.length === 0} onClick={onConfirm}>
            Create {selectedIds.length > 0 ? selectedIds.length : ''} Issue{selectedIds.length !== 1 ? 's' : ''} in Jira
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Session Complete Summary ──────────────────────────────────────────────────

export function SessionCompleteSummary({ session }: { session: CertSession }) {
  return (
    <div>
      <Alert type="success" style={{ marginBottom: 14 }}>
        Certification complete — thank you, {session.certifierName}!
      </Alert>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[
          { l: 'Duration',    v: fmtDuration(session.durationSeconds) },
          { l: 'Environment', v: session.environment },
          { l: 'Role',        v: ROLE_LABELS[session.certifierRole] ?? session.certifierRole },
          { l: 'Defects',     v: `${session.defectCount} (${session.defects.filter(d => d.queuedForJira && !d.jiraIssueKey).length} queued for Jira)` },
        ].map(({ l, v }) => (
          <div key={l} style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{l}</div>
            <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{v}</div>
          </div>
        ))}
      </div>
      {session.defects.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Defects Summary</div>
          {session.defects.map(d => <DefectItem key={d.id} defect={d} />)}
        </>
      )}
      {session.defects.length === 0 && (
        <div style={{ textAlign: 'center', color: '#18a057', padding: 14, fontSize: 14 }}>🎉 Clean session — no defects logged!</div>
      )}
    </div>
  );
}

// ─── Active Session Row (for manager view) ────────────────────────────────────

export function ActiveSessionRow({ session, onCopyLink, onForceComplete, onView }: {
  session: CertSession;
  onCopyLink: () => void;
  onForceComplete: () => void;
  onView: () => void;
}) {
  const elapsed = useTimer(session.startedAt, session.status === 'In Progress');
  const statusColor = session.status === 'In Progress' ? '#2060d8' : session.status === 'Complete' ? '#18a057' : session.status === 'Blocked' ? '#d4840a' : '#9ca3af';

  return (
    <>
      <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600 }}>{session.certifierName}</td>
      <td style={{ padding: '12px 14px' }}>
        <Badge label={ROLE_LABELS[session.certifierRole] ?? session.certifierRole} color={session.certifierRole === 'qa' ? '#7967ae' : session.certifierRole === 'rm' ? '#c85f1a' : '#2060d8'} small />
      </td>
      <td style={{ padding: '12px 14px', fontSize: 12, color: '#374151' }}>{session.businessUnit || '—'}</td>
      <td style={{ padding: '12px 14px', fontSize: 11, color: '#374151' }}>{session.environment}</td>
      <td style={{ padding: '12px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#374151' }}>
        {fmtDuration(elapsed)}
        {session.status === 'In Progress' && <span style={{ marginLeft: 4, fontSize: 9, color: '#2060d8' }}>LIVE</span>}
      </td>
      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: session.defectCount > 3 ? '#d0271d' : session.defectCount > 0 ? '#d4840a' : '#18a057' }}>
        {session.defectCount}
      </td>
      <td style={{ padding: '12px 14px' }}>
        <span style={{ background: statusColor + '14', color: statusColor, border: `1px solid ${statusColor}28`, borderRadius: 12, padding: '3px 9px', fontSize: 10, fontWeight: 700 }}>
          {session.status === 'In Progress' && '● '}{session.status}
        </span>
        {session.blockedReason && <div style={{ fontSize: 10, color: '#d4840a', marginTop: 3 }}>⚠ {session.blockedReason.substring(0, 30)}…</div>}
      </td>
      <td style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Button variant="ghost" size="xs" onClick={onCopyLink} style={{ color: '#2060d8', borderColor: '#bfdbfe', background: '#eff6ff' }} title="Copy session link to resend to tester">🔗 Link</Button>
          <Button variant="ghost" size="xs" onClick={onView} style={{ color: '#18a057', borderColor: '#bbf7d0', background: '#f0fdf4' }}>View</Button>
          {session.status === 'In Progress' && (
            <Button variant="ghost" size="xs" onClick={onForceComplete} style={{ color: '#c85f1a', borderColor: '#fed7aa', background: '#fff7ed' }} title="Force complete if tester's window closed">Force ✓</Button>
          )}
        </div>
      </td>
    </>
  );
}
