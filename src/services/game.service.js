'use strict';

const Player     = require('@models/player.model');
const ServerInfo = require('@models/server.model');
const Match      = require('@models/match.model');
const { saveWithRetry } = require('@utils/save-retry.util');

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
    if (!clientVersion || !serverVersion) return false;
    return clientVersion === serverVersion;
  }

  async getPlayerById(playerId) {
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

  formatServerInfo(serverInfo) {
    return {
      correctversion:   true,
      serverVersion:    serverInfo.serverVersion,
      ServerDevVersion: serverInfo.ServerDevVersion,
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
    const role     = result.role === 'hunter' ? 'hunter' : 'survivor';
    const isWin    = Boolean(result.isWin);
    
    const escapedCount = role === 'survivor'
      ? Math.max(0, Math.min(Number(result.escapedCount) || 0, 4))
      : 0;

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

    const BASE_COIN   = 100;
    const WIN_BONUS   = 150;
    const ESCAPE_BONUS = 20; 
    const coinReward = BASE_COIN + (isWin ? WIN_BONUS : 0) + escapedCount * ESCAPE_BONUS;

    
    
    
    
    
    let latestRecord;
    const savedPlayer = await saveWithRetry(player, (doc) => {
      doc.coin = (doc.coin ?? 0) + coinReward;

      const record = doc.playerRecord && typeof doc.playerRecord === 'object'
        ? doc.playerRecord
        : {};

      const key = role === 'hunter' ? 'hunter' : 'survivor';
      record[key] = record[key] ?? { play: 0, win: 0, lose: 0 };
      record[key].play += 1;
      if (isWin) record[key].win += 1;
      else record[key].lose += 1;

      doc.playerRecord = record;
      doc.markModified('playerRecord');
      latestRecord = record;
    });

    return {
      coinReward,
      totalCoin: savedPlayer.coin,
      playerRecord: latestRecord,
    };
  }
}

module.exports = new GameService();
