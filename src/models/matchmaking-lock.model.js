'use strict';
const mongoose = require('mongoose');
const lockSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  lockedUntil: { type: Date, default: new Date(0) },
}, { timestamps: true });
module.exports = mongoose.model('MatchmakingLock', lockSchema);
