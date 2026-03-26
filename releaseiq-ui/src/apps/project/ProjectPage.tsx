import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi, certApi, jiraApi, copadoApi } from '@/services/api';
import type { Project, JiraStory, CopadoBundle, FixVersionData } from '@/common/types';
import { useAuthStore } from '@/store/authStore';
import { biWeeklyDate, fmtDate, healthColor } from '@/common/utils';
import { Alert, Tabs, StepPipeline, Metric } from '@/common/components/UI';
import { StatusBadge } from '@/common/components/Badge';
import Button from '@/common/components/Button';
import { BundleCard, CopadoPipelineBar, TeamViewPanel, LabelTable } from './components';

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate      = useNavigate();
  const user          = useAuthStore(s => s.user);
  const qc            = useQueryClient();
  const [activeTab,   setActiveTab]   = useState('cert');
  const [syncStatus,  setSyncStatus]  = useState('');

  /* ── Queries ── */
  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn:  () => projectApi.get(projectId!),
    enabled:  !!projectId,
  });

  const { data: sessions } = useQuery({
    queryKey: ['sessions', projectId, 'active'],
    queryFn:  () => certApi.getByProject(projectId!, { status:'In Progress' }),
    enabled:  !!projectId,
    refetchInterval: 30000,
  });

  const { data: storiesResp } = useQuery({
    queryKey: ['stories', projectId],
    queryFn:  () => jiraApi.stories(projectId!),
    enabled:  !!projectId && project?.type === 'salesforce',
  });

  const { data: fixData } = useQuery<FixVersionData>({
    queryKey: ['fixVersions', projectId],
    queryFn:  () => jiraApi.fixVersions(projectId!),
    enabled:  !!projectId && project?.type === 'salesforce',
  });

  const { data: bundles = [] } = useQuery<CopadoBundle[]>({
    queryKey: ['bundles', projectId],
    queryFn:  () => copadoApi.bundles(projectId!),
    enabled:  !!projectId && project?.type === 'salesforce',
  });

  /* ── Mutations ── */
  const syncMut = useMutation({
    mutationFn: () => jiraApi.sync(projectId!),
    onMutate:   () => setSyncStatus('syncing'),
    onSuccess:  () => {
      setSyncStatus('synced');
      qc.invalidateQueries({ queryKey:['stories', projectId] });
      qc.invalidateQueries({ queryKey:['fixVersions', projectId] });
      qc.invalidateQueries({ queryKey:['project', projectId] });
    },
    onError: (e: any) => setSyncStatus('error: ' + (e?.response?.data?.error ?? 'Sync failed')),
  });

  const labelMut = useMutation({
    mutationFn: ({ key, label }: { key:string; label:string }) => jiraApi.addLabel(projectId!, key, label),
    onSuccess:  () => qc.invalidateQueries({ queryKey:['stories', projectId] }),
  });

  /* ── Loading / error ── */
  if (isLoading) return <div style={{ padding:40, textAlign:'center', color:'#9ca3af', fontFamily:"'DM Sans',sans-serif" }}>Loading project…</div>;
  if (error || !project) return (
    <div style={{ padding:24, fontFamily:"'DM Sans',sans-serif" }}>
      <Alert type="error">Project not found or failed to load.</Alert>
      <Button variant="ghost" size="sm" style={{ marginTop:12 }} onClick={() => navigate('/')}>← Go Home</Button>
    </div>
  );

  const stories: JiraStory[] = (storiesResp as any)?.data ?? [];
  const inProgress           = (sessions as any) ?? [];
  const isSF                 = project.type === 'salesforce';
  const isAdmin              = user?.role === 'main-admin' || (user?.role === 'project-admin' && user?.projectAdminOf?.includes(projectId!));
  const stageIndex           = project.healthScore >= 100 ? 5 : project.healthScore >= 80 ? 4 : project.healthScore >= 60 ? 3 : project.healthScore >= 40 ? 2 : project.healthScore >= 20 ? 1 : 0;
  const hc                   = healthColor(project.healthScore);

  const tabs = [
    { key:'cert',    label:'◉ Certification' },
    ...(isSF ? [{ key:'bundles', label:'⬡ Bundles + Copado' }] : []),
    { key:'plan',    label:'📅 Release Plan' },
    ...(isSF ? [{ key:'labels', label:'🏷️ Jira Labels' }, { key:'teams', label:'👥 Team View' }] : []),
    { key:'defects', label:'🐛 Defects' },
    { key:'metrics', label:'📈 Metrics' },
  ];

  return (
    <div style={{ padding:24, maxWidth:1280, fontFamily:"'DM Sans',sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18, flexWrap:'wrap' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>← All Projects</Button>
        <span style={{ fontSize:20 }}>{project.icon}</span>
        <span style={{ fontSize:20, fontWeight:800 }}>{project.name}</span>
        <StatusBadge status={project.status} />
        {project.isLive && (
          <span style={{ fontSize:11, fontWeight:700, color:'#d0271d', display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#d0271d', animation:'riq-pulse 2s infinite', display:'inline-block' }} />LIVE
          </span>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:8, flexWrap:'wrap' }}>
          {inProgress.length > 0 && (
            <Button variant="ghost" size="sm" style={{ color:'#2060d8', borderColor:'#bfdbfe', background:'#eff6ff' }} onClick={() => navigate(`/projects/${projectId}/sessions`)}>
              📋 {inProgress.length} Active Session{inProgress.length > 1 ? 's' : ''}
            </Button>
          )}
          {isSF && <Button variant="ghost" size="sm" loading={syncMut.isPending} onClick={() => syncMut.mutate()}>⟳ Sync Jira</Button>}
          {isAdmin && <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>⚙ Admin</Button>}
          <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/cert/${projectId}`); }}>🔗 Copy Cert Link</Button>
          <Button variant="primary" size="sm" onClick={() => navigate(`/projects/${projectId}/sessions`)}>+ Join Session</Button>
        </div>
      </div>

      {/* Sync alert */}
      {syncStatus && !syncMut.isPending && (
        <div style={{ marginBottom:14 }}>
          <Alert type={syncStatus.startsWith('error') ? 'error' : 'success'}>
            {syncStatus.startsWith('error') ? syncStatus : `✓ Sync complete — ${(storiesResp as any)?.meta?.total ?? 0} stories loaded`}
          </Alert>
        </div>
      )}
      {project.syncStatus === 'stale' && !syncStatus && (
        <div style={{ marginBottom:14 }}>
          <Alert type="warning">
            Data may be stale. Last sync: {project.lastJiraSync ? new Date(project.lastJiraSync).toLocaleString() : 'Never'}
            <button onClick={() => syncMut.mutate()} style={{ marginLeft:8, background:'none', border:'none', color:'#d4840a', cursor:'pointer', fontWeight:700, fontSize:11, fontFamily:'inherit' }}>Refresh now ↺</button>
          </Alert>
        </div>
      )}

      {/* Hero */}
      <div style={{ background:'linear-gradient(138deg,#121c4e 0%,#1a2660 55%,#0e183a 100%)', borderRadius:14, padding:'22px 26px', marginBottom:18, border:'1px solid rgba(208,39,29,.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(208,39,29,.16) 0%,transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
          <div style={{ position:'relative' }}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,.35)', textTransform:'uppercase', letterSpacing:'1.4px', marginBottom:8 }}>
              {isSF?'Salesforce':'React/Other'} · {project.teamCount} Teams · {project.cadence}
            </div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.62)', maxWidth:500, lineHeight:1.55, marginBottom:14 }}>{project.description}</div>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              {[
                { label:'Last',    rel:`${project.shortName} (prev)`, date: biWeeklyDate(project.releaseAnchorDate, -1) },
                { label:'● NOW',   rel: project.currentRelease,       date: biWeeklyDate(project.releaseAnchorDate,  0), highlight:true },
                { label:'Next',    rel:`${project.shortName} (next)`, date: biWeeklyDate(project.releaseAnchorDate,  1) },
              ].map(r => (
                <div key={r.label} style={{ ...(r.highlight ? { borderLeft:'1px solid rgba(255,255,255,.12)', paddingLeft:16 } : {}) }}>
                  <div style={{ fontSize:9, color: r.highlight ? '#fac8bf' : 'rgba(255,255,255,.38)', textTransform:'uppercase', marginBottom:3 }}>{r.label}</div>
                  <div style={{ fontWeight: r.highlight ? 800 : 700, fontSize: r.highlight ? 15 : 13, color:'#fff' }}>{r.rel}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'rgba(255,255,255,.4)' }}>{fmtDate(r.date)}</div>
                </div>
              ))}
            </div>
            {isSF && (
              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                {[project.copadoCICD, project.releaseLabel].map(l => l && l !== 'N/A' ? (
                  <span key={l} style={{ background:'rgba(255,255,255,.12)', borderRadius:12, padding:'3px 10px', fontSize:11, color:'rgba(255,255,255,.8)', fontWeight:600 }}>{l}</span>
                ) : null)}
              </div>
            )}
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.35)', textTransform:'uppercase', marginBottom:4 }}>Health</div>
            <div style={{ fontSize:38, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color: project.healthScore>=80?'#7ee8a2':project.healthScore>=50?'#fcd34d':'#f87171', lineHeight:1 }}>{project.healthScore}%</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:4 }}>{project.ownerEmail}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'flex', gap:12, marginBottom:18, flexWrap:'wrap' }}>
        {[
          { l:'Stories',        v: project.storyCount,  c:'#2060d8' },
          { l:'Done',           v: project.doneCount,   c:'#18a057' },
          { l:'Defects',        v: project.defectCount, c: project.defectCount>5?'#d0271d':project.defectCount>0?'#d4840a':'#18a057' },
          ...(isSF ? [{ l:'Bundles', v: bundles.length, c:'#7967ae' }] : []),
          { l:'Teams',          v: project.teamCount,   c:'#0d9488' },
          { l:'Active Sessions',v: inProgress.length,   c: inProgress.length>0?'#d0271d':'#9ca3af' },
        ].map(s => <Metric key={s.l} label={s.l} value={s.v} color={s.c} />)}
      </div>

      {/* Tabs */}
      <div style={{ marginBottom:18 }}>
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      </div>

      {/* TAB: CERTIFICATION */}
      {activeTab === 'cert' && (
        <div>
          {inProgress.length > 0 && (
            <Alert type="info" style={{ marginBottom:14 }}>
              ● <strong>{inProgress.length} active session{inProgress.length>1?'s':''}</strong> in progress for {project.currentRelease}.
              <button onClick={() => navigate(`/projects/${projectId}/sessions`)} style={{ marginLeft:8, background:'#121c4e', color:'#fff', border:'none', borderRadius:7, padding:'4px 12px', cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:'inherit' }}>View All Sessions</button>
            </Alert>
          )}
          <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:12, padding:18, marginBottom:16, boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Share Certification Link</div>
            <div style={{ background:'#f8f9fc', border:'1px solid #e0e4ef', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#374151', marginBottom:12, fontFamily:"'JetBrains Mono',monospace", wordBreak:'break-all' }}>
              {window.location.origin}/cert/[sessionId]
            </div>
            <div style={{ fontSize:11, color:'#6b7280', marginBottom:16, lineHeight:1.6 }}>
              When BU testers click this link, they land on a Join Session screen with your release pre-loaded. Sessions are saved to MongoDB — closing the browser does not lose data. If a tester loses their link, use the <strong>Active Sessions</strong> page to copy and resend it.
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <Button variant="primary" size="sm" onClick={() => navigate(`/projects/${projectId}/sessions`)}>+ Join Session</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}/sessions`)}>📋 Manage All Sessions</Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: BUNDLES + COPADO */}
      {isSF && activeTab === 'bundles' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:14 }}>Copado Deployment Bundles</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>1–3 bundles per release · DevOps creates in Copado · Auto-promoted through environments</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => copadoApi.sync(projectId!)}>⟳ Refresh Copado</Button>
          </div>
          <CopadoPipelineBar bundles={bundles} />
          {bundles.map((b, i) => (
            <BundleCard key={b._id} bundle={b} index={i} apexThreshold={project.copadoConfig?.apexCoverageThreshold ?? 75} />
          ))}
          {bundles.length === 0 && (
            <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:12, padding:40, textAlign:'center', color:'#9ca3af', fontSize:13 }}>
              No bundles found. Sync from Copado to load bundle data.
            </div>
          )}
        </div>
      )}

      {/* TAB: RELEASE PLAN */}
      {activeTab === 'plan' && (
        <div>
          <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:12, padding:18, marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:14 }}>Deployment Pipeline</div>
            <StepPipeline steps={['Planning','Dev','SIT','UAT','Staging','PROD']} activeIndex={stageIndex} />
          </div>
          <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #e0e4ef', fontWeight:700, fontSize:13 }}>Release Schedule</div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                {['Release','Date',...(isSF?['Labels','Bundles']:[]),'Status','Action'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.6px', borderBottom:'1px solid #e0e4ef', background:'#f8f9fc' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[-1,0,1,2,3].map(offset => {
                  const d = biWeeklyDate(project.releaseAnchorDate, offset);
                  const isCur = offset === 0;
                  const ver = `${project.shortName} ${offset === 0 ? project.currentSprint : `(${offset > 0 ? '+' : ''}${offset})`}`;
                  return (
                    <tr key={offset} style={{ background: isCur ? 'rgba(208,39,29,.03)' : undefined }}>
                      <td style={{ padding:'12px 14px', fontWeight: isCur ? 800 : 600, fontSize:12 }}>
                        {ver}{isCur && <span style={{ marginLeft:6, fontSize:10, color:'#d0271d' }}>(CURRENT)</span>}
                      </td>
                      <td style={{ padding:'12px 14px', fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#6b7280' }}>{fmtDate(d)}</td>
                      {isSF && <>
                        <td style={{ padding:'12px 14px' }}>
                          {isCur ? <span style={{ background:'#f3f0ff', color:'#7967ae', border:'1px solid #ddd6fe', borderRadius:12, padding:'2px 7px', fontSize:10, fontWeight:700, marginRight:5 }}>{project.copadoCICD}</span> : <span style={{ color:'#9ca3af', fontSize:10 }}>TBD</span>}
                        </td>
                        <td style={{ padding:'12px 14px', fontSize:11, color:'#6b7280' }}>{isCur ? bundles.length : offset < 0 ? '2' : '1–3'}</td>
                      </>}
                      <td style={{ padding:'12px 14px' }}>
                        {offset < 0 ? <StatusBadge status="Complete" small /> : isCur ? <StatusBadge status={project.status} small /> : <StatusBadge status="Planned" small />}
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        {isCur ? <Button variant="primary" size="xs" onClick={() => setActiveTab('cert')}>Manage →</Button>
                          : offset < 0 ? <Button variant="ghost" size="xs">Report</Button>
                          : <Button variant="ghost" size="xs">Plan</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: JIRA LABELS */}
      {isSF && activeTab === 'labels' && (
        <LabelTable
          stories={stories}
          releaseLabel={project.releaseLabel}
          copadoCICD={project.copadoCICD}
          onAddLabel={(key, label) => labelMut.mutate({ key, label })}
          loading={syncMut.isPending}
        />
      )}

      {/* TAB: TEAM VIEW */}
      {isSF && activeTab === 'teams' && (
        <TeamViewPanel
          fixData={fixData}
          stories={stories}
          releaseLabel={project.releaseLabel}
          onAddLabel={(key, label) => labelMut.mutate({ key, label })}
        />
      )}

      {/* TAB: DEFECTS */}
      {activeTab === 'defects' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>Defect Tracker</div>
            <Button variant="primary" size="sm" onClick={() => navigate(`/projects/${projectId}/sessions`)}>🐛 Log Defect via Session</Button>
          </div>
          <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                {['ID','Title','Severity','Status','Jira'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.6px', borderBottom:'1px solid #e0e4ef', background:'#f8f9fc' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {project.defectCount === 0
                  ? <tr><td colSpan={5} style={{ padding:32, textAlign:'center', color:'#18a057', fontSize:13 }}>✓ No defects — clean sprint!</td></tr>
                  : Array.from({ length: Math.min(project.defectCount, 20) }).map((_, i) => {
                      const sev = ['Critical','Major','Minor'][i%3];
                      const col = sev==='Critical'?'#d0271d':sev==='Major'?'#c85f1a':'#d4840a';
                      return (
                        <tr key={i} style={{ background: i%2!==0?'rgba(0,0,0,.01)':'#fff' }}>
                          <td style={{ padding:'10px 14px', fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:'#6b7280' }}>DEF-{1000+i}</td>
                          <td style={{ padding:'10px 14px', fontSize:11, color:'#374151', maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Lorem ipsum dolor sit amet defect {i+1}</td>
                          <td style={{ padding:'10px 14px' }}><span style={{ background:col+'14', color:col, border:`1px solid ${col}28`, borderRadius:12, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{sev}</span></td>
                          <td style={{ padding:'10px 14px' }}><StatusBadge status={['Open','In Progress','Resolved'][i%3]} small /></td>
                          <td style={{ padding:'10px 14px' }}><a href={`https://jira.atlassian.net/browse/${project.jiraKey}-BUG-${1000+i}`} target="_blank" rel="noreferrer" style={{ color:'#2060d8', fontWeight:600, fontSize:11, textDecoration:'none' }}>{project.jiraKey}-BUG-{1000+i} ↗</a></td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: METRICS */}
      {activeTab === 'metrics' && (
        <div style={{ background:'#fff', border:'1px solid #e0e4ef', borderRadius:12, padding:24, textAlign:'center', color:'#9ca3af', fontSize:13 }}>
          📈 Metrics dashboard — connect to real Jira data and sync to populate charts.<br/>
          Historical release comparisons, certifier duration trends, and defect analysis will appear here.
        </div>
      )}
    </div>
  );
}
