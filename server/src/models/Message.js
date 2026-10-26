import mongoose from 'mongoose';

// Canonical block types — the core data model
// Provider-native shapes are NEVER persisted
const blockSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'tool_use', 'tool_result'],
    required: true,
  },
  // text block
  text: String,
  // tool_use block
  id: String,       // tool_use_id
  name: String,     // tool name
  input: mongoose.Schema.Types.Mixed,
  // tool_result block
  tool_use_id: String,
  output: String,
  is_error: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const usageSchema = new mongoose.Schema({
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  seq: {
    type: Number,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  blocks: {
    type: [blockSchema],
    required: true,
  },
  provider: String,
  model: String,
  usage: usageSchema,
  turnId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Turn',
  },
  isSummary: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// UNIQUE constraint: (sessionId, seq) — total order, prevents double-writes
messageSchema.index({ sessionId: 1, seq: 1 }, { unique: true });

const Message = mongoose.model('Message', messageSchema);
export default Message;
