'use strict';
const crypto = require('crypto');
const Queue = require('@models/matchmaking-queue.model');
const Lock = require('@models/matchmaking-lock.model');
const Match = require('@models/match.model');

// Entries that were never cleaned up (client crashed / closed the game) must not block or
// pollute matchmaking. Polling /queue/status keeps a waiting entry fresh.
const QUEUE_STALE_MS   = Math.max(1, parseInt(process.env.QUEUE_STALE_MINUTES || '10', 10)) * 60_000;
const MATCHED_STALE_MS = Math.max(1, parseInt(process.env.MATCH_STALE_MINUTES || '30', 10)) * 60_000;

const ROOM_SIZE = Math.max(2, Math.min(parseInt(process.env.MATCH_ROOM_SIZE || '5', 10), 5));

async function purgeStale() {
  const now = Date.now();
  await Queue.deleteMany({ status: 'waiting', updatedAt: { $lt: new Date(now - QUEUE_STALE_MS) } });
  await Queue.deleteMany({ status: 'matched', updatedAt: { $lt: new Date(now - MATCHED_STALE_MS) } });
}

async function acquireLock() {
  try {
    await Lock.updateOne({ key: 'global' }, { $setOnInsert: { key: 'global', lockedUntil: new Date(0) } }, { upsert: true });
  } catch (err) { if (err.code !== 11000) throw err; }
  const now = new Date();
  return Lock.findOneAndUpdate(
    { key: 'global', lockedUntil: { $lte: now } },
    { $set: { lockedUntil: new Date(now.getTime() + 10000) } },
    { new: true }
  );
}

async function formMatches() {
  await purgeStale();
  const lock = await acquireLock();
  if (!lock) return null;
  try {
    const waiting = await Queue.find({ status: 'waiting' }).sort({ joinedAt: 1 }).limit(ROOM_SIZE);
    if (waiting.length < ROOM_SIZE) return null;

    const selectedIds = waiting.map((entry) => entry._id);
    const roomId = `HSH-${crypto.randomUUID()}`;
    const players = waiting.map((entry, index) => ({
      steamId: entry.steamId,
      role: index === 0 ? 'hunter' : 'survivor',
    }));

    const claimed = await Queue.updateMany(
      { _id: { $in: selectedIds }, status: 'waiting' },
      { $set: { status: 'matched', roomId } }
    );
    if (claimed.modifiedCount !== ROOM_SIZE) {
      await Queue.updateMany({ _id: { $in: selectedIds }, roomId }, { $set: { status: 'waiting', roomId: null } });
      return null;
    }

    try {
      await Match.create({ roomId, players, status: 'ready', rewardedSteamIds: [] });
    } catch (err) {
      await Queue.updateMany({ _id: { $in: selectedIds }, roomId }, { $set: { status: 'waiting', roomId: null } });
      throw err;
    }
    return { roomId, players };
  } finally {
    await Lock.updateOne({ _id: lock._id }, { $set: { lockedUntil: new Date(0) } });
  }
}

async function join(player) {
  if (!player?.steamId) throw new Error('Authenticated player is required');
  await purgeStale();
  let entry = await Queue.findOne({ steamId: player.steamId });
  if (entry?.status === 'matched') {
    const match = await Match.findOne({ roomId: entry.roomId }).lean();
    return { status: 'matched', roomId: entry.roomId, match };
  }
  if (!entry) {
    try { entry = await Queue.create({ steamId: player.steamId, status: 'waiting' }); }
    catch (err) {
      if (err.code !== 11000) throw err;
      entry = await Queue.findOne({ steamId: player.steamId });
    }
  }
  await formMatches();
  entry = await Queue.findOne({ steamId: player.steamId });
  if (entry?.status === 'matched') {
    return { status: 'matched', roomId: entry.roomId, match: await Match.findOne({ roomId: entry.roomId }).lean() };
  }
  const position = await Queue.countDocuments({ status: 'waiting', joinedAt: { $lte: entry.joinedAt } });
  const waitingCount = await Queue.countDocuments({ status: 'waiting' });
  return { status: 'waiting', position, waitingCount, requiredPlayers: ROOM_SIZE };
}

async function leave(player) {
  // Also clears a "matched" entry: it used to be impossible to leave once matched, so a
  // player whose match never finished was stuck in that room until the entry was deleted by hand.
  const result = await Queue.deleteOne({ steamId: player.steamId });
  return { left: result.deletedCount === 1 };
}

async function status(player) {
  await purgeStale();
  // Refresh updatedAt so an actively polling client is never treated as a ghost.
  await Queue.updateOne({ steamId: player.steamId, status: 'waiting' }, { $set: { roomId: null } });
  const entry = await Queue.findOne({ steamId: player.steamId }).lean();
  if (!entry) return { status: 'not_queued' };
  if (entry.status === 'matched') return { status: 'matched', roomId: entry.roomId, match: await Match.findOne({ roomId: entry.roomId }).lean() };
  const position = await Queue.countDocuments({ status: 'waiting', joinedAt: { $lte: entry.joinedAt } });
  return { status: 'waiting', position, requiredPlayers: ROOM_SIZE };
}

module.exports = { join, leave, status, ROOM_SIZE };
