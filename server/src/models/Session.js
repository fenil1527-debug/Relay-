import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    default: 'New Session',
  },
  activeProvider: {
    type: String,
    default: '',
  },
  fallbackChain: {
    type: [String],
    default: ['anthropic:claude-3-5-sonnet-20241022', 'openai:gpt-4o'],
  },
  tokenCap: {
    type: Number,
    default: 100000,
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'error'],
    default: 'active',
  },
}, {
  timestamps: true,
});

// Index for efficient user session listing
sessionSchema.index({ userId: 1, updatedAt: -1 });

const Session = mongoose.model('Session', sessionSchema);
export default Session;
