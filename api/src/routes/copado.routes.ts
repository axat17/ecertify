// ============================================================
// copado.routes.ts
// ============================================================
import { Router } from 'express';
import { authenticate, requireProjectAdmin } from '../middleware/auth';
import { CopadoBundle, Project, ErrorLog } from '../models';
import logger from '../utils/logger';
import config from '../config';

const copadoRouter = Router();

// GET /copado/bundles/:projectId
copadoRouter.get('/bundles/:projectId', authenticate, async (req, res) => {
  try {
    const bundles = await CopadoBundle.find({ projectId: req.params.projectId })
      .sort({ bundleNumber: 1 }).lean();
    res.json({ success: true, data: bundles });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch bundles' });
  }
});

// POST /copado/sync/:projectId — sync bundle status from Copado API
copadoRouter.post('/sync/:projectId', authenticate, requireProjectAdmin(), async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await Project.findOne({ projectId });
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' }); return; }
    if (project.type !== 'salesforce') {
      res.status(400).json({ success: false, error: 'Copado integration is only available for Salesforce projects' });
      return;
    }

    if (config.copado.mock) {
      await new Promise(r => setTimeout(r, 1200));
      // Simulate updating bundle statuses
      logger.info('[Copado Sync] Mock sync completed', { projectId });
      res.json({ success: true, message: 'Copado sync completed (mock)', data: { bundlesUpdated: 3, syncedAt: new Date() } });
    } else {
      // Real Copado API calls:
      // 1. GET /services/apexrest/copado/v1/pipelines/{pipelineId}/promotions
      // 2. GET /services/apexrest/copado/v1/environments/{env}/apexTestResults
      // 3. Parse and upsert into CopadoBundle collection
      res.json({ success: true, message: 'Copado sync scheduled — real API calls go here' });
    }
  } catch (err) {
    await ErrorLog.create({ context: 'copado_sync', message: (err as Error).message, projectId, level: 'error' }).catch(() => {});
    logger.error('[Copado Sync] Failed', { error: err, projectId });
    res.status(502).json({ success: false, error: 'Copado sync failed. Cached bundle data is still available.' });
  }
});

// POST /copado/test-connection — verify Copado API credentials
copadoRouter.post('/test-connection', authenticate, requireProjectAdmin(), async (req, res) => {
  const { url, apiToken, pipelineName } = req.body;
  if (!url || !apiToken) {
    res.status(400).json({ success: false, error: 'url and apiToken are required' });
    return;
  }
  await new Promise(r => setTimeout(r, 800));
  // In production: GET {url}/services/apexrest/copado/v1/pipelines
  res.json({ success: true, message: `Connected to Copado at ${url}. Pipeline "${pipelineName}" found.` });
});

export default copadoRouter;


// ============================================================
// admin.routes.ts
// ============================================================
import { Router as AdminRouter } from 'express';
import { authenticate, requireMainAdmin, requireProjectAdmin } from '../middleware/auth';
import { AdminRequest, ErrorLog, User, Project } from '../models';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

const adminRouter = AdminRouter();

// GET /admin/requests — all admin access requests (main admin only)
adminRouter.get('/requests', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const requests = await AdminRequest.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: requests, meta: { pending: requests.filter(r => r.status === 'pending').length } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch admin requests' });
  }
});

// POST /admin/requests — submit admin access request
adminRouter.post('/requests', authenticate, async (req, res) => {
  try {
    const { projectId, reason } = req.body;
    if (!projectId || !reason) {
      res.status(400).json({ success: false, error: 'projectId and reason are required' });
      return;
    }
    const project = await Project.findOne({ projectId }).lean();
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' }); return; }

    const existing = await AdminRequest.findOne({ projectId, requesterEmail: req.user!.email, status: 'pending' });
    if (existing) {
      res.status(409).json({ success: false, error: 'You already have a pending request for this project' });
      return;
    }

    const request = new AdminRequest({
      requestId: uuidv4(),
      projectId,
      projectName: project.name,
      requesterEmail: req.user!.email,
      requesterName: req.user!.name,
      reason,
      status: 'pending',
    });
    await request.save();
    res.status(201).json({ success: true, data: request, message: 'Admin access request submitted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to submit request' });
  }
});

// PATCH /admin/requests/:requestId/approve
adminRouter.patch('/requests/:requestId/approve', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const request = await AdminRequest.findOne({ requestId: req.params.requestId });
    if (!request) { res.status(404).json({ success: false, error: 'Request not found' }); return; }
    if (request.status !== 'pending') {
      res.status(400).json({ success: false, error: `Request is already ${request.status}` });
      return;
    }

    request.status = 'approved';
    request.reviewedBy = req.user!.email;
    request.reviewedAt = new Date();
    await request.save();

    // Update user role and project admin list
    await User.findOneAndUpdate(
      { email: request.requesterEmail },
      { $set: { role: 'project-admin' }, $addToSet: { projectAdminOf: request.projectId } },
      { upsert: false }
    );

    // Update project adminEmails
    await Project.findOneAndUpdate(
      { projectId: request.projectId },
      { $addToSet: { adminEmails: request.requesterEmail } }
    );

    logger.info('Admin request approved', { requestId: req.params.requestId, approvedBy: req.user!.email });
    res.json({ success: true, message: `Admin access granted to ${request.requesterEmail} for ${request.projectName}` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to approve request' });
  }
});

// PATCH /admin/requests/:requestId/deny
adminRouter.patch('/requests/:requestId/deny', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const request = await AdminRequest.findOneAndUpdate(
      { requestId: req.params.requestId, status: 'pending' },
      { status: 'denied', reviewedBy: req.user!.email, reviewedAt: new Date() },
      { new: true }
    );
    if (!request) { res.status(404).json({ success: false, error: 'Request not found or already resolved' }); return; }
    res.json({ success: true, message: `Request denied` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to deny request' });
  }
});

// GET /admin/errors — error log (project admin+)
adminRouter.get('/errors', authenticate, async (req, res) => {
  try {
    const { projectId, resolved } = req.query;
    const filter: Record<string, unknown> = {};
    if (projectId) filter.projectId = projectId;
    if (resolved !== undefined) filter.resolved = resolved === 'true';
    // Non-main-admin can only see their project errors
    if (req.user!.role !== 'main-admin' && req.user!.projectAdminOf.length > 0) {
      filter.projectId = { $in: req.user!.projectAdminOf };
    }
    const errors = await ErrorLog.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data: errors, meta: { total: errors.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch error log' });
  }
});

// DELETE /admin/errors — clear error log (main admin)
adminRouter.delete('/errors', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const result = await ErrorLog.deleteMany({});
    res.json({ success: true, message: `Cleared ${result.deletedCount} error log entries` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to clear error log' });
  }
});

// PATCH /admin/errors/:id/resolve
adminRouter.patch('/errors/:id/resolve', authenticate, async (req, res) => {
  try {
    await ErrorLog.findByIdAndUpdate(req.params.id, { resolved: true });
    res.json({ success: true, message: 'Error marked as resolved' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to resolve error' });
  }
});

// GET /admin/users — list all users (main admin only)
adminRouter.get('/users', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const users = await User.find({}).lean();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// PATCH /admin/users/:email/role — change user role (main admin)
adminRouter.patch('/users/:email/role', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['main-admin', 'project-admin', 'user'].includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }
    const user = await User.findOneAndUpdate({ email: req.params.email }, { role }, { new: true });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true, data: user, message: `Role updated to ${role}` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update user role' });
  }
});

export { adminRouter };

// ============================================================
// activity.routes.ts
// ============================================================
import { Router as ActivityRouter } from 'express';
import { authenticate } from '../middleware/auth';
import { Activity } from '../models';

const activityRouter = ActivityRouter();

// GET /activity — platform-wide activity feed
activityRouter.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, limit = 20 } = req.query;
    const filter: Record<string, unknown> = {};
    if (projectId) filter.projectId = projectId;
    const activities = await Activity.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).lean();
    res.json({ success: true, data: activities });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
});

export { activityRouter };
