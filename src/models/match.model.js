'use strict';

const mongoose = require('mongoose');

const matchPlayerSchema = new mongoose.Schema(
  {
    steamId: { type: String, required: true },
    role:    { type: String, enum: ['hunter', 'survivor'], required: true },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    players: {
      type: [matchPlayerSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['forming', 'ready', 'closed'],
      default: 'ready',
      index: true,
    },
    
    
    rewardedSteamIds: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Match', matchSchema);
