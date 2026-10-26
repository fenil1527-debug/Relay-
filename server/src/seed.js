import mongoose from 'mongoose';
import config from './config/index.js';
import User from './models/User.js';
import Session from './models/Session.js';
import Message from './models/Message.js';
import File from './models/File.js';
import Turn from './models/Turn.js';
import Handoff from './models/Handoff.js';
import LedgerEntry from './models/LedgerEntry.js';
import ProviderAttempt from './models/ProviderAttempt.js';

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.databaseUrl);
  console.log('Connected!');

  // Clear existing demo data
  let user = await User.findOne({ githubId: 'demo-user' });
  if (!user) {
    user = await User.create({
      githubId: 'demo-user',
      name: 'Demo User',
      email: 'demo@relay.dev',
      avatarUrl: '',
    });
    console.log('Created demo user:', user._id);
  } else {
    console.log('Found existing demo user:', user._id);
  }

  // Create or reset a demo session
  const sessionTitle = 'Express E-Commerce Microservice';
  let session = await Session.findOne({ userId: user._id, title: sessionTitle });
  if (session) {
    await Promise.all([
      Message.deleteMany({ sessionId: session._id }),
      File.deleteMany({ sessionId: session._id }),
      Turn.deleteMany({ sessionId: session._id }),
      Handoff.deleteMany({ sessionId: session._id }),
      LedgerEntry.deleteMany({ sessionId: session._id }),
      Session.deleteOne({ _id: session._id }),
    ]);
  }

  session = await Session.create({
    userId: user._id,
    title: sessionTitle,
    activeProvider: 'anthropic:claude-3-5-sonnet-20241022',
    fallbackChain: [
      'anthropic:claude-3-5-sonnet-20241022',
      'openai:gpt-4o',
      'groq:llama-3.3-70b-versatile',
    ],
    tokenCap: 100000,
  });
  console.log('Created demo session:', session._id);

  // Seed Virtual Workspace Files
  const serverCode = `import express from 'express';
import cartRoutes from './routes/cart.js';

const app = express();
app.use(express.json());

app.use('/api/cart', cartRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(\`Cart microservice running on port \${PORT}\`);
});
`;

  const cartRoutesCode = `import { Router } from 'express';
const router = Router();

// In-memory cart store (Decision Ledger #1)
const carts = new Map();

router.get('/:cartId', (req, res) => {
  const cart = carts.get(req.params.cartId) || { items: [], total: 0 };
  res.json({ cart });
});

router.post('/:cartId/items', (req, res) => {
  const { productId, quantity, price } = req.body;
  if (!productId || !quantity || price === undefined) {
    return res.status(400).json({ error: 'Missing required item properties' });
  }

  let cart = carts.get(req.params.cartId) || { items: [], total: 0 };
  cart.items.push({ productId, quantity, price });
  cart.total = cart.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  carts.set(req.params.cartId, cart);

  res.status(201).json({ cart });
});

export default router;
`;

  const packageJsonCode = `{
  "name": "cart-microservice",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.21.0"
  }
}
`;

  await File.create([
    { sessionId: session._id, path: 'src/server.js', content: serverCode, version: 1 },
    { sessionId: session._id, path: 'src/routes/cart.js', content: cartRoutesCode, version: 1 },
    { sessionId: session._id, path: 'package.json', content: packageJsonCode, version: 1 },
  ]);
  console.log('Created virtual files');

  // Seed Turn & Messages
  const turn = await Turn.create({
    sessionId: session._id,
    status: 'completed',
    stepCount: 2,
    startedAt: new Date(Date.now() - 60000),
    endedAt: new Date(),
  });

  await Message.create([
    {
      sessionId: session._id,
      seq: 1,
      role: 'user',
      blocks: [
        {
          type: 'text',
          text: 'Initialize an Express cart microservice with routes for getting and adding items to the cart.',
        },
      ],
      turnId: turn._id,
    },
    {
      sessionId: session._id,
      seq: 2,
      role: 'assistant',
      provider: 'anthropic:claude-3-5-sonnet-20241022',
      model: 'claude-3-5-sonnet-20241022',
      blocks: [
        {
          type: 'text',
          text: "I've structured the cart microservice with Express. Let's create `src/server.js`, `src/routes/cart.js`, and `package.json` in the virtual workspace.",
        },
        {
          type: 'tool_use',
          id: 'tool-call-1',
          name: 'write_file',
          input: { path: 'src/server.js', content: serverCode },
        },
        {
          type: 'tool_result',
          tool_use_id: 'tool-call-1',
          output: 'File written successfully: src/server.js (version 1)',
        },
        {
          type: 'tool_use',
          id: 'tool-call-2',
          name: 'write_file',
          input: { path: 'src/routes/cart.js', content: cartRoutesCode },
        },
        {
          type: 'tool_result',
          tool_use_id: 'tool-call-2',
          output: 'File written successfully: src/routes/cart.js (version 1)',
        },
        {
          type: 'text',
          text: 'The files have been generated and committed to the virtual workspace. You can inspect or edit them in the Monaco editor.',
        },
      ],
      usage: { inputTokens: 412, outputTokens: 680 },
      turnId: turn._id,
    },
  ]);
  console.log('Created demo messages');

  // Seed Decision Ledger
  await LedgerEntry.create([
    {
      sessionId: session._id,
      kind: 'decision',
      body: 'Use in-memory Map for cart cache for sub-millisecond route response',
      status: 'active',
      sourceSeq: 2,
    },
    {
      sessionId: session._id,
      kind: 'constraint',
      body: 'All cart totals must use strict two-digit decimal precision before checkout',
      status: 'active',
      sourceSeq: 2,
    },
    {
      sessionId: session._id,
      kind: 'todo',
      body: 'Integrate Redis client for distributed cart session persistence',
      status: 'active',
      sourceSeq: 2,
    },
  ]);
  console.log('Created decision ledger entries');

  // Seed sample Handoff & Attempt
  await ProviderAttempt.create({
    turnId: turn._id,
    provider: 'anthropic:claude-3-5-sonnet-20241022',
    outcome: 'failed',
    errorClass: 'rate_limit',
    latencyMs: 340,
    tokensIn: 412,
    tokensOut: 0,
  });

  await Handoff.create({
    sessionId: session._id,
    turnId: turn._id,
    fromProvider: 'anthropic:claude-3-5-sonnet-20241022',
    toProvider: 'openai:gpt-4o',
    reason: 'rate_limit',
    packet: {
      ledgerEntries: [
        'Use in-memory Map for cart cache',
        'All cart totals must use strict two-digit decimal precision',
      ],
      touchedFiles: ['src/server.js', 'src/routes/cart.js'],
      lastAssistantMessagePreview: 'Initializing cart microservice...',
    },
  });
  console.log('Created demo handoff');

  console.log('✅ Seed completed successfully!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
