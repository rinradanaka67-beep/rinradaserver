'use strict';

const gameService          = require('@services/game.service');
const MatchmakingQueue     = require('@models/matchmaking-queue.model');
const { sendError, sendSuccess } = require('@utils/response.util');

exports.checkVersion = async (req, res) => {
  try {
    const clientVersion = req.body?.clientversion;
    const playerId      = req.body?.playerId;
    const serverInfo    = await gameService.getServerInfo();
    const formatted     = gameService.formatServerInfo(serverInfo);

    if (!gameService.isServerOnline(serverInfo)) {
      return sendError(res, 503, 'Server is under maintenance', {
        serverInfo: { ...formatted, correctversion: false },
      });
    }

    if (!gameService.validateClientVersion(clientVersion, serverInfo.serverVersion)) {
      return sendError(res, 400, 'Client version mismatch. Please update your game.', {
        serverInfo: { ...formatted, correctversion: false },
      });
    }

    if (playerId) {
      // A brand-new player has no account until /authen creates it, so "not found" is fine here.
      const player = await gameService.getPlayerById(playerId);
      if (player && gameService.isPlayerBanned(player)) {
        const banStatus = gameService.getBanStatus(player);
        return sendError(res, 403, banStatus.reason || 'Your account has been banned');
      }
    }

    return sendSuccess(res, { serverInfo: formatted });
  } catch (error) {
    return sendError(res, 500, 'Internal server error');
  }
};

exports.getBan = async (req, res) => {
  try {
    const playerId = req.body?.Player?.[0]?.playerId;

    if (!playerId) {
      return sendError(res, 400, 'No player ID provided');
    }

    // Unknown players are simply not banned (getBanStatus returns the defaults for null).
    const player = await gameService.getPlayerById(playerId);
    return sendSuccess(res, { banStatus: gameService.getBanStatus(player) });
  } catch (error) {
    return sendError(res, 500, 'Internal server error');
  }
};

exports.endGameResult = async (req, res) => {
  try {
    const player = req.player;
    const { role, isWin, escapedCount } = req.body ?? {};
    let roomId = req.body?.roomId ?? req.body?.room_id ?? req.body?.matchId;
    if (!roomId) {
      // Fall back to the room this player was matched into (still verified against the match).
      const queued = await MatchmakingQueue.findOne({ steamId: player.steamId, status: 'matched' }).lean();
      roomId = queued?.roomId;
    }

    if (!roomId) {
      return sendError(res, 400, 'No active match found for this player');
    }

    let result;
    try {
      result = await gameService.applyEndGameResult(player, { role, isWin, escapedCount }, roomId);
    } catch (rewardError) {
      
      const statusCode = rewardError.statusCode ?? 500;
      return sendError(res, statusCode, rewardError.message || 'Internal server error');
    }

    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, 500, 'Internal server error');
  }
};
