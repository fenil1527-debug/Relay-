import mongoose from 'mongoose';

const ledgerEntrySchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  kind: {
    type: String,
    enum: ['decision', 'constraint', 'todo', 'fact'],
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'done', 'superseded'],
    default: 'active',
  },
  sourceSeq: {
    type: Number,
    default: 0,
  },
  supersededBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerEntry',
    default: null,
  },
}, {
  timestamps: true,
});

// Active entries for a session — used in every context build
ledgerEntrySchema.index({ sessionId: 1, status: 1 });

const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
export default LedgerEntry;
