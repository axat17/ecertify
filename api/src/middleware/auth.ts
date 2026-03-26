import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { User } from '../models';
import { UserRole } from '../types';
import logger from '../utils/logger';

interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  projectAdminOf: string[];
  iat: number;
  exp: number;
}

// ─── Mock users for local dev ─────────────────────────────────
const MOCK_USERS = [
  { email: 'john.doe@adp.com', name: 'John Doe', role: 'main-admin' as UserRole, projectAdminOf: [] },
  { email: 'jane.smith@adp.com', name: 'Jane Smith', role: 'project-admin' as UserRole, projectAdminOf: ['ecertify'] },
  { email: 'tester@adp.com', name: 'BU Tester', role: 'user' as UserRole, projectAdminOf: [] },
];

// ─── Generate JWT ─────────────────────────────────────────────
export function generateToken(user: { id: string; email: string; name: string; role: UserRole; projectAdminOf: string[] }): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, projectAdminOf: user.projectAdminOf },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
  );
}

// ─── Authenticate middleware ──────────────────────────────────
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'No authorization token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      req.user = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        projectAdminOf: decoded.projectAdminOf || [],
      };
      next();
    } catch (jwtError) {
      if ((jwtError as Error).name === 'TokenExpiredError') {
        res.status(401).json({ success: false, error: 'Token expired. Please log in again.' });
      } else {
        res.status(401).json({ success: false, error: 'Invalid token' });
      }
    }
  } catch (err) {
    logger.error('Auth middleware error', { error: err });
    res.status(500).json({ success: false, error: 'Authentication error' });
  }
}

// ─── Role guards ──────────────────────────────────────────────

export function requireMainAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
  if (req.user.role !== 'main-admin') {
    res.status(403).json({ success: false, error: 'Main Admin access required' });
    return;
  }
  next();
}

export function requireProjectAdmin(projectIdParam = 'projectId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const projId = req.params[projectIdParam] || req.body.projectId;
    const isMainAdmin = req.user.role === 'main-admin';
    const isProjAdmin = req.user.role === 'project-admin' && req.user.projectAdminOf.includes(projId);
    if (!isMainAdmin && !isProjAdmin) {
      res.status(403).json({ success: false, error: 'Project Admin access required for this operation' });
      return;
    }
    next();
  };
}

// ─── Mock auth handler (local dev only) ──────────────────────
export async function mockLogin(req: Request, res: Response): Promise<void> {
  if (config.authMode !== 'mock') {
    res.status(403).json({ success: false, error: 'Mock auth is not enabled in this environment' });
    return;
  }

  const { email } = req.body;
  if (!email) {
    res.status(400).json({ success: false, error: 'Email is required for mock login' });
    return;
  }

  try {
    // Find or create user in DB
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Check if it's a known mock user
      const mockProfile = MOCK_USERS.find(u => u.email === email.toLowerCase()) || {
        email: email.toLowerCase(),
        name: email.split('@')[0].replace('.', ' '),
        role: 'user' as UserRole,
        projectAdminOf: [],
      };
      user = new User({
        email: mockProfile.email,
        name: mockProfile.name,
        initials: mockProfile.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
        role: mockProfile.role,
        projectAdminOf: mockProfile.projectAdminOf,
        isActive: true,
      });
      await user.save();
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      projectAdminOf: user.projectAdminOf,
    });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user._id, email: user.email, name: user.name, role: user.role, projectAdminOf: user.projectAdminOf },
      },
    });
  } catch (err) {
    logger.error('Mock login error', { error: err, email });
    res.status(500).json({ success: false, error: 'Login failed' });
  }
}

// ─── Azure AD token validation ────────────────────────────────
// In production, validate the Azure AD access token against Microsoft's JWKS
// and extract user claims. Here we provide the scaffolding.
export async function azureCallback(req: Request, res: Response): Promise<void> {
  try {
    // The actual Azure AD token comes from MSAL on the frontend
    // Frontend sends the Azure ID token, we validate it server-side
    const { idToken, accessToken } = req.body;
    if (!idToken) {
      res.status(400).json({ success: false, error: 'Azure ID token required' });
      return;
    }

    // TODO: Validate idToken against Azure AD JWKS endpoint:
    // GET https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys
    // For now, decode without verification as placeholder
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      res.status(400).json({ success: false, error: 'Invalid ID token format' });
      return;
    }

    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const email = claims.preferred_username || claims.email || claims.upn;
    const name = claims.name || email;
    const azureOid = claims.oid;

    if (!email) {
      res.status(400).json({ success: false, error: 'Could not extract email from Azure token' });
      return;
    }

    // Find or create user
    let user = await User.findOne({ $or: [{ azureOid }, { email: email.toLowerCase() }] });
    if (!user) {
      user = new User({
        email: email.toLowerCase(),
        name,
        initials: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
        azureOid,
        role: 'user',
        projectAdminOf: [],
        isActive: true,
      });
      await user.save();
    } else {
      user.azureOid = azureOid;
      user.lastLogin = new Date();
      await user.save();
    }

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      projectAdminOf: user.projectAdminOf,
    });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user._id, email: user.email, name: user.name, role: user.role, projectAdminOf: user.projectAdminOf },
      },
    });
  } catch (err) {
    logger.error('Azure callback error', { error: err });
    res.status(500).json({ success: false, error: 'Azure authentication failed' });
  }
}
