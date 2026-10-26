import mongoose from 'mongoose';

const handoffSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  turnId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Turn',
    required: false,
    default: null,
  },
  fromProvider: {
    type: String,
    required: true,
  },
  toProvider: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  packet: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

const Handoff = mongoose.model('Handoff', handoffSchema);
export default Handoff;
