import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import config from './config/index.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/sessions.js';
import turnRoutes from './routes/turns.js';
import fileRoutes from './routes/files.js';
import { apiRateLimit } from './middleware/rateLimit.js';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(apiRateLimit);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/sessions', turnRoutes);
app.use('/api/sessions', fileRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  
  // Sanitize error — never leak internal details or keys
  const message = config.nodeEnv === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(err.status || 500).json({ error: message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Database connection and server start ─────────────────────────────────────
async function start() {
  try {
    await mongoose.connect(config.databaseUrl);
    console.log('✓ Connected to MongoDB');
    
    app.listen(config.port, () => {
      console.log(`✓ Relay server running on port ${config.port}`);
      console.log(`  Environment: ${config.nodeEnv}`);
      console.log(`  Client URL: ${config.clientUrl}`);
      
      if (config.enableSimulation) {
        console.log('  ⚠ Simulation mode enabled');
      }
    });
  } catch (err) {
    console.error('✗ Failed to start:', err.message);
    process.exit(1);
  }
}

start();

export default app;
