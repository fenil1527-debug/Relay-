import { Router } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';
import config from '../config/index.js';

const router = Router();

function getCallbackURL(req) {
  if (config.githubCallbackUrl) return config.githubCallbackUrl;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}/api/auth/github/callback`;
}

function getClientRedirectBase(req) {
  if (config.clientUrl && !config.clientUrl.includes('localhost')) {
    return config.clientUrl;
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${proto}://${host}`;
  }
  return config.clientUrl || 'http://localhost:5173';
}

// Configure GitHub OAuth strategy
if (config.githubClientId && config.githubClientSecret) {
  passport.use(new GitHubStrategy({
    clientID: config.githubClientId,
    clientSecret: config.githubClientSecret,
    callbackURL: config.githubCallbackUrl || '/api/auth/github/callback',
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ githubId: profile.id });
      
      if (!user) {
        user = await User.create({
          githubId: profile.id,
          name: profile.displayName || profile.username,
          email: profile.emails?.[0]?.value || '',
          avatarUrl: profile.photos?.[0]?.value || '',
        });
      } else {
        // Update profile info
        user.name = profile.displayName || profile.username;
        user.avatarUrl = profile.photos?.[0]?.value || '';
        await user.save();
      }
      
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }));
}

// GitHub OAuth initiation
router.get('/github', (req, res, next) => {
  const redirectBase = getClientRedirectBase(req);
  if (!config.githubClientId || !config.githubClientSecret) {
    return res.redirect(`${redirectBase}/login?error=GitHub+OAuth+not+configured.+Use+1-Click+Demo+Login.`);
  }
  const callbackURL = getCallbackURL(req);
  passport.authenticate('github', {
    scope: ['user:email'],
    session: false,
    callbackURL,
  })(req, res, next);
});

// GitHub OAuth callback
router.get('/github/callback', (req, res, next) => {
  const redirectBase = getClientRedirectBase(req);
  if (!config.githubClientId || !config.githubClientSecret) {
    return res.redirect(`${redirectBase}/login?error=GitHub+OAuth+not+configured.+Use+1-Click+Demo+Login.`);
  }
  const callbackURL = getCallbackURL(req);
  passport.authenticate('github', {
    failureRedirect: `${redirectBase}/login?error=auth_failed`,
    session: false,
    callbackURL,
  })(req, res, next);
},
  (req, res) => {
    const token = generateToken(req.user._id.toString());
    const redirectBase = getClientRedirectBase(req);
    const isSecure = config.nodeEnv === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
    
    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`${redirectBase}/dashboard?token=${token}`);
  }
);

// Get current user
router.get('/me', async (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.userId).select('-__v').lean();
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Demo login (development only — creates a test user without GitHub)
router.post('/demo-login', async (req, res) => {
  if (config.nodeEnv === 'production') {
    return res.status(404).json({ error: 'Not available' });
  }

  try {
    let user = await User.findOne({ githubId: 'demo-user' });
    
    if (!user) {
      user = await User.create({
        githubId: 'demo-user',
        name: 'Demo User',
        email: 'demo@relay.dev',
        avatarUrl: '',
      });
    }

    const token = generateToken(user._id.toString());
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user, token });
  } catch (err) {
    console.error('Demo login error:', err.message);
    const errorMsg = err.message?.includes('schema cache')
      ? 'Supabase tables not initialized: Please run supabase_schema.sql in your Supabase SQL Editor!'
      : `Login failed: ${err.message}`;
    res.status(500).json({ error: errorMsg });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

export default router;
