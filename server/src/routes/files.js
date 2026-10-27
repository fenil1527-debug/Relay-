import { Router } from 'express';
import File from '../models/File.js';
import Session from '../models/Session.js';
import { authenticate } from '../middleware/auth.js';
import { filePathSchema } from '../validators/schemas.js';
import config from '../config/index.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/sessions/:id/files — List all files in a session
 */
router.get('/:id/files', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const files = await File.find({ sessionId: session._id })
      .select('path version updatedAt')
      .sort({ path: 1 })
      .lean();

    const manifest = files.map(f => ({
      path: f.path,
      version: f.version,
      updatedAt: f.updatedAt,
    }));

    res.json({ files: manifest });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

/**
 * GET /api/sessions/:id/files/:path(*) — Read a file from the editor
 */
router.get('/:id/files/:path(*)', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const parsed = filePathSchema.safeParse(req.params.path);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const file = await File.findOne({ sessionId: session._id, path: parsed.data }).lean();
    if (!file) return res.status(404).json({ error: 'File not found' });

    res.json({
      path: file.path,
      content: file.content,
      version: file.version,
      updatedAt: file.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

/**
 * PUT /api/sessions/:id/files/:path(*) — Save a file from the editor (versioned)
 */
router.put('/:id/files/:path(*)', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const parsed = filePathSchema.safeParse(req.params.path);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const { content, expectedVersion } = req.body;

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    if (Buffer.byteLength(content, 'utf8') > config.maxFileSizeBytes) {
      return res.status(400).json({ error: 'File too large' });
    }

    const existing = await File.findOne({ sessionId: session._id, path: parsed.data });

    // Optimistic concurrency check
    if (expectedVersion !== undefined && existing && existing.version !== expectedVersion) {
      return res.status(409).json({
        error: 'Version conflict',
        currentVersion: existing.version,
        expectedVersion,
      });
    }

    if (!existing) {
      const count = await File.countDocuments({ sessionId: session._id });
      if (count >= config.maxFilesPerSession) {
        return res.status(400).json({ error: 'Maximum files per session reached' });
      }
    }

    const newVersion = existing ? existing.version + 1 : 1;

    const file = await File.findOneAndUpdate(
      { sessionId: session._id, path: parsed.data },
      { content, version: newVersion },
      { upsert: true, new: true }
    );

    res.json({
      path: file.path,
      content: file.content,
      version: file.version,
      updatedAt: file.updatedAt,
      file: {
        path: file.path,
        content: file.content,
        version: file.version,
        updatedAt: file.updatedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save file' });
  }
});

export default router;
