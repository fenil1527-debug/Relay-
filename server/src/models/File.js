import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  path: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    default: '',
  },
  version: {
    type: Number,
    default: 1,
  },
}, {
  timestamps: true,
});

// UNIQUE constraint: one file per path per session
fileSchema.index({ sessionId: 1, path: 1 }, { unique: true });

const File = mongoose.model('File', fileSchema);
export default File;
