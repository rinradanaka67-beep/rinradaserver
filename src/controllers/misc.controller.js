'use strict';

const staticJson = require('@utils/static-json.util');
const staticImage = require('@utils/static-image.util');
const { sendSuccess, sendError } = require('@utils/response.util');

const isProd = process.env.NODE_ENV === 'production';

exports.addIngameLog = (req, res) => {
  return sendSuccess(res, { logged: true });
};

exports.addMatchLog = (req, res) => {
  return sendSuccess(res, { logged: true });
};

exports.addErrorLog = (req, res) => {
  return sendSuccess(res, { logged: true });
};

exports.checkPenalty = (req, res) => {

  return sendSuccess(res, { hasPenalty: false, penaltyUntil: null });
};

exports.checkServerDetect = (req, res) => {

  return sendSuccess(res, { detected: false });
};

exports.getTreasureProgress = (req, res) => {
  const player = req.player;
  const progress = (player?.playerRecord && player.playerRecord.treasure) || {
    current_step: 0,
    completed: false,
    claimed_rewards: [],
  };
  return sendSuccess(res, { progress });
};

exports.getMailbox = (req, res) => {

  return sendSuccess(res, { mails: [], unreadCount: 0 });
};

const BANNER_FILE_MAP = Object.freeze({
  greedy: 'static/gacha/banner_greedy.json',
  bullet: 'static/gacha/banner_bullet.json',
});

exports.getGachaBanner = async (req, res) => {
  try {
    const bannerId = req.query?.id;
    const file = BANNER_FILE_MAP[bannerId];
    if (!file) {
      return sendError(res, 404, 'Banner not found');
    }
    const data = await staticJson.load(file);
    return res.json(data);
  } catch (error) {
    return sendError(res, 500, 'Failed to load banner');
  }
};

exports.genQr = (req, res) => {

  return sendSuccess(res, {
    qr_url: null,
    qr_text: null,
    enabled: false,
    message: 'QR service not available on this private server',
  });
};

exports.getExpRankTable = staticJson.serve('static/exprk/exprk_table.json');

exports.getBannerImage = staticImage.serveByParam('key');
