'use strict';

const authService       = require('@services/auth.service');
const playerDataService = require('@services/player-data.service');
const { verifySession } = require('@middleware/auth.middleware');
const { sendError }     = require('@utils/response.util');

class AuthController {
    async authenticate(req, res) {
    try {
      const { authType, ticket, clientversion } = req.body;

      if (!ticket) {
        return sendError(res, 400, 'ticket is required');
      }
      if (authType !== 'steam') {
        return sendError(res, 400, 'Only Steam authentication is supported');
      }

      const verification = await authService.verifySteamTicket(ticket);
      if (!verification.success) {
        return sendError(res, 401, verification.error ?? 'Authentication failed');
      }

      const { steamId } = verification;
      const steamName   = await authService.getSteamPlayerName(steamId);
      const player      = await playerDataService.getOrCreatePlayerData(steamId, steamName);

      const banCheck = playerDataService.checkBanStatus(player);
      if (banCheck.banned) {
        return sendError(res, 403, banCheck.reason);
      }

      const sessionToken = authService.generateJWT(steamId);
      await playerDataService.updatePlayerSession(player, steamId, sessionToken);

      console.log(`[Auth] Player authenticated — ${steamName} (${steamId})`);

      return res.status(200).json(
        await playerDataService.prepareAuthResponse(player, steamName, sessionToken)
      );
    } catch (error) {
      return sendError(res, 500, 'Internal server error');
    }
  }
}

const authController = new AuthController();

module.exports = {
  authenticate:  authController.authenticate.bind(authController),
  verifySession,
};
