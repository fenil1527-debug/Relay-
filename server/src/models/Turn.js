import mongoose from 'mongoose';

const turnSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['running', 'completed', 'failed', 'interrupted'],
    default: 'running',
  },
  stepCount: {
    type: Number,
    default: 0,
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: {
    type: Date,
  },
});

// Partial unique index: at most one running turn per session
// This prevents concurrent turns on the same session
turnSchema.index(
  { sessionId: 1 },
  { 
    unique: true, 
    partialFilterExpression: { status: 'running' },
    name: 'one_running_turn_per_session',
  }
);

const Turn = mongoose.model('Turn', turnSchema);
export default Turn;
