import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  githubId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    default: '',
  },
  avatarUrl: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);
export default User;
