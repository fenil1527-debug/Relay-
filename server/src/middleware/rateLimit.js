import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for the /turn endpoint.
 * Prevents abuse of the agent loop.
 */
export const turnRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 turns per minute per user
  keyGenerator: (req) => req.userId || req.ip,
  message: { error: 'Too many turn requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API rate limiter.
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.userId || req.ip,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
