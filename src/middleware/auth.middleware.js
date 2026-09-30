'use strict';

const authService    = require('@services/auth.service');
const playerDataService = require('@services/player-data.service');
const { sendError }  = require('@utils/response.util');

async function verifySession(req, res, next) {
  try {
    const token = authService.extractToken(req);

    if (!token) {
      return sendError(res, 401, 'No token provided');
    }

    const player = await authService.verifyToken(token);

    if (!player) {
      return sendError(res, 401, 'Invalid or expired token');
    }

    const banCheck = playerDataService.checkBanStatus(player);
    if (banCheck.banned) {
      return sendError(res, 403, banCheck.reason);
    }

    req.player = player;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Token expired');
    }
    return sendError(res, 401, 'Invalid token');
  }
}

module.exports = { verifySession };
