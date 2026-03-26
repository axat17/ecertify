import React, { useState } from 'react';
import type { CopadoBundle, JiraStory, FixVersionData, Project } from '@/common/types';
import { BUNDLE_COLORS, ENV_PIPELINE, fmtDuration, truncate } from '@/common/utils';
import { StatusBadge } from '@/common/components/Badge';
import { Alert, ProgressBar } from '@/common/components/UI';

// ─── Copado Pipeline Overview Bar ─────────────────────────────────────────────

export function CopadoPipelineBar({ bundles }: { bundles: CopadoBundle[] }) {
  const allPromotions = bundles.flatMap(b => b.promotions);
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>PROMOTION PIPELINE — ALL BUNDLES</div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {ENV_PIPELINE.map((env, i) => {
          const envPromotions = allPromotions.filter(p => p.env === env);
          const allPassed = envPromotions.length > 0 && envPromotions.every(p => p.status === 'Passed');
          const anyInProgress = envPromotions.some(p => p.status === 'In Progress');
          const col = allPassed ? '#18a057' : anyInProgress ? '#d4840a' : '#9ca3af';
          return (
            <React.Fragment key={env}>
              <div style={{ flex: 1, background: col + '14', border: `1px solid ${col}28`, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: col }}>{env}</div>
                <div style={{ fontSize: 9, color: col + 'aa', marginTop: 2 }}>{allPassed ? '✓ All' : anyInProgress ? '↻' : '—'}</div>
              </div>
              {i < ENV_PIPELINE.length - 1 && <span style={{ color: '#9ca3af', fontSize: 16 }}>→</span>}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Bundle Card ──────────────────────────────────────────────────────────────

export function BundleCard({ bundle, index, apexThreshold = 75 }: { bundle: CopadoBundle; index: number; apexThreshold?: number }) {
  const [open, setOpen] = useState(false);
  const apc = Math.round(bundle.apexResults.coveragePercent);
  const bColor = BUNDLE_COLORS[index % BUNDLE_COLORS.length];
  const statusCol = bundle.status === 'Deployed' ? '#18a057' : bundle.status === 'In Progress' ? '#d4840a' : '#9ca3af';

  return (
    <div style={{ background: '#fff', border: `1px solid ${statusCol}28`, borderLeft: `3px solid ${bColor}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>{open ? '▾' : '▸'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{bundle.name}</div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{bundle.storyCount} stories · Teams: {bundle.teams.join(', ')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: apc >= apexThreshold ? '#18a057' : '#d0271d' }}>{apc}%</div>
            <div style={{ fontSize: 9, color: '#9ca3af' }}>Apex</div>
          </div>
          <StatusBadge status={bundle.validationResult.status} small />
          <StatusBadge status={bundle.status} small />
        </div>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: 16, borderTop: '1px solid #e0e4ef' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {/* Promotions */}
            <div style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 10 }}>Promotion Status</div>
              {bundle.promotions.map(p => {
                const pc = p.status === 'Passed' ? '#18a057' : p.status === 'In Progress' ? '#2060d8' : '#9ca3af';
                return (
                  <div key={p.env} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f0f2f7', fontSize: 11 }}>
                    <span style={{ background: pc + '14', color: pc, border: `1px solid ${pc}28`, borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{p.env}</span>
                    <span style={{ fontWeight: 600, color: pc }}>{p.status}</span>
                    {p.promotedAt && <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: "'JetBrains Mono', monospace" }}>{new Date(p.promotedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                );
              })}
              {bundle.backPromoHistory.length > 0 && (
                <div style={{ marginTop: 8, padding: '6px 8px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, fontSize: 10, color: '#92400e' }}>
                  <strong>Back-Promo:</strong> {bundle.backPromoHistory.map(h => `${h.fromEnv}→${h.toEnv}`).join(', ')}
                </div>
              )}
            </div>

            {/* Apex */}
            <div style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 10 }}>Apex Test Results</div>
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: apc >= apexThreshold ? '#18a057' : '#d0271d' }}>{apc}%</div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>Coverage (min {apexThreshold}%)</div>
              </div>
              <ProgressBar value={apc} height={6} color={apc >= apexThreshold ? '#18a057' : '#d0271d'} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 12, textAlign: 'center' }}>
                {[{ l: 'Passed', v: bundle.apexResults.passed, c: '#18a057' }, { l: 'Failed', v: bundle.apexResults.failed, c: bundle.apexResults.failed > 0 ? '#d0271d' : '#9ca3af' }, { l: 'Skipped', v: bundle.apexResults.skipped, c: '#9ca3af' }].map(s => (
                  <div key={s.l} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 6, padding: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: s.c }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Validation */}
            <div style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 10 }}>Validation</div>
              <StatusBadge status={bundle.validationResult.status} />
              <div style={{ marginTop: 10 }}>
                {bundle.validationResult.checks.map(c => (
                  <div key={c} style={{ fontSize: 11, color: '#374151', padding: '4px 0', borderBottom: '1px solid #f0f2f7', display: 'flex', gap: 6 }}>
                    <span style={{ color: '#18a057' }}>✓</span>{c}
                  </div>
                ))}
                {bundle.validationResult.warnings?.map(w => (
                  <div key={w} style={{ fontSize: 10, color: '#d4840a', marginTop: 4 }}>⚠ {w}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Team View Panel (consolidated + drill-down) ──────────────────────────────

interface TeamViewPanelProps {
  fixData: FixVersionData | undefined;
  stories: JiraStory[];
  releaseLabel: string;
  onAddLabel: (key: string, label: string) => void;
}

export function TeamViewPanel({ fixData, stories, releaseLabel, onAddLabel }: TeamViewPanelProps) {
  const [openTeams, setOpenTeams] = useState<Record<string, boolean>>({});

  if (!fixData) {
    return <Alert type="warning">Sync from Jira to load team breakdown</Alert>;
  }

  const { consolidated, perTeam } = fixData;
  const total = consolidated.totalStories || 1;

  return (
    <div>
      {/* Consolidated */}
      <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Consolidated — {releaseLabel}</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          {[{ l: 'Total', v: consolidated.totalStories, c: '#2060d8' }, { l: 'Done', v: consolidated.done, c: '#18a057' }, { l: 'In Progress', v: consolidated.inProgress, c: '#2060d8' }, { l: 'To Do', v: consolidated.todo, c: '#9ca3af' }].map(s => (
            <div key={s.l} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 14, borderRadius: 7, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${Math.round(consolidated.done / total * 100)}%`, background: '#18a057' }} />
          <div style={{ width: `${Math.round(consolidated.inProgress / total * 100)}%`, background: '#2060d8' }} />
          <div style={{ flex: 1, background: '#f0f2f7' }} />
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 10, color: '#9ca3af', marginTop: 6 }}>
          <span><span style={{ color: '#18a057' }}>■</span> Done ({consolidated.done})</span>
          <span><span style={{ color: '#2060d8' }}>■</span> In Progress ({consolidated.inProgress})</span>
          <span><span style={{ color: '#9ca3af' }}>■</span> To Do ({consolidated.todo})</span>
        </div>
      </div>

      {/* Per-team */}
      {perTeam.map(tv => {
        const isOpen = openTeams[tv.team];
        const teamStories = stories.filter(s => s.team === tv.team);
        const missingLabels = teamStories.filter(s => !s.hasCopadoCICD || !s.hasReleaseLabel).length;
        const pct = tv.storyCount > 0 ? Math.round(tv.doneCount / tv.storyCount * 100) : 0;
        const hc = pct >= 80 ? '#18a057' : pct >= 50 ? '#d4840a' : '#d0271d';

        return (
          <div key={tv.team} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: '#fafafa' }}
              onClick={() => setOpenTeams(o => ({ ...o, [tv.team]: !o[tv.team] }))}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#121c4e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>
                  {tv.team.split('-')[1] ?? tv.team.slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{tv.team}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>Fix Version: {tv.versionName}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {missingLabels > 0 && <span style={{ fontSize: 11, color: '#d0271d', fontWeight: 600 }}>⚠ {missingLabels} label issue{missingLabels > 1 ? 's' : ''}</span>}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: hc, fontFamily: "'JetBrains Mono', monospace" }}>{tv.doneCount}/{tv.storyCount}</div>
                  <div style={{ fontSize: 9, color: '#9ca3af' }}>done</div>
                </div>
                <span style={{ color: '#9ca3af', fontSize: 13 }}>{isOpen ? '▾' : '▸'}</span>
              </div>
            </div>

            {isOpen && (
              <div>
                {teamStories.length === 0
                  ? <div style={{ padding: '16px 18px', color: '#9ca3af', fontSize: 12 }}>No stories loaded for this team. Sync from Jira.</div>
                  : teamStories.slice(0, 10).map(s => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', borderTop: '1px solid #f0f2f7', fontSize: 11, background: (!s.hasCopadoCICD || !s.hasReleaseLabel) ? 'rgba(208,39,29,.02)' : undefined }}>
                      <a href={s.jiraUrl} target="_blank" rel="noreferrer" style={{ color: '#2060d8', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>{s.key}</a>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }} title={s.title}>{s.title}</span>
                      <StatusBadge status={s.status} small />
                      <span style={{ color: '#9ca3af', fontSize: 10, flexShrink: 0 }}>{s.assignee}</span>
                      {s.bundle && <span style={{ fontSize: 10, fontWeight: 700, color: '#7967ae', flexShrink: 0 }}>● {s.bundle}</span>}
                      {!s.hasCopadoCICD && <button onClick={() => onAddLabel(s.key, 'CopadoCICD')} style={{ fontSize: 9, color: '#7967ae', background: '#f3f0ff', border: '1px solid #ddd6fe', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>+ CopadoCICD</button>}
                      {!s.hasReleaseLabel && <button onClick={() => onAddLabel(s.key, releaseLabel)} style={{ fontSize: 9, color: '#2060d8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>+ Label</button>}
                      {s.isBlocker && <span style={{ fontSize: 9, color: '#d4840a', flexShrink: 0 }}>🚧</span>}
                    </div>
                  ))
                }
                {teamStories.length > 10 && <div style={{ padding: '8px 18px', fontSize: 10, color: '#9ca3af', borderTop: '1px solid #f0f2f7' }}>+{teamStories.length - 10} more stories</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Jira Label Table ─────────────────────────────────────────────────────────

interface LabelTableProps {
  stories: JiraStory[];
  releaseLabel: string;
  copadoCICD: string;
  onAddLabel: (key: string, label: string) => void;
  loading?: boolean;
}

type LabelFilter = 'all' | 'ready' | 'missing';

export function LabelTable({ stories, releaseLabel, copadoCICD, onAddLabel, loading }: LabelTableProps) {
  const [filter, setFilter] = useState<LabelFilter>('all');

  const ready   = stories.filter(s => s.hasCopadoCICD && s.hasReleaseLabel);
  const missing = stories.filter(s => !s.hasCopadoCICD || !s.hasReleaseLabel);
  const visible = filter === 'ready' ? ready : filter === 'missing' ? missing : stories;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { l: '✓ Both Labels',        v: ready.length,   c: '#18a057' },
          { l: '⚠ Missing CopadoCICD', v: stories.filter(s => !s.hasCopadoCICD).length, c: '#d0271d' },
          { l: '⚠ Missing Release',    v: stories.filter(s => !s.hasReleaseLabel).length, c: '#d4840a' },
          { l: 'Total',                v: stories.length, c: '#2060d8' },
        ].map(s => (
          <div key={s.l} style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 10, padding: 15, flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>{s.l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['all', 'All Stories'], ['ready', '✓ Ready'], ['missing', '⚠ Missing']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ background: filter === k ? '#121c4e' : '#fff', color: filter === k ? '#fff' : '#9ca3af', border: `1px solid ${filter === k ? '#121c4e' : '#e0e4ef'}`, borderRadius: 7, padding: '6px 13px', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Key', 'Title', 'Team', 'Status', copadoCICD, releaseLabel, 'Bundle', 'Action'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid #e0e4ef', background: '#f8f9fc', whiteSpace: 'nowrap' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {visible.slice(0, 30).map((s, i) => (
              <tr key={s.key} style={{ background: (!s.hasCopadoCICD || !s.hasReleaseLabel) ? 'rgba(208,39,29,.02)' : i % 2 !== 0 ? 'rgba(0,0,0,.01)' : '#fff' }}>
                <td style={{ padding: '10px 14px' }}><a href={s.jiraUrl} target="_blank" rel="noreferrer" style={{ color: '#2060d8', fontWeight: 700, fontSize: 11, textDecoration: 'none' }}>{s.key}</a></td>
                <td style={{ padding: '10px 14px', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.title}>{s.title}</td>
                <td style={{ padding: '10px 14px' }}><span style={{ background: '#ccfbf1', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{s.team}</span></td>
                <td style={{ padding: '10px 14px' }}><StatusBadge status={s.status} small /></td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  {s.hasCopadoCICD ? <span style={{ color: '#18a057', fontWeight: 700 }}>✓</span>
                    : <button onClick={() => onAddLabel(s.key, copadoCICD)} style={{ background: '#f3f0ff', color: '#7967ae', border: '1px solid #ddd6fe', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>+ Add</button>}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  {s.hasReleaseLabel
                    ? <span style={{ background: '#eff6ff', color: '#2060d8', border: '1px solid #bfdbfe', borderRadius: 12, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{releaseLabel}</span>
                    : <button onClick={() => onAddLabel(s.key, releaseLabel)} style={{ background: '#eff6ff', color: '#2060d8', border: '1px solid #bfdbfe', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: 'inherit' }}>+ Add</button>}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 10, color: s.bundle ? '#7967ae' : '#9ca3af' }}>{s.bundle ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  {(!s.hasCopadoCICD || !s.hasReleaseLabel)
                    ? <button onClick={() => { if (!s.hasCopadoCICD) onAddLabel(s.key, copadoCICD); if (!s.hasReleaseLabel) onAddLabel(s.key, releaseLabel); }} style={{ background: '#d0271d', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>Fix All</button>
                    : <span style={{ color: '#18a057', fontSize: 11 }}>✓ Ready</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length > 30 && <div style={{ padding: '12px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 12, borderTop: '1px solid #e0e4ef' }}>Showing 30 of {visible.length} stories. Sync to load all.</div>}
        {visible.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>{loading ? 'Syncing from Jira…' : 'No stories found. Sync from Jira first.'}</div>}
      </div>
    </div>
  );
}
