import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../models/User.js';

/**
 * JWT authentication middleware.
 * Extracts token from httpOnly cookie or Authorization header.
 * Attaches user to req.user.
 */
export function authenticate(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Attach the full user document to req.user (lazy, used when needed).
 */
export async function attachUser(req, res, next) {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Generate a JWT for a user.
 */
export function generateToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });
}
