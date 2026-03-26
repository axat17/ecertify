import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { Activity } from '../models';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, limit = '20' } = req.query;
    const filter: Record<string, unknown> = {};
    if (projectId) filter.projectId = projectId;
    const activities = await Activity.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string, 10))
      .lean();
    res.json({ success: true, data: activities });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
});

export default router;
