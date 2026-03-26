import { Router } from 'express';
import { mockLogin, azureCallback, authenticate } from '../middleware/auth';
import { User } from '../models';

const router = Router();

// Mock login (local dev only)
router.post('/mock-login', mockLogin);

// Azure AD callback (production)
router.post('/azure/callback', azureCallback);

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email }).lean();
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: { id: user._id, email: user.email, name: user.name, role: user.role, projectAdminOf: user.projectAdminOf, initials: user.initials } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// Logout (client should discard token; we just confirm)
router.post('/logout', authenticate, (_, res) => {
  res.json({ success: true, message: 'Logged out. Discard your token on the client.' });
});

export default router;
