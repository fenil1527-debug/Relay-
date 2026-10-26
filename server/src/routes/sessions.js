import { Router } from 'express';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import Handoff from '../models/Handoff.js';
import LedgerEntry from '../models/LedgerEntry.js';
import File from '../models/File.js';
import Turn from '../models/Turn.js';
import ProviderAttempt from '../models/ProviderAttempt.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createSessionSchema, updateProviderSchema } from '../validators/schemas.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/sessions — List user's sessions
 */
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .lean();

    // Enrich with message count and last message preview
    const enriched = await Promise.all(sessions.map(async (s) => {
      const messageCount = await Message.countDocuments({ sessionId: s._id });
      const lastMessage = await Message.findOne({ sessionId: s._id })
        .sort({ seq: -1 })
        .lean();
      
      let preview = '';
      if (lastMessage) {
        const textBlock = lastMessage.blocks.find(b => b.type === 'text');
        preview = textBlock?.text?.substring(0, 100) || '';
      }

      return {
        ...s,
        messageCount,
        preview,
      };
    }));

    res.json({ sessions: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

/**
 * POST /api/sessions — Create a session
 */
router.post('/', validate(createSessionSchema), async (req, res) => {
  try {
    const { title, fallbackChain, tokenCap } = req.body;

    const session = await Session.create({
      userId: req.userId,
      title,
      fallbackChain: fallbackChain || ['anthropic:claude-3-5-sonnet-20241022', 'openai:gpt-4o'],
      activeProvider: fallbackChain?.[0] || 'anthropic:claude-3-5-sonnet-20241022',
      tokenCap: tokenCap || 100000,
    });

    res.status(201).json({ session });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * GET /api/sessions/:id — Get session details with messages, ledger, handoffs
 */
router.get('/:id', async (req, res) => {
  try {
    // Ownership check: WHERE id AND userId
    const session = await Session.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).lean();

    // Return 404 for both not-found and unauthorized (anti-enumeration)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const [messages, ledger, handoffs, files, turns] = await Promise.all([
      Message.find({ sessionId: session._id }).sort({ seq: 1 }).lean(),
      LedgerEntry.find({ sessionId: session._id }).sort({ createdAt: 1 }).lean(),
      Handoff.find({ sessionId: session._id }).sort({ createdAt: 1 }).lean(),
      File.find({ sessionId: session._id }).select('path version updatedAt').lean(),
      Turn.find({ sessionId: session._id }).sort({ startedAt: -1 }).limit(20).lean(),
    ]);

    // Load provider attempts for recent turns
    const turnIds = turns.map(t => t._id);
    const attempts = await ProviderAttempt.find({ turnId: { $in: turnIds } })
      .sort({ createdAt: 1 }).lean();

    res.json({
      session,
      messages,
      ledger,
      handoffs,
      files,
      turns,
      attempts,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load session' });
  }
});

/**
 * PATCH /api/sessions/:id/provider — Manual provider swap
 */
router.patch('/:id/provider', validate(updateProviderSchema), async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const oldProvider = session.activeProvider;
    session.activeProvider = req.body.provider;
    await session.save();

    // Record manual handoff
    await Handoff.create({
      sessionId: session._id,
      turnId: null,
      fromProvider: oldProvider,
      toProvider: req.body.provider,
      reason: 'Manual provider swap by user',
      packet: {},
    });

    res.json({ session, handoff: { from: oldProvider, to: req.body.provider } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update provider' });
  }
});

/**
 * DELETE /api/sessions/:id — Delete a session and all its data
 */
router.delete('/:id', async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Delete all related data
    await Promise.all([
      Message.deleteMany({ sessionId: session._id }),
      File.deleteMany({ sessionId: session._id }),
      Turn.deleteMany({ sessionId: session._id }),
      Handoff.deleteMany({ sessionId: session._id }),
      LedgerEntry.deleteMany({ sessionId: session._id }),
      ProviderAttempt.deleteMany({ 
        turnId: { $in: await Turn.find({ sessionId: session._id }).distinct('_id') }
      }),
    ]);

    await Session.findByIdAndDelete(session._id);

    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
