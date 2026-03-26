import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { CertificationSession, Project, Activity, ErrorLog } from '../models';
import { v4 as uuidv4 } from 'uuid';
import { IDefect, DefectSeverity, JiraPriority, CertRole } from '../types';
import logger from '../utils/logger';

const router = Router();

// ─── GET /certifications/active — all active sessions across projects ─────────
// This is the "manage active sessions" view for Release Managers
router.get('/active', authenticate, async (req, res) => {
  try {
    const { projectId } = req.query;
    const filter: Record<string, unknown> = { status: 'In Progress' };
    if (projectId) filter.projectId = projectId;

    const sessions = await CertificationSession.find(filter)
      .sort({ startedAt: -1 })
      .lean();

    // Enrich with project name
    const projectIds = [...new Set(sessions.map(s => s.projectId))];
    const projects = await Project.find({ projectId: { $in: projectIds } }).lean();
    const projMap = Object.fromEntries(projects.map(p => [p.projectId, p]));

    const enriched = sessions.map(s => ({
      ...s,
      projectName: projMap[s.projectId]?.name || s.projectId,
      durationSeconds: Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000),
    }));

    res.json({ success: true, data: enriched, meta: { total: enriched.length } });
  } catch (err) {
    logger.error('Failed to fetch active sessions', { error: err });
    res.status(500).json({ success: false, error: 'Failed to fetch active sessions' });
  }
});

// GET /certifications/project/:projectId — all sessions for a project
router.get('/project/:projectId', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { releaseVersion, status } = req.query;
    const filter: Record<string, unknown> = { projectId };
    if (releaseVersion) filter.releaseVersion = releaseVersion;
    if (status) filter.status = status;

    const sessions = await CertificationSession.find(filter)
      .sort({ startedAt: -1 })
      .lean();

    res.json({ success: true, data: sessions, meta: { total: sessions.length } });
  } catch (err) {
    logger.error('Failed to fetch project sessions', { error: err, projectId: req.params.projectId });
    res.status(500).json({ success: false, error: 'Failed to fetch certification sessions' });
  }
});

// GET /certifications/:sessionId — single session by sessionId (UUID)
router.get('/:sessionId', authenticate, async (req, res) => {
  try {
    const session = await CertificationSession.findOne({ sessionId: req.params.sessionId }).lean();
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found. The link may be expired or invalid.' });
      return;
    }
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch session' });
  }
});

// POST /certifications/join — create/join a certification session
router.post('/join', authenticate, async (req, res) => {
  try {
    const { projectId, releaseVersion, certifierName, certifierEmail, certifierRole, businessUnit, environment } = req.body;

    // Validate required fields
    if (!projectId || !releaseVersion || !certifierName || !certifierEmail || !certifierRole) {
      res.status(400).json({ success: false, error: 'projectId, releaseVersion, certifierName, certifierEmail, certifierRole are required' });
      return;
    }

    const validRoles: CertRole[] = ['bu', 'qa', 'rm', 'dev'];
    if (!validRoles.includes(certifierRole)) {
      res.status(400).json({ success: false, error: `Invalid certifierRole. Must be one of: ${validRoles.join(', ')}` });
      return;
    }

    if (certifierRole === 'bu' && !businessUnit) {
      res.status(400).json({ success: false, error: 'businessUnit is required for BU Rep role' });
      return;
    }

    // Check project exists
    const project = await Project.findOne({ projectId });
    if (!project) {
      res.status(404).json({ success: false, error: `Project '${projectId}' not found` });
      return;
    }

    // Check if this person already has an active session for this release
    const existingActive = await CertificationSession.findOne({
      projectId,
      certifierEmail: certifierEmail.toLowerCase(),
      releaseVersion,
      status: 'In Progress',
    });

    if (existingActive) {
      // Return the existing session so they can resume
      res.json({
        success: true,
        data: existingActive,
        message: 'Resumed existing active session',
        resumed: true,
      });
      return;
    }

    const sessionId = uuidv4();
    const session = new CertificationSession({
      sessionId,
      projectId,
      releaseVersion,
      certifierName,
      certifierEmail: certifierEmail.toLowerCase(),
      certifierRole,
      businessUnit,
      environment: environment || 'UAT',
      status: 'In Progress',
      startedAt: new Date(),
      durationSeconds: 0,
      defects: [],
      defectCount: 0,
      verifiedStoryKeys: [],
      jiraIssuesCreated: false,
      jiraIssueKeys: [],
    });

    await session.save();

    await Activity.create({
      projectId,
      type: 'session_joined',
      message: `${certifierName} joined ${releaseVersion} certification (${certifierRole === 'qa' ? 'QA Team' : certifierRole === 'rm' ? 'Release Manager' : `BU Rep — ${businessUnit}`})`,
      icon: '▶️',
      actorEmail: certifierEmail,
      actorName: certifierName,
    });

    logger.info('Certification session started', { sessionId, projectId, certifierEmail, certifierRole });

    // Return session with share link
    const shareLink = `/cert/${sessionId}`;
    res.status(201).json({
      success: true,
      data: { ...session.toObject(), shareLink },
      message: 'Certification session started',
    });
  } catch (err) {
    logger.error('Failed to create certification session', { error: err });
    res.status(500).json({ success: false, error: 'Failed to start certification session' });
  }
});

// PATCH /certifications/:sessionId/defect — add a defect to a session
router.patch('/:sessionId/defect', authenticate, async (req, res) => {
  try {
    const session = await CertificationSession.findOne({ sessionId: req.params.sessionId });
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }
    if (session.status !== 'In Progress') {
      res.status(400).json({ success: false, error: `Cannot add defects to a session with status '${session.status}'` });
      return;
    }

    const { title, description, severity, linkedStoryKey, environment, functionalArea, screenshotUrl, queuedForJira } = req.body;

    if (!title || !severity) {
      res.status(400).json({ success: false, error: 'title and severity are required' });
      return;
    }

    const validSeverities: DefectSeverity[] = ['Critical', 'Major', 'Minor'];
    if (!validSeverities.includes(severity)) {
      res.status(400).json({ success: false, error: `Invalid severity. Must be: ${validSeverities.join(', ')}` });
      return;
    }

    const priorityMap: Record<DefectSeverity, JiraPriority> = { Critical: 'Highest', Major: 'High', Minor: 'Medium' };

    const defect: IDefect = {
      id: uuidv4(),
      title,
      description: description || '',
      severity,
      jiraPriority: priorityMap[severity as DefectSeverity],
      linkedStoryKey,
      environment: environment || session.environment,
      functionalArea: functionalArea || 'General',
      screenshotUrl,
      reporterName: session.certifierName,
      reporterEmail: session.certifierEmail,
      reporterRole: session.certifierRole,
      businessUnit: session.businessUnit,
      queuedForJira: queuedForJira !== false,
      loggedAt: new Date(),
    };

    session.defects.push(defect);
    session.defectCount = session.defects.length;
    session.durationSeconds = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    await session.save();

    await Activity.create({
      projectId: session.projectId,
      type: 'defect_logged',
      message: `${session.certifierName} logged a ${severity} defect: "${title}"`,
      icon: '🐛',
      actorEmail: session.certifierEmail,
      actorName: session.certifierName,
      metadata: { severity, sessionId: session.sessionId },
    });

    res.json({ success: true, data: defect, message: 'Defect logged successfully' });
  } catch (err) {
    logger.error('Failed to log defect', { error: err, sessionId: req.params.sessionId });
    res.status(500).json({ success: false, error: 'Failed to log defect' });
  }
});

// PATCH /certifications/:sessionId/verify-story — mark a story as verified
router.patch('/:sessionId/verify-story', authenticate, async (req, res) => {
  try {
    const { storyKey, verified } = req.body;
    const session = await CertificationSession.findOne({ sessionId: req.params.sessionId });
    if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return; }
    if (session.status !== 'In Progress') { res.status(400).json({ success: false, error: 'Session is not active' }); return; }

    if (verified && !session.verifiedStoryKeys.includes(storyKey)) {
      session.verifiedStoryKeys.push(storyKey);
    } else if (!verified) {
      session.verifiedStoryKeys = session.verifiedStoryKeys.filter(k => k !== storyKey);
    }
    session.durationSeconds = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    await session.save();

    res.json({ success: true, data: { verifiedStoryKeys: session.verifiedStoryKeys } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update story verification' });
  }
});

// PATCH /certifications/:sessionId/block — mark session as blocked
router.patch('/:sessionId/block', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    const session = await CertificationSession.findOne({ sessionId: req.params.sessionId });
    if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return; }
    session.status = 'Blocked';
    session.blockedReason = reason || 'No reason provided';
    session.durationSeconds = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    await session.save();
    res.json({ success: true, message: 'Session marked as blocked' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to block session' });
  }
});

// POST /certifications/:sessionId/complete — complete the session
router.post('/:sessionId/complete', authenticate, async (req, res) => {
  try {
    const session = await CertificationSession.findOne({ sessionId: req.params.sessionId });
    if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return; }
    if (session.status === 'Complete') {
      res.json({ success: true, data: session, message: 'Session was already completed' });
      return;
    }

    session.status = 'Complete';
    session.completedAt = new Date();
    session.durationSeconds = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    await session.save();

    // Update project defect count
    await Project.findOneAndUpdate(
      { projectId: session.projectId },
      { $inc: { defectCount: session.defectCount } }
    );

    await Activity.create({
      projectId: session.projectId,
      type: 'cert_complete',
      message: `${session.certifierName} completed certification — ${session.defectCount} defect${session.defectCount !== 1 ? 's' : ''} logged`,
      icon: '✅',
      actorEmail: session.certifierEmail,
      actorName: session.certifierName,
      metadata: { defectCount: session.defectCount, durationSeconds: session.durationSeconds },
    });

    logger.info('Certification session completed', { sessionId: session.sessionId, defects: session.defectCount });
    res.json({ success: true, data: session, message: 'Certification completed successfully' });
  } catch (err) {
    logger.error('Failed to complete session', { error: err, sessionId: req.params.sessionId });
    res.status(500).json({ success: false, error: 'Failed to complete certification session' });
  }
});

// POST /certifications/:sessionId/create-jira-issues — bulk create Jira bugs
router.post('/:sessionId/create-jira-issues', authenticate, async (req, res) => {
  try {
    const { selectedDefectIds } = req.body; // array of defect IDs to create; if empty, create all queued
    const session = await CertificationSession.findOne({ sessionId: req.params.sessionId });
    if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return; }

    const project = await Project.findOne({ projectId: session.projectId });
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' }); return; }

    const defectsToCreate = session.defects.filter(d =>
      d.queuedForJira && !d.jiraIssueKey &&
      (!selectedDefectIds || selectedDefectIds.includes(d.id))
    );

    if (defectsToCreate.length === 0) {
      res.json({ success: true, data: { created: 0, issues: [] }, message: 'No defects to create' });
      return;
    }

    // MOCK: In production, call Jira REST API POST /rest/api/3/issue
    // Each defect becomes a Jira Bug with:
    //   project.key = project.jiraKey
    //   issuetype = Bug
    //   summary = defect.title
    //   description = defect.description
    //   priority = defect.jiraPriority
    //   labels = [CopadoCICD label, release label, BU label, env label]
    //   customfield_linkedStory = defect.linkedStoryKey (if configured)

    const createdIssues: { defectId: string; jiraKey: string; url: string }[] = [];
    let issueCounter = 5000;

    for (const defect of defectsToCreate) {
      await new Promise(r => setTimeout(r, 50)); // simulate API latency
      const jiraKey = `${project.jiraKey}-${issueCounter++}`;
      const jiraUrl = `${project.jiraBaseUrl || 'https://your-org.atlassian.net'}/browse/${jiraKey}`;

      // Update defect in session
      const d = session.defects.find(x => x.id === defect.id);
      if (d) { d.jiraIssueKey = jiraKey; d.jiraIssueUrl = jiraUrl; }

      createdIssues.push({ defectId: defect.id, jiraKey, url: jiraUrl });
    }

    session.jiraIssuesCreated = true;
    session.jiraIssueKeys = createdIssues.map(i => i.jiraKey);
    await session.save();

    await Activity.create({
      projectId: session.projectId,
      type: 'jira_created',
      message: `${createdIssues.length} Jira bug${createdIssues.length !== 1 ? 's' : ''} created from ${session.certifierName}'s session`,
      icon: '🎫',
      actorEmail: session.certifierEmail,
      actorName: session.certifierName,
      metadata: { issues: createdIssues.map(i => i.jiraKey) },
    });

    logger.info('Jira issues created', { sessionId: session.sessionId, count: createdIssues.length });
    res.json({ success: true, data: { created: createdIssues.length, issues: createdIssues }, message: `${createdIssues.length} Jira issues created` });
  } catch (err) {
    // Log to error log collection
    await ErrorLog.create({ context: 'jira_bulk_create', message: (err as Error).message, stack: (err as Error).stack, projectId: req.params.projectId, level: 'error' }).catch(() => {});
    logger.error('Failed to create Jira issues', { error: err });
    res.status(500).json({ success: false, error: 'Failed to create Jira issues. Please retry.' });
  }
});

// GET /certifications/:sessionId/resume — resume a session (used when cert link is clicked)
// Returns session data so UI can restore state even after page navigation
router.get('/:sessionId/resume', async (req, res) => {
  // No auth required — cert link is the credential
  try {
    const session = await CertificationSession.findOne({ sessionId: req.params.sessionId });
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found. This link may be invalid or expired.' });
      return;
    }

    // Update duration if still in progress
    if (session.status === 'In Progress') {
      session.durationSeconds = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
      await session.save();
    }

    const project = await Project.findOne({ projectId: session.projectId }).lean();

    res.json({
      success: true,
      data: {
        session,
        project: project ? { name: project.name, currentRelease: project.currentRelease, icon: project.icon } : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to resume session' });
  }
});

export default router;
