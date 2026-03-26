import { Router } from 'express';
import { authenticate, requireMainAdmin } from '../middleware/auth';
import { AdminRequest, ErrorLog, User, Project } from '../models';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

const router = Router();

router.get('/requests', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const requests = await AdminRequest.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: requests, meta: { pending: requests.filter((r: any) => r.status === 'pending').length } });
  } catch (err) { res.status(500).json({ success: false, error: 'Failed to fetch admin requests' }); }
});

router.post('/requests', authenticate, async (req, res) => {
  try {
    const { projectId, reason } = req.body;
    if (!projectId || !reason) { res.status(400).json({ success: false, error: 'projectId and reason are required' }); return; }
    const project = await Project.findOne({ projectId }).lean();
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' }); return; }
    const existing = await AdminRequest.findOne({ projectId, requesterEmail: req.user!.email, status: 'pending' });
    if (existing) { res.status(409).json({ success: false, error: 'Pending request already exists' }); return; }
    const request = new AdminRequest({ requestId: uuidv4(), projectId, projectName: (project as any).name, requesterEmail: req.user!.email, requesterName: req.user!.name, reason, status: 'pending' });
    await request.save();
    res.status(201).json({ success: true, data: request, message: 'Request submitted' });
  } catch (err) { res.status(500).json({ success: false, error: 'Failed to submit request' }); }
});

router.patch('/requests/:requestId/approve', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const request = await AdminRequest.findOne({ requestId: req.params.requestId });
    if (!request) { res.status(404).json({ success: false, error: 'Request not found' }); return; }
    if (request.status !== 'pending') { res.status(400).json({ success: false, error: `Already ${request.status}` }); return; }
    request.status = 'approved'; request.reviewedBy = req.user!.email; request.reviewedAt = new Date();
    await request.save();
    await User.findOneAndUpdate({ email: request.requesterEmail }, { $set: { role: 'project-admin' }, $addToSet: { projectAdminOf: request.projectId } });
    await Project.findOneAndUpdate({ projectId: request.projectId }, { $addToSet: { adminEmails: request.requesterEmail } });
    logger.info('Admin approved', { requestId: req.params.requestId });
    res.json({ success: true, message: `Access granted to ${request.requesterEmail}` });
  } catch (err) { res.status(500).json({ success: false, error: 'Failed to approve' }); }
});

router.patch('/requests/:requestId/deny', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const request = await AdminRequest.findOneAndUpdate({ requestId: req.params.requestId, status: 'pending' }, { status: 'denied', reviewedBy: req.user!.email, reviewedAt: new Date() }, { new: true });
    if (!request) { res.status(404).json({ success: false, error: 'Request not found' }); return; }
    res.json({ success: true, message: 'Request denied' });
  } catch (err) { res.status(500).json({ success: false, error: 'Failed to deny' }); }
});

router.get('/errors', authenticate, async (req, res) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.user!.role !== 'main-admin') filter.projectId = { $in: req.user!.projectAdminOf };
    const errors = await ErrorLog.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data: errors });
  } catch (err) { res.status(500).json({ success: false, error: 'Failed to fetch errors' }); }
});

router.delete('/errors', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const result = await ErrorLog.deleteMany({});
    res.json({ success: true, message: `Cleared ${result.deletedCount} entries` });
  } catch (err) { res.status(500).json({ success: false, error: 'Failed to clear' }); }
});

router.get('/users', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const users = await User.find({}).lean();
    res.json({ success: true, data: users });
  } catch (err) { res.status(500).json({ success: false, error: 'Failed to fetch users' }); }
});

router.patch('/users/:email/role', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['main-admin', 'project-admin', 'user'].includes(role)) { res.status(400).json({ success: false, error: 'Invalid role' }); return; }
    const user = await User.findOneAndUpdate({ email: req.params.email }, { role }, { new: true });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true, data: user });
  } catch (err) { res.status(500).json({ success: false, error: 'Failed to update role' }); }
});

export default router;
