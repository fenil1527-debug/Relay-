import mongoose from 'mongoose';

const providerAttemptSchema = new mongoose.Schema({
  turnId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Turn',
    required: true,
    index: true,
  },
  provider: {
    type: String,
    required: true,
  },
  outcome: {
    type: String,
    enum: ['success', 'retryable', 'failover', 'fatal'],
    required: true,
  },
  errorClass: {
    type: String,
    default: null,
  },
  latencyMs: {
    type: Number,
    default: 0,
  },
  tokensIn: {
    type: Number,
    default: 0,
  },
  tokensOut: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

const ProviderAttempt = mongoose.model('ProviderAttempt', providerAttemptSchema);
export default ProviderAttempt;
