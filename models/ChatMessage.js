import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  readBy: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "user",
    default: []
  },
  info: {
    type: Object,
    default: {}
  }
});

export default mongoose.model('ChatMessage', chatMessageSchema);
