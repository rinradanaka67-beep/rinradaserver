'use strict';
const mongoose = require('mongoose');

const queueEntrySchema = new mongoose.Schema({
  steamId: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['waiting', 'matched'], default: 'waiting', index: true },
  roomId: { type: String, default: null, index: true },
  joinedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

module.exports = mongoose.model('MatchmakingQueue', queueEntrySchema);
