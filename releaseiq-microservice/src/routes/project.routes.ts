import { Router } from 'express';
import { authenticate, requireMainAdmin, requireProjectAdmin } from '../middleware/auth';
import { Project, Activity } from '../models';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

const router = Router();

// GET /projects — list all projects
router.get('/', authenticate, async (req, res) => {
  try {
    const projects = await Project.find({}).sort({ isLive: -1, name: 1 }).lean();
    res.json({ success: true, data: projects });
  } catch (err) {
    logger.error('Failed to fetch projects', { error: err });
    res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
});

// GET /projects/:projectId — single project
router.get('/:projectId', authenticate, async (req, res) => {
  try {
    const project = await Project.findOne({ projectId: req.params.projectId }).lean();
    if (!project) {
      res.status(404).json({ success: false, error: `Project '${req.params.projectId}' not found` });
      return;
    }
    // Mask API tokens before sending to client
    if (project.jiraApiToken) project.jiraApiToken = '••••••••';
    if (project.copadoConfig?.apiToken) project.copadoConfig.apiToken = '••••••••';
    res.json({ success: true, data: project });
  } catch (err) {
    logger.error('Failed to fetch project', { error: err, projectId: req.params.projectId });
    res.status(500).json({ success: false, error: 'Failed to fetch project' });
  }
});

// POST /projects — create new project (Main Admin only)
router.post('/', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const { name, type, jiraKey, ownerEmail, cadence, teamCount, releaseLabel, description, tags, color, icon } = req.body;

    if (!name || !type || !jiraKey || !ownerEmail) {
      res.status(400).json({ success: false, error: 'name, type, jiraKey, and ownerEmail are required' });
      return;
    }

    const projectId = jiraKey.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);

    const existing = await Project.findOne({ $or: [{ projectId }, { jiraKey: jiraKey.toUpperCase() }] });
    if (existing) {
      res.status(409).json({ success: false, error: `Project with key '${jiraKey}' already exists` });
      return;
    }

    const project = new Project({
      projectId,
      name,
      shortName: name.split('—')[0]?.trim() || name,
      type,
      icon: icon || (type === 'salesforce' ? '☁️' : '⚛️'),
      color: color || '#2060d8',
      status: 'Planning',
      healthScore: 0,
      currentSprint: '1.0',
      currentRelease: `${name} 1.0`,
      releaseAnchorDate: new Date(),
      cadence: cadence || 'biweekly',
      description: description || '',
      tags: tags || [],
      jiraKey: jiraKey.toUpperCase(),
      releaseLabel: releaseLabel || `${jiraKey}_1.0`,
      copadoCICD: type === 'salesforce' ? 'CopadoCICD' : 'N/A',
      teamCount: teamCount || 7,
      ownerEmail,
      adminEmails: [ownerEmail, req.user!.email].filter((v, i, a) => a.indexOf(v) === i),
      syncStatus: 'never',
    });

    await project.save();

    await Activity.create({
      projectId: project.projectId,
      type: 'admin_change',
      message: `Project "${name}" created by ${req.user!.name}`,
      icon: '➕',
      actorEmail: req.user!.email,
      actorName: req.user!.name,
    });

    res.status(201).json({ success: true, data: project, message: `Project '${name}' created successfully` });
  } catch (err) {
    logger.error('Failed to create project', { error: err });
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
});

// PATCH /projects/:projectId — update project settings (Project Admin+)
router.patch('/:projectId', authenticate, requireProjectAdmin(), async (req, res) => {
  try {
    const { projectId } = req.params;
    const allowedFields = ['name', 'shortName', 'status', 'description', 'tags', 'isLive', 'cadence', 'teamCount', 'color', 'adminEmails', 'releaseLabel', 'copadoCICD'];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    // Separately handle copadoConfig (don't overwrite token if masked)
    if (req.body.copadoConfig) {
      const existing = await Project.findOne({ projectId }).lean();
      const cfg = { ...existing?.copadoConfig, ...req.body.copadoConfig };
      if (cfg.apiToken === '••••••••' && existing?.copadoConfig?.apiToken) {
        cfg.apiToken = existing.copadoConfig.apiToken;
      }
      updates.copadoConfig = cfg;
    }

    const project = await Project.findOneAndUpdate({ projectId }, { $set: updates }, { new: true, runValidators: true });
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    logger.info('Project updated', { projectId, updatedBy: req.user!.email, fields: Object.keys(updates) });
    res.json({ success: true, data: project, message: 'Project updated successfully' });
  } catch (err) {
    logger.error('Failed to update project', { error: err, projectId: req.params.projectId });
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
});

// DELETE /projects/:projectId — Main Admin only
router.delete('/:projectId', authenticate, requireMainAdmin, async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ projectId: req.params.projectId });
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    logger.warn('Project deleted', { projectId: req.params.projectId, deletedBy: req.user!.email });
    res.json({ success: true, message: `Project '${project.name}' deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

// POST /projects/:projectId/toggle-live
router.post('/:projectId/toggle-live', authenticate, requireProjectAdmin(), async (req, res) => {
  try {
    const project = await Project.findOne({ projectId: req.params.projectId });
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' }); return; }
    project.isLive = !project.isLive;
    await project.save();
    res.json({ success: true, data: { isLive: project.isLive }, message: `Project set to ${project.isLive ? 'LIVE' : 'offline'}` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to toggle live status' });
  }
});

export default router;
