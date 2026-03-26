// ============================================================
// routes/index.ts — Central route registration
// ============================================================
import { Router } from 'express';
import authRoutes from './auth.routes';
import projectRoutes from './project.routes';
import certRoutes from './certification.routes';
import jiraRoutes from './jira.routes';
import copadoRoutes from './copado.routes';
import adminRoutes from './admin.routes';
import activityRoutes from './activity.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/certifications', certRoutes);
router.use('/jira', jiraRoutes);
router.use('/copado', copadoRoutes);
router.use('/admin', adminRoutes);
router.use('/activity', activityRoutes);

// Health check
router.get('/health', (_, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

export default router;
