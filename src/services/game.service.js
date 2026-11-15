'use strict';

const Player     = require('@models/player.model');
const ServerInfo = require('@models/server.model');
const Match      = require('@models/match.model');
const MatchmakingQueue = require('@models/matchmaking-queue.model');
const { saveWithRetry } = require('@utils/save-retry.util');
const config = require('@config');

const SERVER_INFO_DEFAULTS = Object.freeze({
  correctversion:  true,
  serverVersion:   '1.0.6.0',
  ServerDevVersion: '1.0.6.0',
  IsOnline:        true,
  IsDevOnline:     true,
});

class GameService {
  async getServerInfo() {
    return (await ServerInfo.findOne().lean()) ?? { ...SERVER_INFO_DEFAULTS };
  }

  isServerOnline(serverInfo) {
    return Boolean(serverInfo?.IsOnline);
  }

  validateClientVersion(clientVersion, serverVersion) {
    if (!config.enforceVersion) return true;   // accept any client version
    if (!clientVersion || !serverVersion) return false;
    return clientVersion === serverVersion;
  }

  async getPlayerById(playerId) {
    // A JSON body can carry {"$ne":null} here; only plain strings may reach the query.
    if (typeof playerId !== 'string' || !playerId) return null;
    return Player.findOne({ steamId: playerId }).lean(false);
  }

  getBanStatus(player) {
    return {
      permanentBanned: player?.banStatus?.permanentBanned ?? false,
      bannedUntil:     player?.banStatus?.bannedUntil     ?? null,
      banMessageCode:  player?.banStatus?.banMessageCode  ?? 1,
      reason:          player?.banStatus?.reason          ?? '',
      updatedAt:       player?.banStatus?.updatedAt       ?? null,
    };
  }

  isPlayerBanned(player) {
    const { permanentBanned, bannedUntil } = this.getBanStatus(player);
    if (permanentBanned) return true;
    return bannedUntil ? new Date(bannedUntil) > new Date() : false;
  }

  formatServerInfo(serverInfo, clientVersion) {
    // When not enforcing, report the client's own version so the client sees "up to date".
    const echo = !config.enforceVersion && clientVersion ? String(clientVersion) : null;
    return {
      correctversion:   true,
      serverVersion:    echo ?? serverInfo.serverVersion,
      ServerDevVersion: echo ?? serverInfo.ServerDevVersion,
      IsOnline:         serverInfo.IsOnline,
      IsDevOnline:      serverInfo.IsDevOnline,
    };
  }

  /**
   * ประมวลผลจบเกม: ให้ coin ตาม role/ผลแพ้ชนะ แล้วอัปเดต playerRecord (win/lose/play count)
   *
   * กันเหรียญซ้ำด้วย roomId: ต้องมีแมตช์จริงที่ player อยู่ในนั้น, ยังไม่ปิด,
   * และยังไม่เคยรับรางวัลของแมตช์นี้มาก่อน (atomic update กัน race condition
   * กรณี client ยิง request ซ้ำพร้อมกัน)
   *
   * @param {import('@models/player.model')} player
   * @param {{ role?: 'hunter'|'survivor', isWin?: boolean, escapedCount?: number }} result
   * @param {string} roomId - roomId ของแมตช์ที่กำลังจบ (บังคับ)
   */
  async applyEndGameResult(player, result = {}, roomId) {
    const requestedRole = result.role === 'hunter' ? 'hunter' : 'survivor';
    const isWin = result.isWin === true || result.isWin === 1 || result.isWin === 'true';
    
    let role = requestedRole;
    let escapedCount = 0;

    if (!roomId) {
      const err = new Error('No active match to submit result for');
      err.statusCode = 400;
      throw err;
    }

    
    
    const claimedMatch = await Match.findOneAndUpdate(
      {
        roomId,
        status: { $ne: 'closed' },
        'players.steamId': player.steamId,
        rewardedSteamIds: { $ne: player.steamId },
      },
      { $addToSet: { rewardedSteamIds: player.steamId } },
      { new: true }
    );

    if (!claimedMatch) {
      const err = new Error('Result already submitted for this match, or match is invalid');
      err.statusCode = 409;
      throw err;
    }

    const matchPlayer = claimedMatch.players.find((entry) => entry.steamId === player.steamId);
    if (!matchPlayer) {
      await Match.updateOne({ _id: claimedMatch._id }, { $pull: { rewardedSteamIds: player.steamId } });
      const err = new Error('Player is not part of this match');
      err.statusCode = 403;
      throw err;
    }
    // The server-side match record is authoritative; do not trust the role sent by the client.
    role = matchPlayer.role;
    escapedCount = role === 'survivor'
      ? Math.max(0, Math.min(Number(result.escapedCount) || 0, 4))
      : 0;

    const BASE_COIN   = 100;
    const WIN_BONUS   = 150;
    const ESCAPE_BONUS = 20; 
    const coinReward = BASE_COIN + (isWin ? WIN_BONUS : 0) + escapedCount * ESCAPE_BONUS;

    
    
    
    
    
    let latestRecord;
    let savedPlayer;
    try {
      savedPlayer = await saveWithRetry(player, (doc) => {
        doc.coin = (doc.coin ?? 0) + coinReward;

        const record = doc.playerRecord && typeof doc.playerRecord === 'object'
          ? doc.playerRecord
          : {};
        const key = role === 'hunter' ? 'hunter' : 'survivor';
        // The template record has no play/win/lose keys: `undefined + 1` used to store NaN.
        const entry = record[key] && typeof record[key] === 'object' ? record[key] : {};
        entry.play        = (Number(entry.play)        || 0) + 1;
        entry.win         = (Number(entry.win)         || 0) + (isWin ? 1 : 0);
        entry.lose        = (Number(entry.lose)        || 0) + (isWin ? 0 : 1);
        entry.matchplayed = (Number(entry.matchplayed) || 0) + 1;
        record[key] = entry;
        doc.playerRecord = record;
        doc.markModified('playerRecord');
        latestRecord = record;
      });
    } catch (saveError) {
      // Allow a retry if persistence failed after the reward claim was reserved.
      await Match.updateOne({ _id: claimedMatch._id }, { $pull: { rewardedSteamIds: player.steamId } });
      throw saveError;
    }

    // Once every player has submitted, close the match so it does not stay open forever.
    if (claimedMatch.rewardedSteamIds.length >= claimedMatch.players.length) {
      await Match.updateOne({ _id: claimedMatch._id }, { $set: { status: 'closed' } });
    }

    await MatchmakingQueue.deleteOne({ steamId: player.steamId, status: 'matched', roomId });

    return {
      coinReward,
      totalCoin: savedPlayer.coin,
      playerRecord: latestRecord,
    };
  }
}

module.exports = new GameService();
