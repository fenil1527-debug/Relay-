import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { turnRateLimit } from '../middleware/rateLimit.js';
import { sendMessageSchema } from '../validators/schemas.js';
import { runTurn, resumeTurn } from '../services/orchestrator.js';
import Session from '../models/Session.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/sessions/:id/turn — Run a turn (SSE stream)
 * 
 * From ARCHITECTURE.md §10:
 * SSE event types: step_start, text_delta, tool_call, tool_result,
 * file_changed, attempt_failed, handoff, ledger_updated, done, error
 */
router.post('/:id/turn', turnRateLimit, validate(sendMessageSchema), async (req, res) => {
  const sessionId = req.params.id;
  const userId = req.userId;
  const { content } = req.body;
  const simulateHeader = req.headers['x-relay-simulate'] || null;

  // Verify session ownership
  const session = await Session.findOne({ _id: sessionId, userId });
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // SSE emitter
  const emitSSE = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // Client disconnected
    }
  };

  // Handle client disconnect
  let clientDisconnected = false;
  req.on('close', () => {
    clientDisconnected = true;
  });

  try {
    await runTurn(sessionId, userId, content, emitSSE, simulateHeader);
  } catch (err) {
    emitSSE({ type: 'error', message: err.message });
    emitSSE({ type: 'done', status: 'failed' });
  } finally {
    if (!clientDisconnected) {
      res.end();
    }
  }
});

/**
 * POST /api/sessions/:id/turn/resume — Resume an interrupted turn
 */
router.post('/:id/turn/resume', async (req, res) => {
  const sessionId = req.params.id;
  const userId = req.userId;

  const session = await Session.findOne({ _id: sessionId, userId });
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const emitSSE = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) { /* disconnected */ }
  };

  try {
    await resumeTurn(sessionId, userId, emitSSE);
  } catch (err) {
    emitSSE({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

export default router;
