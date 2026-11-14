'use strict';

const jwt    = require('jsonwebtoken');
const axios  = require('axios');
const config = require('@config');
const Player = require('@models/player.model');

const STEAM_ID_REGEX = /^7656\d{13}$/;

class AuthService {
    generateJWT(steamId) {
    return jwt.sign(
      { steamId, type: 'session' },
      config.jwt.secret,
      { expiresIn: config.jwt.sessionExpiry }
    );
  }

    async verifyToken(token) {

    const decoded = jwt.verify(token, config.jwt.secret);

    const player = await Player.findOne({ steamId: decoded.steamId }).lean(false);
    if (!player) return null;

    if (player.session_token !== token) {
      return null;
    }

    return player;
  }

    parseSteamTicket(ticketHex) {
    try {
      const buf = Buffer.from(ticketHex, 'hex');
      for (let i = 0; i <= buf.length - 8; i++) {
        const id = buf.readBigUInt64LE(i).toString();
        if (STEAM_ID_REGEX.test(id)) return id;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

    async verifySteamTicket(ticket) {

    const parsedId = this.parseSteamTicket(ticket);

    if (!config.steam.apiKey) {
      if (parsedId) {
        return { success: true, steamId: parsedId };
      }
      return { success: false, error: 'Could not verify Steam ticket: no API key configured' };
    }

    try {
      const { data } = await axios.get(
        'https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/',
        {
          params: {
            key:   config.steam.apiKey,
            appid: config.steam.appId,
            ticket,
          },
          timeout: 10_000,
        }
      );

      const params  = data?.response?.params;
      const steamId = params?.steamid || params?.ownersteamid;

      if (steamId) return { success: true, steamId };

      const error = data?.response?.error?.errordesc || 'Steam authentication failed';
      return { success: false, error };
    } catch (err) {

      if (parsedId) {
        return { success: true, steamId: parsedId };
      }
      return { success: false, error: 'Could not verify Steam ticket' };
    }
  }

    async getSteamPlayerName(steamId) {
    if (!config.steam.apiKey) {
      return `Player_${steamId.slice(-6)}`;
    }

    try {
      const { data } = await axios.get(
        'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/',
        {
          params: { key: config.steam.apiKey, steamids: steamId },
          timeout: 10_000,
        }
      );
      return data?.response?.players?.[0]?.personaname || `Player_${steamId.slice(-6)}`;
    } catch (err) {
      return `Player_${steamId.slice(-6)}`;
    }
  }

    extractToken(req) {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) return match[1];
    }
    return req.body?.session_token || req.headers['x-access-token'] || null;
  }
}

module.exports = new AuthService();
